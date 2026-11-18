/* =====================================================================
 * 热力追逐 · 游戏主逻辑
 * 状态机 / 玩家物理 / 碰撞 / 道具 / 追逐 / 镜头 / 渲染
 * ===================================================================== */

/* ---------------- 存档（本地保存，离线可用） ---------------- */
const Save = {
  key: 'heat-chase.v1',
  data: null,
  defaults() {
    return {
      best: 0, coins: 0, runs: 0, bestDist: 0,
      up: { jet: 0, shoes: 0, magnet: 0, double: 0, board: 0 },
      skin: 0, owned: [0],
      set: { sfx: true, music: true, view: 0, quality: 1, vibrate: true },
      tutorial: false,
    };
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(this.key)); } catch (e) { d = null; }
    const def = this.defaults();
    if (d && typeof d === 'object') {
      Object.assign(def.up, d.up || {}); Object.assign(def.set, d.set || {});
      const up = def.up, set = def.set;
      Object.assign(def, d); def.up = up; def.set = set;
      if (!Array.isArray(def.owned) || !def.owned.length) def.owned = [0];
      if (!(def.skin >= 0 && def.skin < SKINS.length)) def.skin = 0;
    }
    this.data = def;
  },
  store() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* 无痕模式等情况下忽略 */ } },
};

/* ---------------- 道具配置 ---------------- */
const FX_INFO = {
  jet: { name: '喷气背包', icon: '🚀', base: 6.5, step: 0.8, desc: '短暂飞行，无视地面障碍', col: [1, 0.5, 0.2] },
  shoes: { name: '超级跑鞋', icon: '👟', base: 10, step: 1.5, desc: '跳得更高，能直接跳上车顶', col: [0.3, 1, 0.55] },
  magnet: { name: '磁铁', icon: '🧲', base: 10, step: 1.5, desc: '自动吸附附近金币', col: [1, 0.25, 0.3] },
  double: { name: '双倍得分', icon: '✖️2', base: 10, step: 1.5, desc: '分数倍率翻倍', col: [0.7, 0.35, 1] },
  board: { name: '滑板', icon: '🛹', base: 15, step: 2, desc: '护盾：撞一下不会结束，无限次使用', col: [0.3, 0.95, 1] },
};
const UP_COST = [150, 400, 900, 1800, 3500];
const fxDur = (k) => FX_INFO[k].base + FX_INFO[k].step * (Save.data.up[k] || 0);

const GRAV = 38, JUMP_V = 12.4, JUMP_V_SUPER = 16.9, JET_Y = 6.4;
const BOARD_CD = 4;
const ZONE_LEN = 700;

/* ---------------- 场景主题 ---------------- */
const THEMES = [
  { name: '黄昏车场', top: hex('#2c1b57'), hor: hex('#f29a68'), amb: [0.66, 0.56, 0.7], sun: [0.9, 0.62, 0.42], sunCol: [1, 0.74, 0.4], sunX: 0.3, sunY: 0.12, stars: 0.3, aurora: 0, fogK: 1 },
  { name: '霓虹车站', top: hex('#0a0716'), hor: hex('#110c26'), amb: [0.52, 0.48, 0.72], sun: [0.3, 0.3, 0.46], sunCol: [0, 0, 0], sunX: 0, sunY: 0.3, stars: 0, aurora: 0, fogK: 0.82 },
  { name: '冰雪港口', top: hex('#040b22'), hor: hex('#2b527f'), amb: [0.54, 0.64, 0.86], sun: [0.5, 0.58, 0.8], sunCol: [0.72, 0.8, 1], sunX: -0.42, sunY: 0.5, stars: 1, aurora: 1, fogK: 1 },
];
const themeOfZone = (zi) => ((zi % 3) + 3) % 3;
const themeOfChunk = (k) => (k < 0 ? 0 : themeOfZone(Math.floor((k * CH) / ZONE_LEN)));

/* ---------------- 全局状态 ---------------- */
let R = null, MD = null, ps = null, W = null;
const G = {
  state: 'boot', time: 0, dist: 0, speed: 0, score: 0, coins: 0, runTime: 0,
  viewMix: 0, heatLevel: 1, heat: 0,
  fx: { jet: 0, shoes: 0, magnet: 0, double: 0 }, fxMax: { jet: 1, shoes: 1, magnet: 1, double: 1 },
  board: { t: 0, max: 1, cd: 0 },
  jetFall: 0, chase: 9, stumbleT: 0, shake: 0, introT: 0, dieT: 0, camBlend: 0,
  eyeH: 1.55, lookDown: 0.75, coinStreak: 0, coinStreakT: 0, zoneIdx: 0, dodges: 0,
  newBest: false, dieSide: 1, menuT: 0, barkT: 0, stepT: 0,
};
const P = {
  lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, grounded: true, rollT: 0, jumpBuf: 0, coyote: 0,
  invuln: 0, laneT: 9, fastFall: false, phase: 0, yaw: 0, hop: 0,
};
const chaser = { x: 0, phase: 0 };
const camA = { ex: 0, ey: 2, ez: 5, tx: 0, ty: 1, tz: -5, roll: 0, fov: 1 };
const camB = { ex: 0, ey: 2, ez: 5, tx: 0, ty: 1, tz: -5, roll: 0, fov: 1 };
const camO = { ex: 0, ey: 2, ez: 5, tx: 0, ty: 1, tz: -5, roll: 0, fov: 1 };
const proj = M4.create(), view = M4.create(), projVM = M4.create(), IDENT = M4.create();
const m = M4.create(), mb = M4.create();
const envNow = {};

function vib(ms) {
  if (PLATFORM.id === 'mobile' && Save.data.set.vibrate && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* 忽略 */ } }
}
const mult = () => G.heatLevel * (G.fx.double > 0 ? 2 : 1);

/* ---------------- 流程控制 ---------------- */
function resetRun(tutorial) {
  W = new World((Math.random() * 1e9) | 0, { tutorial });
  W.extend(PLATFORM.viewDist + 60);
  decorCache.clear();
  Object.assign(G, {
    dist: 0, speed: 0, score: 0, coins: 0, runTime: 0, heatLevel: 1, heat: 0, jetFall: 0, chase: 4.5, stumbleT: 0,
    shake: 0, introT: 0, dieT: 0, camBlend: 0, coinStreak: 0, coinStreakT: 0, zoneIdx: 0, dodges: 0, newBest: false,
  });
  G.fx.jet = G.fx.shoes = G.fx.magnet = G.fx.double = 0;
  G.board.t = 0; G.board.cd = 0;
  Object.assign(P, { lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, grounded: true, rollT: 0, jumpBuf: 0, coyote: 0, invuln: 0, laneT: 9, fastFall: false, phase: 0, yaw: Math.PI / 2, hop: 0, fromLane: 1 });
  chaser.x = 0.6;
  ps.clear();
  Snd.jet(false);
}

