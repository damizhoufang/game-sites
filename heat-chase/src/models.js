/* =====================================================================
 * 热力追逐 · 模型与贴图
 * 所有美术资源都由代码生成：涂鸦贴图图集 + 低多边形模型
 * ===================================================================== */

const LANE_W = 2.4;                 // 轨道间距
const laneX = (l) => (l - 1) * LANE_W;
const CH = 20;                      // 地面分块长度
const CAR_LEN = 14;                 // 每节车厢占用长度（含车钩间隙）
const CAR_BODY = 13.6;
const ROOF_H = 3.0;                 // 车顶高度
const RAMP_LEN = 7;                 // 上车顶的斜坡长度

const FONT = '"Arial Black", Impact, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';

/* ---------------- 贴图图集 ---------------- */
function makeAtlas() {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const UV = {};
  const reg = (name, x, y, w, h) => { UV[name] = [(x + 2) / S, (y + 2) / S, (x + w - 2) / S, (y + h - 2) / S]; };
  const cell = (name, x, y, w, h, fn) => {
    reg(name, x, y, w, h);
    g.save(); g.beginPath(); g.rect(x + 1, y + 1, w - 2, h - 2); g.clip(); g.translate(x, y);
    fn(w, h);
    g.restore();
  };
  const rr = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  };
  const rnd = mulberry(20261112);

  /* 喷漆字：粗描边 + 渐变填充 + 高光 + 流挂 */
  const sprayText = (text, cx, cy, maxW, fs, c1, c2, edge, rot) => {
    g.save();
    g.translate(cx, cy); g.rotate(rot || 0);
    g.font = `italic 900 ${fs}px ${FONT}`;
    const m = g.measureText(text).width;
    if (m > maxW) { fs *= maxW / m; g.font = `italic 900 ${fs}px ${FONT}`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.strokeStyle = '#0b0b14'; g.lineWidth = fs * 0.3; g.strokeText(text, 0, 0);
    g.strokeStyle = edge; g.lineWidth = fs * 0.15; g.strokeText(text, 0, 0);
    const gr = g.createLinearGradient(0, -fs * 0.5, 0, fs * 0.5);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.fillText(text, 0, 0);
    g.globalAlpha = 0.5; g.fillStyle = '#ffffff';
    g.font = `italic 900 ${fs}px ${FONT}`;
    g.save(); g.beginPath(); g.rect(-maxW, -fs * 0.5, maxW * 2, fs * 0.3); g.clip(); g.fillText(text, 0, 0); g.restore();
    g.globalAlpha = 1;
    g.restore();
  };
  const splat = (w, h, cols, n) => {
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[(rnd() * cols.length) | 0];
      g.globalAlpha = 0.5 + rnd() * 0.4;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 7, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  };
  const drips = (x0, x1, y, col, n) => {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = lerp(x0, x1, rnd()), l = 8 + rnd() * 26, w = 3 + rnd() * 4;
      rr(x, y, w, l, w / 2); g.fill();
    }
  };

  /* 四个小涂鸦标签 256x160 */
  const tags = [
    ['热力', '#ffe14a', '#ff5a1f', '#ffffff'],
    ['CHASE', '#5ef2ff', '#2f6bff', '#ffffff'],
    ['酷企鹅', '#baff5a', '#11b86a', '#fffbe0'],
    ['快跑!', '#ff8bd1', '#d6249f', '#fff0fb'],
  ];
  tags.forEach((t, i) => cell('tag' + i, i * 256, 0, 256, 160, (w, h) => {
    splat(w, h, [t[1], t[2], '#ffffff'], 14);
    drips(40, w - 40, h * 0.62, t[2], 5);
    sprayText(t[0], w / 2, h * 0.5, w * 0.8, h * 0.56, t[1], t[2], t[3], -0.07 + i * 0.03);
  }));

  /* 列车侧窗条 512x160 */
  cell('win', 0, 160, 512, 160, (w, h) => {
    const lit = [1, 0, 1, 1, 0, 1];
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 83;
      if (i === 2) {           // 车门
        g.fillStyle = 'rgba(10,10,20,.55)'; rr(x + 4, 6, 64, h - 12, 6); g.fill();
        g.fillStyle = '#20304f'; rr(x + 12, 18, 22, 62, 4); g.fill(); rr(x + 38, 18, 22, 62, 4); g.fill();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + 35, 8, 2, h - 16);
        continue;
      }
      g.fillStyle = '#0d0f1c'; rr(x, 22, 72, 92, 12); g.fill();
      const gr = g.createLinearGradient(0, 28, 0, 108);
      if (lit[i]) { gr.addColorStop(0, '#fff1b8'); gr.addColorStop(1, '#ffb85c'); }
      else { gr.addColorStop(0, '#31466f'); gr.addColorStop(1, '#16203a'); }
      g.fillStyle = gr; rr(x + 5, 27, 62, 82, 9); g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)';
      g.beginPath(); g.moveTo(x + 12, 104); g.lineTo(x + 34, 30); g.lineTo(x + 46, 30); g.lineTo(x + 24, 104); g.fill();
    }
  });

  /* 游戏标志牌 512x160 */
  cell('logo', 512, 160, 512, 160, (w, h) => {
    g.fillStyle = '#120a22'; rr(4, 4, w - 8, h - 8, 18); g.fill();
    g.strokeStyle = '#ff5a1f'; g.lineWidth = 5; rr(9, 9, w - 18, h - 18, 14); g.stroke();
    sprayText('热力追逐', w / 2, h * 0.52, w * 0.82, h * 0.6, '#fff06a', '#ff4d2e', '#ffffff', -0.03);
  });

  /* 列车车头 256x256 */
  cell('front', 0, 320, 256, 256, (w, h) => {
    g.fillStyle = '#05060c'; rr(66, 10, 124, 30, 6); g.fill();
    g.font = `900 21px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ff9a2e'; g.fillText('热力线 07', 128, 26);
    g.fillStyle = '#0b0d18'; rr(20, 48, 216, 108, 16); g.fill();
    const gr = g.createLinearGradient(0, 54, 0, 150);
    gr.addColorStop(0, '#5b7fb8'); gr.addColorStop(1, '#17233f');
    g.fillStyle = gr; rr(27, 54, 202, 96, 12); g.fill();
    g.fillStyle = 'rgba(255,255,255,.2)';
    g.beginPath(); g.moveTo(44, 150); g.lineTo(92, 54); g.lineTo(124, 54); g.lineTo(76, 150); g.fill();
    g.fillStyle = '#0b0d18'; g.fillRect(126, 54, 4, 96);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
    g.strokeRect(96, 166, 64, 82);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(14, 162, 228, 5);
  });

  /* 楼房窗户 256x256 x2 */
  const bwin = (name, x, y, seed) => cell(name, x, y, 256, 256, (w, h) => {
    const r = mulberry(seed);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const X = 14 + i * 60, Y = 14 + j * 60, v = r();
      g.fillStyle = 'rgba(10,8,20,.55)'; g.fillRect(X - 3, Y - 3, 52, 52);
      g.fillStyle = v < 0.34 ? '#ffd27a' : v < 0.46 ? '#fff0c2' : v < 0.54 ? '#8fd6ff' : '#201c38';
      g.fillRect(X, Y, 46, 46);
      g.fillStyle = 'rgba(10,8,20,.6)'; g.fillRect(X + 21, Y, 3, 46); g.fillRect(X, Y + 21, 46, 3);
    }
  });
  bwin('bwinA', 256, 320, 11);
  bwin('bwinB', 512, 320, 29);

  /* 霓虹海报 256x256 */
  cell('poster', 768, 320, 256, 256, (w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#2b0f5c'); gr.addColorStop(1, '#0a2a5c');
    g.fillStyle = gr; rr(4, 4, w - 8, h - 8, 12); g.fill();
    g.strokeStyle = '#5ef2ff'; g.lineWidth = 6; rr(12, 12, w - 24, h - 24, 10); g.stroke();
    paintPenguin(g, w / 2, h * 0.5, 0.95);
    g.font = `italic 900 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ff5ad1'; g.fillText('别停下!', w / 2, h - 38);
  });

  /* 警示条纹 256x128 */
  cell('hazard', 0, 576, 256, 128, (w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8322c';
    for (let x = -h; x < w + h; x += 64) {
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.lineTo(x + h + 32, 0); g.lineTo(x + 32, h); g.fill();
    }
  });
  const arrow = (name, x, y, down, bg) => cell(name, x, y, 128, 128, (w, h) => {
    g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 56, 0, TAU); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 52, 0, TAU); g.stroke();
    g.save(); g.translate(64, 64); if (down) g.rotate(Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -36); g.lineTo(30, -2); g.lineTo(12, -2); g.lineTo(12, 34); g.lineTo(-12, 34); g.lineTo(-12, -2); g.lineTo(-30, -2); g.closePath(); g.fill();
    g.restore();
  });
  arrow('arrowDown', 256, 576, true, '#1f6fff');
  arrow('arrowUp', 384, 576, false, '#16b36b');
  cell('star', 512, 576, 128, 128, (w, h) => {
    g.strokeStyle = '#b86e00'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 54, 0, TAU); g.stroke();
    g.fillStyle = '#fff3a8'; g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 10, r = i % 2 ? 19 : 44;
      g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
    }
    g.closePath(); g.fill();
  });
  cell('x2', 640, 576, 128, 128, (w, h) => {
    g.font = `italic 900 76px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.strokeStyle = '#3a0a66'; g.lineWidth = 14; g.strokeText('×2', 62, 66);
    g.fillStyle = '#ffffff'; g.fillText('×2', 62, 66);
  });
  cell('chevron', 768, 576, 128, 128, (w, h) => {
    g.fillStyle = '#f5b82e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#2a2433'; g.lineWidth = 16; g.lineJoin = 'miter';
    for (let y = 120; y > -40; y -= 56) { g.beginPath(); g.moveTo(14, y); g.lineTo(64, y - 40); g.lineTo(114, y); g.stroke(); }
  });
  cell('emblem', 896, 576, 128, 128, (w, h) => {
    g.fillStyle = '#ffcf3a'; rr(34, 30, 60, 68, 10); g.fill();
    g.fillStyle = '#5a3200'; g.beginPath(); g.arc(64, 56, 11, 0, TAU); g.fill(); g.fillRect(59, 58, 10, 26);
  });

  /* 两幅大壁画 512x320 */
  cell('mural0', 0, 704, 512, 320, (w, h) => {
    splat(w, h, ['#ff5a1f', '#ffe14a', '#5ef2ff', '#ff5ad1'], 46);
    g.fillStyle = '#ff7a2e';
    for (let i = 0; i < 7; i++) {          // 火焰底
      const x = 40 + i * 66, t = 70 + rnd() * 60;
      g.beginPath(); g.moveTo(x - 46, h - 30); g.quadraticCurveTo(x - 30, t + 60, x, t); g.quadraticCurveTo(x + 34, t + 70, x + 46, h - 30); g.fill();
    }
    g.fillStyle = '#ffd23a';
    for (let i = 0; i < 6; i++) {
      const x = 70 + i * 72, t = 150 + rnd() * 40;
      g.beginPath(); g.moveTo(x - 30, h - 30); g.quadraticCurveTo(x - 14, t + 40, x, t); g.quadraticCurveTo(x + 20, t + 46, x + 30, h - 30); g.fill();
    }
    drips(30, w - 30, h - 34, '#ff7a2e', 12);
    sprayText('热力追逐', w / 2, h * 0.47, w * 0.9, 150, '#ffffff', '#ffe14a', '#ff2e63', -0.06);
  });
  cell('mural1', 512, 704, 512, 320, (w, h) => {
    splat(w, h, ['#5ef2ff', '#baff5a', '#ffffff'], 40);
    g.fillStyle = '#2f6bff'; g.beginPath(); g.ellipse(150, 160, 130, 126, 0, 0, TAU); g.fill();
    g.fillStyle = '#5ef2ff'; g.beginPath(); g.ellipse(150, 160, 112, 108, 0, 0, TAU); g.fill();
    paintPenguin(g, 150, 168, 1.5);
    sprayText('COOL', 366, 112, 250, 110, '#baff5a', '#11b86a', '#ffffff', -0.1);
    sprayText('不服来追', 366, 226, 250, 78, '#ff8bd1', '#d6249f', '#ffffff', 0.04);
    drips(250, 480, 262, '#d6249f', 6);
  });

  return { canvas: cv, UV };
}

/* 平面企鹅涂鸦（用于贴图和图标） */
function paintPenguin(g, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.fillStyle = '#141a2b'; g.beginPath(); g.ellipse(0, 10, 50, 62, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, -44, 40, 36, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(-52, 12, 12, 34, 0.5, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(52, 12, 12, 34, -0.5, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 18, 36, 48, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(0, -40, 30, 25, 0, 0, TAU); g.fill();
  g.fillStyle = '#ff3b5c'; g.fillRect(-36, -18, 72, 14); g.fillRect(16, -10, 14, 34);
  g.fillStyle = '#ffb000'; g.beginPath(); g.ellipse(0, -66, 38, 20, 0, Math.PI, TAU); g.fill();
  g.fillStyle = '#141a2b'; g.beginPath(); g.arc(-13, -46, 5, 0, TAU); g.fill(); g.beginPath(); g.arc(13, -46, 5, 0, TAU); g.fill();
  g.fillStyle = '#ff9a1f'; g.beginPath(); g.moveTo(-10, -36); g.lineTo(10, -36); g.lineTo(0, -24); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(-20, 72, 18, 8, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(20, 72, 18, 8, 0, 0, TAU); g.fill();
  g.restore();
}

/* 企鹅皮肤配色 */
const SKINS = [
  { id: 'street', name: '街头红', price: 0, scarf: '#ff3b5c', cap: '#ffb000', pack: '#2d6cdf' },
  { id: 'polar', name: '极地蓝', price: 300, scarf: '#35c9ff', cap: '#ffffff', pack: '#ff7a2e' },
  { id: 'neon', name: '荧光绿', price: 800, scarf: '#9dff3a', cap: '#ff3bd4', pack: '#22233a' },
  { id: 'gold', name: '黄金传说', price: 2000, scarf: '#ffd23a', cap: '#ffd23a', pack: '#8a2be2' },
];

const TRAIN_COLS = ['#e2483d', '#1fa39c', '#f0a92c', '#7558d6', '#3d7be0'];

function uvSub(uv, fx0, fy0, fx1, fy1) {
  return [lerp(uv[0], uv[2], fx0), lerp(uv[1], uv[3], fy0), lerp(uv[0], uv[2], fx1), lerp(uv[1], uv[3], fy1)];
}

/* ---------------- 模型 ---------------- */
function buildModels(gl, UV) {
  const MD = {};
  const mk = (fn) => { const b = new MeshBuilder(); fn(b); return b.build(gl); };
  const C = {
    navy: hex('#2a3352'), white: hex('#f7f9ff'), orange: hex('#ff9a1f'), black: hex('#0c0d14'), pink: hex('#ff9db0'),
    steel: hex('#9aa3b5'), dark: hex('#22222c'), wood: hex('#3d2f2a'), gold: hex('#ffc928'), red: hex('#e8322c'),
  };

  /* ---- 地面分块（三种场景主题） ---- */
  const groundThemes = [
    { ballast: '#54465a', side: '#41374b', sideY: 0.0, curb: '#7d7385', rail: '#a7afc2', sleeper: '#33272b' },
    { ballast: '#262338', side: '#3d3856', sideY: 1.0, curb: '#f2c14e', rail: '#b6c0d6', sleeper: '#15131f' },
    { ballast: '#aec4e2', side: '#e3eefb', sideY: 0.3, curb: '#ffffff', rail: '#8794ad', sleeper: '#5b6f8e' },
  ];
  MD.ground = groundThemes.map((t) => mk((b) => {
    const bal = hex(t.ballast), side = hex(t.side), rail = hex(t.rail), sl = hex(t.sleeper), curb = hex(t.curb);
    b.quad([-4.6, 0, 0], [4.6, 0, 0], [4.6, 0, -CH], [-4.6, 0, -CH], bal);
    for (let l = 0; l < 3; l++) {
      const lx = laneX(l);
      for (let z = -0.5; z > -CH; z -= 1) {
        b.quad([lx - 0.95, 0.05, z + 0.17], [lx + 0.95, 0.05, z + 0.17], [lx + 0.95, 0.05, z - 0.17], [lx - 0.95, 0.05, z - 0.17], sl);
        b.quad([lx - 0.95, 0, z + 0.17], [lx + 0.95, 0, z + 0.17], [lx + 0.95, 0.05, z + 0.17], [lx - 0.95, 0.05, z + 0.17], shade(sl, 0.8));
      }
      for (const s of [-1, 1]) {
        const x = lx + s * 0.57;
        b.quad([x - 0.055, 0.14, 0], [x + 0.055, 0.14, 0], [x + 0.055, 0.14, -CH], [x - 0.055, 0.14, -CH], rail, 0.1);
        b.quad([x - 0.055, 0, 0], [x - 0.055, 0.14, 0], [x - 0.055, 0.14, -CH], [x - 0.055, 0, -CH], shade(rail, 0.6));
        b.quad([x + 0.055, 0, -CH], [x + 0.055, 0.14, -CH], [x + 0.055, 0.14, 0], [x + 0.055, 0, 0], shade(rail, 0.6));
      }
    }
    for (const s of [-1, 1]) {
      const xa = s > 0 ? 4.6 : -80, xb = s > 0 ? 80 : -4.6;
      b.quad([xa, t.sideY, 0], [xb, t.sideY, 0], [xb, t.sideY, -CH], [xa, t.sideY, -CH], side);
      if (t.sideY > 0) {
        const x0 = s > 0 ? 4.6 : -4.6;
        b.decalX(x0, -s, 0, -CH, 0, t.sideY, null, shade(side, 0.7));
        b.box(Math.min(x0, x0 + s * 0.22), t.sideY, -CH, Math.max(x0, x0 + s * 0.22), t.sideY + 0.025, 0, curb, t.sideY > 0.5 ? 0.6 : 0);
      } else {
        b.box(s > 0 ? 4.42 : -4.6, 0, -CH, s > 0 ? 4.6 : -4.42, 0.2, 0, curb);
      }
    }
  }));

  /* ---- 列车 ---- */
  const buildTrain = (colHex, tagUV, moving, tagZ) => mk((b) => {
    const col = hex(colHex), L = CAR_BODY, W = 1.05, Y0 = 0.5, Y1 = 2.78, RH = ROOF_H;
    const roof = mixCol(col, [0.82, 0.84, 0.9], 0.72);
    b.box(-0.92, 0.14, -L + 0.3, 0.92, Y0, -0.3, C.dark);
    for (const z of [-2.2, -L + 2.2]) b.box(-1.0, 0, z - 1.0, 1.0, 0.42, z + 1.0, hex('#15151c'));
    b.box(-W, Y0, -L, W, Y1, 0, col);
    b.box(-W + 0.06, Y1, -L + 0.08, W - 0.06, RH, -0.08, roof);
    for (let z = -1.6; z > -L + 1; z -= 3) b.box(-W + 0.12, RH, z - 0.07, W - 0.12, RH + 0.03, z + 0.07, shade(roof, 0.82));
    b.box(-W - 0.012, 1.08, -L - 0.008, W + 0.012, 1.2, 0.008, hex('#f4f1e6'));
    for (const s of [-1, 1]) {
      const x = s * (W + 0.016);
      b.decalX(x, s, -0.5, -L / 2, 1.34, 2.56, UV.win, col, 0.55);
      b.decalX(x, s, -L / 2, -L + 0.5, 1.34, 2.56, UV.win, col, 0.55);
      if (tagUV) {
        const zc = tagZ !== undefined ? tagZ : (s > 0 ? -4.2 : -8.6);
        b.decalX(s * (W + 0.024), s, zc + 1.9, zc - 1.9, 0.56, 2.7, tagUV, col, 0.15);
      }
    }
    b.decalZ(-W, Y0, W, Y1, 0.016, UV.front, col, 0.3);
    for (const s of [-1, 1]) {
      b.box(s * 0.66 - 0.17, 0.7, 0, s * 0.66 + 0.17, 0.94, 0.06, [1, 0.96, 0.72], 1);
      b.box(s * 0.7 - 0.12, 0.72, -L - 0.05, s * 0.7 + 0.12, 0.9, -L, [1, 0.15, 0.1], 1);
    }
    b.box(-1.02, 0.28, -0.12, 1.02, 0.5, 0.16, hex('#1d1d26'));
    if (moving) {
      b.decalZ(-1.02, 0.28, 1.02, 0.5, 0.166, uvSub(UV.hazard, 0, 0, 1, 0.3), C.white, 0.5);
      b.box(-0.16, RH, -0.5, 0.16, RH + 0.2, -0.2, [1, 0.35, 0.1], 1);
    }
  });
  MD.trains = TRAIN_COLS.map((c, i) => buildTrain(c, i % 2 === 0 ? UV['tag' + (i % 4)] : null, false));
  MD.trainTagged = buildTrain('#d9dbe4', UV.mural0, false, -8.3);       // 开场被涂鸦的那节车厢
  MD.trainMove = buildTrain('#f4c531', null, true);

  /* ---- 斜坡 ---- */
  MD.ramp = mk((b) => {
    const W = 1.0, H = ROOF_H, L = RAMP_LEN, n = 4;
    const side = hex('#373c52');
    for (let i = 0; i < n; i++) {
      const z0 = (-L * i) / n, z1 = (-L * (i + 1)) / n, y0 = (H * i) / n, y1 = (H * (i + 1)) / n;
      b.quad([-W, y0, z0], [W, y0, z0], [W, y1, z1], [-W, y1, z1], hex('#f5b82e'), 0.12, UV.chevron);
    }
    b.tri([W, 0, 0], [W, 0, -L], [W, H, -L], side);
    b.tri([-W, 0, -L], [-W, 0, 0], [-W, H, -L], side);
    b.quad([W, 0, -L], [-W, 0, -L], [-W, H, -L], [W, H, -L], side);
    for (const s of [-1, 1]) {        // 两侧护边
      const x0 = s > 0 ? W - 0.08 : -W, x1 = s > 0 ? W : -W + 0.08;
      b.quad([x0, 0.12, 0], [x1, 0.12, 0], [x1, H + 0.12, -L], [x0, H + 0.12, -L], C.red, 0.2);
    }
    b.box(-W, 0, -0.06, W, 0.1, 0.1, C.dark);
  });

  /* ---- 低栏（需要跳） ---- */
  MD.low = mk((b) => {
    const post = hex('#d7dbe6');
    for (const s of [-1, 1]) {
      b.box(s * 0.93 - 0.07, 0, -0.07, s * 0.93 + 0.07, 1.0, 0.07, post);
      b.box(s * 0.93 - 0.2, 0, -0.32, s * 0.93 + 0.2, 0.07, 0.32, C.dark);
      b.box(s * 0.93 - 0.08, 1.0, -0.08, s * 0.93 + 0.08, 1.1, 0.08, [1, 0.6, 0.1], 1);
    }
    b.box(-1.0, 0.5, -0.05, 1.0, 0.92, 0.05, C.white);
    b.decalZ(-1.0, 0.5, 1.0, 0.92, 0.058, uvSub(UV.hazard, 0, 0, 1, 0.42), C.white, 0.15);
    b.box(-0.93, 0.2, -0.03, 0.93, 0.3, 0.03, post);
  });
  MD.low2 = mk((b) => {
    const y = hex('#f2b134');
    b.box(-0.88, 0, -0.42, 0.88, 0.72, 0.42, y);
    b.decalZ(-0.88, 0.06, 0.88, 0.5, 0.428, uvSub(UV.hazard, 0, 0, 1, 0.5), C.white, 0.15);
    b.box(-0.92, 0.72, -0.46, 0.92, 0.8, 0.46, C.dark);
    b.box(-0.55, 0.8, -0.2, -0.25, 0.9, 0.1, [1, 0.3, 0.15], 1);
    b.box(0.25, 0.8, -0.2, 0.55, 0.9, 0.1, [1, 0.3, 0.15], 1);
  });
  /* ---- 高栏（需要翻滚） ---- */
  MD.high = mk((b) => {
    const post = hex('#c9cede'), panel = hex('#243a9a');
    for (const s of [-1, 1]) {
      b.box(s * 1.0 - 0.08, 0, -0.08, s * 1.0 + 0.08, 2.5, 0.08, post);
      b.box(s * 1.0 - 0.22, 0, -0.3, s * 1.0 + 0.22, 0.07, 0.3, C.dark);
    }
    b.box(-0.92, 1.15, -0.05, 0.92, 2.15, 0.05, panel);
    b.decalZ(-0.46, 1.19, 0.46, 2.11, 0.058, UV.arrowDown, panel, 0.7);
    b.decalZ(-0.92, 1.15, -0.56, 2.15, 0.058, uvSub(UV.hazard, 0, 0, 0.36, 1), C.white, 0.15);
    b.decalZ(0.56, 1.15, 0.92, 2.15, 0.058, uvSub(UV.hazard, 0.64, 0, 1, 1), C.white, 0.15);
    b.box(-0.92, 1.08, -0.04, 0.92, 1.15, 0.04, [0.3, 0.95, 1], 1);
    b.box(-1.08, 2.4, -0.09, 1.08, 2.55, 0.09, post);
  });

  /* ---- 金币 ---- */
  MD.coin = mk((b) => {
    const rx = M4.create(); M4.rotX(rx, Math.PI / 2);
    b.xf(rx);
    b.cyl(0, -0.05, 0, 0.34, 0.05, 0.34, C.gold, 0.35, 16);
    b.cyl(0, -0.052, 0, 0.36, 0.052, 0.36, hex('#d98a00'), 0.2, 16, false);
    b.xf(null);
    b.decalZ(-0.27, -0.27, 0.27, 0.27, 0.056, UV.star, C.gold, 2.75);
    b.decalZn(-0.27, -0.27, 0.27, 0.27, -0.056, UV.star, C.gold, 2.75);
  });

  /* ---- 道具 ---- */
  MD.pu = {};
  MD.pu.jet = mk((b) => {
    const sil = hex('#d5dbe8'), red = hex('#ff3b3b');
    for (const s of [-1, 1]) {
      b.cyl(s * 0.2, -0.3, 0, 0.16, 0.3, 0.16, sil, 0.1);
      b.cyl(s * 0.2, 0.3, 0, 0.16, 0.56, 0, red, 0.2);
      b.cyl(s * 0.2, -0.42, 0, 0.11, -0.3, 0.15, C.dark);
      b.cyl(s * 0.2, -0.72, 0, 0, -0.42, 0.1, [1, 0.7, 0.15], 1, 8, false);
      b.box(s * 0.2 - 0.17, -0.02, -0.17, s * 0.2 + 0.17, 0.06, 0.17, red, 0.2);
    }
    b.box(-0.12, -0.2, -0.1, 0.12, 0.2, 0.1, hex('#3a3f52'));
  });
  MD.pu.shoes = mk((b) => {
    const gr = hex('#30d67b');
    b.box(-0.19, -0.3, -0.5, 0.19, -0.2, 0.36, C.white, 0.2);
    b.box(-0.17, -0.2, -0.2, 0.17, 0.02, 0.34, gr, 0.15);
    b.ellipsoid(0, -0.16, -0.26, 0.17, 0.13, 0.24, gr, 0.15, 10, 6);
    b.box(-0.17, 0.02, 0.04, 0.17, 0.3, 0.34, gr, 0.15);
    b.box(-0.18, 0.3, 0.02, 0.18, 0.36, 0.36, C.white, 0.2);
    b.box(-0.175, -0.12, -0.3, 0.175, -0.06, 0.2, C.white, 0.3);
    for (const s of [-1, 1]) {           // 小翅膀
      b.quad([s * 0.19, 0.0, 0.2], [s * 0.19, 0.12, 0.2], [s * 0.62, 0.42, 0.42], [s * 0.5, 0.1, 0.44], C.white, 0.8);
      b.quad([s * 0.19, -0.1, 0.2], [s * 0.19, 0.02, 0.2], [s * 0.5, 0.16, 0.5], [s * 0.4, -0.08, 0.48], C.white, 0.8);
    }
    b.cyl(0, -0.48, -0.05, 0.12, -0.3, 0.12, hex('#ffd23a'), 0.5, 8);
  });
  MD.pu.magnet = mk((b) => {
    const red = hex('#ff2e3e');
    b.box(-0.38, -0.1, -0.11, -0.14, 0.3, 0.11, red, 0.2);
    b.box(0.14, -0.1, -0.11, 0.38, 0.3, 0.11, red, 0.2);
    b.box(-0.38, -0.36, -0.11, 0.38, -0.1, 0.11, red, 0.2);
    b.box(-0.38, 0.3, -0.11, -0.14, 0.48, 0.11, C.white, 0.5);
    b.box(0.14, 0.3, -0.11, 0.38, 0.48, 0.11, C.white, 0.5);
  });
  MD.pu.double = mk((b) => {
    const p = hex('#a03cff');
    b.ellipsoid(0, 0, 0, 0.46, 0.46, 0.09, p, 0.35, 16, 6);
    b.ellipsoid(0, 0, 0, 0.5, 0.5, 0.05, hex('#ffd23a'), 0.5, 16, 4);
    b.decalZ(-0.34, -0.34, 0.34, 0.34, 0.1, UV.x2, p, 2.9);
    b.decalZn(-0.34, -0.34, 0.34, 0.34, -0.1, UV.x2, p, 2.9);
  });
  MD.pu.chest = mk((b) => {
    const w1 = hex('#8a5527'), w2 = hex('#a86b33'), gd = hex('#ffcf3a');
    b.box(-0.42, -0.32, -0.28, 0.42, 0.08, 0.28, w1);
    b.box(-0.42, 0.08, -0.28, 0.42, 0.26, 0.28, w2);
    b.box(-0.36, 0.26, -0.24, 0.36, 0.34, 0.24, w2);
    for (const x of [-0.3, 0.3]) b.box(x - 0.05, -0.33, -0.29, x + 0.05, 0.35, 0.29, gd, 0.35);
    b.box(-0.43, 0.05, -0.29, 0.43, 0.11, 0.29, gd, 0.35);
    b.decalZ(-0.14, -0.12, 0.14, 0.2, 0.3, UV.emblem, w1, 0.8);
    b.decalZn(-0.14, -0.12, 0.14, 0.2, -0.3, UV.emblem, w1, 0.8);
  });

  /* ---- 滑板（悬浮板） ---- */
  MD.board = mk((b) => {
    b.ellipsoid(0, 0, 0, 0.36, 0.05, 0.98, hex('#ff5a1f'), 0.2, 12, 6);
    b.box(-0.07, 0.035, -0.8, 0.07, 0.055, 0.8, hex('#ffe14a'), 0.7);
    b.box(-0.24, -0.1, -0.7, 0.24, -0.05, 0.7, [0.3, 0.95, 1], 1);
    for (const s of [-1, 1]) b.cyl(s * 0.2, -0.13, 0.78, 0.07, -0.02, 0.09, C.dark);
  });

  /* ---- 平面圆盘：影子 / 光圈 ---- */
  MD.disc = mk((b) => b.disc(0, 0, 0, 1, [1, 1, 1], 1, 20));

  /* ---- 企鹅 ---- */
  MD.penguin = SKINS.map((sk) => mk((b) => {
    const scarf = hex(sk.scarf), cap = hex(sk.cap), pack = hex(sk.pack);
    b.ellipsoid(0, 0.62, 0, 0.43, 0.56, 0.4, C.navy, 0, 14, 10);
    b.ellipsoid(0, 0.56, -0.13, 0.34, 0.46, 0.31, C.white, 0, 12, 8);
    b.ellipsoid(0, 1.2, -0.02, 0.34, 0.31, 0.33, C.navy, 0, 14, 10);
    b.ellipsoid(0, 1.17, -0.13, 0.27, 0.23, 0.24, C.white, 0, 12, 8);
    for (const s of [-1, 1]) {
      b.ellipsoid(s * 0.12, 1.25, -0.345, 0.05, 0.062, 0.03, C.black, 0, 8, 6);
      b.ellipsoid(s * 0.105, 1.272, -0.372, 0.018, 0.02, 0.012, C.white, 1, 6, 4);
      b.ellipsoid(s * 0.2, 1.13, -0.3, 0.05, 0.035, 0.03, C.pink, 0.2, 6, 4);
    }
    b.ellipsoid(0, 1.15, -0.37, 0.085, 0.05, 0.12, C.orange, 0.15, 8, 6);
    b.cyl(0, 0.93, 0, 0.37, 1.04, 0.34, scarf, 0.12, 14);
    b.box(0.1, 0.56, 0.3, 0.27, 0.99, 0.385, scarf, 0.12);
    b.cyl(0, 1.33, -0.01, 0.35, 1.42, 0.34, shade(cap, 0.78), 0.1, 14);
    b.ellipsoid(0, 1.42, -0.01, 0.325, 0.18, 0.315, cap, 0.1, 14, 6);
    b.ellipsoid(0, 1.63, -0.01, 0.085, 0.085, 0.085, C.white, 0.2, 8, 6);
    b.box(-0.25, 0.4, 0.3, 0.25, 0.92, 0.58, pack, 0.05);
    b.box(-0.2, 0.5, 0.58, 0.2, 0.74, 0.62, shade(pack, 0.7));
    b.cyl(-0.11, 0.92, 0.44, 0.07, 1.14, 0.07, C.steel, 0.1, 8);
    b.cyl(-0.11, 1.14, 0.44, 0.045, 1.2, 0.045, hex('#ff5ad1'), 0.5, 8);
    b.cyl(0.11, 0.92, 0.44, 0.07, 1.08, 0.07, C.steel, 0.1, 8);
    b.cyl(0.11, 1.08, 0.44, 0.045, 1.14, 0.045, hex('#5ef2ff'), 0.5, 8);
    b.ellipsoid(0, 0.2, 0.36, 0.1, 0.07, 0.12, C.navy, 0, 8, 6);
  }));
  MD.pFlip = mk((b) => b.ellipsoid(0, -0.27, 0, 0.07, 0.3, 0.17, C.navy, 0, 10, 8));
  MD.pFoot = mk((b) => b.ellipsoid(0, 0.045, -0.08, 0.13, 0.05, 0.2, C.orange, 0.1, 10, 6));
  /* 第一人称：鳍 / 喙 / 喷漆罐 */
  MD.vmFlip = mk((b) => {
    b.ellipsoid(0, 0, -0.26, 0.085, 0.045, 0.3, C.navy, 0, 10, 8);
    b.ellipsoid(0, -0.02, -0.24, 0.07, 0.03, 0.26, hex('#e9eefc'), 0, 8, 6);
  });
  MD.vmBeak = mk((b) => b.ellipsoid(0, 0, 0, 0.075, 0.035, 0.12, C.orange, 0.2, 10, 6));
  MD.vmCan = mk((b) => {
    b.cyl(0, -0.1, 0, 0.045, 0.1, 0.045, hex('#ff5ad1'), 0.2, 10);
    b.cyl(0, 0.1, 0, 0.045, 0.13, 0.03, C.steel, 0.1, 10);
    b.cyl(0, 0.13, 0, 0.02, 0.17, 0.02, C.white, 0.3, 8);
    b.box(-0.046, -0.04, -0.046, 0.046, 0.02, 0.046, C.white, 0.3);
  });

  /* ---- 警卫 ---- */
  MD.guard = {};
  MD.guard.body = mk((b) => {
    const uni = hex('#2a479c'), uniD = hex('#1a2c66'), skin = hex('#f0b990');
    b.box(-0.33, 0.95, -0.2, 0.33, 1.62, 0.2, uni);
    b.ellipsoid(0, 1.2, -0.08, 0.36, 0.34, 0.3, uni, 0, 10, 8);
    b.box(-0.345, 0.93, -0.215, 0.345, 1.03, 0.215, C.black);
    b.box(-0.06, 0.94, -0.3, 0.06, 1.02, -0.2, C.gold, 0.5);
    b.box(-0.24, 1.42, -0.31, -0.12, 1.54, -0.29, C.gold, 0.6);
    b.ellipsoid(0, 1.86, 0, 0.21, 0.24, 0.22, skin, 0, 10, 8);
    b.cyl(0, 1.98, 0, 0.235, 2.12, 0.27, uniD, 0, 12);
    b.box(-0.2, 1.97, -0.38, 0.2, 2.0, -0.14, C.black);
    b.box(-0.05, 2.02, -0.285, 0.05, 2.09, -0.255, C.gold, 0.7);
    b.box(-0.11, 1.775, -0.235, 0.11, 1.81, -0.195, hex('#3b2a20'));
    for (const s of [-1, 1]) b.ellipsoid(s * 0.08, 1.88, -0.2, 0.025, 0.03, 0.02, C.black, 0, 6, 4);
    b.box(-0.04, 1.25, -0.39, 0.04, 1.6, -0.36, hex('#11162b'));
  });
  MD.guard.leg = mk((b) => {
    b.box(-0.13, -0.95, -0.13, 0.13, 0, 0.13, hex('#18224d'));
    b.box(-0.14, -0.95, -0.32, 0.14, -0.84, 0.14, C.black);
  });
  MD.guard.arm = mk((b) => {
    b.box(-0.1, -0.62, -0.1, 0.1, 0.03, 0.1, hex('#2a479c'));
    b.ellipsoid(0, -0.68, 0, 0.09, 0.09, 0.09, hex('#f0b990'), 0, 8, 6);
  });
  MD.guard.armR = mk((b) => {
    b.box(-0.1, -0.62, -0.1, 0.1, 0.03, 0.1, hex('#2a479c'));
    b.ellipsoid(0, -0.68, 0, 0.09, 0.09, 0.09, hex('#f0b990'), 0, 8, 6);
    b.box(-0.05, -0.76, -0.42, 0.05, -0.66, -0.02, hex('#2c2c36'));
    b.box(-0.07, -0.78, -0.47, 0.07, -0.64, -0.42, [1, 1, 0.75], 1);
  });

  /* ---- 小狗 ---- */
  MD.dog = {};
  MD.dog.body = mk((b) => {
    const br = hex('#b8733b'), brD = hex('#7a4622'), cream = hex('#f3dcbb');
    b.ellipsoid(0, 0.55, 0.05, 0.2, 0.2, 0.46, br, 0, 10, 8);
    b.ellipsoid(0, 0.5, -0.2, 0.15, 0.15, 0.2, cream, 0, 8, 6);
    b.ellipsoid(0, 0.84, -0.42, 0.19, 0.18, 0.2, br, 0, 10, 8);
    b.ellipsoid(0, 0.79, -0.6, 0.1, 0.085, 0.13, cream, 0, 8, 6);
    b.ellipsoid(0, 0.82, -0.72, 0.04, 0.035, 0.03, C.black, 0, 6, 4);
    for (const s of [-1, 1]) {
      b.ellipsoid(s * 0.15, 0.98, -0.36, 0.06, 0.11, 0.05, brD, 0, 6, 4);
      b.ellipsoid(s * 0.08, 0.89, -0.585, 0.025, 0.03, 0.02, C.black, 0, 6, 4);
    }
    b.cyl(0, 0.66, -0.26, 0.17, 0.72, 0.17, hex('#e8322c'), 0.2, 10);
    b.box(-0.035, 0.6, 0.44, 0.035, 0.94, 0.52, br);
    b.ellipsoid(0, 0.96, 0.48, 0.05, 0.06, 0.05, cream, 0, 6, 4);
  });
  MD.dog.legs = mk((b) => {
    const br = hex('#9c5f2e');
    for (const s of [-1, 1]) {
      b.box(s * 0.12 - 0.05, -0.45, -0.05, s * 0.12 + 0.05, 0, 0.05, br);
      b.box(s * 0.12 - 0.055, -0.45, -0.1, s * 0.12 + 0.055, -0.38, 0.05, hex('#f3dcbb'));
    }
  });

  /* ================= 场景装饰 ================= */
  const deco = {};
  MD.deco = deco;

  /* 轨道边的涂鸦墙（每个主题左右各若干种） */
  const buildWall = (side, colHex, capHex, seed, snow) => mk((b) => {
    const r = mulberry(seed), col = hex(colHex), cap = hex(capHex);
    const xa = Math.min(0, side * 0.36), xb = Math.max(0, side * 0.36);
    b.box(xa, 0, -CH, xb, 2.5, 0, col);
    b.box(xa - 0.06, 2.5, -CH, xb + 0.06, snow ? 2.72 : 2.62, 0, cap, snow ? 0.15 : 0);
    for (let z = 0; z >= -CH; z -= 5) b.box(xa - 0.05, 0, z - 0.2, xb + 0.05, 2.5, z + 0.2, shade(col, 0.82));
    const slots = [-0.5, -5.5, -10.5, -15.5];
    const x = -side * 0.02;
    for (const zs of slots) {
      const v = r();
      if (v < 0.25) continue;
      if (v < 0.5) { const m = r() < 0.5 ? UV.mural0 : UV.mural1; b.decalX(x, -side, zs - 0.4, zs - 4.1, 0.15, 2.45, m, col, 0.12); }
      else { const t = UV['tag' + ((r() * 4) | 0)]; const zo = r() * 0.8; b.decalX(x, -side, zs - 0.5 - zo, zs - 3.5 - zo, 0.3, 2.2, t, col, 0.12); }
    }
  });
  deco.wallYard = { L: [], R: [] }; deco.wallSnow = { L: [], R: [] };
  for (let i = 0; i < 4; i++) {
    deco.wallYard.L.push(buildWall(-1, '#8c7f93', '#5b5063', 100 + i, false));
    deco.wallYard.R.push(buildWall(1, '#927f86', '#5b5063', 200 + i, false));
    deco.wallSnow.L.push(buildWall(-1, '#6f86a8', '#f4f9ff', 300 + i, true));
    deco.wallSnow.R.push(buildWall(1, '#6f86a8', '#f4f9ff', 400 + i, true));
  }

  /* 楼房 */
  const bPal = ['#6a4c7d', '#84506b', '#4f4a86', '#9a5b4d', '#5d5e8f', '#7a4660', '#3f5b86'];
  const buildBuilding = (side, seed) => {
    const r = mulberry(seed);
    const len = 8 + r() * 8, dep = 7 + r() * 5, h = 9 + r() * 17;
    const col = hex(bPal[(r() * bPal.length) | 0]);
    const mesh = mk((b) => {
      const x0 = side > 0 ? 0 : -dep, x1 = side > 0 ? dep : 0;
      b.box(x0, 0, -len, x1, h, 0, col);
      b.box(x0 - 0.18, h, -len - 0.18, x1 + 0.18, h + 0.4, 0.18, shade(col, 0.72));
      b.box(x0, 0, -len, x1, 1.6, 0.03, shade(col, 0.7));
      const nz = Math.max(1, Math.round(len / 4)), ny = Math.max(1, Math.round((h - 2.2) / 4));
      const ch = (h - 2.4) / ny;
      for (let i = 0; i < nz; i++) for (let j = 0; j < ny; j++) {
        const zA = (-i * len) / nz - 0.25, zB = (-(i + 1) * len) / nz + 0.25;
        b.decalX(-side * 0.03, -side, zA, zB, 2.1 + j * ch, 2.1 + (j + 1) * ch - 0.3, r() < 0.5 ? UV.bwinA : UV.bwinB, col, 0.85);
      }
      const nx = Math.max(1, Math.round(dep / 4));
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const xa = x0 + (i * dep) / nx + 0.25, xb = x0 + ((i + 1) * dep) / nx - 0.25;
        b.decalZ(xa, 2.1 + j * ch, xb, 2.1 + (j + 1) * ch - 0.3, 0.035, r() < 0.5 ? UV.bwinA : UV.bwinB, col, 0.85);
      }
      const cx = (x0 + x1) / 2;
      if (r() < 0.5) { b.cyl(cx, h + 0.4, -len * 0.35, 1.1, h + 2.4, 1.1, hex('#5a4a52'), 0, 10); b.cyl(cx, h + 2.4, -len * 0.35, 1.2, h + 3.0, 0, hex('#3d3340'), 0, 10); }
      else { b.box(cx - 1.4, h + 0.4, -len * 0.7, cx + 1.4, h + 1.7, -len * 0.4, shade(col, 0.6)); b.box(cx + 1.0, h + 0.4, -len * 0.3, cx + 1.1, h + 4.2, -len * 0.3 + 0.1, C.dark); b.box(cx + 0.98, h + 4.2, -len * 0.3 - 0.02, cx + 1.12, h + 4.36, -len * 0.3 + 0.12, [1, 0.2, 0.15], 1); }
    });
    return { mesh, len, dep, h };
  };
  deco.bldL = []; deco.bldR = [];
  for (let i = 0; i < 6; i++) { deco.bldL.push(buildBuilding(-1, 500 + i * 7)); deco.bldR.push(buildBuilding(1, 600 + i * 7)); }

  /* 路灯（朝轨道伸臂） */
  const buildLamp = (side) => mk((b) => {
    const p = hex('#2b2b38');
    b.box(-0.08, 0, -0.08, 0.08, 5.3, 0.08, p);
    b.box(Math.min(0, -side * 1.3), 5.18, -0.06, Math.max(0, -side * 1.3), 5.3, 0.06, p);
    b.box(-side * 1.3 - 0.28, 5.02, -0.16, -side * 1.3 + 0.28, 5.18, 0.16, [1, 0.88, 0.6], 1);
    b.box(-0.16, 0, -0.16, 0.16, 0.35, 0.16, p);
  });
  deco.lampL = buildLamp(-1); deco.lampR = buildLamp(1);

  /* 信号门架 + 标志牌（足够高，喷气背包飞行时从下方穿过） */
  deco.gantry = mk((b) => {
    const p = hex('#34344a');
    for (const s of [-1, 1]) b.box(s * 4.5 - 0.14, 0, -0.14, s * 4.5 + 0.14, 10.4, 0.14, p);
    b.box(-4.64, 10.0, -0.18, 4.64, 10.4, 0.18, p);
    for (let l = 0; l < 3; l++) {
      const lx = laneX(l);
      b.box(lx - 0.32, 9.2, -0.1, lx + 0.32, 10.0, 0.1, hex('#12121a'));
      b.box(lx - 0.22, 9.64, 0.1, lx - 0.02, 9.84, 0.13, l === 1 ? [0.2, 1, 0.4] : [1, 0.2, 0.15], 1);
      b.box(lx + 0.02, 9.34, 0.1, lx + 0.22, 9.54, 0.13, [1, 0.75, 0.15], 1);
    }
    b.box(-2.5, 10.4, -0.07, 2.5, 11.95, 0.07, hex('#120a22'));
    b.decalZ(-2.4, 10.45, 2.4, 11.9, 0.08, UV.logo, hex('#120a22'), 0.9);
  });

  /* 霓虹车站：站台、立柱、背墙、顶棚（一个分块长度） */
  deco.station = [0, 1, 2].map((variant) => mk((b) => {
    const wall = hex('#221d3a'), pil = hex('#4a4474'), ceil = hex('#15122a');
    const neon = [[1, 0.25, 0.8], [0.3, 0.95, 1], [1, 0.75, 0.2]];
    for (const s of [-1, 1]) {
      const xw = s * 10.2;
      b.box(Math.min(xw, xw + s * 0.5), 1.0, -CH, Math.max(xw, xw + s * 0.5), 11.2, 0, wall);
      const xf = xw - s * 0.03;
      b.box(Math.min(xf, xf - s * 0.08), 3.0, -CH, Math.max(xf, xf - s * 0.08), 3.12, 0, neon[(variant + (s > 0 ? 1 : 0)) % 3], 1);
      b.box(Math.min(xf, xf - s * 0.08), 7.6, -CH, Math.max(xf, xf - s * 0.08), 7.72, 0, neon[(variant + (s > 0 ? 2 : 1)) % 3], 1);
      const posters = variant === 0 ? [UV.poster, UV.mural1] : variant === 1 ? [UV.mural0, UV.poster] : [UV.logo, UV.mural1];
      posters.forEach((uv, i) => {
        const zc = -5 - i * 10, wide = uv === UV.poster ? 1.9 : uv === UV.logo ? 4.4 : 3.0, hh = uv === UV.logo ? 1.4 : 1.9;
        b.decalX(xf - s * 0.02, -s, zc + wide, zc - wide, 5.35 - hh, 5.35 + hh, uv, wall, 0.9);
      });
      for (const z of [-5, -15]) {
        b.box(s * 6.6 - 0.32, 1.0, z - 0.32, s * 6.6 + 0.32, 11.2, z + 0.32, pil);
        b.box(s * 6.6 - 0.36, 4.2, z - 0.36, s * 6.6 + 0.36, 4.34, z + 0.36, neon[variant], 1);
        b.box(s * 6.6 - 0.4, 1.0, z - 0.4, s * 6.6 + 0.4, 1.4, z + 0.4, shade(pil, 0.7));
      }
      /* 长椅 */
      b.box(s * 8.6 - 0.3, 1.0, -11.4, s * 8.6 + 0.3, 1.5, -8.6, hex('#ff5a1f'), 0.15);
    }
    b.quad([-10.7, 11.2, -CH], [10.7, 11.2, -CH], [10.7, 11.2, 0], [-10.7, 11.2, 0], ceil);
    for (let l = 0; l < 3; l++) {
      const lx = laneX(l);
      for (const z of [-1.2, -11.2]) b.box(lx - 0.14, 11.08, z - 7.6, lx + 0.14, 11.16, z, [0.82, 0.95, 1], 1);
    }
    b.box(-10.7, 10.6, -10.3, 10.7, 11.2, -9.7, shade(pil, 0.6));
  }));
  /* 车站入口立面 */
  deco.portal = mk((b) => {
    const br = hex('#3a2f55'), tr = hex('#57477d');
    b.box(-80, 0, -1.4, -10.7, 30, 0, br);
    b.box(10.7, 0, -1.4, 80, 30, 0, br);
    b.box(-10.7, 11.2, -1.4, 10.7, 30, 0, br);
    b.box(-11.2, 0, -1.5, -10.7, 11.7, 0.12, tr);
    b.box(10.7, 0, -1.5, 11.2, 11.7, 0.12, tr);
    b.box(-11.2, 11.2, -1.5, 11.2, 11.7, 0.12, tr);
    b.box(-10.7, 11.0, 0.0, 10.7, 11.2, 0.14, [1, 0.25, 0.8], 1);
    b.box(-6.4, 12.6, 0, 6.4, 16.9, 0.1, hex('#120a22'));
    b.decalZ(-6.2, 12.75, 6.2, 16.75, 0.11, UV.logo, hex('#120a22'), 1);
  });

  /* 冰雪港口 */
  deco.pine = [0, 1].map((v) => mk((b) => {
    const gr = hex(v ? '#1f6d5a' : '#2a7d4f'), sn = hex('#f2f8ff'), k = v ? 1.25 : 1;
    b.cyl(0, 0, 0, 0.2 * k, 1.3 * k, 0.15 * k, hex('#5d4030'), 0, 7);
    const layers = [[0.9, 1.7, 2.7], [1.9, 1.35, 3.7], [2.9, 1.0, 4.8]];
    for (const [y0, rad, y1] of layers) {
      b.cyl(0, y0 * k, 0, rad * k, y1 * k, 0, gr, 0, 8, true);
      const ym = lerp(y0, y1, 0.5);
      b.cyl(0, ym * k, 0, rad * 0.53 * k, (y1 + 0.05) * k, 0, sn, 0.1, 8, false);
    }
  }));
  deco.ice = [0, 1, 2].map((v) => mk((b) => {
    const r = mulberry(900 + v);
    const ice = hex('#bfe6ff'), ice2 = hex('#8fc8f2');
    for (let i = 0; i < 3 + v; i++) {
      const w = 0.7 + r() * 1.3, h = 0.8 + r() * (1.6 + v), d = 0.7 + r() * 1.2, x = (r() - 0.5) * 2.4, z = (r() - 0.5) * 2.4;
      const m = M4.create(); M4.translate(m, x, 0, z); M4.rotY(m, r() * 3); M4.rotZ(m, (r() - 0.5) * 0.3);
      b.xf(m).box(-w / 2, -0.2, -d / 2, w / 2, h, d / 2, r() < 0.5 ? ice : ice2, 0.18);
    }
    b.xf(null);
    b.ellipsoid(0, 0, 0, 2.4, 0.5, 2.2, hex('#f2f8ff'), 0.05, 8, 4);
  }));
  const cPal = ['#e2483d', '#2f6bff', '#f0a92c', '#16a678', '#8a54d6', '#e8e8f0'];
  deco.containers = [0, 1, 2].map((v) => mk((b) => {
    const r = mulberry(950 + v);
    const one = (x, y, z, rot) => {
      const col = hex(cPal[(r() * cPal.length) | 0]);
      const m = M4.create(); M4.translate(m, x, y, z); M4.rotY(m, rot);
      b.xf(m).box(-1.25, 0, -3.05, 1.25, 2.6, 3.05, col);
      for (let k = -2.6; k <= 2.6; k += 0.65) { b.box(-1.28, 0.1, k - 0.08, -1.25, 2.5, k + 0.08, shade(col, 0.75)); b.box(1.25, 0.1, k - 0.08, 1.28, 2.5, k + 0.08, shade(col, 0.75)); }
      b.box(-1.26, 2.6, -3.06, 1.26, 2.72, 3.06, hex('#f2f8ff'), 0.1);
      b.xf(null);
    };
    one(0, 0, 0, 0); one(0, 2.72, 0.3, 0.06);
    if (v > 0) one(2.8, 0, -0.4, 0.02);
    if (v > 1) { one(2.8, 2.72, -0.2, -0.05); one(0, 5.44, 0, 0.1); }
  }));
  deco.snowman = mk((b) => {
    const sn = hex('#f6faff');
    b.ellipsoid(0, 0.55, 0, 0.62, 0.58, 0.62, sn, 0.05, 10, 8);
    b.ellipsoid(0, 1.35, 0, 0.44, 0.42, 0.44, sn, 0.05, 10, 8);
    b.ellipsoid(0, 1.98, 0, 0.3, 0.3, 0.3, sn, 0.05, 10, 8);
    b.cyl(0, 2.2, 0, 0.3, 2.26, 0.3, C.black, 0, 10); b.cyl(0, 2.26, 0, 0.2, 2.6, 0.2, C.black, 0, 10);
    b.cyl(0, 1.68, 0, 0.3, 1.78, 0.32, hex('#ff3b5c'), 0.15, 10);
  });
  deco.lampSnowL = deco.lampL; deco.lampSnowR = deco.lampR;

  return MD;
}
