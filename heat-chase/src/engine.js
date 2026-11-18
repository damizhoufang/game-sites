/* =====================================================================
 * 热力追逐 · 引擎层
 * 数学工具 / WebGL 渲染器 / 网格构建器 / 粒子系统
 * 纯原生 WebGL，不依赖任何第三方库，完全离线可用
 * ===================================================================== */

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const approach = (cur, target, rate, dt) => cur + (target - cur) * Math.min(1, rate * dt);

function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function mixCol(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function shade(c, k) { return [clamp(c[0] * k, 0, 1), clamp(c[1] * k, 0, 1), clamp(c[2] * k, 0, 1)]; }

/* 可复现的伪随机数（mulberry32） */
function mulberry(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- 4x4 矩阵（列主序） ---------------- */
const M4 = {
  create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  identity(m) { m.fill(0); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  copy(o, a) { o.set(a); return o; },
  perspective(m, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    m.fill(0);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
    return m;
  },
  translate(m, x, y, z) {
    m[12] += m[0] * x + m[4] * y + m[8] * z;
    m[13] += m[1] * x + m[5] * y + m[9] * z;
    m[14] += m[2] * x + m[6] * y + m[10] * z;
    m[15] += m[3] * x + m[7] * y + m[11] * z;
    return m;
  },
  scale(m, x, y, z) {
    for (let i = 0; i < 4; i++) { m[i] *= x; m[4 + i] *= y; m[8 + i] *= z; }
    return m;
  },
  rotX(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < 4; i++) { const y = m[4 + i], z = m[8 + i]; m[4 + i] = y * c + z * s; m[8 + i] = z * c - y * s; }
    return m;
  },
  rotY(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < 4; i++) { const x = m[i], z = m[8 + i]; m[i] = x * c - z * s; m[8 + i] = x * s + z * c; }
    return m;
  },
  rotZ(m, a) {
    const c = Math.cos(a), s = Math.sin(a);
    for (let i = 0; i < 4; i++) { const x = m[i], y = m[4 + i]; m[i] = x * c + y * s; m[4 + i] = y * c - x * s; }
    return m;
  },
};

/* ---------------- 网格构建器 ----------------
 * 顶点格式：位置3 法线3 颜色3 自发光1 贴图坐标2 = 12 个浮点数
 * 贴图坐标 u<0 表示不采样贴图
 */
const VSIZE = 12;

class MeshBuilder {
  constructor() { this.d = []; this.m = null; }
  xf(m) { this.m = m; return this; }
  _v(p, n, c, e, u, v) {
    let x = p[0], y = p[1], z = p[2], nx = n[0], ny = n[1], nz = n[2];
    const m = this.m;
    if (m) {
      const X = m[0] * x + m[4] * y + m[8] * z + m[12];
      const Y = m[1] * x + m[5] * y + m[9] * z + m[13];
      const Z = m[2] * x + m[6] * y + m[10] * z + m[14];
      const NX = m[0] * nx + m[4] * ny + m[8] * nz;
      const NY = m[1] * nx + m[5] * ny + m[9] * nz;
      const NZ = m[2] * nx + m[6] * ny + m[10] * nz;
      const l = Math.hypot(NX, NY, NZ) || 1;
      x = X; y = Y; z = Z; nx = NX / l; ny = NY / l; nz = NZ / l;
    }
    this.d.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], e, u, v);
  }
  static normal(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    n[0] /= l; n[1] /= l; n[2] /= l;
    return n;
  }
  tri(a, b, c, col, e = 0) {
    const n = MeshBuilder.normal(a, b, c);
    this._v(a, n, col, e, -1, -1); this._v(b, n, col, e, -1, -1); this._v(c, n, col, e, -1, -1);
    return this;
  }
  /* a左下 b右下 c右上 d左上（从正面看），uv=[u0,v0,u1,v1]（v0 为贴图上边） */
  quad(a, b, c, d, col, e = 0, uv = null) {
    const n = MeshBuilder.normal(a, b, c);
    if (uv) {
      this._v(a, n, col, e, uv[0], uv[3]); this._v(b, n, col, e, uv[2], uv[3]); this._v(c, n, col, e, uv[2], uv[1]);
      this._v(a, n, col, e, uv[0], uv[3]); this._v(c, n, col, e, uv[2], uv[1]); this._v(d, n, col, e, uv[0], uv[1]);
    } else {
      this._v(a, n, col, e, -1, -1); this._v(b, n, col, e, -1, -1); this._v(c, n, col, e, -1, -1);
      this._v(a, n, col, e, -1, -1); this._v(c, n, col, e, -1, -1); this._v(d, n, col, e, -1, -1);
    }
    return this;
  }
  box(x0, y0, z0, x1, y1, z1, col, e = 0) {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, e);   // +z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, e);   // -z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, e);   // +x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, e);   // -x
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col, e);   // +y
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], col, e);   // -y
    return this;
  }
  /* 朝 +z 的贴花 */
  decalZ(x0, y0, x1, y1, z, uv, col, e = 0) {
    return this.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], col, e, uv);
  }
  /* 朝 -z 的贴花 */
  decalZn(x0, y0, x1, y1, z, uv, col, e = 0) {
    return this.quad([x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], col, e, uv);
  }
  /* 朝 ±x 的贴花，zA > zB */
  decalX(x, dir, zA, zB, y0, y1, uv, col, e = 0) {
    if (dir > 0) return this.quad([x, y0, zA], [x, y0, zB], [x, y1, zB], [x, y1, zA], col, e, uv);
    return this.quad([x, y0, zB], [x, y0, zA], [x, y1, zA], [x, y1, zB], col, e, uv);
  }
  /* 朝上的贴花：从 +y 往下看，近端(z大)在下 */
  decalY(x0, z0, x1, z1, y, uv, col, e = 0) {
    return this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], col, e, uv);
  }
  ellipsoid(cx, cy, cz, rx, ry, rz, col, e = 0, seg = 12, rings = 8) {
    const P = (i, j) => {
      const th = (i / rings) * Math.PI, ph = (j / seg) * TAU;
      const sx = Math.sin(th) * Math.cos(ph), sy = Math.cos(th), sz = Math.sin(th) * Math.sin(ph);
      const n = [sx / rx, sy / ry, sz / rz];
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      return { p: [cx + sx * rx, cy + sy * ry, cz + sz * rz], n: [n[0] / l, n[1] / l, n[2] / l] };
    };
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        if (i > 0) { this._v(a.p, a.n, col, e, -1, -1); this._v(d.p, d.n, col, e, -1, -1); this._v(c.p, c.n, col, e, -1, -1); }
        if (i < rings - 1) { this._v(a.p, a.n, col, e, -1, -1); this._v(c.p, c.n, col, e, -1, -1); this._v(b.p, b.n, col, e, -1, -1); }
      }
    }
    return this;
  }
  /* 沿 y 轴的圆柱 / 圆台 / 圆锥 */
  cyl(cx, y0, cz, r0, y1, r1, col, e = 0, seg = 12, caps = true) {
    const slope = (r0 - r1) / Math.max(1e-6, (y1 - y0));
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * TAU, a1 = ((j + 1) / seg) * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const nl = Math.hypot(1, slope);
      const n0 = [c0 / nl, slope / nl, s0 / nl], n1 = [c1 / nl, slope / nl, s1 / nl];
      const A = [cx + c0 * r0, y0, cz + s0 * r0], B = [cx + c1 * r0, y0, cz + s1 * r0];
      const C = [cx + c1 * r1, y1, cz + s1 * r1], D = [cx + c0 * r1, y1, cz + s0 * r1];
      this._v(A, n0, col, e, -1, -1); this._v(C, n1, col, e, -1, -1); this._v(B, n1, col, e, -1, -1);
      if (r1 > 1e-5) { this._v(A, n0, col, e, -1, -1); this._v(D, n0, col, e, -1, -1); this._v(C, n1, col, e, -1, -1); }
      if (caps) {
        if (r1 > 1e-5) { const n = [0, 1, 0]; this._v([cx, y1, cz], n, col, e, -1, -1); this._v(D, n, col, e, -1, -1); this._v(C, n, col, e, -1, -1); }
        if (r0 > 1e-5) { const n = [0, -1, 0]; this._v([cx, y0, cz], n, col, e, -1, -1); this._v(B, n, col, e, -1, -1); this._v(A, n, col, e, -1, -1); }
      }
    }
    return this;
  }
  /* 水平圆盘（朝上） */
  disc(cx, y, cz, r, col, e = 0, seg = 16) {
    const n = [0, 1, 0];
    for (let j = 0; j < seg; j++) {
      const a0 = (j / seg) * TAU, a1 = ((j + 1) / seg) * TAU;
      this._v([cx, y, cz], n, col, e, -1, -1);
      this._v([cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], n, col, e, -1, -1);
      this._v([cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], n, col, e, -1, -1);
    }
    return this;
  }
  build(gl) {
    const data = new Float32Array(this.d);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return { vbo, count: data.length / VSIZE };
  }
}