const Game = {
  toMenu() {
    resetRun(false);
    G.state = 'menu'; G.menuT = 0;
    UI.showHUD(false); UI.show('menu');
    Snd.music(false);
  },
  start() {
    Snd.unlock();
    resetRun(!Save.data.tutorial);
    G.state = 'intro'; G.introT = 0;
    UI.show(null); UI.showHUD(false);
    UI.bubble('站住！不许乱涂！', 1050, 550);
    Snd.play('whistle', 0.55); Snd.play('bark', 0.95); Snd.play('bark', 1.2);
  },
  beginRun() {
    G.state = 'run'; G.camBlend = 1; G.viewMix = Save.data.set.view;
    copyCam(camB, camO);
    UI.showHUD(true); UI.bubble('', 0, 0); UI.pop('快跑！', 'big');
    Snd.music(true);
    Save.data.runs++;
  },
  pause() {
    if (G.state !== 'run') return;
    G.state = 'pause'; UI.show('pause'); Snd.jet(false); Snd.music(false);
  },
  resume() {
    if (G.state !== 'pause') return;
    G.state = 'run'; UI.show(null); Snd.music(true); if (G.fx.jet > 0) Snd.jet(true);
  },
  restart() { this.start(); },
  tap() { if (G.state === 'intro' && G.introT > 0.25) G.introT = Math.max(G.introT, 1.75); },
  left() { laneMove(-1); },
  right() { laneMove(1); },
  jump() {
    if (G.state !== 'run' || G.fx.jet > 0) return;
    P.jumpBuf = 0.14;
  },
  roll() {
    if (G.state !== 'run' || G.fx.jet > 0) return;
    if (P.grounded) { P.rollT = 0.68; Snd.play('roll'); }
    else { P.vy = Math.min(P.vy, -24); P.fastFall = true; G.jetFall = 0; }
  },
  board() {
    if (G.state !== 'run') return;
    if (G.board.t > 0) return;
    if (G.board.cd > 0) { UI.pop('滑板充能中…', 'warn'); return; }
    G.board.t = G.board.max = fxDur('board');
    Snd.play('board'); vib(20);
    UI.pop('滑板护盾！', 'good');
    burst(P.x, P.y + 0.3, -0.5, FX_INFO.board.col, 14, 4);
  },
  toggleView() {
    Save.data.set.view = Save.data.set.view ? 0 : 1; Save.store();
    UI.pop(Save.data.set.view ? '追尾视角' : '第一人称视角', 'info');
    UI.refreshSettings();
  },
  applySettings() { Snd.apply(); resize(); },
};

function laneMove(dir) {
  if (G.state !== 'run') return;
  const nl = P.lane + dir;
  if (nl < 0 || nl > 2) { G.shake = Math.max(G.shake, 0.12); Snd.play('thud'); return; }
  P.prevLane = P.lane; P.fromLane = P.lane; P.lane = nl; P.laneT = 0;
  Snd.play('lane');
}

/* ---------------- 主题与环境 ---------------- */
function computeEnv(z) {
  const zi = Math.floor(z / ZONE_LEN), f = z - zi * ZONE_LEN;
  let a = THEMES[themeOfZone(zi)], b = a, t = 0;
  if (f < 40 && zi > 0) { b = a; a = THEMES[themeOfZone(zi - 1)]; t = smooth(0.5 + f / 80); }
  else if (f > ZONE_LEN - 40) { b = THEMES[themeOfZone(zi + 1)]; t = smooth((f - (ZONE_LEN - 40)) / 80); }
  const e = envNow;
  e.top = mixCol(a.top, b.top, t); e.hor = mixCol(a.hor, b.hor, t);
  e.amb = mixCol(a.amb, b.amb, t); e.sun = mixCol(a.sun, b.sun, t); e.sunCol = mixCol(a.sunCol, b.sunCol, t);
  e.sunX = lerp(a.sunX, b.sunX, t); e.sunY = lerp(a.sunY, b.sunY, t);
  e.stars = lerp(a.stars, b.stars, t); e.aurora = lerp(a.aurora, b.aurora, t); e.fogK = lerp(a.fogK, b.fogK, t);
  e.theme = themeOfZone(zi);
  return e;
}

/* ---------------- 场景装饰（按分块缓存） ---------------- */
const decorCache = new Map();
function chunkDecor(k) {
  let d = decorCache.get(k);
  if (d) return d;
  d = [];
  const z0 = k * CH, th = themeOfChunk(k), r = mulberry(k * 7919 + 13), D = MD.deco;
  const add = (mesh, x, y, z, ry) => d.push({ mesh, x, y, z, ry: ry || 0 });
  if (th === 0) {
    add(D.wallYard.L[(r() * 4) | 0], -5.2, 0, z0); add(D.wallYard.R[(r() * 4) | 0], 5.2, 0, z0);
    for (const s of [-1, 1]) {
      const list = s < 0 ? D.bldL : D.bldR;
      if (r() < 0.88) { const b = list[(r() * list.length) | 0]; add(b.mesh, s * (8.2 + r() * 3.5), 0, z0 + r() * 5); }
      if (r() < 0.55) { const b = list[(r() * list.length) | 0]; add(b.mesh, s * (24 + r() * 8), 0, z0 + r() * 8); }
    }
    if (k % 2 === 0) { const s = (k / 2) % 2 ? 1 : -1; add(s < 0 ? D.lampL : D.lampR, s * 4.85, 0, z0 + 10); }
    if (((k % 7) + 7) % 7 === 4) add(D.gantry, 0, 0, z0 + 6);
  } else if (th === 1) {
    add(D.station[((k % 3) + 3) % 3], 0, 0, z0);
    if (themeOfChunk(k - 1) !== 1) add(D.portal, 0, 0, z0);
    if (themeOfChunk(k + 1) !== 1) add(D.portal, 0, 0, z0 + CH);
  } else {
    if (r() < 0.8) add(D.wallSnow.L[(r() * 4) | 0], -5.2, 0.28, z0);
    if (r() < 0.8) add(D.wallSnow.R[(r() * 4) | 0], 5.2, 0.28, z0);
    for (const s of [-1, 1]) {
      const n = 2 + ((r() * 3) | 0);
      for (let i = 0; i < n; i++) add(D.pine[(r() * 2) | 0], s * (7.5 + r() * 20), 0.25, z0 + r() * CH, r() * 6);
      const v = r();
      if (v < 0.4) add(D.containers[(r() * 3) | 0], s * (10 + r() * 4), 0.28, z0 + 4 + r() * 10, (r() - 0.5) * 0.3);
      else if (v < 0.75) add(D.ice[(r() * 3) | 0], s * (8 + r() * 6), 0.28, z0 + r() * CH, r() * 6);
      else if (v < 0.9) add(D.snowman, s * (6.8 + r() * 2), 0.28, z0 + r() * CH, s * -1.2);
    }
    if (k % 2 === 0) { const s = (k / 2) % 2 ? 1 : -1; add(s < 0 ? D.lampL : D.lampR, s * 4.85, 0.28, z0 + 10); }
    if (((k % 9) + 9) % 9 === 5) add(D.gantry, 0, 0, z0 + 6);
  }
  decorCache.set(k, d);
  if (decorCache.size > 40) { for (const key of decorCache.keys()) { if (key < k - 20) decorCache.delete(key); } }
  return d;
}

/* ---------------- 粒子小工具（坐标：相对玩家的渲染空间，前方为 -z） ---------------- */
function burst(x, y, z, col, n, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, b = Math.random() * Math.PI, v = sp * (0.4 + Math.random() * 0.8);
    ps.spawn({ x, y, z, vx: Math.cos(a) * Math.sin(b) * v, vy: Math.cos(b) * v + 1.5, vz: Math.sin(a) * Math.sin(b) * v, life: 0.35 + Math.random() * 0.35, size: 0.09 + Math.random() * 0.1, col, grav: 6, scroll: 0.6 });
  }
}
function dust(x, y, z, n) {
  for (let i = 0; i < n; i++) {
    ps.spawn({ x: x + (Math.random() - 0.5) * 0.6, y: y + 0.1, z, vx: (Math.random() - 0.5) * 2, vy: 0.6 + Math.random() * 1.2, vz: 0, life: 0.45, size: 0.22, col: [0.8, 0.76, 0.72], a: 0.5, add: 0, grow: 1.5, scroll: 1 });
  }
}

