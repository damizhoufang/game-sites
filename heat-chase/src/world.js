/* =====================================================================
 * 热力追逐 · 关卡生成
 * 无限生成三条轨道上的列车、栏杆、金币和道具，
 * 并始终保证至少有一条"安全通道"可以通过（不会出现必死局面）
 * ===================================================================== */

function speedAt(z) { return Math.min(30, 13 + z * 0.0042); }

const PU_KINDS = ['jet', 'shoes', 'magnet', 'double', 'chest'];
const SKY_Y = 7.1;

class World {
  constructor(seed, opts) {
    opts = opts || {};
    this.rnd = mulberry(seed);
    this.objs = [];
    this.coins = [];
    this.hints = [];
    this.safe = 1;                       // 当前安全通道所在轨道
    this.trainEnd = [-99, -99, -99];     // 每条轨道上最后一列车的车尾位置
    this.nextTrain = [0, 0, 0];          // 每条轨道最早可以再放列车的位置
    this.nextHurdle = [0, 0, 0];         // 每条轨道最早可以再放栏杆的位置
    this.lastHurdle = [-99, -99, -99];
    this.hold = { lane: -1, until: 0 };  // 换安全通道时，旧通道需保持畅通到这里
    this.clearFrom = -1; this.clearUntil = -1;   // 喷气背包降落区：不放障碍
    this.movingUntil = -1;                // 对向列车经过期间，安全通道不换位置
    this.nextPU = 170 + this.rnd() * 60;
    this.colorI = (this.rnd() * 5) | 0;

    /* 开场：左轨停着一节刚被涂鸦的车厢 */
    this.objs.push({ t: 'train', lane: 0, x: laneX(0), z: -8, len: CAR_BODY, solid: true, tagged: true, col: 0 });
    this.trainEnd[0] = 6; this.nextTrain[0] = 40; this.nextHurdle[0] = 30;
    this.genZ = 38;
    if (opts.tutorial) this._tutorial();
  }

  /* ---------- 基础放置 ---------- */
  _hurdle(type, lane, z) {
    this.objs.push({ t: type, lane, x: laneX(lane), z });
    this.lastHurdle[lane] = z;
    /* 同一轨道上：跳过低栏后要留出落地 + 再起跳的距离；钻过高栏后留出起身的距离 */
    const sp = speedAt(z);
    this.nextHurdle[lane] = Math.max(this.nextHurdle[lane], z + sp * (type === 'high' ? 0.62 : 0.94));
  }
  _train(lane, z, cars, ramp) {
    const col = (this.colorI++) % 5;
    if (ramp) {
      this.objs.push({ t: 'ramp', lane, x: laneX(lane), z, len: RAMP_LEN, solid: true });
      for (let i = 0; i < 4; i++) {
        const k = 0.18 + i * 0.25;
        this.coins.push({ x: laneX(lane), y: k * ROOF_H + 0.9, z: z + k * RAMP_LEN });
      }
      z += RAMP_LEN;
    }
    for (let i = 0; i < cars; i++) {
      this.objs.push({ t: 'train', lane, x: laneX(lane), z: z + i * CAR_LEN, len: i < cars - 1 ? CAR_LEN : CAR_BODY, solid: true, col });
    }
    const end = z + cars * CAR_LEN;
    if (ramp || this.rnd() < 0.22) {
      for (let zz = z + 2.5; zz < end - 2.5; zz += 1.8) this.coins.push({ x: laneX(lane), y: ROOF_H + 0.9, z: zz });
    }
    this.trainEnd[lane] = end;
    this.nextTrain[lane] = end + 22;
    this.nextHurdle[lane] = end + 22;
    return end;
  }
  _coinLine(lane, z, n, y) {
    for (let i = 0; i < n; i++) this.coins.push({ x: laneX(lane), y: y === undefined ? 0.9 : y, z: z + i * 1.6 });
  }
  _coinArc(lane, z, span, peak) {
    for (let i = -3; i <= 3; i++) {
      const k = i / 3;
      this.coins.push({ x: laneX(lane), y: 0.9 + peak * (1 - k * k), z: z + k * span });
    }
  }
  _pu(z, kind) {
    const R = this.rnd;
    if (!kind) {
      const r = R();
      kind = r < 0.26 ? 'chest' : r < 0.46 ? 'magnet' : r < 0.64 ? 'double' : r < 0.82 ? 'shoes' : 'jet';
      if (kind === 'jet' && z < 220) kind = 'magnet';
    }
    this.objs.push({ t: 'pu', kind, lane: this.safe, x: laneX(this.safe), y: 1.15, z });
  }
  _trainFreeAt(l, z) { return z >= this.trainEnd[l] + 1.5; }