/* ---------------- 着色器 ---------------- */
const SH_MAIN_VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute float aEmi; attribute vec2 aUV;
uniform mat4 uProj; uniform mat4 uView; uniform mat4 uModel;
uniform vec3 uLight; uniform vec3 uAmb; uniform vec3 uSun;
uniform vec2 uCurve; uniform vec2 uFog;
varying vec3 vCol; varying vec3 vLit; varying float vFog; varying float vEmi; varying vec2 vUV;
void main(){
  vec4 wp = uModel * vec4(aPos, 1.0);
  vec4 vp = uView * wp;
  float d = vp.z;
  vp.y -= uCurve.y * d * d;
  vp.x += uCurve.x * d * d;
  gl_Position = uProj * vp;
  vec3 n = normalize((uModel * vec4(aNor, 0.0)).xyz);
  float df = max(dot(n, uLight), 0.0);
  vLit = uAmb * (0.62 + 0.38 * n.y) + uSun * df;
  vFog = clamp((-d - uFog.x) * uFog.y, 0.0, 1.0);
  vCol = aCol; vEmi = aEmi; vUV = aUV;
}`;
const SH_MAIN_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex; uniform vec3 uFogCol; uniform vec4 uTint; uniform float uAlpha;
varying vec3 vCol; varying vec3 vLit; varying float vFog; varying float vEmi; varying vec2 vUV;
void main(){
  vec3 c = vCol;
  float e = vEmi;
  if (vUV.x >= 0.0) {
    vec4 t = texture2D(uTex, vUV);
    if (e > 1.5) { if (t.a < 0.5) discard; e -= 2.0; c = t.rgb; }   // 镂空贴花：自发光值 +2 表示透明处不绘制
    else { c = mix(c, t.rgb, t.a); e *= t.a; }
  }
  vec3 lit = c * mix(vLit, vec3(1.0), e);
  lit = mix(lit, uTint.rgb, uTint.a);
  lit = mix(lit, uFogCol, vFog * (1.0 - 0.45 * e));
  gl_FragColor = vec4(lit, uAlpha);
}`;
const SH_SKY_VS = `
attribute vec2 aP; varying vec2 vP;
void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const SH_SKY_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunCol; uniform vec2 uSunPos;
uniform float uHorY; uniform float uStars; uniform float uAurora; uniform float uTime; uniform float uAspect;
varying vec2 vP;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  float t = clamp((vP.y - uHorY) / (1.001 - uHorY), 0.0, 1.0);
  vec3 c = mix(uHor, uTop, pow(t, 0.65));
  vec2 q = vec2((vP.x - uSunPos.x) * uAspect, vP.y - uSunPos.y);
  float d = length(q);
  float sr = 0.095 * clamp(uAspect * 1.25, 0.6, 1.0);
  c += uSunCol * (smoothstep(sr, sr * 0.92, d) * 0.9 + 0.4 * exp(-d * d * 0.07 / (sr * sr)));
  if (uStars > 0.0) {
    vec2 g = floor(vec2(vP.x * uAspect, vP.y) * 70.0);
    float h = hash(g);
    c += uStars * step(0.985, h) * t * (0.55 + 0.45 * sin(uTime * 2.0 + h * 90.0));
  }
  if (uAurora > 0.0) {
    float a = sin(vP.x * 3.0 + uTime * 0.3 + sin(vP.y * 5.0 + uTime * 0.2) * 1.5) * 0.5 + 0.5;
    float band = smoothstep(0.2, 0.55, t) * smoothstep(1.0, 0.6, t);
    c += uAurora * vec3(0.1, 0.9, 0.6) * a * a * band * 0.8;
  }
  if (vP.y < uHorY) c = uHor;
  gl_FragColor = vec4(c, 1.0);
}`;
const SH_PT_VS = `
attribute vec3 aC; attribute vec2 aQ; attribute float aS; attribute vec4 aCol; attribute float aAdd;
uniform mat4 uProj; uniform mat4 uView; uniform vec2 uCurve;
varying vec2 vQ; varying vec4 vCol; varying float vAdd;
void main(){
  vec4 vp = uView * vec4(aC, 1.0);
  float d = vp.z;
  vp.y -= uCurve.y * d * d; vp.x += uCurve.x * d * d;
  vp.xy += aQ * aS;
  gl_Position = uProj * vp;
  vQ = aQ; vCol = aCol; vAdd = aAdd;
}`;
const SH_PT_FS = `
precision mediump float;
varying vec2 vQ; varying vec4 vCol; varying float vAdd;
void main(){
  float a = smoothstep(1.0, 0.25, length(vQ)) * vCol.a;
  gl_FragColor = vec4(vCol.rgb * a, a * (1.0 - vAdd));
}`;