/* ---------------- 地面高度与碰撞 ---------------- */
function solidTop(o, z) { return o.t === 'ramp' ? clamp((z - o.z) / o.len, 0, 1) * ROOF_H : ROOF_H; }
function solidTol(o) { return o.t === 'ramp' ? 0.75 : 0.45; }
function groundAt(x, z, y) {
  let h = 0;
  const objs = W.objs;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (!o.solid || o.dead) continue;
    if (z < o.z - 0.3 || z > o.z + o.len + 0.3) continue;
    if (Math.abs(x - o.x) > 1.25) continue;
    const top = solidTop(o, z);
    if (y >= top - solidTol(o) && top > h) h = top;
  }
  return h;
}

function addHeat(v) {
  G.heat += v;
  if (G.heat >= 1) {
    if (G.heatLevel < 10) {
      G.heatLevel++; G.heat = 0.12;
      UI.pop('热力等级 ×' + G.heatLevel, 'heat'); Snd.play('level');
    } else G.heat = 1;
  }
}
function addCoins(n, x, y, z) {
  G.coins += n;
  G.score += 5 * n * mult();
  addHeat(0.011 * Math.min(n, 10));
  if (x !== undefined) {
    for (let i = 0; i < 4; i++) ps.spawn({ x, y, z, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 2, life: 0.3, size: 0.1, col: [1, 0.85, 0.3], scroll: 0.5 });
  }
}

function stumble() {
  if (P.invuln > 0) return;
  if (G.stumbleT > 0) {                      // 警卫已经贴身，再绊一下就被抓
    if (G.board.t > 0) { breakBoard(null); return; }
    die('caught'); return;
  }
  G.stumbleT = 6.5; P.invuln = 0.5; G.shake = 0.35; G.heat = 0;
  Snd.play('stumble'); Snd.play('bark', 0.15); vib(60);
  UI.pop('警卫逼近！', 'warn');
}
function breakBoard(o) {
  G.board.t = 0; G.board.cd = BOARD_CD; P.invuln = 1.6; G.shake = 0.45;
  const reach = G.dist + Math.max(18, G.speed * 1.7);
  for (const q of W.objs) {
    if (q.t === 'pu' || q.dead) continue;
    const near = q.z < reach && q.z + (q.len || 0.5) > G.dist - 1;
    if (near && (Math.abs(q.x - P.x) < 1.3 || q === o)) q.dead = true;
  }
  burst(P.x, P.y + 0.8, -1.2, [1, 0.6, 0.2], 26, 7);
  burst(P.x, P.y + 0.4, -0.6, FX_INFO.board.col, 12, 5);
  Snd.play('break'); vib([40, 30, 60]);
  UI.pop('滑板碎了！', 'warn');
}
function die(cause) {
  if (G.state !== 'run') return;
  G.state = 'dying'; G.dieT = 0; G.shake = 0.6; G.dieCause = cause;
  G.dieSide = P.x > 0.5 ? -1 : 1;
  copyCam(camB, camO);
  Snd.jet(false); Snd.music(false); Snd.play('crash'); Snd.play('whistle', 0.5); Snd.play('bark', 0.8);
  vib([80, 40, 120]);
  burst(P.x, P.y + 0.9, -0.6, [1, 0.9, 0.4], 18, 5);
  const d = Save.data;
  d.coins += G.coins;
  G.finalScore = Math.floor(G.score);
  G.newBest = G.finalScore > d.best;
  if (G.newBest) d.best = G.finalScore;
  d.bestDist = Math.max(d.bestDist || 0, Math.floor(G.dist));
  d.tutorial = true;
  Save.store();
}
function hitSolid(o) {
  if (P.invuln > 0) return;
  const side = P.prevLane !== P.lane && P.lane === o.lane && Math.abs(P.x - laneX(P.lane)) > 0.3 && G.dist > o.z + 0.9;
  if (side) {                                 // 侧面蹭到：弹回原轨道并踉跄
    const back = P.prevLane; P.prevLane = P.lane; P.lane = back; P.laneT = 0;
    Snd.play('thud'); stumble(); return;
  }
  if (G.board.t > 0) { breakBoard(o); return; }
  die('crash');
}
function hitHurdle(o) {
  if (P.invuln > 0) return;
  if (Math.abs(P.x - o.x) > 0.72) { o.dead = true; burst(o.x, 0.8, -(o.z - G.dist), [1, 0.9, 0.8], 10, 4); Snd.play('thud'); stumble(); return; }
  if (G.board.t > 0) { breakBoard(o); return; }
  die('crash');
}

function pickup(kind, silent) {
  const info = FX_INFO[kind];
  if (kind === 'chest') { openChest(); return; }
  if (kind === 'jet') {
    G.fx.jet = G.fxMax.jet = fxDur('jet');
    G.jetFall = 0; P.rollT = 0; P.grounded = false; P.vy = 0;
    const pred = G.dist + speedAt(G.dist) * 1.22 * G.fx.jet;
    W.clearZone(pred - 24, pred + 64);
    W.skyCoins(G.dist + 24, pred - 14);
    Snd.jet(true);
  } else {
    G.fx[kind] = G.fxMax[kind] = fxDur(kind);
  }
  addHeat(0.1);
  if (!silent) { UI.pop(info.name + '！', 'good'); Snd.play('power'); vib(25); }
  burst(P.x, P.y + 1, -0.8, info.col, 16, 5);
}
function openChest() {
  const r = Math.random();
  Snd.play('chest'); vib(30);
  if (r < 0.36) {
    const n = [30, 50, 80, 120][(Math.random() * 4) | 0];
    addCoins(n); UI.pop('宝箱：金币 +' + n, 'gold');
  } else if (r < 0.5) {
    const s = 300 * mult(); G.score += s; UI.pop('宝箱：分数 +' + s, 'gold');
  } else if (r < 0.58) {
    addHeat(1); UI.pop('宝箱：热力直升一级', 'heat');
  } else {
    const kinds = ['jet', 'shoes', 'magnet', 'double'];
    const k = kinds[(Math.random() * kinds.length) | 0];
    pickup(k, true); UI.pop('宝箱：' + FX_INFO[k].name + '！', 'gold');
  }
  burst(P.x, P.y + 1, -0.8, [1, 0.85, 0.3], 22, 6);
}

