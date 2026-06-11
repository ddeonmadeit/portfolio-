// ============================================================
//  AUDIO — everything is synthesized with WebAudio.
//  No audio files needed: desert wind, fire crackle, UI blips.
// ============================================================

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this._windGain = null;
    this._crackleTimer = null;
  }

  // Must be called from a user gesture (browser autoplay policy).
  start() {
    if (this.started) return;
    this.started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this._startWind();
    this._startCrackle();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 1, this.ctx.currentTime + 0.3);
    }
  }

  _noiseBuffer(seconds = 2) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // brown-ish noise: smoother, more like wind than white noise
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  _startWind() {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(4);
    src.loop = true;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.4;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.05;

    // slow gusting via LFO on the filter cutoff
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(lp.frequency);

    // second LFO breathes the volume
    const lfo2 = this.ctx.createOscillator();
    lfo2.frequency.value = 0.045;
    const lfo2Gain = this.ctx.createGain();
    lfo2Gain.gain.value = 0.025;
    lfo2.connect(lfo2Gain).connect(gain.gain);

    src.connect(lp).connect(gain).connect(this.master);
    src.start();
    lfo.start();
    lfo2.start();
    this._windGain = gain;
  }

  // distant fire pops, very quiet, random intervals
  _startCrackle() {
    const pop = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900 + Math.random() * 1800, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.05);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.012 + Math.random() * 0.015, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
      osc.connect(g).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.08);
      this._crackleTimer = setTimeout(pop, 180 + Math.random() * 1400);
    };
    pop();
  }

  // short dry tick on hover
  blip() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.04, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // tape-stop style descend, used when entering a structure
  enter() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.7);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1200, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 0.7);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    osc.connect(lp).connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.85);
  }

  // reverse swell, used when stepping back out
  exit() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  // soft mechanical clack for opening a work / panel
  clack() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(0.08);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
  }
}

export const audio = new AudioEngine();