/* ---------------- 渲染器 ---------------- */
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const opts = { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('WebGL 不可用');
    this.gl = gl;
    this.main = this._prog(SH_MAIN_VS, SH_MAIN_FS,
      ['aPos', 'aNor', 'aCol', 'aEmi', 'aUV'],
      ['uProj', 'uView', 'uModel', 'uLight', 'uAmb', 'uSun', 'uCurve', 'uFog', 'uTex', 'uFogCol', 'uTint', 'uAlpha']);
    this.skyP = this._prog(SH_SKY_VS, SH_SKY_FS, ['aP'],
      ['uTop', 'uHor', 'uSunCol', 'uSunPos', 'uHorY', 'uStars', 'uAurora', 'uTime', 'uAspect']);
    this.ptP = this._prog(SH_PT_VS, SH_PT_FS, ['aC', 'aQ', 'aS', 'aCol', 'aAdd'], ['uProj', 'uView', 'uCurve']);
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    this.PT_MAX = 420;
    this.ptData = new Float32Array(this.PT_MAX * 6 * 11);
    this.ptBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ptBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.ptData.byteLength, gl.DYNAMIC_DRAW);
    this.proj = M4.create(); this.view = M4.create();
    this.tex = null;
    this.env = {
      light: [0.36, 0.78, 0.5], amb: [0.6, 0.6, 0.6], sun: [0.7, 0.7, 0.7],
      fogCol: [0.5, 0.5, 0.5], fogNear: 50, fogFar: 120, curve: [0, 0],
    };
    this._noTint = [0, 0, 0, 0];
    this.drawCalls = 0;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
  }
  _prog(vs, fs, attrs, unis) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('着色器编译失败: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('着色器链接失败: ' + gl.getProgramInfoLog(p));
    const u = {};
    unis.forEach((n) => { u[n] = gl.getUniformLocation(p, n); });
    return { p, u, na: attrs.length };
  }
  setTexture(canvas) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    this.tex = t;
  }
  resize(cssW, cssH, dpr) {
    const w = Math.max(2, Math.round(cssW * dpr)), h = Math.max(2, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.w = w; this.h = h; this.aspect = w / h;
  }
  _attribs(n) {
    const gl = this.gl;
    for (let i = 0; i < 6; i++) { if (i < n) gl.enableVertexAttribArray(i); else gl.disableVertexAttribArray(i); }
  }
  frameStart() {
    const gl = this.gl;
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(this.env.fogCol[0], this.env.fogCol[1], this.env.fogCol[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawCalls = 0;
  }
  sky(s) {
    const gl = this.gl, P = this.skyP;
    gl.useProgram(P.p);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    this._attribs(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(P.u.uTop, s.top); gl.uniform3fv(P.u.uHor, s.hor); gl.uniform3fv(P.u.uSunCol, s.sunCol);
    gl.uniform2f(P.u.uSunPos, s.sunPos[0], s.sunPos[1]);
    gl.uniform1f(P.u.uHorY, s.horY); gl.uniform1f(P.u.uStars, s.stars); gl.uniform1f(P.u.uAurora, s.aurora);
    gl.uniform1f(P.u.uTime, s.time); gl.uniform1f(P.u.uAspect, this.aspect);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  }
  /* 开始绘制不透明/半透明网格；overrides 可覆盖雾和弯曲（用于第一人称手部模型） */
  begin(proj, view, ov) {
    const gl = this.gl, P = this.main, e = this.env;
    gl.useProgram(P.p);
    this._attribs(5);
    gl.uniformMatrix4fv(P.u.uProj, false, proj);
    gl.uniformMatrix4fv(P.u.uView, false, view);
    gl.uniform3fv(P.u.uLight, e.light); gl.uniform3fv(P.u.uAmb, e.amb); gl.uniform3fv(P.u.uSun, e.sun);
    gl.uniform3fv(P.u.uFogCol, e.fogCol);
    if (ov && ov.noFog) { gl.uniform2f(P.u.uFog, 1e6, 0); gl.uniform2f(P.u.uCurve, 0, 0); }
    else { gl.uniform2f(P.u.uFog, e.fogNear, 1 / (e.fogFar - e.fogNear)); gl.uniform2f(P.u.uCurve, e.curve[0], e.curve[1]); }
    gl.uniform4fv(P.u.uTint, this._noTint);
    gl.uniform1f(P.u.uAlpha, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(P.u.uTex, 0);
    this._blend = false; this._tinted = false;
    gl.disable(gl.BLEND);
  }
  draw(mesh, model, alpha, tint) {
    const gl = this.gl, P = this.main;
    if (alpha === undefined) alpha = 1;
    const blend = alpha < 0.999;
    if (blend !== this._blend) {
      this._blend = blend;
      if (blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
      else { gl.disable(gl.BLEND); gl.depthMask(true); }
    }
    gl.uniform1f(P.u.uAlpha, alpha);
    if (tint) { gl.uniform4fv(P.u.uTint, tint); this._tinted = true; }
    else if (this._tinted) { gl.uniform4fv(P.u.uTint, this._noTint); this._tinted = false; }
    gl.uniformMatrix4fv(P.u.uModel, false, model);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    const st = VSIZE * 4;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, st, 12);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, st, 24);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, st, 36);
    gl.vertexAttribPointer(4, 2, gl.FLOAT, false, st, 40);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    this.drawCalls++;
  }
  end() {
    const gl = this.gl;
    gl.disable(gl.BLEND); gl.depthMask(true);
  }
  clearDepth() { this.gl.clear(this.gl.DEPTH_BUFFER_BIT); }
  particles(ps, proj, view) {
    const n = Math.min(ps.count, this.PT_MAX);
    if (!n) return;
    const gl = this.gl, P = this.ptP, d = this.ptData;
    const Q = [-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1];
    let o = 0;
    for (let i = 0; i < n; i++) {
      const p = ps.list[i];
      const k = p.life / p.max;
      const a = p.a * (p.fade ? Math.min(1, k * 2.2) : 1);
      const s = p.size * (p.grow ? (1 + (1 - k) * p.grow) : 1);
      for (let v = 0; v < 6; v++) {
        d[o++] = p.x; d[o++] = p.y; d[o++] = p.z;
        d[o++] = Q[v * 2]; d[o++] = Q[v * 2 + 1];
        d[o++] = s;
        d[o++] = p.r; d[o++] = p.g; d[o++] = p.b; d[o++] = a;
        d[o++] = p.add;
      }
    }
    gl.useProgram(P.p);
    this._attribs(5);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ptBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d.subarray(0, o));
    const st = 11 * 4;
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, st, 12);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, st, 20);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, st, 24);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, st, 40);
    gl.uniformMatrix4fv(P.u.uProj, false, proj);
    gl.uniformMatrix4fv(P.u.uView, false, view);
    gl.uniform2f(P.u.uCurve, this.env.curve[0], this.env.curve[1]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, n * 6);
    gl.disable(gl.BLEND); gl.depthMask(true);
  }
}