/* ---------------- 每个物理步（最多 1/120 秒） ---------------- */
function stepRun(h) {
  G.runTime += h;
  const boost = Math.min(1, 0.4 + G.runTime * 0.6);
  G.speed = speedAt(G.dist) * boost * (G.fx.jet > 0 ? 1.22 : 1);
  const dd = G.speed * h;
  G.dist += dd;
  G.score += dd * mult();

  for (const k in G.fx) {
    if (G.fx[k] > 0) {
      G.fx[k] -= h;
      if (G.fx[k] <= 0) {
        G.fx[k] = 0;
        if (k === 'jet') { G.jetFall = 4; P.vy = 0; P.invuln = Math.max(P.invuln, 2.5); Snd.jet(false); }
      }
    }
  }
  if (G.board.t > 0) { G.board.t -= h; if (G.board.t <= 0) { G.board.t = 0; G.board.cd = BOARD_CD; UI.pop('滑板时间到', 'info'); } }
  else if (G.board.cd > 0) G.board.cd = Math.max(0, G.board.cd - h);
  if (P.invuln > 0) P.invuln -= h;
  if (G.stumbleT > 0) G.stumbleT -= h;
  if (P.rollT > 0) P.rollT -= h;
  P.laneT += h;
  P.x = approach(P.x, laneX(P.lane), 15, h);
  if (Math.abs(P.x - laneX(P.lane)) < 0.02) P.prevLane = P.lane;

  /* 垂直方向 */
  if (G.fx.jet > 0) {
    P.y = approach(P.y, JET_Y, 3.2, h); P.vy = 0; P.grounded = false;
  } else {
    const gnd = groundAt(P.x, G.dist, P.y);
    if (P.grounded) {
      if (gnd < P.y - 0.25) { P.grounded = false; P.vy = 0; P.coyote = 0.11; }
      else P.y = gnd;
    }
    if (P.jumpBuf > 0) {
      P.jumpBuf -= h;
      if (P.grounded || P.coyote > 0) {
        P.vy = G.fx.shoes > 0 ? JUMP_V_SUPER : JUMP_V;
        P.grounded = false; P.coyote = 0; P.jumpBuf = 0; P.rollT = 0; P.fastFall = false;
        Snd.play(G.fx.shoes > 0 ? 'jumpHi' : 'jump');
      }
    }
    if (P.coyote > 0) P.coyote -= h;
    if (!P.grounded) {
      if (G.jetFall > 0) { P.vy = Math.max(P.vy - GRAV * 0.4 * h, -8.5); }
      else P.vy -= GRAV * h;
      P.y += P.vy * h;
      const g2 = groundAt(P.x, G.dist, P.y);
      if (P.y <= g2 && P.vy <= 0) {
        P.y = g2; P.grounded = true;
        if (P.vy < -4) { dust(P.x, P.y, -0.3, 4); Snd.play('land'); }
        P.vy = 0;
        if (G.jetFall > 0) { G.jetFall = 0; P.invuln = Math.max(P.invuln, 0.9); }
        if (P.fastFall) { P.fastFall = false; P.rollT = 0.6; Snd.play('roll'); }
      }
    }
  }

  /* 物体：对向列车移动、碰撞、拾取 */
  const objs = W.objs, z = G.dist, flying = G.fx.jet > 0 || G.jetFall > 0;
  const ph = P.rollT > 0 ? 0.62 : 1.5;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.dead) continue;
    if (o.t === 'mtrain') {
      if (!o.active && z >= o.trigger) { o.active = true; Snd.play('horn'); UI.pop('注意对向来车！', 'warn'); }
      if (o.active) o.z -= speedAt(z) * 0.65 * h;
    }
    if (o.solid) {
      if (!o.passed && o.z < z - 0.3) {
        o.passed = true;
        if (o.t !== 'ramp' && P.lane !== o.lane && P.fromLane === o.lane && P.laneT < 0.42 && P.y < 2) nearMiss('极限闪避', 60, 0.16);
      }
      if (flying || z < o.z - 0.25 || z > o.z + o.len + 0.2 || Math.abs(P.x - o.x) >= 1.05) continue;
      if (P.y < solidTop(o, z) - solidTol(o)) { hitSolid(o); if (G.state !== 'run') return; }
    } else if (o.t === 'pu') {
      if (Math.abs(o.z - z) < 1.1 && Math.abs(o.x - P.x) < 1.1 && Math.abs(o.y - (P.y + 0.8)) < 1.6) { o.dead = true; pickup(o.kind); }
    } else {
      if (!o.passed && o.z < z - 0.5) {
        o.passed = true;
        if (Math.abs(P.x - o.x) < 0.9 && P.y < 2.6 && !flying) nearMiss(o.t === 'high' ? '贴地滑过' : '漂亮一跳', 20, 0.06);
      }
      if (flying || Math.abs(o.z - z) > 0.4 || Math.abs(P.x - o.x) >= 1.0) continue;
      const y0 = o.t === 'high' ? 1.15 : 0, y1 = o.t === 'high' ? 2.2 : (o.t === 'low2' ? 0.84 : 0.92);
      if (P.y < y1 - 0.12 && P.y + ph > y0 + 0.08) { hitHurdle(o); if (G.state !== 'run') return; }
    }
  }

  /* 金币 */
  const coins = W.coins, mag = G.fx.magnet > 0, cy = P.y + 0.75;
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.taken) continue;
    const dz = c.z - z;
    if (dz > 12 || dz < -3) continue;
    if (mag && !c.mag && dz < 10 && Math.abs(c.y - cy) < 4.5) c.mag = true;
    if (c.mag) {
      const k = Math.min(1, h * 13);
      c.x += (P.x - c.x) * k; c.y += (cy - c.y) * k; c.z += (z + 0.2 - c.z) * k;
    }
    if (Math.abs(c.z - z) < 0.95 && Math.abs(c.x - P.x) < 0.95 && Math.abs(c.y - cy) < 1.25) {
      c.taken = true;
      G.coinStreak = G.coinStreakT > 0 ? G.coinStreak + 1 : 0; G.coinStreakT = 0.35;
      addCoins(1, c.x, c.y, -(c.z - z));
      Snd.play('coin', Math.min(G.coinStreak, 12));
    }
  }
}
function nearMiss(text, pts, heat) {
  const s = pts * mult();
  G.score += s; G.dodges++;
  addHeat(heat);
  if (pts >= 50) { UI.pop(text + ' +' + s, 'good'); Snd.play('dodge'); }
}