  /* ---------- 新手教学段：跳、滚、换道各练一次 ---------- */
  _tutorial() {
    for (let l = 0; l < 3; l++) this._hurdle('low', l, 56);
    this.hints.push({ z: 56 - 24, key: 'jump' });
    this._coinArc(1, 56, 3.2, 1.2);
    for (let l = 0; l < 3; l++) this._hurdle('high', l, 94);
    this.hints.push({ z: 94 - 24, key: 'roll' });
    this._coinLine(1, 90, 5, 0.5);
    this._train(1, 134, 1, false); this._train(2, 134, 1, false);
    this.hints.push({ z: 134 - 30, key: 'lane' });
    this._coinLine(0, 126, 9);
    this.hints.push({ z: 168, key: 'board' });
    this.safe = 0;
    this.genZ = 176;
  }

  /* ---------- 喷气背包：清出降落区 + 空中金币 ---------- */
  clearZone(z0, z1) {
    this.clearFrom = z0; this.clearUntil = z1;
    this.objs = this.objs.filter((o) => {
      if (o.t === 'pu') return true;
      if (o.t === 'mtrain') return o.active || !(o.z - 80 > z0 - 30 && o.z - 80 < z1);
      const a = o.z, b = o.z + (o.len || 0.5);
      return !(b > z0 && a < z1);
    });
    this.coins = this.coins.filter((c) => !(c.z > z0 && c.z < z1 && c.y > 2));
    for (let l = 0; l < 3; l++) {
      if (this.trainEnd[l] > z0) this.trainEnd[l] = Math.min(this.trainEnd[l], z0);
    }
  }
  skyCoins(z0, z1) {
    let lane = (this.rnd() * 3) | 0, n = 0;
    for (let z = z0; z < z1; z += 1.7) {
      this.coins.push({ x: laneX(lane), y: SKY_Y, z, sky: true });
      if (++n >= 9) { n = 0; lane = clamp(lane + (this.rnd() < 0.5 ? -1 : 1), 0, 2); z += 5; }
    }
  }

