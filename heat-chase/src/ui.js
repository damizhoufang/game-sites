/* =====================================================================
 * 热力追逐 · 界面
 * HUD、菜单、商店、设置、结算。图标全部为内嵌矢量图，离线可用
 * ===================================================================== */

const ICON = {
  jet: '<path d="M12 2c3 2.5 4.5 6 4.5 10l-2 3h-5l-2-3C7.5 8 9 4.5 12 2z" fill="#e9eefc"/><circle cx="12" cy="9" r="2" fill="#35c9ff"/><path d="M7.5 12l-3 4 4-.5zM16.5 12l3 4-4-.5z" fill="#ff3b3b"/><path d="M10 16h4l-2 6z" fill="#ffb000"/>',
  shoes: '<path d="M3 16c0-2 1-3 3-3l2-5 3 1 1 3c3 1 6 1.5 8 3 1 .8 1 2 1 3H3z" fill="#30d67b"/><rect x="3" y="18" width="18" height="2.4" rx="1.2" fill="#fff"/><path d="M9 10l3 1M10 12.5l3 .8" stroke="#fff" stroke-width="1.2"/>',
  magnet: '<path d="M5 4h4.5v8a2.5 2.5 0 005 0V4H19v8a7 7 0 01-14 0z" fill="#ff2e3e"/><rect x="5" y="4" width="4.5" height="3.2" fill="#fff"/><rect x="14.5" y="4" width="4.5" height="3.2" fill="#fff"/>',
  double: '<circle cx="12" cy="12" r="10" fill="#a03cff"/><text x="12" y="16.3" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="Arial,sans-serif">×2</text>',
  board: '<rect x="2" y="9" width="20" height="4.6" rx="2.3" fill="#ff5a1f"/><rect x="5" y="10.7" width="14" height="1.3" rx=".6" fill="#ffe14a"/><circle cx="6.5" cy="16.5" r="2" fill="#5ef2ff"/><circle cx="17.5" cy="16.5" r="2" fill="#5ef2ff"/>',
  chest: '<rect x="3" y="10" width="18" height="10" rx="1.5" fill="#8a5527"/><path d="M3 10c0-3.5 2.5-6 9-6s9 2.5 9 6z" fill="#a86b33"/><rect x="10" y="8.5" width="4" height="5" rx="1" fill="#ffcf3a"/>',
  guard: '<path d="M4 13c0-5 3.5-8 8-8s8 3 8 8z" fill="#3b5fd0"/><rect x="3" y="13" width="18" height="3.2" rx="1.2" fill="#18224d"/><circle cx="12" cy="9.8" r="1.9" fill="#ffc928"/>',
  penguin: '<ellipse cx="12" cy="13" rx="7" ry="9" fill="#1b2233" stroke="#fff" stroke-width=".8"/><ellipse cx="12" cy="14.5" rx="4.6" ry="6.3" fill="#fff"/><circle cx="9.8" cy="8.4" r="1" fill="#fff"/><circle cx="14.2" cy="8.4" r="1" fill="#fff"/><path d="M10.5 10.2h3L12 12.4z" fill="#ff9a1f"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#fff"/>',
  pause: '<rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="#fff"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="#fff"/>',
  coin: '<circle cx="12" cy="12" r="10" fill="#b86e00"/><circle cx="12" cy="12" r="8.2" fill="#ffc928"/><path d="M12 6.2l1.8 3.7 4 .5-3 2.8.8 4-3.6-2-3.6 2 .8-4-3-2.8 4-.5z" fill="#fff3a8"/>',
};
const svg = (name, size) => `<svg class="ic" viewBox="0 0 24 24" width="${size || 24}" height="${size || 24}" aria-hidden="true">${ICON[name]}</svg>`;
const $ = (id) => document.getElementById(id);
const fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const UI = {
  cur: null, prev: null, hudCache: {}, hintTimer: 0, bubbleTimers: [], resetArmed: false,

  init() {
    const P = PLATFORM;
    $('hud').innerHTML = `
      <button class="ui hbtn" id="btnPause" aria-label="暂停">${svg('pause', 22)}</button>
      <div id="chase" aria-hidden="true"><div class="c-track"><div class="c-guard" id="cGuard">${svg('guard', 22)}</div><div class="c-pen">${svg('penguin', 22)}</div></div></div>
      <div id="scorebox">
        <div id="mult">×1</div>
        <div id="score">0</div>
        <div id="coinrow">${svg('coin', 18)}<span id="coins">0</span></div>
        <div id="heatbar"><div id="heatfill"></div><span>热力</span></div>
      </div>
      <div id="fxbar">${['jet', 'shoes', 'magnet', 'double'].map((k) => `<div class="fx hidden" id="fx-${k}">${svg(k, 24)}<div class="fx-bar"><i></i></div></div>`).join('')}</div>
      <button class="ui" id="btnBoard" aria-label="放出滑板">${svg('board', 34)}<span class="b-inf">∞</span><span class="b-key">${P.boardKey}</span></button>
      <button class="ui hbtn" id="btnView" aria-label="切换视角">${svg('eye', 22)}</button>
      ${P.keyBar ? `<div id="keybar">${P.keyBar}</div>` : ''}`;

    const ctl = P.controls.map((c) => `<li><b>${c[0]}</b><span>${c[1]}</span></li>`).join('');
    const pus = ['jet', 'shoes', 'magnet', 'double', 'chest', 'board'].map((k) => {
      const name = k === 'chest' ? '宝箱' : FX_INFO[k].name, desc = k === 'chest' ? '随机奖励：金币、分数、热力或一件道具' : FX_INFO[k].desc;
      return `<li>${svg(k, 26)}<b>${name}</b><span>${desc}</span></li>`;
    }).join('');

    $('screens').innerHTML = `
    <section class="screen ui" id="s-menu">
      <div class="title">
        <div class="t-sub">HEAT CHASE</div>
        <h1><span>热力</span><span>追逐</span></h1>
        <div class="t-tag">涂鸦企鹅 · 三轨狂奔 · ${P.label}</div>
      </div>
      <div class="menu-panel">
        <div class="stats"><div><b id="m-best">0</b><span>最高分</span></div><div><b id="m-coins">0</b><span>金币</span></div></div>
        <button class="btn primary" data-act="start">开始逃跑</button>
        <div class="row"><button class="btn" data-act="shop">商店</button><button class="btn" data-act="settings">设置</button><button class="btn" data-act="help">玩法</button></div>
        <div class="foot">${P.menuFoot}</div>
      </div>
    </section>

    <section class="screen ui dim" id="s-pause">
      <div class="card">
        <h2>暂停</h2>
        <button class="btn primary" data-act="resume">继续</button>
        <button class="btn" data-act="restart">重新开始</button>
        <button class="btn" data-act="settings">设置</button>
        <button class="btn" data-act="menu">返回主菜单</button>
      </div>
    </section>

    <section class="screen ui dim" id="s-over">
      <div class="card">
        <div class="badge hidden" id="o-new">新纪录！</div>
        <h2 id="o-title">被抓住了！</h2>
        <div class="bigscore" id="o-score">0</div>
        <div class="grid">
          <div><b id="o-dist">0</b><span>距离（米）</span></div>
          <div><b id="o-coins">0</b><span>本局金币</span></div>
          <div><b id="o-level">×1</b><span>热力等级</span></div>
          <div><b id="o-best">0</b><span>最高分</span></div>
        </div>
        <button class="btn primary" data-act="restart">再来一局</button>
        <div class="row"><button class="btn" data-act="shop">商店</button><button class="btn" data-act="menu">主菜单</button></div>
      </div>
    </section>

    <section class="screen ui dim" id="s-shop">
      <div class="card wide">
        <div class="card-head"><h2>商店</h2><div class="wallet">${svg('coin', 20)}<b id="s-coins">0</b></div></div>
        <div class="scroll">
          <h3>道具升级 <small>每升一级，持续时间更长</small></h3>
          <div id="s-ups"></div>
          <h3>企鹅造型</h3>
          <div id="s-skins"></div>
        </div>
        <button class="btn" data-act="back">返回</button>
      </div>
    </section>

    <section class="screen ui dim" id="s-settings">
      <div class="card">
        <h2>设置</h2>
        <div class="opt"><span>音效</span><button class="tog" data-set="sfx"></button></div>
        <div class="opt"><span>音乐</span><button class="tog" data-set="music"></button></div>
        <div class="opt"><span>视角</span><button class="seg" data-set="view"></button></div>
        <div class="opt"><span>画质</span><button class="seg" data-set="quality"></button></div>
        ${P.id === 'mobile' ? '<div class="opt"><span>震动反馈</span><button class="tog" data-set="vibrate"></button></div>' : ''}
        ${P.id === 'pc' ? '<div class="opt"><span>全屏</span><button class="seg" data-act="fullscreen">切换全屏</button></div>' : ''}
        <div class="opt"><span>清除存档</span><button class="seg danger" data-act="reset" id="btnReset">清除</button></div>
        <button class="btn" data-act="back">返回</button>
      </div>
    </section>

    <section class="screen ui dim" id="s-help">
      <div class="card wide">
        <h2>玩法</h2>
        <div class="scroll">
          <p class="lead">你是一只爱涂鸦的企鹅，在列车上喷漆时被警卫和小狗发现了。沿着三条轨道一路狂奔，跑得越远分数越高；迎面撞上障碍，本局就结束。</p>
          <h3>操作</h3><ul class="keys">${ctl}</ul>
          <h3>道具</h3><ul class="pus">${pus}</ul>
          <h3>小技巧</h3>
          <ul class="tips">
            <li>吃金币、贴身闪避会积攒<b>热力</b>，热力条满了倍率就升一级，最高 ×10。</li>
            <li>侧面蹭到列车只会踉跄一下，但警卫会追近；这时再失误一次就会被抓。</li>
            <li>黄色斜坡可以冲上车顶，车顶上通常有一整排金币。</li>
            <li>空中${P.id === 'pc' ? '按 ↓' : '下滑'}可以急速落地并接翻滚。</li>
            <li>滑板可以无限次使用：撞碎后充能 ${BOARD_CD} 秒就能再放。</li>
          </ul>
        </div>
        <button class="btn" data-act="back">返回</button>
      </div>
    </section>`;

    /* 事件 */
    $('screens').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      Snd.unlock();
      if (b.dataset.set) { this.toggleSet(b.dataset.set); return; }
      if (b.dataset.up) { this.buyUp(b.dataset.up); return; }
      if (b.dataset.skin) { this.pickSkin(+b.dataset.skin); return; }
      if (b.dataset.act) { Snd.play('click'); this.act(b.dataset.act); }
    });
    /* HUD 按钮在按下瞬间就响应（不等 click 合成），手感更跟手 */
    const press = (id, fn) => {
      const el = $(id);
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); Snd.unlock(); fn(); });
      el.addEventListener('click', (e) => { if (e.detail === 0) fn(); });      // 键盘回车触发
    };
    press('btnPause', () => { Snd.play('click'); Game.pause(); });
    press('btnBoard', () => Game.board());
    press('btnView', () => Game.toggleView());
    this.refreshSettings();
  },

  act(a) {
    switch (a) {
      case 'start': case 'restart': Game.start(); break;
      case 'resume': Game.resume(); break;
      case 'menu': Game.toMenu(); break;
      case 'shop': this.prev = this.cur; this.show('shop'); break;
      case 'settings': this.prev = this.cur; this.show('settings'); break;
      case 'help': this.prev = this.cur; this.show('help'); break;
      case 'back': this.back(); break;
      case 'fullscreen': {
        const d = document;
        if (d.fullscreenElement) d.exitFullscreen(); else if (d.documentElement.requestFullscreen) d.documentElement.requestFullscreen().catch(() => {});
        break;
      }
      case 'reset':
        if (!this.resetArmed) { this.resetArmed = true; $('btnReset').textContent = '再点一次确认'; }
        else { this.resetArmed = false; const set = Save.data.set; Save.data = Save.defaults(); Save.data.set = set; Save.store(); $('btnReset').textContent = '已清除'; this.refreshMenu(); }
        break;
      default: break;
    }
  },
  back() {
    if (this.cur === 'shop' || this.cur === 'settings' || this.cur === 'help') this.show(this.prev || 'menu');
  },
  primary() {
    if (this.cur === 'menu') Game.start();
    else if (this.cur === 'over') Game.start();
    else if (this.cur === 'pause') Game.resume();
  },

  show(name) {
    this.cur = name;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === 's-' + name));
    if (name === 'menu') this.refreshMenu();
    if (name === 'shop') this.refreshShop();
    if (name === 'settings') { this.resetArmed = false; $('btnReset').textContent = '清除'; this.refreshSettings(); }
    document.body.classList.toggle('in-menu', name === 'menu');
  },
  showHUD(on) {
    $('hud').classList.toggle('hidden', !on);
    this.hudCache = {};
    if (!on) { $('vig').className = ''; $('hint').classList.add('hidden'); }
  },

  /* ---- HUD 每帧刷新（只在数值变化时改 DOM） ---- */
  hud(s) {
    const c = this.hudCache;
    if (c.score !== s.score) { c.score = s.score; $('score').textContent = fmt(s.score); }
    if (c.coins !== s.coins) { c.coins = s.coins; $('coins').textContent = fmt(s.coins); }
    if (c.mult !== s.mult) {
      c.mult = s.mult;
      const el = $('mult'); el.textContent = '×' + s.mult; el.classList.toggle('dbl', s.double);
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
    const hp = Math.round((s.heatLevel >= 10 ? 1 : s.heat) * 100);
    if (c.heat !== hp) { c.heat = hp; $('heatfill').style.width = hp + '%'; }
    const cp = Math.round(s.chase * 100);
    if (c.chase !== cp) { c.chase = cp; $('cGuard').style.left = (4 + (1 - s.chase) * 62) + '%'; }
    if (c.danger !== s.danger) { c.danger = s.danger; $('vig').className = s.danger ? 'danger' : ''; $('chase').classList.toggle('danger', s.danger); }
    for (const k of ['jet', 'shoes', 'magnet', 'double']) {
      const on = s.fx[k] > 0, el = $('fx-' + k);
      if (c['on' + k] !== on) { c['on' + k] = on; el.classList.toggle('hidden', !on); }
      if (on) {
        const p = Math.round((s.fx[k] / s.fxMax[k]) * 100);
        if (c['p' + k] !== p) { c['p' + k] = p; el.querySelector('i').style.width = p + '%'; el.classList.toggle('low', p < 22); }
      }
    }
    const b = s.board, bst = b.t > 0 ? 'on' : b.cd > 0 ? 'cd' : 'ready';
    const bp = b.t > 0 ? Math.round((b.t / b.max) * 100) : b.cd > 0 ? Math.round((1 - b.cd / s.boardCd) * 100) : 100;
    if (c.bst !== bst || c.bp !== bp) {
      c.bst = bst; c.bp = bp;
      const el = $('btnBoard'); el.className = 'ui ' + bst; el.style.setProperty('--p', bp);
    }
  },

  pop(text, kind) {
    const box = $('pops');
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    const d = document.createElement('div');
    d.className = 'pop ' + (kind || 'info');
    d.textContent = text;
    d.addEventListener('animationend', () => d.remove());
    box.appendChild(d);
  },
  hint(text, ms) {
    const el = $('hint');
    el.innerHTML = text; el.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => el.classList.add('hidden'), ms || 2500);
  },
  bubble(text, ms, delay) {
    const el = $('bubble');
    this.bubbleTimers.forEach(clearTimeout);
    this.bubbleTimers = [
      setTimeout(() => { el.textContent = text; el.classList.remove('hidden'); }, delay || 0),
      setTimeout(() => el.classList.add('hidden'), (delay || 0) + ms),
    ];
  },

  showOver(s) {
    $('o-title').textContent = s.cause === 'caught' ? '被警卫抓住了！' : '撞上了！被抓住了！';
    $('o-score').textContent = fmt(s.score);
    $('o-dist').textContent = fmt(s.dist);
    $('o-coins').textContent = '+' + fmt(s.coins);
    $('o-level').textContent = '×' + s.level;
    $('o-best').textContent = fmt(s.best);
    $('o-new').classList.toggle('hidden', !s.newBest);
    this.show('over');
  },

  refreshMenu() {
    $('m-best').textContent = fmt(Save.data.best);
    $('m-coins').textContent = fmt(Save.data.coins);
  },
  refreshSettings() {
    const s = Save.data.set;
    document.querySelectorAll('[data-set]').forEach((b) => {
      const k = b.dataset.set;
      if (k === 'view') b.textContent = s.view ? '追尾视角' : '第一人称';
      else if (k === 'quality') b.textContent = s.quality ? '高清' : '流畅';
      else { b.classList.toggle('on', !!s[k]); b.textContent = s[k] ? '开' : '关'; }
    });
  },
  toggleSet(k) {
    const s = Save.data.set;
    if (k === 'view' || k === 'quality') s[k] = s[k] ? 0 : 1; else s[k] = !s[k];
    Save.store();
    Game.applySettings();
    this.refreshSettings();
    Snd.play('click');
  },

  refreshShop() {
    const d = Save.data;
    $('s-coins').textContent = fmt(d.coins);
    $('s-ups').innerHTML = ['board', 'jet', 'shoes', 'magnet', 'double'].map((k) => {
      const lv = d.up[k] || 0, max = lv >= UP_COST.length, cost = max ? 0 : UP_COST[lv], info = FX_INFO[k];
      const pips = UP_COST.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      return `<div class="up">${svg(k, 34)}
        <div class="up-mid"><b>${info.name}</b><span>${info.desc}</span><div class="pips">${pips}<em>${fxDur(k).toFixed(1)} 秒</em></div></div>
        <button class="buy ${max ? 'max' : d.coins < cost ? 'poor' : ''}" data-up="${k}" ${max ? 'disabled' : ''}>${max ? '已满级' : svg('coin', 16) + fmt(cost)}</button></div>`;
    }).join('');
    $('s-skins').innerHTML = SKINS.map((sk, i) => {
      const owned = d.owned.includes(i), cur = d.skin === i;
      return `<button class="skin ${cur ? 'cur' : ''} ${!owned && d.coins < sk.price ? 'poor' : ''}" data-skin="${i}">
        <span class="sw"><i style="background:${sk.cap}"></i><i style="background:#1b2233"></i><i style="background:${sk.scarf}"></i><i style="background:#f7f9ff"></i></span>
        <b>${sk.name}</b><em>${cur ? '使用中' : owned ? '点击使用' : svg('coin', 14) + fmt(sk.price)}</em></button>`;
    }).join('');
  },
  buyUp(k) {
    const d = Save.data, lv = d.up[k] || 0;
    if (lv >= UP_COST.length) return;
    if (d.coins < UP_COST[lv]) { Snd.play('deny'); return; }
    d.coins -= UP_COST[lv]; d.up[k] = lv + 1; Save.store();
    Snd.play('buy'); this.refreshShop();
  },
  pickSkin(i) {
    const d = Save.data, sk = SKINS[i];
    if (!d.owned.includes(i)) {
      if (d.coins < sk.price) { Snd.play('deny'); return; }
      d.coins -= sk.price; d.owned.push(i); Snd.play('buy');
    } else Snd.play('click');
    d.skin = i; Save.store(); this.refreshShop();
  },

  fatal(msg) {
    const el = $('screens');
    el.innerHTML = `<section class="screen ui dim on"><div class="card"><h2>无法运行</h2><p class="lead">${msg}</p></div></section>`;
  },
};