/* ---------------- 每帧（非物理）更新 ---------------- */
function runFrame(dt) {
  G.heat = Math.max(0, G.heat - dt * 0.022);
  if (G.coinStreakT > 0) G.coinStreakT -= dt;
  P.phase += dt * (5 + G.speed * 0.42);
  G.viewMix = approach(G.viewMix, Save.data.set.view, 6, dt);
  G.eyeH = approach(G.eyeH, P.rollT > 0 ? 0.62 : 1.55, 16, dt);
  G.lookDown = approach(G.lookDown, (G.fx.jet > 0 || G.jetFall > 0) ? 2.3 : 0.75, 4, dt);
  if (G.camBlend > 0) G.camBlend = Math.max(0, G.camBlend - dt / 0.8);
  const target = G.stumbleT > 0 ? 2.4 : 9;
  G.chase = approach(G.chase, target, G.stumbleT > 0 ? 6 : 0.9, dt);
  chaser.x = approach(chaser.x, P.x, 4, dt); chaser.phase += dt * (6 + G.speed * 0.35);

  W.extend(G.dist + PLATFORM.viewDist + 60);
  W.prune(G.dist);

  /* 提示（新手教学） */
  while (W.hints.length && G.dist >= W.hints[0].z) { const hnt = W.hints.shift(); UI.hint(PLATFORM.hints[hnt.key], 2600); }

  /* 进入新区域 */
  const zi = Math.floor(G.dist / ZONE_LEN);
  if (zi !== G.zoneIdx) { G.zoneIdx = zi; UI.pop('进入 · ' + THEMES[themeOfZone(zi)].name, 'zone'); Snd.play('level'); }

  /* 环境粒子 */
  const th = envNow.theme;
  if (th === 2 && Math.random() < dt * 60) ps.spawn({ x: (Math.random() - 0.5) * 22, y: 2 + Math.random() * 8, z: -4 - Math.random() * 40, vx: 0.6, vy: -2.2, life: 1.6, size: 0.07, col: [1, 1, 1], a: 0.9, add: 0, scroll: 1 });
  if (G.heatLevel >= 3 && Math.random() < dt * (G.heatLevel * 2.2)) ps.spawn({ x: (Math.random() - 0.5) * 10, y: 0.3 + Math.random() * 4, z: -28 - Math.random() * 14, vy: 0.8, life: 1.5, size: 0.06, col: [1, 0.5, 0.15], scroll: 1 });
  if (G.fx.jet > 0) {
    for (const s of [-1, 1]) ps.spawn({ x: P.x + s * 0.22, y: P.y + 0.35, z: 0.45, vx: (Math.random() - 0.5), vy: -5 - Math.random() * 3, life: 0.28, size: 0.2, col: [1, 0.6 + Math.random() * 0.3, 0.15], scroll: 0.3, grow: -0.6 });
  }
  if (G.fx.shoes > 0 && Math.random() < dt * 30) ps.spawn({ x: P.x + (Math.random() - 0.5) * 0.4, y: P.y + 0.1, z: 0.2, vy: 0.5, life: 0.4, size: 0.09, col: FX_INFO.shoes.col, scroll: 1 });
  if (G.board.t > 0 && Math.random() < dt * 40) ps.spawn({ x: P.x + (Math.random() - 0.5) * 0.5, y: P.y + 0.12, z: 0.7, vy: -0.3, life: 0.35, size: 0.1, col: FX_INFO.board.col, scroll: 1 });
  /* 对向列车车灯光晕 */
  for (const o of W.objs) {
    if (o.t === 'mtrain' && o.active && !o.dead) {
      const zr = -(o.z - G.dist);
      if (zr < 0 && zr > -PLATFORM.viewDist) for (const s of [-1, 1]) ps.spawn({ x: o.x + s * 0.66, y: 0.84, z: zr + 0.2, life: 0.05, size: 0.75, col: [1, 0.95, 0.6], a: 0.8, fade: 0, scroll: 0 });
    }
  }
  /* 脚步声 / 追逐音效 */
  if (P.grounded && G.board.t <= 0) { G.stepT -= dt * (G.speed / 4.6); if (G.stepT <= 0) { G.stepT = 1; Snd.play('step'); } }
  if (G.stumbleT > 0) { G.barkT -= dt; if (G.barkT <= 0) { G.barkT = 0.9 + Math.random() * 0.8; Snd.play('bark'); } }

  /* HUD */
  UI.hud({
    score: Math.floor(G.score), coins: G.coins, mult: mult(), heat: G.heat, heatLevel: G.heatLevel,
    dist: Math.floor(G.dist), chase: clamp((G.chase - 2.4) / 6.6, 0, 1), danger: G.stumbleT > 0,
    fx: G.fx, fxMax: G.fxMax, board: G.board, boardCd: BOARD_CD, double: G.fx.double > 0,
  });
}

function introUpdate(dt) {
  G.introT += dt;
  const t = G.introT;
  P.phase += dt * 6;
  if (t < 1.15) {
    P.yaw = Math.PI / 2;
    if (Math.random() < dt * 50) ps.spawn({ x: -0.6, y: 1.0 + Math.random() * 0.3, z: -0.05, vx: -3 - Math.random() * 2, vy: (Math.random() - 0.5) * 1.5, vz: (Math.random() - 0.5) * 1.5, life: 0.25, size: 0.13, col: [1, 0.35, 0.8], a: 0.7, scroll: 0 });
  } else {
    const k = smooth((t - 1.15) / 0.45);
    P.yaw = (Math.PI / 2) * (1 - k);
    P.hop = Math.sin(clamp((t - 1.15) / 0.4, 0, 1) * Math.PI) * 0.35;
  }
  G.chase = lerp(16, 4.6, smooth(t / 1.7));
  chaser.phase += dt * 11; chaser.x = 0.6;
  if (t >= 1.75) { P.yaw = 0; P.hop = 0; Game.beginRun(); }
}
function dyingUpdate(dt) {
  G.dieT += dt;
  G.chase = approach(G.chase, 1.25, 5, dt);
  chaser.x = approach(chaser.x, P.x, 5, dt);
  if (G.chase > 1.5) chaser.phase += dt * 12;
  if (!P.grounded) {                           // 让企鹅落回地面
    P.vy -= GRAV * dt; P.y += P.vy * dt;
    const g = groundAt(P.x, G.dist, P.y + 0.6);
    if (P.y <= g) { P.y = g; P.grounded = true; P.vy = 0; }
  }
  if (Math.random() < dt * 14) {
    const a = G.time * 5 + Math.random();
    ps.spawn({ x: P.x + Math.cos(a) * 0.4, y: P.y + 1.75, z: Math.sin(a) * 0.4, life: 0.4, size: 0.09, col: [1, 0.9, 0.3], scroll: 0 });
  }
  if (G.dieT > 1.9 && G.state === 'dying') {
    G.state = 'over';
    UI.showHUD(false);
    UI.showOver({ score: G.finalScore, best: Save.data.best, newBest: G.newBest, coins: G.coins, dist: Math.floor(G.dist), level: G.heatLevel, total: Save.data.coins, cause: G.dieCause });
    Snd.play('over');
  }
}

function update(dt) {
  G.time += dt;
  let scroll = 0;
  switch (G.state) {
    case 'menu':
      G.menuT += dt; P.phase += dt * 3;
      { /* 主菜单：企鹅大部分时间看向镜头，偶尔转身补两笔涂鸦 */
        const c = G.menuT % 7, k = c < 4 ? 0 : c < 4.5 ? smooth((c - 4) / 0.5) : c < 6.3 ? 1 : 1 - smooth((c - 6.3) / 0.7);
        P.yaw = lerp(-0.62, Math.PI / 2, k); G.menuSpray = k > 0.95;
      }
      if (G.menuSpray && Math.random() < dt * 40) ps.spawn({ x: -0.6, y: 1.0 + Math.random() * 0.3, z: -0.05, vx: -3 - Math.random() * 2, vy: (Math.random() - 0.5) * 1.5, vz: (Math.random() - 0.5) * 1.5, life: 0.25, size: 0.13, col: [0.4, 0.95, 1], a: 0.7, scroll: 0 });
      break;
    case 'intro': introUpdate(dt); break;
    case 'run': {
      let acc = dt;
      while (acc > 1e-5 && G.state === 'run') { const h = Math.min(acc, 1 / 120); stepRun(h); acc -= h; }
      if (G.state === 'run') runFrame(dt);
      scroll = G.speed;
      break;
    }
    case 'dying': dyingUpdate(dt); break;
    default: break;
  }
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 1.6);
  if (G.state !== 'pause') ps.update(dt, scroll);
}