/* ---------------- 粒子系统（对象池） ---------------- */
class Particles {
  constructor(max) {
    this.max = max; this.count = 0; this.list = [];
    for (let i = 0; i < max; i++) this.list.push({});
  }
  clear() { this.count = 0; }
  /* o: x,y,z,vx,vy,vz,life,size,col[3],a,add(1加色/0普通),grav,drag,fade,grow,scroll(是否随世界后退) */
  spawn(o) {
    if (this.count >= this.max) return null;
    const p = this.list[this.count++];
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = p.max = o.life || 0.5;
    p.size = o.size || 0.2;
    const c = o.col || [1, 1, 1];
    p.r = c[0]; p.g = c[1]; p.b = c[2];
    p.a = o.a === undefined ? 1 : o.a;
    p.add = o.add === undefined ? 1 : o.add;
    p.grav = o.grav || 0; p.drag = o.drag || 0;
    p.fade = o.fade === undefined ? 1 : o.fade;
    p.grow = o.grow || 0;
    p.scroll = o.scroll === undefined ? 1 : o.scroll;
    return p;
  }
  update(dt, scroll) {
    for (let i = this.count - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        const last = this.list[--this.count];
        this.list[this.count] = p; this.list[i] = last;
        continue;
      }
      p.vy -= p.grav * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += (p.vz + (p.scroll ? scroll : 0)) * dt;
    }
  }
}
