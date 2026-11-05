/**
 * Official Spribe Aviator Sound Effects Engine
 * Recreates Spribe Aviator's authentic audio identity with Web Audio API
 */

export class SoundEngine {
  ctx: AudioContext | null;
  soundMuted: boolean;
  musicMuted: boolean;
  masterVolume: number;

  masterGain: GainNode | null;
  sfxGain: GainNode | null;
  musicGain: GainNode | null;

  engineOsc1: OscillatorNode | null;
  engineOsc2: OscillatorNode | null;
  engineSub: OscillatorNode | null;
  engineFilter: BiquadFilterNode | null;
  engineGain: GainNode | null;
  bladeNoiseSource: AudioBufferSourceNode | null;
  bladeFilter: BiquadFilterNode | null;
  bladeGain: GainNode | null;
  tremoloGain: GainNode | null;
  rotorLFO: OscillatorNode | null;
  rotorLFOGain: GainNode | null;
  isPlayingEngine: boolean;

  lastMilestonePassed: number;

  musicInterval: NodeJS.Timeout | null;
  isPlayingMusic: boolean;
  wasPlayingMusicBeforeHidden: boolean;

  isTabVisible: boolean;
  isAviatorViewActive: boolean;
  isWindowFocused: boolean;
  isFlightActive: boolean;
  lastMultiplier: number;

  constructor() {
    this.ctx = null;
    this.soundMuted = false;
    this.musicMuted = false;
    this.masterVolume = 0.65;

    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;

    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineSub = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.bladeNoiseSource = null;
    this.bladeFilter = null;
    this.bladeGain = null;
    this.tremoloGain = null;
    this.rotorLFO = null;
    this.rotorLFOGain = null;
    this.isPlayingEngine = false;

    this.lastMilestonePassed = 1.0;

    this.musicInterval = null;
    this.isPlayingMusic = false;
    this.wasPlayingMusicBeforeHidden = false;

    this.isTabVisible = typeof document !== 'undefined' ? (!document.hidden && document.visibilityState === 'visible') : true;
    this.isAviatorViewActive = true;
    this.isWindowFocused = typeof document !== 'undefined' && document.hasFocus ? document.hasFocus() : true;
    this.isFlightActive = false;
    this.lastMultiplier = 1.0;

    this.initVisibilityListeners();

    if (typeof window !== 'undefined') {
      const unlockEvents = ['click', 'touchstart', 'touchend', 'mousedown', 'pointerdown', 'keydown'];
      const unlockAudio = () => {
        this.initContext();
        if (!this.musicMuted && !this.isPlayingMusic && this.isUserViewingApp()) {
          this.startAmbientMusic();
        }
        unlockEvents.forEach(evt => window.removeEventListener(evt, unlockAudio));
      };

      unlockEvents.forEach(evt => window.addEventListener(evt, unlockAudio, { passive: true }));
    }
  }

