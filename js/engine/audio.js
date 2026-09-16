/**
 * ShiftStack Official Aviator Sound Engine
 * Recreates Spribe Aviator's exact soundscape:
 * - Propeller engine drone with rotor blade amplitude modulation & dynamic pitch climb
 * - Authentic "Flew Away" Doppler jet fly-off whoosh (not generic bomb explosion)
 * - Signature dual metallic coin/bell cashout chime (Ding-Ding!)
 * - Hypnotic ambient lounge music loop
 * - Takeoff revs and UI click ticks
 */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.soundMuted = false;
    this.musicMuted = false;
    this.masterVolume = 0.55;

    // Engine sound nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.propellerLFO = null;
    this.propellerLFOGain = null;
    this.isPlayingEngine = false;

    // Ambient music scheduler
    this.musicInterval = null;
    this.isPlayingMusic = false;

    // Unlock on first user interaction (browser autoplay policy)
    const unlockAudio = () => {
      this.initContext();
      if (!this.musicMuted && !this.isPlayingMusic) {
        this.startAmbientMusic();
      }
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.soundMuted = !this.soundMuted;
    if (this.soundMuted && this.isPlayingEngine) {
      this.stopEngine();
    }
    return this.soundMuted;
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    if (this.musicMuted) {
      this.stopAmbientMusic();
    } else {
      this.startAmbientMusic();
    }
    return this.musicMuted;
  }

  // Backwards compatible mute toggle
  toggleMute() {
    return this.toggleSound();
  }

  /* =========================================================================
     1. AVIATOR PROPELLER ENGINE SOUND
     Authentic dual harmonic engine with rotor blade chop modulation
     ========================================================================= */
  startEngine() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopEngine();
    const t = this.ctx.currentTime;

    // 1. Fundamental Engine Oscillator (Sawtooth + Triangle)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(78, t); // deep prop rumble

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(156, t);

    // Warm Lowpass Filter
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(380, t);
    this.engineFilter.Q.setValueAtTime(3.5, t);

    // 2. Propeller Blade Flutter (LFO modulating amplitude at ~28 blade passes/sec)
    this.propellerLFO = this.ctx.createOscillator();
    this.propellerLFO.type = 'sine';
    this.propellerLFO.frequency.setValueAtTime(26, t);

    this.propellerLFOGain = this.ctx.createGain();
    this.propellerLFOGain.gain.setValueAtTime(0.35, t);

    // Main Engine Gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.001, t);
    this.engineGain.gain.linearRampToValueAtTime(this.masterVolume * 0.14, t + 0.25);

    // Connect LFO to gain modulation
    this.propellerLFO.connect(this.propellerLFOGain);
    this.propellerLFOGain.connect(this.engineGain.gain);

    // Connect audio path
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineOsc1.start(t);
    this.engineOsc2.start(t);
    this.propellerLFO.start(t);
    this.isPlayingEngine = true;
  }

  // Smoothly accelerates pitch as multiplier climbs
  updateEnginePitch(multiplier) {
    if (!this.isPlayingEngine || !this.ctx || this.soundMuted) return;
    const t = this.ctx.currentTime;

    // Logarithmic scale: 1.00x -> 50.00x maps 78Hz -> 320Hz
    const logScale = Math.min(Math.log(multiplier) * 1.5, 3.8);
    const targetFreq = 78 + logScale * 62;
    const targetFilter = 380 + logScale * 260;
    const targetLFORate = 26 + logScale * 14;

    if (this.engineOsc1 && this.engineOsc2) {
      this.engineOsc1.frequency.setTargetAtTime(targetFreq, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(targetFreq * 2, t, 0.08);
    }
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(targetFilter, t, 0.08);
    }
    if (this.propellerLFO) {
      this.propellerLFO.frequency.setTargetAtTime(targetLFORate, t, 0.08);
    }
  }

  stopEngine() {
    if (!this.isPlayingEngine || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      if (this.engineGain) {
        this.engineGain.gain.setTargetAtTime(0.0001, t, 0.04);
      }
      setTimeout(() => {
        if (this.engineOsc1) { try { this.engineOsc1.stop(); this.engineOsc1.disconnect(); } catch (e) {} }
        if (this.engineOsc2) { try { this.engineOsc2.stop(); this.engineOsc2.disconnect(); } catch (e) {} }
        if (this.propellerLFO) { try { this.propellerLFO.stop(); this.propellerLFO.disconnect(); } catch (e) {} }
        this.engineOsc1 = null;
        this.engineOsc2 = null;
        this.propellerLFO = null;
        this.isPlayingEngine = false;
      }, 60);
    } catch (e) {
      this.isPlayingEngine = false;
    }
  }

  /* =========================================================================
     2. AUTHENTIC "FLEW AWAY" SOUND
     The iconic Spribe Aviator jet fly-off whoosh & Doppler altitude fade
     ========================================================================= */
  playFlewAway() {
    this.stopEngine();
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // 1. Resonant Whoosh (Noise sweeping down with Doppler curve)
    const bufferSize = this.ctx.sampleRate * 0.75;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.75;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.setValueAtTime(4.0, t);
    bandpass.frequency.setValueAtTime(1600, t);
    bandpass.frequency.exponentialRampToValueAtTime(180, t + 0.7);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.linearRampToValueAtTime(this.masterVolume * 0.38, t + 0.06);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noiseSource.start(t);
    noiseSource.stop(t + 0.75);

    // 2. High-speed Doppler engine glide tone
    const glideOsc = this.ctx.createOscillator();
    const glideGain = this.ctx.createGain();

    glideOsc.type = 'sawtooth';
    glideOsc.frequency.setValueAtTime(320, t);
    glideOsc.frequency.exponentialRampToValueAtTime(75, t + 0.65);

    const glideFilter = this.ctx.createBiquadFilter();
    glideFilter.type = 'lowpass';
    glideFilter.frequency.setValueAtTime(900, t);
    glideFilter.frequency.exponentialRampToValueAtTime(120, t + 0.65);

    glideGain.gain.setValueAtTime(0.001, t);
    glideGain.gain.linearRampToValueAtTime(this.masterVolume * 0.22, t + 0.05);
    glideGain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

    glideOsc.connect(glideFilter);
    glideFilter.connect(glideGain);
    glideGain.connect(this.ctx.destination);

    glideOsc.start(t);
    glideOsc.stop(t + 0.7);
  }

  // Alias for backward compatibility
  playCrash() {
    this.playFlewAway();
  }

  /* =========================================================================
     3. AUTHENTIC CASHOUT SOUND
     Spribe Aviator signature crystal dual bell chime: Ding-Ding!
     ========================================================================= */
  playCashout() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Note 1: E6 (1318.5 Hz) -> Note 2: A6 (1760.0 Hz)
    const bellPings = [
      { freq: 1318.51, delay: 0.00, dur: 0.55 },
      { freq: 1760.00, delay: 0.09, dur: 0.65 }
    ];

    bellPings.forEach(({ freq, delay, dur }) => {
      const pingTime = t + delay;

      // Primary sine tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, pingTime);

      gain.gain.setValueAtTime(0.001, pingTime);
      gain.gain.linearRampToValueAtTime(this.masterVolume * 0.32, pingTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur);

      // Add harmonic sparkle
      const overtone = this.ctx.createOscillator();
      const overtoneGain = this.ctx.createGain();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2.02, pingTime);

      overtoneGain.gain.setValueAtTime(0.001, pingTime);
      overtoneGain.gain.linearRampToValueAtTime(this.masterVolume * 0.12, pingTime + 0.015);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, pingTime + dur * 0.6);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(this.ctx.destination);
      overtoneGain.connect(this.ctx.destination);

      osc.start(pingTime);
      osc.stop(pingTime + dur);
      overtone.start(pingTime);
      overtone.stop(pingTime + dur);
    });
  }

  /* =========================================================================
     4. AMBIENT HYPNOTIC LOUNGE MUSIC LOOP (Spribe Style)
     Mellow synth pad chords in Dm9 -> G13 -> Bbmaj7 -> Am7
     ========================================================================= */
  startAmbientMusic() {
    if (this.musicMuted || this.isPlayingMusic) return;
    this.initContext();
    if (!this.ctx) return;

    this.isPlayingMusic = true;

    // Hypnotic chord progression (frequencies in Hz)
    const chords = [
      [146.83, 220.00, 261.63, 329.63], // Dm9 (D3, A3, C4, E4)
      [196.00, 246.94, 293.66, 329.63], // G13 (G3, B3, D4, E4)
      [116.54, 174.61, 233.08, 293.66], // Bbmaj7 (Bb2, F3, Bb3, D4)
      [110.00, 164.81, 220.00, 261.63]  // Am7 (A2, E3, A3, C4)
    ];

    let chordIdx = 0;

    const playNextChord = () => {
      if (!this.isPlayingMusic || this.musicMuted || !this.ctx) return;

      const chord = chords[chordIdx % chords.length];
      chordIdx++;
      const t = this.ctx.currentTime;
      const duration = 3.6; // seconds per chord

      chord.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420, t);
        filter.frequency.linearRampToValueAtTime(560, t + 1.8);
        filter.frequency.linearRampToValueAtTime(380, t + duration);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.linearRampToValueAtTime(this.masterVolume * 0.035, t + 0.8);
        gain.gain.linearRampToValueAtTime(0.0001, t + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

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

  /* =========================================================================
     5. UI INTERACTIONS & BUTTON TICKS
     ========================================================================= */
  playClick() {
    if (this.soundMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(820, t);
    osc.frequency.exponentialRampToValueAtTime(220, t + 0.035);

    gain.gain.setValueAtTime(this.masterVolume * 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  }
}
