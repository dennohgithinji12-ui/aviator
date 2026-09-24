/**
 * Official Spribe Aviator Sound Effects Engine
 * Recreates Spribe Aviator's authentic audio identity:
 * - Aerobatic twin-cylinder propeller engine drone with aerodynamic blade-chop air modulation
 * - Exponential logarithmic pitch climb tracking flight multiplier (1.00x to 100x+)
 * - Signature "FLEW AWAY" Doppler jet fly-off whoosh with stereo trajectory pan
 * - Iconic crystal-gold dual coin bell cashout chime (Ding-Ding! at 1480Hz & 2217Hz)
 * - Rhythmic wooden acoustic countdown ticks (5s-2s) & high alert pip (1s)
 * - Jet throttle takeoff spinup whoosh
 * - Tactile mechanical bet switch click
 * - Milestone reward chimes (2x Purple tier & 10x Magenta tier)
 * - 4-note cascading coin drop deposit jingle
 * - Ambient hypnotic lounge synth groove in Dm9 / G13 / Bbmaj7 / Am7
 */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.soundMuted = false;
    this.musicMuted = false;
    this.masterVolume = 0.65;

    // Audio routing buses
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;

    // Propeller Engine state & audio nodes
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

    // Milestones tracking
    this.lastMilestonePassed = 1.0;

    // Ambient music scheduler
    this.musicInterval = null;
    this.isPlayingMusic = false;

    // Universal unlock on first user gesture across mobile & desktop
    const unlockEvents = ['click', 'touchstart', 'touchend', 'mousedown', 'pointerdown', 'keydown'];
    const unlockAudio = () => {
      this.initContext();
      if (!this.musicMuted && !this.isPlayingMusic) {
        this.startAmbientMusic();
      }
      unlockEvents.forEach(evt => window.removeEventListener(evt, unlockAudio));
    };

    unlockEvents.forEach(evt => window.addEventListener(evt, unlockAudio, { passive: true }));
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Build Master & Sub-buses
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.soundMuted ? 0.0 : 1.0, this.ctx.currentTime);
        this.sfxGain.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(this.musicMuted ? 0.0 : 0.45, this.ctx.currentTime);
        this.musicGain.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleSound() {
    this.soundMuted = !this.soundMuted;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.soundMuted ? 0.0 : 1.0, this.ctx.currentTime, 0.02);
    }
    if (this.soundMuted && this.isPlayingEngine) {
      this.stopEngine();
    }
    return this.soundMuted;
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicMuted ? 0.0 : 0.45, this.ctx.currentTime, 0.05);
    }
    if (this.musicMuted) {
      this.stopAmbientMusic();
    } else {
      this.startAmbientMusic();
    }
    return this.musicMuted;
  }

  toggleMute() {
    return this.toggleSound();
  }

  /* =========================================================================
     1. AUTHENTIC SPRIBE PROPELLER ENGINE DRONE
     Warm twin-cylinder hum + aero blade chop + dynamic tension pitch climb
     ========================================================================= */
  startEngine() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopEngine();
    this.lastMilestonePassed = 1.0;
    const t = this.ctx.currentTime;

    // 1. Primary Engine Oscillator (Sawtooth harmonic body)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(84, t); // F2 warm displacement

    // 2. Harmonic Oscillator (Triangle wave overtone)
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(168, t);

    // 3. Sub-octave chassis rumble (Square wave filtered heavily)
    this.engineSub = this.ctx.createOscillator();
    this.engineSub.type = 'square';
    this.engineSub.frequency.setValueAtTime(42, t);

    // Warm Lowpass Filter for engine tone
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(420, t);
    this.engineFilter.Q.setValueAtTime(2.2, t);

    // 4. Aerodynamic Propeller Blade Air Chop (White Noise passed through resonant bandpass)
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

    // 5. Rotor Blade Tremolo (LFO modulating gain smoothly between 0.40 and 1.0 without phase distortion)
    this.tremoloGain = this.ctx.createGain();
    this.tremoloGain.gain.setValueAtTime(0.70, t);

    this.rotorLFO = this.ctx.createOscillator();
    this.rotorLFO.type = 'sine';
    this.rotorLFO.frequency.setValueAtTime(24, t); // 24 blade passes/sec at idle

    this.rotorLFOGain = this.ctx.createGain();
    this.rotorLFOGain.gain.setValueAtTime(0.28, t);

    this.rotorLFO.connect(this.rotorLFOGain);
    this.rotorLFOGain.connect(this.tremoloGain.gain);

    // Main Engine Master Gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.0001, t);
    this.engineGain.gain.linearRampToValueAtTime(0.18, t + 0.20);

    // Routing
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

  // Accelerates pitch and blade chop as multiplier climbs
  updateEnginePitch(multiplier) {
    if (!this.isPlayingEngine || !this.ctx || this.soundMuted) return;
    const t = this.ctx.currentTime;

    // Logarithmic curve: 1.00x -> 100.00x smoothly maps 84Hz -> 420Hz
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

    // Trigger milestone sounds on key multipliers (2x Purple, 10x Magenta)
    if (multiplier >= 2.0 && this.lastMilestonePassed < 2.0) {
      this.lastMilestonePassed = 2.0;
      this.playMilestone(2.0);
    } else if (multiplier >= 10.0 && this.lastMilestonePassed < 10.0) {
      this.lastMilestonePassed = 10.0;
      this.playMilestone(10.0);
    }
  }

  stopEngine() {
    if (!this.isPlayingEngine || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.setTargetAtTime(0.0001, t, 0.03);
      }
      setTimeout(() => {
        if (this.engineOsc1) { try { this.engineOsc1.stop(); this.engineOsc1.disconnect(); } catch (e) {} }
        if (this.engineOsc2) { try { this.engineOsc2.stop(); this.engineOsc2.disconnect(); } catch (e) {} }
        if (this.engineSub) { try { this.engineSub.stop(); this.engineSub.disconnect(); } catch (e) {} }
        if (this.bladeNoiseSource) { try { this.bladeNoiseSource.stop(); this.bladeNoiseSource.disconnect(); } catch (e) {} }
        if (this.rotorLFO) { try { this.rotorLFO.stop(); this.rotorLFO.disconnect(); } catch (e) {} }
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.engineSub = null;
        this.bladeNoiseSource = null;
        this.rotorLFO = null;
        this.isPlayingEngine = false;
      }, 50);
    } catch (e) {
      this.isPlayingEngine = false;
    }
  }

  /* =========================================================================
     2. SPRIBE "FLEW AWAY!" DOPPLER FLY-OFF SOUND
     Iconic jet aerodynamic fly-away whoosh with stereo trajectory pan
     ========================================================================= */
  playFlewAway() {
    this.stopEngine();
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Aerodynamic Resonant Whoosh (Noise sweeping down with Doppler curve)
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.85);
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.85;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.setValueAtTime(4.2, t);
    bandpass.frequency.setValueAtTime(2200, t);
    bandpass.frequency.exponentialRampToValueAtTime(110, t + 0.78);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(0.48, t + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.80);

    // Stereo Panner (moves from center to right as plane shoots off-screen)
    let panner = null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(0.0, t);
      panner.pan.linearRampToValueAtTime(0.85, t + 0.65);
    }

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    if (panner) {
      noiseGain.connect(panner);
      panner.connect(this.sfxGain || this.masterGain || this.ctx.destination);
    } else {
      noiseGain.connect(this.sfxGain || this.masterGain || this.ctx.destination);
    }

    noiseSource.start(t);
    noiseSource.stop(t + 0.85);

    // 2. High-speed Doppler engine down-glide tone
    const glideOsc = this.ctx.createOscillator();
    const glideGain = this.ctx.createGain();

    glideOsc.type = 'sawtooth';
    glideOsc.frequency.setValueAtTime(460, t);
    glideOsc.frequency.exponentialRampToValueAtTime(65, t + 0.70);

    const glideFilter = this.ctx.createBiquadFilter();
    glideFilter.type = 'lowpass';
    glideFilter.frequency.setValueAtTime(1100, t);
    glideFilter.frequency.exponentialRampToValueAtTime(90, t + 0.70);

    glideGain.gain.setValueAtTime(0.001, t);
    glideGain.gain.linearRampToValueAtTime(0.28, t + 0.04);
    glideGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.72);

    glideOsc.connect(glideFilter);
    glideFilter.connect(glideGain);
    glideGain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

    glideOsc.start(t);
    glideOsc.stop(t + 0.75);
  }

  playCrash() {
    this.playFlewAway();
  }

  /* =========================================================================
     3. SPRIBE CASHOUT SOUND: CRYSTAL DUAL COIN BELL CHIME
     Signature Spribe Aviator cashout: Ding-Ding! at 1480Hz & 2217Hz
     ========================================================================= */
  playCashout() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Note 1: F#6 (1479.98 Hz) -> Note 2: C#7 (2217.46 Hz)
    const bellPings = [
      { freq: 1479.98, delay: 0.00, dur: 0.65 },
      { freq: 2217.46, delay: 0.08, dur: 0.85 }
    ];

    bellPings.forEach(({ freq, delay, dur }) => {
      const pingTime = t + delay;

      // Primary crystal sine bell
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, pingTime);

      gain.gain.setValueAtTime(0.001, pingTime);
      gain.gain.linearRampToValueAtTime(0.38, pingTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur);

      // 1st Harmonic metallic shimmer
      const overtone1 = this.ctx.createOscillator();
      const overtone1Gain = this.ctx.createGain();
      overtone1.type = 'triangle';
      overtone1.frequency.setValueAtTime(freq * 2.0, pingTime);

      overtone1Gain.gain.setValueAtTime(0.001, pingTime);
      overtone1Gain.gain.linearRampToValueAtTime(0.14, pingTime + 0.010);
      overtone1Gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur * 0.55);

      // High crystalline sparkle
      const overtone2 = this.ctx.createOscillator();
      const overtone2Gain = this.ctx.createGain();
      overtone2.type = 'sine';
      overtone2.frequency.setValueAtTime(freq * 3.01, pingTime);

      overtone2Gain.gain.setValueAtTime(0.001, pingTime);
      overtone2Gain.gain.linearRampToValueAtTime(0.07, pingTime + 0.008);
      overtone2Gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur * 0.40);

      osc.connect(gain);
      overtone1.connect(overtone1Gain);
      overtone2.connect(overtone2Gain);

      gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);
      overtone1Gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);
      overtone2Gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

      osc.start(pingTime);
      osc.stop(pingTime + dur);
      overtone1.start(pingTime);
      overtone1.stop(pingTime + dur);
      overtone2.start(pingTime);
      overtone2.stop(pingTime + dur);
    });
  }

  /* =========================================================================
     4. COUNTDOWN TICKS & TAKEOFF REV
     ========================================================================= */
  playCountdownTick(secondsLeft = 5) {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const isFinal = secondsLeft <= 1;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    if (isFinal) {
      // High alert pip before takeoff
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.06);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24, t + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.075);
    } else {
      // Hollow acoustic woodblock tick (tok!)
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
      gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.042);
    }
  }

  // Jet takeoff throttle rev whoosh as multiplier initiates at 1.00x
  playTakeoff() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

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
    gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.40);
  }

  /* =========================================================================
     5. MECHANICAL BET CLICK & MILESTONE CHIMES
     ========================================================================= */
  playBetPlaced() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Crisp mechanical dual-transient click
    [0.0, 0.024].forEach((delay, idx) => {
      const pingTime = t + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 1650 : 640, pingTime);
      osc.frequency.exponentialRampToValueAtTime(idx === 0 ? 420 : 180, pingTime + 0.022);

      gain.gain.setValueAtTime(0.18, pingTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + 0.025);

      osc.connect(gain);
      gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

      osc.start(pingTime);
      osc.stop(pingTime + 0.03);
    });
  }

  playClick() {
    this.playBetPlaced();
  }

  playMilestone(tier) {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    if (tier === 2.0) {
      // 2.00x Purple tier shimmer
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.16, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    } else if (tier >= 10.0) {
      // 10.00x Magenta Big Win tier: Celebratory 3-note chime
      const notes = [1046.50, 1318.51, 1567.98];
      notes.forEach((freq, idx) => {
        const pingTime = t + (idx * 0.08);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, pingTime);
        gain.gain.setValueAtTime(0.001, pingTime);
        gain.gain.linearRampToValueAtTime(0.24, pingTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + 0.50);

        osc.connect(gain);
        gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);
        osc.start(pingTime);
        osc.stop(pingTime + 0.52);
      });
    }
  }

  // 4-Note coin drop deposit jingle
  playDeposit() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [1046.50, 1318.51, 1567.98, 2093.00];

    notes.forEach((freq, idx) => {
      const noteTime = t + (idx * 0.065);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.25, noteTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.45);

      osc.connect(gain);
      gain.connect(this.sfxGain || this.masterGain || this.ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.48);
    });
  }

  /* =========================================================================
     6. AMBIENT LOUNGE MUSIC LOOP (Spribe Electric Piano / Synth Pad)
     Mellow chord progression in Dm9 -> G13 -> Bbmaj7 -> Am7 with sub-bass
     ========================================================================= */
  startAmbientMusic() {
    if (this.musicMuted || this.isPlayingMusic) return;
    this.initContext();
    if (!this.ctx) return;

    this.isPlayingMusic = true;

    // Authentic mellow chords
    const progression = [
      { bass: 73.42, chord: [220.00, 261.63, 293.66, 329.63] }, // Dm9 (D2, A3, C4, D4, E4)
      { bass: 98.00, chord: [246.94, 293.66, 329.63, 392.00] }, // G13 (G2, B3, D4, E4, G4)
      { bass: 58.27, chord: [174.61, 220.00, 261.63, 293.66] }, // Bbmaj7 (Bb1, F3, A3, C4, D4)
      { bass: 55.00, chord: [164.81, 220.00, 261.63, 329.63] }  // Am7 (A1, E3, A3, C4, E4)
    ];

    let chordIdx = 0;

    const playNextChord = () => {
      if (!this.isPlayingMusic || this.musicMuted || !this.ctx) return;

      const { bass, chord } = progression[chordIdx % progression.length];
      chordIdx++;
      const t = this.ctx.currentTime;
      const duration = 3.6;

      // Deep mellow sub-bass note
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      const bassFilter = this.ctx.createBiquadFilter();

      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(bass, t);

      bassFilter.type = 'lowpass';
      bassFilter.frequency.setValueAtTime(180, t);

      bassGain.gain.setValueAtTime(0.0001, t);
      bassGain.gain.linearRampToValueAtTime(0.08, t + 0.35);
      bassGain.gain.linearRampToValueAtTime(0.0001, t + duration);

      bassOsc.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(this.musicGain || this.masterGain || this.ctx.destination);

      bassOsc.start(t);
      bassOsc.stop(t + duration);

      // Electric piano chord voices
      chord.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

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
        gain.connect(this.musicGain || this.masterGain || this.ctx.destination);

        osc.start(t);
        osc.stop(t + duration);
      });
    };

    playNextChord();
    this.musicInterval = setInterval(playNextChord, 3500);
  }

  stopAmbientMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}