  /* ---------- 向前生成 ---------- */
  extend(toZ) {
    let guard = 0;
    while (this.genZ < toZ && guard++ < 400) this._step();
  }
  _step() {
    const z = this.genZ, R = this.rnd;
    const d = clamp(z / 3500, 0, 1), sp = speedAt(z);
    const gap = Math.max(9.5, sp * (0.66 - 0.15 * d));

    if (z > this.clearFrom - 52 && z < this.clearUntil) {       // 降落区内只放金币
      if (R() < 0.6) this._coinLine((R() * 3) | 0, z + 2, 5);
      this.genZ += gap;
      return;
    }
    if (z >= this.nextPU) {
      this._pu(z + gap * 0.5);
      this.nextPU = z + 230 + R() * 190;
    }

    const wH = 0.37, wT = 0.3 + 0.08 * d, wS = 0.12, wM = z > 450 ? 0.07 + 0.06 * d : 0, wG = 0.1;
    let r = R() * (wH + wT + wS + wM + wG);
    if ((r -= wH) < 0) return this._evHurdles(z, gap, d);
    if ((r -= wT) < 0) return this._evTrain(z, gap, d);
    if ((r -= wS) < 0) return this._evSwitch(z, gap, sp);
    if ((r -= wM) < 0) return this._evMoving(z, gap);
    return this._evGap(z, gap);
  }
  _evGap(z, gap) {
    const R = this.rnd;
    const lanes = [0, 1, 2].filter((l) => this._trainFreeAt(l, z) && this._trainFreeAt(l, z + 12));
    if (lanes.length) this._coinLine(lanes[(R() * lanes.length) | 0], z + 1.5, 5 + ((R() * 3) | 0));
    this.genZ += gap * 0.65;
  }
  _evHurdles(z, gap, d) {
    const R = this.rnd, types = [null, null, null];
    let any = false;
    const ok = [0, 1, 2].filter((l) => z >= this.nextHurdle[l] && this._trainFreeAt(l, z - 2));
    for (const l of ok) {
      const p = l === this.safe ? 0.5 + 0.2 * d : 0.62;
      if (R() < p) { types[l] = R() < 0.42 ? 'high' : (R() < 0.5 ? 'low' : 'low2'); any = true; }
    }
    if (!any && ok.length) types[ok[(R() * ok.length) | 0]] = R() < 0.5 ? 'low' : 'high';
    for (let l = 0; l < 3; l++) if (types[l]) this._hurdle(types[l], l, z);
    const c = this.safe;
    if (types[c] === 'low' || types[c] === 'low2') { if (R() < 0.65) this._coinArc(c, z, 3.4, 1.25); }
    else if (types[c] === 'high') { if (R() < 0.5) this._coinLine(c, z - 3.2, 5, 0.5); }
    else if (R() < 0.7) this._coinLine(c, z + 2.5, clamp(Math.floor((gap - 5) / 1.6), 3, 7));
    this.genZ += gap;
  }
  _evTrain(z, gap, d) {
    const R = this.rnd;
    const c = [0, 1, 2].filter((l) => l !== this.safe && !(this.hold.lane === l && this.hold.until > z)
      && z >= this.nextTrain[l] && this.lastHurdle[l] <= z - gap * 1.2);
    if (!c.length) return this._evGap(z, gap);
    if (c.length > 1 && R() < 0.5) c.reverse();
    const n = c.length > 1 && R() < 0.3 + 0.25 * d ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const cars = 1 + (R() < 0.55 ? 1 : 0) + (R() < 0.2 + 0.2 * d ? 1 : 0);
      const ramp = z > 150 && R() < 0.34;
      this._train(c[i], z + (i ? R() * 6 : 0), cars, ramp);
    }
    if (R() < 0.6) this._coinLine(this.safe, z + 2, 6);
    this.genZ += gap;
  }
  _evSwitch(z, gap, sp) {
    const R = this.rnd;
    if (z < this.movingUntil) return this._evGap(z, gap);
    const c = [0, 1, 2].filter((l) => l !== this.safe && this._trainFreeAt(l, z - 1) && Math.abs(l - this.safe) === 1);
    if (!c.length) return this._evGap(z, gap);
    const to = c[(R() * c.length) | 0], from = this.safe;
    const win = Math.max(12, sp * 0.85);
    this.hold = { lane: from, until: z + win };
    this.nextTrain[to] = Math.max(this.nextTrain[to], z + win);
    this._coinLine(from, z + 0.5, 3);
    this._coinLine(to, z + 6.5, 4);
    this.safe = to;
    this.genZ += gap * 0.8;
  }
  _evMoving(z, gap) {
    const R = this.rnd;
    /* 对向列车只出现在紧挨安全通道的轨道上：玩家随时可以一步躲开 */
    const c = [0, 1, 2].filter((l) => l !== this.safe && Math.abs(l - this.safe) === 1 && !(this.hold.lane === l && this.hold.until > z)
      && z >= this.nextTrain[l] && this.lastHurdle[l] <= z - gap);
    if (!c.length || z < this.movingUntil) return this._evGap(z, gap);
    const lane = c[(R() * c.length) | 0];
    this.movingUntil = z + 124;
    this.objs.push({ t: 'mtrain', lane, x: laneX(lane), z: z + 118, len: 2 * CAR_LEN - 0.4, cars: 2, solid: true, trigger: z - 72, active: false });
    this.trainEnd[lane] = z + 122; this.nextTrain[lane] = z + 136; this.nextHurdle[lane] = z + 140;
    if (R() < 0.6) this._coinLine(this.safe, z + 2, 6);
    this.genZ += gap * 0.6;
  }

  /* 清理已经跑过的物体 */
  prune(dist) {
    if (this.objs.length && this.objs[0].z + (this.objs[0].len || 0) < dist - 40 || this.objs.length > 140) {
      this.objs = this.objs.filter((o) => o.z + (o.len || 0) > dist - 24 && !o.dead);
    }
    if (this.coins.length > 60 && this.coins[0].z < dist - 12 || this.coins.length > 400) {
      this.coins = this.coins.filter((c) => c.z > dist - 6 && !c.taken);
    }
  }
}