/* ---------------- 镜头 ---------------- */
function copyCam(a, b) { a.ex = b.ex; a.ey = b.ey; a.ez = b.ez; a.tx = b.tx; a.ty = b.ty; a.tz = b.tz; a.roll = b.roll; a.fov = b.fov; }
function lerpCam(o, a, b, t) {
  o.ex = lerp(a.ex, b.ex, t); o.ey = lerp(a.ey, b.ey, t); o.ez = lerp(a.ez, b.ez, t);
  o.tx = lerp(a.tx, b.tx, t); o.ty = lerp(a.ty, b.ty, t); o.tz = lerp(a.tz, b.tz, t);
  o.roll = lerp(a.roll, b.roll, t); o.fov = lerp(a.fov, b.fov, t);
}
function baseFov() {
  const a = R.aspect;
  if (a >= 1.2) return 1.05;
  return clamp(2 * Math.atan(Math.tan(0.55) / a), 1.05, 1.5);
}
function camPlay(o) {
  const v = smooth(G.viewMix), portrait = R.aspect < 1;
  const onFoot = P.grounded && G.board.t <= 0;
  const bob = onFoot ? Math.sin(P.phase * 2) * 0.04 : (G.board.t > 0 ? Math.sin(G.time * 5) * 0.02 : 0);
  const fx = P.x + (onFoot ? Math.sin(P.phase) * 0.025 : 0), fy = P.y + G.eyeH + bob;
  const lead = (laneX(P.lane) - P.x);
  const tpx = P.x * 0.8, tpy = P.y * 0.8 + (portrait ? 4.0 : 3.3), tpz = portrait ? 6.8 : 5.6;
  o.ex = lerp(fx, tpx, v); o.ey = lerp(fy, tpy, v); o.ez = lerp(0.05, tpz, v);
  o.tx = lerp(P.x + lead * 0.4, P.x * 0.9, v);
  o.ty = lerp(fy - G.lookDown, P.y * 0.7 + 1.2, v);
  o.tz = lerp(-7, -8, v);
  o.roll = -lead * 0.035 * (1 - v * 0.5) + (P.rollT > 0 ? Math.sin((1 - P.rollT / 0.68) * Math.PI) * 0.1 * (1 - v) : 0);
  o.fov = baseFov() + (G.speed - 13) * 0.006 + (G.fx.jet > 0 ? 0.1 : 0) + (G.heatLevel - 1) * 0.004;
}
function camIntro(o, t) {
  const portrait = R.aspect < 1, sw = Math.sin(G.time * 0.5) * 0.25;
  o.ex = (portrait ? 2.0 : 3.0) + sw; o.ey = 1.55; o.ez = portrait ? -4.6 : -3.9;
  o.tx = portrait ? -0.35 : -0.9; o.ty = portrait ? 1.25 : 1.05; o.tz = 0.6;
  o.roll = 0; o.fov = baseFov() * (portrait ? 0.8 : 0.9);
}
function camDie(o) {
  /* 从身后斜上方看：企鹅撞晕在障碍前，警卫和小狗从后面追上来 */
  const s = G.dieSide, portrait = R.aspect < 1;
  o.ex = P.x + 0.85 * s; o.ey = P.y + 2.3; o.ez = portrait ? 5.0 : 4.3;
  o.tx = P.x; o.ty = P.y + 0.9; o.tz = -0.6; o.roll = 0.04 * s; o.fov = baseFov() * 0.92;
}
function buildView() {
  if (G.state === 'menu' || G.state === 'intro') { camIntro(camO); copyCam(camB, camO); }
  else if (G.state === 'dying' || G.state === 'over') { camDie(camA); lerpCam(camO, camB, camA, smooth(Math.min(1, G.dieT / 0.55))); }
  else {
    camPlay(camA);
    if (G.camBlend > 0) lerpCam(camO, camA, camB, smooth(G.camBlend)); else copyCam(camO, camA);
  }
  const c = camO;
  let ex = c.ex, ey = c.ey;
  if (G.shake > 0) { ex += (Math.random() - 0.5) * G.shake * 0.35; ey += (Math.random() - 0.5) * G.shake * 0.35; }
  const dx = c.tx - ex, dy = c.ty - ey, dz = c.tz - c.ez;
  const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
  M4.identity(view);
  M4.rotZ(view, -c.roll); M4.rotX(view, -pitch); M4.rotY(view, -yaw);
  M4.translate(view, -ex, -ey, -c.ez);
  M4.perspective(proj, c.fov, R.aspect, 0.25, 420);
  G.camPitch = pitch; G.camFov = c.fov;
}

/* ---------------- 角色绘制 ---------------- */
function drawPenguin(x, y, zr, yaw, pose) {
  const body = MD.penguin[Save.data.skin] || MD.penguin[0];
  const ph = P.phase;
  let bob = 0, wad = 0, lean = 0, sw = 0, out = 0.22, fL = 0, fR = 0, fz = 0, spin = 0, by = 0;
  if (pose === 'run') { bob = Math.abs(Math.sin(ph)) * 0.07; wad = Math.sin(ph) * 0.09; sw = Math.sin(ph) * 0.85; fL = Math.max(0, Math.sin(ph)) * 0.2; fR = Math.max(0, -Math.sin(ph)) * 0.2; fz = Math.cos(ph) * 0.18; lean = -0.12; }
  else if (pose === 'jump') { out = 1.25; fL = fR = 0.12; fz = 0; lean = -0.1; }
  else if (pose === 'roll') { spin = (1 - P.rollT / 0.68) * TAU; out = 0.1; }
  else if (pose === 'board') { out = 1.0 + Math.sin(G.time * 4) * 0.12; by = 0.2 + Math.sin(G.time * 5) * 0.03; wad = Math.sin(G.time * 2.4) * 0.06; }
  else if (pose === 'jet') { lean = -0.5; out = 0.5; fL = fR = 0.05; }
  else if (pose === 'spray' || pose === 'wave') { bob = Math.sin(ph) * 0.012; out = 0.2; }
  else if (pose === 'dizzy') { lean = 0.5; wad = Math.sin(G.time * 9) * 0.07; out = 1.1; }
  M4.identity(mb); M4.translate(mb, x, y + bob + by, zr); M4.rotY(mb, yaw + (pose === 'board' ? 0.95 : 0));
  if (pose === 'roll') { M4.translate(mb, 0, 0.5, 0); M4.rotX(mb, -spin); M4.scale(mb, 0.86, 0.86, 0.86); M4.translate(mb, 0, -0.62, 0); }
  else { M4.rotZ(mb, wad); M4.rotX(mb, lean); }
  const blink = P.invuln > 0 && G.state === 'run' && Math.sin(G.time * 40) > 0 ? 0.45 : 1;
  R.draw(body, mb, blink);
  for (const s of [-1, 1]) {
    M4.copy(m, mb); M4.translate(m, s * 0.44, 0.9, 0); M4.rotZ(m, s * out);
    let a = s > 0 ? sw : -sw;
    if (pose === 'spray' && s > 0) a = 1.35 + Math.sin(G.time * 9) * 0.12;
    if (pose === 'wave' && s > 0) { M4.rotZ(m, 1.9 + Math.sin(G.time * 7) * 0.35); a = 0; }
    M4.rotX(m, a);
    R.draw(MD.pFlip, m, blink);
    M4.copy(m, mb); M4.translate(m, s * 0.18, s > 0 ? fR : fL, s > 0 ? -fz : fz);
    R.draw(MD.pFoot, m, blink);
  }
  if (pose === 'board') {
    M4.identity(m); M4.translate(m, x, y + 0.14 + Math.sin(G.time * 5) * 0.03, zr); M4.rotY(m, yaw); M4.rotZ(m, Math.sin(G.time * 2.4) * 0.05);
    R.draw(MD.board, m);
  }
  if (pose === 'jet') {
    M4.copy(m, mb); M4.translate(m, 0, 0.62, 0.56); M4.scale(m, 0.8, 0.8, 0.8);
    R.draw(MD.pu.jet, m);
  }
}
function drawGuard(x, y, zr, yaw, running) {
  const ph = chaser.phase, sw = running ? Math.sin(ph) * 0.95 : 0, bob = running ? Math.abs(Math.sin(ph)) * 0.08 : 0;
  M4.identity(mb); M4.translate(mb, x, y + bob, zr); M4.rotY(mb, yaw); M4.rotX(mb, running ? -0.14 : 0);
  R.draw(MD.guard.body, mb);
  for (const s of [-1, 1]) {
    M4.copy(m, mb); M4.translate(m, s * 0.17, 0.95, 0); M4.rotX(m, s * sw);
    R.draw(MD.guard.leg, m);
    M4.copy(m, mb); M4.translate(m, s * 0.43, 1.58, 0); M4.rotX(m, running ? -s * sw * 0.8 + (s > 0 ? 0.5 : 0) : (s > 0 ? 1.1 : 0.2));
    R.draw(s > 0 ? MD.guard.armR : MD.guard.arm, m);
  }
}
function drawDog(x, y, zr, yaw, running) {
  const ph = chaser.phase * 1.5, sw = running ? Math.sin(ph) * 0.8 : 0, bob = running ? Math.abs(Math.sin(ph)) * 0.1 : 0;
  M4.identity(mb); M4.translate(mb, x, y + bob, zr); M4.rotY(mb, yaw); M4.rotX(mb, running ? Math.sin(ph) * 0.08 : 0);
  R.draw(MD.dog.body, mb);
  M4.copy(m, mb); M4.translate(m, 0, 0.45, -0.25); M4.rotX(m, sw); R.draw(MD.dog.legs, m);
  M4.copy(m, mb); M4.translate(m, 0, 0.45, 0.32); M4.rotX(m, -sw); R.draw(MD.dog.legs, m);
}

