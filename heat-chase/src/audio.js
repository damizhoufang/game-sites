/* =====================================================================
 * 热力追逐 · 声音
 * 所有音效和背景音乐都用 Web Audio 实时合成，不需要任何音频文件
 * ===================================================================== */

const Snd = {
  ctx: null, master: null, sfxG: null, musG: null, noiseBuf: null, ok: false,
  jetSrc: null, jetGain: null, musicOn: false, timer: null, nextT: 0, stepI: 0,

  unlock() {
    if (this.ok) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(c.destination);
      this.sfxG = c.createGain(); this.sfxG.connect(this.master);
      this.musG = c.createGain(); this.musG.connect(this.master);
      const len = c.sampleRate, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.ok = true;
      this.apply();
      if (c.state === 'suspended') c.resume();
      if (this.musicOn) this._startMusic();
    } catch (e) { this.ok = false; }
  },
  apply() {
    if (!this.ok) return;
    const s = Save.data.set, t = this.ctx.currentTime;
    this.sfxG.gain.setTargetAtTime(s.sfx ? 1 : 0, t, 0.02);
    this.musG.gain.setTargetAtTime(s.music ? 0.55 : 0, t, 0.05);
  },

  /* ---- 基础发声 ---- */
  tone(f0, dur, type, vol, t0, f1, dest) {
    const c = this.ctx, t = c.currentTime + (t0 || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol, t0, freq, ftype, f1, dest) {
    const c = this.ctx, t = c.currentTime + (t0 || 0);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true;
    f.type = ftype || 'lowpass'; f.frequency.setValueAtTime(freq || 1200, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  },

  /* ---- 音效 ---- */
  play(name, arg) {
    if (!this.ok || !Save.data.set.sfx) return;
    const d = name === 'coin' ? 0 : (arg || 0);
    switch (name) {
      case 'coin': { const f = 1040 * Math.pow(2, (arg || 0) / 24); this.tone(f, 0.07, 'square', 0.07, 0); this.tone(f * 1.5, 0.11, 'square', 0.06, 0.05); break; }
      case 'jump': this.tone(300, 0.18, 'sine', 0.22, d, 660); break;
      case 'jumpHi': this.tone(320, 0.26, 'sine', 0.22, d, 980); this.tone(1320, 0.2, 'triangle', 0.08, d + 0.08, 1980); break;
      case 'roll': this.noise(0.26, 0.16, d, 500, 'bandpass', 1800); break;
      case 'lane': this.noise(0.09, 0.07, d, 2400, 'highpass'); break;
      case 'land': this.tone(130, 0.11, 'sine', 0.2, d, 60); break;
      case 'step': this.noise(0.035, 0.035, d, 700, 'lowpass'); break;
      case 'thud': this.tone(150, 0.14, 'sine', 0.3, d, 60); this.noise(0.08, 0.12, d, 900); break;
      case 'stumble': this.tone(240, 0.3, 'sawtooth', 0.14, d, 90); this.noise(0.2, 0.16, d, 1400); break;
      case 'crash': this.noise(0.6, 0.45, d, 3200, 'lowpass', 200); this.tone(110, 0.5, 'sine', 0.4, d, 36); this.tone(520, 0.25, 'square', 0.1, d, 130); break;
      case 'power': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, d + i * 0.06)); break;
      case 'chest': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.14, d + i * 0.055)); break;
      case 'board': this.tone(200, 0.3, 'sawtooth', 0.1, d, 900); this.tone(1320, 0.25, 'sine', 0.1, d + 0.18); break;
      case 'break': this.noise(0.4, 0.35, d, 4200, 'lowpass', 400); this.tone(700, 0.3, 'square', 0.12, d, 140); break;
      case 'whistle': {
        const c = this.ctx, t = c.currentTime + d, o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 2350; l.frequency.value = 38; lg.gain.value = 190;
        l.connect(lg); lg.connect(o.frequency);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
        g.gain.setValueAtTime(0.16, t + 0.42); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        o.connect(g); g.connect(this.sfxG); o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6);
        break;
      }
      case 'bark': this.tone(520, 0.1, 'sawtooth', 0.16, d, 250); this.noise(0.09, 0.1, d, 1100, 'bandpass'); this.tone(470, 0.1, 'sawtooth', 0.13, d + 0.16, 230); break;
      case 'horn': this.tone(311, 0.7, 'sawtooth', 0.12, d); this.tone(370, 0.7, 'sawtooth', 0.1, d); this.tone(311, 0.35, 'sawtooth', 0.12, d + 0.85); this.tone(370, 0.35, 'sawtooth', 0.1, d + 0.85); break;
      case 'level': [659, 880, 1175].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.16, d + i * 0.08)); break;
      case 'dodge': this.tone(700, 0.1, 'triangle', 0.14, d, 1400); break;
      case 'over': [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.16, d + i * 0.18)); break;
      case 'click': this.tone(880, 0.05, 'square', 0.07, d); break;
      case 'buy': [784, 1047, 1568].forEach((f, i) => this.tone(f, 0.12, 'square', 0.1, d + i * 0.07)); break;
      case 'deny': this.tone(200, 0.16, 'square', 0.1, d, 140); break;
      default: break;
    }
  },

  /* ---- 喷气背包持续音 ---- */
  jet(on) {
    if (!this.ok) return;
    const c = this.ctx;
    if (on && !this.jetSrc) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8;
      g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.3);
      s.connect(f); f.connect(g); g.connect(this.sfxG); s.start();
      this.jetSrc = s; this.jetGain = g;
    } else if (!on && this.jetSrc) {
      const s = this.jetSrc, g = this.jetGain;
      g.gain.cancelScheduledValues(c.currentTime);
      g.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
      s.stop(c.currentTime + 0.4);
      this.jetSrc = null; this.jetGain = null;
    }
  },

  /* ---- 背景音乐：16 分音符步进音序器 ---- */
  music(on) {
    this.musicOn = on;
    if (!this.ok) return;
    if (on) this._startMusic(); else this._stopMusic();
  },
  _startMusic() {
    if (this.timer) return;
    this.nextT = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this._sched(), 50);
  },
  _stopMusic() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
  _sched() {
    const c = this.ctx;
    if (c.state !== 'running') return;
    const SP = 60 / 138 / 4;
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    while (this.nextT < c.currentTime + 0.14) {
      this._step(this.stepI, this.nextT - c.currentTime);
      this.stepI = (this.stepI + 1) % 128;
      this.nextT += SP;
    }
  },
  _step(i, t) {
    const M = this.musG, bar = Math.floor(i / 16) % 8, s = i % 16;
    const roots = [110, 110, 87.31, 87.31, 130.81, 130.81, 98, 98];
    const chords = [[0, 3, 7, 12], [0, 3, 7, 10], [0, 4, 7, 12], [0, 4, 7, 11], [0, 4, 7, 12], [0, 4, 7, 9], [0, 4, 7, 12], [0, 4, 7, 10]];
    const root = roots[bar], ch = chords[bar];
    if (s % 4 === 0) { this.tone(150, 0.14, 'sine', 0.5, t, 42, M); }
    if (s === 4 || s === 12) { this.noise(0.12, 0.22, t, 1800, 'bandpass', null, M); }
    if (s % 2 === 0) { this.noise(0.03, s % 4 === 2 ? 0.09 : 0.04, t, 7000, 'highpass', null, M); }
    const bassPat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (bassPat[s]) this.tone(root * (s === 13 ? 1.5 : 1), 0.16, 'sawtooth', 0.16, t, null, M);
    const arp = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 3, 2, 1, 0];
    const half = Math.floor(i / 64) % 2;
    if (half === 1 || s % 2 === 0) {
      const n = ch[arp[s]];
      this.tone(root * 4 * Math.pow(2, n / 12), 0.1, 'square', 0.035, t, null, M);
    }
  },
};
