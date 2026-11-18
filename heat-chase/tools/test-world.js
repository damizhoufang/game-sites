// 关卡公平性检查：模拟 60 公里，确认任何位置都存在可通过的路线
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = ['engine.js', 'models.js', 'world.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n');
const ctx = { console, Math, Float32Array };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.World = World; this.laneX = laneX; this.speedAt = speedAt;', ctx);
const log = console.log; let shown = 0; console.log = (...a) => { if (++shown <= 12) log(...a); };
let bad = 0, stats = { train: 0, ramp: 0, mtrain: 0, low: 0, high: 0, pu: 0, coins: 0 };
for (let seed = 1; seed <= 30; seed++) {
  const W = new ctx.World(seed * 7717, { tutorial: seed % 5 === 0 });
  const N = 20000;
  for (let z = 500; z <= N + 400; z += 500) W.extend(z);
  // blocked[lane][z]
  const blocked = [0, 1, 2].map(() => new Uint8Array(N + 400));
  const hurdles = [0, 1, 2].map(() => []);
  for (const o of W.objs) {
    if (o.t === 'train') { for (let z = Math.floor(o.z); z <= Math.ceil(o.z + o.len); z++) if (z >= 0 && z < N + 400) blocked[o.lane][z] = 1; stats.train++; }
    else if (o.t === 'mtrain') { for (let z = Math.floor(o.z - 118); z <= Math.ceil(o.z + 4); z++) if (z >= 0 && z < N + 400) blocked[o.lane][z] = 1; stats.mtrain++; }
    else if (o.t === 'ramp') stats.ramp++;
    else if (o.t === 'pu') { stats.pu++; if (blocked[o.lane][Math.round(o.z)]) { bad++; console.log('道具在列车里', seed, o.z); } }
    else { hurdles[o.lane].push(o.z); stats[o.t === 'high' ? 'high' : 'low']++; if (blocked[o.lane][Math.round(o.z)]) { bad++; console.log('栏杆在列车里', seed, o.z, o.lane); } }
  }
  stats.coins += W.coins.length;
  // 对向列车：其相邻轨道中必须有一条在整个会车过程中没有列车（随时能一步躲开）
  for (const o of W.objs) {
    if (o.t !== 'mtrain') continue;
    const z0 = Math.floor(o.z - 118), z1 = Math.ceil(o.z - 118 + 70);   // 从预留起点到会车结束
    const ok = [o.lane - 1, o.lane + 1].some((a) => { if (a < 0 || a > 2) return false; for (let z = Math.max(0, z0); z <= z1; z++) if (blocked[a][z]) return false; return true; });
    if (!ok) { bad++; console.log('对向列车无处可躲', seed, o.z - 118, o.lane); }
  }
  // 可达性：换道需要两条轨道在前后 4 米内都畅通
  let reach = [1, 1, 1];
  for (let z = 0; z < N; z++) {
    const nr = [0, 0, 0];
    for (let l = 0; l < 3; l++) {
      if (blocked[l][z + 1]) continue;
      if (reach[l]) nr[l] = 1;
      for (const a of [l - 1, l + 1]) {
        if (a < 0 || a > 2 || !reach[a]) continue;
        let ok = true;
        for (let k = -3; k <= 1; k++) if (blocked[l][Math.max(0, z + k)] || blocked[a][Math.max(0, z + k)]) ok = false;
        if (ok) nr[l] = 1;
      }
    }
    reach = nr;
    if (!reach[0] && !reach[1] && !reach[2]) { bad++; console.log('死路! seed', seed, 'z', z); break; }
  }
  // 同一轨道上相邻栏杆的最小间距
  for (let l = 0; l < 3; l++) { hurdles[l].sort((a, b) => a - b); for (let i = 1; i < hurdles[l].length; i++) { const g = hurdles[l][i] - hurdles[l][i - 1]; if (g < 9 || g < ctx.speedAt(hurdles[l][i]) * 0.6) { bad++; console.log('栏杆过密', seed, hurdles[l][i], g); } } }
}
log('统计', JSON.stringify(stats));
log(bad ? '发现问题: ' + bad : '全部通过：30 个随机种子 × 20 公里，均存在可通过路线');
process.exit(bad ? 1 : 0);