  initVisibilityListeners(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      const isVisible = !document.hidden && document.visibilityState === 'visible';
      this.setTabVisible(isVisible);
    });

    window.addEventListener('pagehide', () => {
      this.setTabVisible(false);
    });

    window.addEventListener('pageshow', () => {
      const isVisible = !document.hidden && document.visibilityState === 'visible';
      this.setTabVisible(isVisible);
    });

    window.addEventListener('blur', () => {
      this.isWindowFocused = false;
      this.handleViewingStateChange();
    });

    window.addEventListener('focus', () => {
      this.isWindowFocused = true;
      this.handleViewingStateChange();
    });
  }

  isUserViewingApp(): boolean {
    return this.isTabVisible && this.isWindowFocused;
  }

  isUserViewingGame(): boolean {
    return this.isUserViewingApp() && this.isAviatorViewActive;
  }

  setTabVisible(isVisible: boolean): void {
    this.isTabVisible = !!isVisible;
    this.handleViewingStateChange();
  }

  setWindowFocused(isFocused: boolean): void {
    this.isWindowFocused = !!isFocused;
    this.handleViewingStateChange();
  }

  setAviatorViewActive(isActive: boolean): void {
    this.isAviatorViewActive = !!isActive;
    this.handleViewingStateChange();
  }

  handleViewingStateChange(): void {
    const viewingApp = this.isUserViewingApp();
    const viewingGame = this.isUserViewingGame();

    if (!viewingApp) {
      if (this.masterGain && this.ctx) {
        try {
          this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.015);
        } catch (e) {}
      }
      this.stopEngineAudioNodes();
      if (this.isPlayingMusic) {
        this.stopAmbientMusic();
        this.wasPlayingMusicBeforeHidden = true;
      }
    } else if (!viewingGame) {
      if (this.masterGain && this.ctx) {
        try {
          this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
        } catch (e) {}
      }
      this.stopEngineAudioNodes();
    } else {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.masterGain && this.ctx) {
        try {
          this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
        } catch (e) {}
      }
      if (this.isFlightActive && !this.soundMuted && !this.isPlayingEngine) {
        this.startEngineAudioNodes();
        if (this.lastMultiplier) {
          this.updateEnginePitch(this.lastMultiplier);
        }
      }
      if (this.wasPlayingMusicBeforeHidden && !this.musicMuted && !this.isPlayingMusic) {
        this.wasPlayingMusicBeforeHidden = false;
        this.startAmbientMusic();
      }
    }
  }

  initContext(): void {
    if (!this.ctx) {
      const AudioCtx = typeof window !== 'undefined'
        ? (window.AudioContext || (window as any).webkitAudioContext)
        : (typeof globalThis !== 'undefined' ? (globalThis.AudioContext || (globalThis as any).webkitAudioContext) : null);
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        this.masterGain = this.ctx.createGain();
        const initialVol = this.isUserViewingApp() ? this.masterVolume : 0.0;
        this.masterGain.gain.setValueAtTime(initialVol, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.soundMuted ? 0.0 : 1.0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(this.musicMuted ? 0.0 : 0.20, this.ctx.currentTime);
        this.musicGain.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && this.isUserViewingApp()) {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleSound(): boolean {
    this.soundMuted = !this.soundMuted;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.soundMuted ? 0.0 : 1.0, this.ctx.currentTime, 0.02);
    }
    if (this.soundMuted && this.isPlayingEngine) {
      this.stopEngine();
    }
    return this.soundMuted;
  }

  toggleMusic(): boolean {
    this.musicMuted = !this.musicMuted;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0.0 : 0.20, this.ctx.currentTime, 0.05);
    }
    if (this.musicMuted) {
      this.stopAmbientMusic();
    } else if (this.isUserViewingApp()) {
      this.startAmbientMusic();
    }
    return this.musicMuted;
  }

  toggleMute(): boolean {
    return this.toggleSound();
  }

  startEngine(): void {
    this.isFlightActive = true;
    if (this.soundMuted || !this.isUserViewingGame()) return;
    this.startEngineAudioNodes();
  }

  startEngineAudioNodes(): void {
    if (this.soundMuted || !this.isUserViewingGame()) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopEngineAudioNodes();
    this.lastMilestonePassed = 1.0;
    const t = this.ctx.currentTime;

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(84, t);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(168, t);

    this.engineSub = this.ctx.createOscillator();
    this.engineSub.type = 'square';
    this.engineSub.frequency.setValueAtTime(42, t);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(420, t);
    this.engineFilter.Q.setValueAtTime(2.2, t);

    const bufferSize = Math.floor(this.ctx.sampleRate * 1.5);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.45;
    }
    this.bladeNoiseSource = this.ctx.createBufferSource();
    this.bladeNoiseSource.buffer = noiseBuffer;
    this.bladeNoiseSource.loop = true;

    this.bladeFilter = this.ctx.createBiquadFilter();
    this.bladeFilter.type = 'bandpass';
    this.bladeFilter.frequency.setValueAtTime(480, t);
    this.bladeFilter.Q.setValueAtTime(3.2, t);

    this.bladeGain = this.ctx.createGain();
    this.bladeGain.gain.setValueAtTime(0.08, t);

    this.bladeNoiseSource.connect(this.bladeFilter);
    this.bladeFilter.connect(this.bladeGain);

    this.tremoloGain = this.ctx.createGain();
    this.tremoloGain.gain.setValueAtTime(0.70, t);

    this.rotorLFO = this.ctx.createOscillator();
    this.rotorLFO.type = 'sine';
    this.rotorLFO.frequency.setValueAtTime(24, t);

    this.rotorLFOGain = this.ctx.createGain();
    this.rotorLFOGain.gain.setValueAtTime(0.28, t);

    this.rotorLFO.connect(this.rotorLFOGain);
    this.rotorLFOGain.connect(this.tremoloGain.gain);

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0001, t);
    this.engineGain.gain.linearRampToValueAtTime(0.18, t + 0.20);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineSub.connect(this.engineFilter);

    this.engineFilter.connect(this.tremoloGain);
    this.bladeGain.connect(this.tremoloGain);

    this.tremoloGain.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

    this.engineOsc1.start(t);
    this.engineOsc2.start(t);
    this.engineSub.start(t);
    this.bladeNoiseSource.start(t);
    this.rotorLFO.start(t);
    this.isPlayingEngine = true;
  }

  updateEnginePitch(multiplier: number): void {
    this.lastMultiplier = multiplier;
    if (!this.isPlayingEngine || !this.ctx || this.soundMuted || !this.isUserViewingGame()) return;
    const t = this.ctx.currentTime;

    const logVal = Math.min(Math.log(Math.max(1.0, multiplier)) * 1.6, 4.8);
    const targetFreq = 84 + logVal * 70;
    const targetFilter = 420 + logVal * 320;
    const targetRotorRate = 24 + logVal * 16;
    const targetBladeFilter = 480 + logVal * 280;

    if (this.engineOsc1 && this.engineOsc2 && this.engineSub) {
      this.engineOsc1.frequency.setTargetAtTime(targetFreq, t, 0.06);
      this.engineOsc2.frequency.setTargetAtTime(targetFreq * 2, t, 0.06);
      this.engineSub.frequency.setTargetAtTime(targetFreq * 0.5, t, 0.06);
    }
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(targetFilter, t, 0.06);
    }
    if (this.bladeFilter) {
      this.bladeFilter.frequency.setTargetAtTime(targetBladeFilter, t, 0.06);
    }
    if (this.rotorLFO) {
      this.rotorLFO.frequency.setTargetAtTime(targetRotorRate, t, 0.06);
    }

    if (multiplier >= 2.0 && this.lastMilestonePassed < 2.0) {
      this.lastMilestonePassed = 2.0;
      this.playMilestone(2.0);
    } else if (multiplier >= 10.0 && this.lastMilestonePassed < 10.0) {
      this.lastMilestonePassed = 10.0;
      this.playMilestone(10.0);
    }
  }

  stopEngine(): void {
    this.isFlightActive = false;
    this.stopEngineAudioNodes();
  }

  stopEngineAudioNodes(): void {
    if (!this.isPlayingEngine || !this.ctx) return;
    try {
      const oldGain = this.engineGain;
      const oldOsc1 = this.engineOsc1;
      const oldOsc2 = this.engineOsc2;
      const oldSub = this.engineSub;
      const oldNoise = this.bladeNoiseSource;
      const oldLfo = this.rotorLFO;

      this.isPlayingEngine = false;
      this.engineGain = null;
      this.engineOsc1 = null;
      this.engineOsc2 = null;
      this.engineSub = null;
      this.bladeNoiseSource = null;
      this.rotorLFO = null;

      if (oldGain && this.ctx) {
        oldGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.02);
      }

      setTimeout(() => {
        try { oldOsc1?.stop(); oldOsc1?.disconnect(); } catch (e) {}
        try { oldOsc2?.stop(); oldOsc2?.disconnect(); } catch (e) {}
        try { oldSub?.stop(); oldSub?.disconnect(); } catch (e) {}
        try { oldNoise?.stop(); oldNoise?.disconnect(); } catch (e) {}
        try { oldLfo?.stop(); oldLfo?.disconnect(); } catch (e) {}
      }, 40);
    } catch (e) {
      this.isPlayingEngine = false;
    }
  }

  playFlewAway(): void {
    this.isFlightActive = false;
    this.stopEngine();
    if (this.soundMuted || !this.isUserViewingGame()) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx!.currentTime;

    const bufferSize = Math.floor(this.ctx!.sampleRate * 0.85);
    const noiseBuffer = this.ctx!.createBuffer(1, bufferSize, this.ctx!.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.85;
    }

    const noiseSource = this.ctx!.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bandpass = this.ctx!.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.setValueAtTime(4.2, t);
    bandpass.frequency.setValueAtTime(2200, t);
    bandpass.frequency.exponentialRampToValueAtTime(110, t + 0.78);

    const noiseGain = this.ctx!.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(0.48, t + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.80);

    let panner: StereoPannerNode | null = null;
    if (typeof this.ctx!.createStereoPanner === 'function') {
      panner = this.ctx!.createStereoPanner();
      panner.pan.setValueAtTime(0.0, t);
      panner.pan.linearRampToValueAtTime(0.85, t + 0.65);
    }

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    if (panner) {
      noiseGain.connect(panner);
      panner.connect(this.sfxGain || this.masterGain || this.ctx!.destination);
    } else {
      noiseGain.connect(this.sfxGain || this.masterGain || this.ctx!.destination);
    }

    noiseSource.start(t);
    noiseSource.stop(t + 0.85);

    const glideOsc = this.ctx!.createOscillator();
    const glideGain = this.ctx!.createGain();

    glideOsc.type = 'sawtooth';
    glideOsc.frequency.setValueAtTime(460, t);
    glideOsc.frequency.exponentialRampToValueAtTime(65, t + 0.70);

    const glideFilter = this.ctx!.createBiquadFilter();
    glideFilter.type = 'lowpass';
    glideFilter.frequency.setValueAtTime(1100, t);
    glideFilter.frequency.exponentialRampToValueAtTime(90, t + 0.70);

    glideGain.gain.setValueAtTime(0.001, t);
    glideGain.gain.linearRampToValueAtTime(0.28, t + 0.04);
    glideGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);

    glideOsc.connect(glideFilter);
    glideFilter.connect(glideGain);
    this.connectToDestination(glideGain, this.sfxGain || this.masterGain || this.ctx!.destination);

    glideOsc.start(t);
    glideOsc.stop(t + 0.75);
  }

  playCrash(): void {
    this.playFlewAway();
  }

  private connectToDestination(source: AudioNode, destination: AudioNode | AudioDestinationNode | null): void {
    if (destination) {
      source.connect(destination);
    }
  }

  private getDestination(): AudioNode | AudioDestinationNode {
    if (!this.ctx) {
      this.initContext();
    }
    return this.sfxGain || this.masterGain || this.ctx!.destination;
  }

  playCashout(): void {
    if (this.soundMuted || !this.isUserViewingApp()) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx!.currentTime;

    const bellPings = [
      { freq: 1479.98, delay: 0.00, dur: 0.65 },
      { freq: 2217.46, delay: 0.08, dur: 0.85 }
    ];

    bellPings.forEach(({ freq, delay, dur }) => {
      const pingTime = t + delay;

      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, pingTime);

      gain.gain.setValueAtTime(0.001, pingTime);
      gain.gain.linearRampToValueAtTime(0.38, pingTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur);

      const overtone1 = this.ctx!.createOscillator();
      const overtone1Gain = this.ctx!.createGain();
      overtone1.type = 'triangle';
      overtone1.frequency.setValueAtTime(freq * 2.0, pingTime);

      overtone1Gain.gain.setValueAtTime(0.001, pingTime);
      overtone1Gain.gain.linearRampToValueAtTime(0.14, pingTime + 0.010);
      overtone1Gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur * 0.55);

      const overtone2 = this.ctx!.createOscillator();
      const overtone2Gain = this.ctx!.createGain();
      overtone2.type = 'sine';
      overtone2.frequency.setValueAtTime(freq * 3.01, pingTime);

      overtone2Gain.gain.setValueAtTime(0.001, pingTime);
      overtone2Gain.gain.linearRampToValueAtTime(0.07, pingTime + 0.008);
      overtone2Gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur * 0.40);

      osc.connect(gain);
      overtone1.connect(overtone1Gain);
      overtone2.connect(overtone2Gain);

      const destination = this.sfxGain || this.masterGain || this.ctx!.destination;
      this.connectToDestination(gain, destination);
      this.connectToDestination(overtone1Gain, destination);
      this.connectToDestination(overtone2Gain, destination);

      osc.start(pingTime);
      osc.stop(pingTime + dur);
      overtone1.start(pingTime);
      overtone1.stop(pingTime + dur);
      overtone2.start(pingTime);
      overtone2.stop(pingTime + dur);
    });
  }

  playCountdownTick(secondsLeft = 5): void {
    if (this.soundMuted || !this.isUserViewingGame()) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx!.currentTime;
    const isFinal = secondsLeft <= 1;

    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();
    const filter = this.ctx!.createBiquadFilter();

    if (isFinal) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

      osc.connect(gain);
      this.connectToDestination(gain, this.sfxGain || this.masterGain || this.ctx!.destination);

      osc.start(t);
      osc.stop(t + 0.075);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(720, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.035);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, t);
      filter.Q.setValueAtTime(3.0, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);

      osc.connect(filter);
      filter.connect(gain);
      this.connectToDestination(gain, this.sfxGain || this.masterGain || this.ctx!.destination);

      osc.start(t);
      osc.stop(t + 0.042);
    }
  }

  playTakeoff(): void {
    if (this.soundMuted || !this.isUserViewingGame()) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const filter = this.ctx!.createBiquadFilter();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(260, t + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, t);
    filter.frequency.linearRampToValueAtTime(840, t + 0.35);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.26, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    this.connectToDestination(gain, this.sfxGain || this.masterGain || this.ctx!.destination);

    osc.start(t);
    osc.stop(t + 0.40);
  }

  playBetPlaced(): void {
    if (this.soundMuted || !this.isUserViewingApp()) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx!.currentTime;

    [0.0, 0.024].forEach((delay, idx) => {
      const pingTime = t + delay;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 1650 : 640, pingTime);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 420 : 180, pingTime + 0.022);

      gain.gain.setValueAtTime(0.18, pingTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + 0.025);

      osc.connect(gain);
      this.connectToDestination(gain, this.sfxGain || this.masterGain || this.ctx!.destination);

      osc.start(pingTime);
      osc.stop(pingTime + 0.03);
    });
  }

  playClick(): void {
    this.playBetPlaced();
  }

  playMilestone(tier: number): void {
    if (this.soundMuted || !this.isUserViewingGame()) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx!.currentTime;

    if (tier === 2.0) {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      this.connectToDestination(gain, this.sfxGain || this.masterGain || this.ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    } else if (tier >= 10.0) {
      const notes = [1046.50, 1318.51, 1567.98];
      notes.forEach((freq, idx) => {
        const pingTime = t + (idx * 0.08);
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, pingTime);
        gain.gain.setValueAtTime(0.001, pingTime);
        gain.gain.linearRampToValueAtTime(0.24, pingTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + 0.50);

        osc.connect(gain);
        this.connectToDestination(gain, this.sfxGain || this.masterGain || this.ctx!.destination);
        osc.start(pingTime);
        osc.stop(pingTime + 0.52);
      });
    }
  }

  playDeposit(): void {
    if (this.soundMuted || !this.isUserViewingApp()) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx!.currentTime;
    const notes = [1046.50, 1318.51, 1567.98, 2093.00];

    notes.forEach((freq, idx) => {
      const noteTime = t + (idx * 0.065);
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.45);

      osc.connect(gain);
      this.connectToDestination(gain, this.sfxGain || this.masterGain || this.ctx!.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.48);
    });
  }

  startAmbientMusic(): void {
    if (this.musicMuted || this.isPlayingMusic || !this.isUserViewingApp()) return;
    this.initContext();
    if (!this.ctx) return;

    this.isPlayingMusic = true;

    const progression = [
      { bass: 73.42, chord: [220.00, 261.63, 293.66, 329.63] },
      { bass: 98.00, chord: [246.94, 293.66, 329.63, 392.00] },
      { bass: 58.27, chord: [174.61, 220.00, 261.63, 293.66] },
      { bass: 55.00, chord: [164.81, 220.00, 261.63, 329.63] }
    ];

    let chordIdx = 0;

    const playNextChord = () => {
      if (!this.isPlayingMusic || this.musicMuted || !this.ctx || !this.isUserViewingApp()) return;

      const { bass, chord } = progression[chordIdx % progression.length];
      chordIdx++;
      const t = this.ctx!.currentTime;
      const duration = 3.6;

      const bassOsc = this.ctx!.createOscillator();
      const bassGain = this.ctx!.createGain();
      const bassFilter = this.ctx!.createBiquadFilter();

      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(bass, t);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(180, t);

      bassGain.gain.setValueAtTime(0.0001, t);
      bassGain.gain.linearRampToValueAtTime(0.08, t + 0.35);
      bassGain.gain.linearRampToValueAtTime(0.0001, t + duration);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      const musicDestination = this.musicGain || this.masterGain || this.ctx!.destination;
      this.connectToDestination(bassGain, musicDestination);

      bassOsc.start(t);
      bassOsc.stop(t + duration);

      chord.forEach(freq => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        const filter = this.ctx!.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(360, t);
        filter.frequency.linearRampToValueAtTime(540, t + 1.2);
        filter.frequency.linearRampToValueAtTime(320, t + duration);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(0.045, t + 0.50);
        gain.gain.linearRampToValueAtTime(0.0001, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        this.connectToDestination(gain, musicDestination);

        osc.start(t);
        osc.stop(t + duration);
      });
    };

    playNextChord();
    this.musicInterval = setInterval(playNextChord, 3500);
  }

  stopAmbientMusic(): void {
    this.isPlayingMusic = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}