/* ---------------- 第一人称手部模型 ---------------- */
function drawViewModel() {
  const hh = 0.62 * Math.tan(0.5), hw = Math.min(0.4, hh * R.aspect * 0.9);
  M4.perspective(projVM, 1.0, R.aspect, 0.05, 10);
  R.clearDepth();
  R.begin(projVM, IDENT, { noFog: true });
  const onBoard = G.board.t > 0, air = !P.grounded, jet = G.fx.jet > 0, roll = P.rollT > 0;
  const run = P.grounded && !onBoard && !roll;
  for (const s of [-1, 1]) {
    const swing = run ? Math.sin(P.phase + (s > 0 ? 0 : Math.PI)) : 0;
    let x = s * hw, y = -hh * 1.0 + swing * 0.045, z = -0.62 + swing * 0.07, spread = 0.5;
    if (air || jet) { y += 0.07; spread = 0.9; x *= 1.12; }
    if (onBoard && !air) { y += 0.03 + Math.sin(G.time * 4 + s) * 0.012; spread = 0.85; x *= 1.1; }
    if (roll) { y -= 0.1; }
    M4.identity(m); M4.translate(m, x, y, z); M4.rotY(m, -s * 0.38); M4.rotX(m, 0.3 + swing * 0.22); M4.rotZ(m, s * spread);
    M4.scale(m, 0.72, 0.72, 0.72);
    R.draw(MD.vmFlip, m);
    if (s > 0 && !onBoard) { M4.translate(m, 0, 0.06, -0.44); M4.rotX(m, -0.5); M4.scale(m, 0.8, 0.8, 0.8); R.draw(MD.vmCan, m); }
  }
  M4.identity(m); M4.translate(m, 0, -hh * 1.04 + (run ? Math.sin(P.phase * 2) * 0.006 : 0) - (roll ? 0.05 : 0), -0.5);
  R.draw(MD.vmBeak, m);
  if (onBoard) {
    M4.identity(m); M4.translate(m, 0, -0.6 + Math.sin(G.time * 5) * 0.012, -1.55); M4.rotX(m, 0.06); M4.rotZ(m, Math.sin(G.time * 2.4) * 0.04); M4.scale(m, 0.8, 0.8, 0.8);
    R.draw(MD.board, m);
  }
  R.end();
}

/* ---------------- 渲染 ---------------- */
const tintTmp = [1, 1, 1, 1];
function render() {
  const z = G.dist, VD = PLATFORM.viewDist;
  const env = computeEnv(z);
  buildView();
  const E = R.env;
  E.amb = env.amb; E.sun = env.sun; E.fogCol = env.hor;
  E.fogNear = VD * 0.42 * env.fogK; E.fogFar = VD * env.fogK;
  const cinematic = G.state === 'menu' || G.state === 'intro';
  E.curve[0] = cinematic ? 0 : Math.sin(z * 0.0045) * 0.00055 + Math.sin(z * 0.0017 + 1.3) * 0.0004;
  E.curve[1] = cinematic ? 0.0002 : 0.00042;
  R.frameStart();
  const horY = clamp(Math.tan(-G.camPitch) / Math.tan(G.camFov / 2) - 0.1, -0.9, 0.9);
  R.sky({ top: env.top, hor: env.hor, sunCol: env.sunCol, sunPos: [env.sunX, horY + env.sunY], horY, stars: env.stars, aurora: env.aurora, time: G.time });
  R.begin(proj, view);

  /* 地面与场景 */
  const lookBack = cinematic || G.state === 'dying' || G.state === 'over';
  const k0 = Math.floor((z - (lookBack ? 110 : 24)) / CH), k1 = Math.floor((z + VD) / CH);
  for (let k = k0; k <= k1; k++) {
    M4.identity(m); M4.translate(m, 0, 0, -(k * CH - z));
    R.draw(MD.ground[themeOfChunk(k)], m);
    const d = chunkDecor(k);
    for (let i = 0; i < d.length; i++) {
      const it = d[i];
      M4.identity(m); M4.translate(m, it.x, it.y, -(it.z - z));
      if (it.ry) M4.rotY(m, it.ry);
      R.draw(it.mesh, m);
    }
  }

  /* 障碍物与道具 */
  const objs = W.objs, t = G.time;
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.dead) continue;
    const zr = -(o.z - z);
    if (zr < -VD - 4 || zr > 30 + (o.len || 0)) continue;
    M4.identity(m);
    switch (o.t) {
      case 'train': M4.translate(m, o.x, 0, zr); R.draw(o.tagged ? MD.trainTagged : MD.trains[o.col], m); break;
      case 'mtrain':
        for (let c = 0; c < o.cars; c++) { M4.identity(m); M4.translate(m, o.x, 0, zr - c * CAR_LEN); R.draw(MD.trainMove, m); }
        break;
      case 'ramp': M4.translate(m, o.x, 0, zr); R.draw(MD.ramp, m); break;
      case 'low': case 'low2': case 'high': M4.translate(m, o.x, 0, zr); R.draw(MD[o.t], m); break;
      case 'pu': {
        M4.translate(m, o.x, o.y + Math.sin(t * 3 + o.z) * 0.12, zr); M4.rotY(m, t * 2.2); M4.scale(m, 1.25, 1.25, 1.25);
        R.draw(MD.pu[o.kind], m);
        break;
      }
      default: break;
    }
  }
  const coins = W.coins;
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i];
    if (c.taken) continue;
    const zr = -(c.z - z);
    if (zr < -VD || zr > 6) continue;
    M4.identity(m); M4.translate(m, c.x, c.y, zr); M4.rotY(m, t * 3.2 + c.z * 0.35);
    R.draw(MD.coin, m);
  }

  /* 角色 */
  const v = G.viewMix;
  const showBody = cinematic || G.state === 'dying' || G.state === 'over' || v > 0.3 || G.camBlend > 0.25;
  if (cinematic) {
    drawPenguin(0, P.hop, 0, P.yaw, G.state === 'intro' ? (G.introT > 1.15 ? 'jump' : 'spray') : (G.menuSpray ? 'spray' : 'wave'));
    if (G.state === 'intro') {
      drawGuard(chaser.x, 0, G.chase, 0, G.introT < 1.75);
      drawDog(chaser.x - 1.2, 0, G.chase - 1.4, 0, true);
    }
  } else if (G.state === 'dying' || G.state === 'over') {
    /* 第一人称下刚撞上的一瞬间镜头还在企鹅脑袋里，等镜头拉开后再画身体 */
    if (v > 0.3 || G.dieT > 0.2) drawPenguin(P.x, P.y, 0, Math.PI - 0.5 * G.dieSide, 'dizzy');
    const run = G.chase > 1.5;
    drawGuard(chaser.x - 0.45 * G.dieSide, P.y > 1 ? P.y : 0, G.chase, 0, run);
    drawDog(chaser.x + 0.75 * G.dieSide, P.y > 1 ? P.y : 0, G.chase - 0.35, -0.5 * G.dieSide, true);
  } else {
    if (showBody) {
      const pose = G.fx.jet > 0 ? 'jet' : G.board.t > 0 ? 'board' : P.rollT > 0 ? 'roll' : !P.grounded ? 'jump' : 'run';
      drawPenguin(P.x, P.y, 0, 0, pose);
    }
    if (G.chase < camO.ez - 1.2) {
      drawGuard(chaser.x + 0.3, 0, G.chase, 0, true);
      drawDog(chaser.x - 0.9, 0, G.chase - 1.0, 0, true);
    }
  }

  /* 半透明：影子、道具光圈、护盾 */
  if (showBody && !cinematic) {
    const g = groundAt(P.x, z, P.y);
    M4.identity(m); M4.translate(m, P.x, g + 0.16, 0); M4.scale(m, 0.5, 1, 0.42);
    tintTmp[0] = tintTmp[1] = tintTmp[2] = 0; tintTmp[3] = 1;
    R.draw(MD.disc, m, 0.32, tintTmp);
  }
  for (let i = 0; i < objs.length; i++) {
    const o = objs[i];
    if (o.t !== 'pu' || o.dead) continue;
    const zr = -(o.z - z);
    if (zr < -VD || zr > 5) continue;
    const col = FX_INFO[o.kind === 'chest' ? 'double' : o.kind].col;
    tintTmp[0] = o.kind === 'chest' ? 1 : col[0]; tintTmp[1] = o.kind === 'chest' ? 0.82 : col[1]; tintTmp[2] = o.kind === 'chest' ? 0.3 : col[2]; tintTmp[3] = 1;
    const s = 0.75 + Math.sin(t * 5 + o.z) * 0.1;
    M4.identity(m); M4.translate(m, o.x, 0.17, zr); M4.scale(m, s, 1, s);
    R.draw(MD.disc, m, 0.42, tintTmp);
  }
  if (G.stumbleT > 0 && G.state === 'run') {     // 警卫手电筒照在前方地面
    tintTmp[0] = 1; tintTmp[1] = 0.95; tintTmp[2] = 0.7; tintTmp[3] = 1;
    M4.identity(m); M4.translate(m, P.x + Math.sin(t * 7) * 0.5, P.y + 0.18, -4.2 + Math.sin(t * 5) * 0.6); M4.scale(m, 0.9, 1, 1.5);
    R.draw(MD.disc, m, 0.16 + Math.sin(t * 11) * 0.03, tintTmp);
  }
  R.end();
  R.particles(ps, proj, view);

  if (!cinematic && (G.state === 'run' || G.state === 'pause') && v < 0.3 && G.camBlend <= 0.25) drawViewModel();
}

/* ---------------- 输入：键盘 + 指针滑动 + 双击 ---------------- */
const Input = {
  init() {
    const el = document.getElementById('stage');
    let sx = 0, sy = 0, st = 0, active = false, fired = false, lastTap = 0, ltx = 0, lty = 0, pid = null;
    const TH = PLATFORM.swipePx;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.ui')) return;
      Snd.unlock();
      active = true; fired = false; sx = e.clientX; sy = e.clientY; st = performance.now(); pid = e.pointerId;
    });
    el.addEventListener('pointermove', (e) => {
      if (!active || fired || e.pointerId !== pid) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < TH) return;
      fired = true;
      if (Math.abs(dx) > Math.abs(dy)) { if (dx > 0) Game.right(); else Game.left(); }
      else if (dy > 0) Game.roll(); else Game.jump();
    });
    const up = (e) => {
      if (!active || e.pointerId !== pid) return;
      active = false;
      if (fired) return;
      const now = performance.now();
      if (now - st > 280) return;
      if (now - lastTap < 340 && Math.hypot(e.clientX - ltx, e.clientY - lty) < 70) { lastTap = 0; Game.board(); }
      else { lastTap = now; ltx = e.clientX; lty = e.clientY; Game.tap(); }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { active = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault(); return; }
      Snd.unlock();
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      let used = true;
      switch (k) {
        case 'ArrowLeft': case 'a': Game.left(); break;
        case 'ArrowRight': case 'd': Game.right(); break;
        case 'ArrowUp': case 'w': Game.jump(); break;
        case ' ': if (G.state === 'run') Game.jump(); else UI.primary(); break;
        case 'ArrowDown': case 's': Game.roll(); break;
        case 'Shift': case 'e': case 'f': Game.board(); break;
        case 'v': if (G.state === 'run') Game.toggleView(); break;
        case 'm': Save.data.set.sfx = Save.data.set.music = !(Save.data.set.sfx || Save.data.set.music); Save.store(); Game.applySettings(); UI.refreshSettings(); break;
        case 'Escape': case 'p': if (G.state === 'run') Game.pause(); else if (G.state === 'pause') Game.resume(); else UI.back(); break;
        case 'Enter': if (G.state === 'intro') Game.tap(); else UI.primary(); break;
        default: used = false;
      }
      if (used) e.preventDefault();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) Game.pause(); });
    window.addEventListener('blur', () => Game.pause());
  },
};

/* ---------------- 启动与主循环 ---------------- */
function resize() {
  if (!R) return;
  const el = document.getElementById('stage');
  const q = Save.data.set.quality;
  const dpr = Math.min(window.devicePixelRatio || 1, PLATFORM.maxDpr) * (q === 0 ? 0.7 : 1);
  R.resize(el.clientWidth, el.clientHeight, dpr);
}
let lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  if (G.state === 'boot' || G.hold) return;       // G.hold 仅供自动化测试冻结实时循环
  update(G.state === 'pause' ? 0 : dt);
  render();
}
function boot() {
  Save.load();
  UI.init();
  const canvas = document.getElementById('gl');
  try {
    R = new Renderer(canvas);
    const at = makeAtlas();
    R.setTexture(at.canvas);
    MD = buildModels(R.gl, at.UV);
  } catch (err) {
    UI.fatal('无法启动 3D 画面：' + (err && err.message ? err.message : err) + '。请换用较新的浏览器（Chrome / Edge / Safari / Firefox）。');
    return;
  }
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); Game.pause(); });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  ps = new Particles(R.PT_MAX);
  Snd.apply();
  Input.init();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  Game.toMenu();
  lastT = performance.now();
  requestAnimationFrame(loop);
}
