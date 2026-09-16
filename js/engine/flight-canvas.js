/**
 * Spribe Aviator 60 FPS HTML5 Canvas Flight Engine
 * Authentic flight physics, smooth Bezier trajectory curve with glowing neon red trail,
 * procedural propeller rotation, particle exhaust system, dynamic scaling coordinate axes,
 * Spribe "FLEW AWAY!" off-screen flyout animation, and responsive DPR rendering.
 */

export class FlightCanvasEngine {
  constructor(canvasElement, onMultiplierUpdate, onStateChange) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onMultiplierUpdate = onMultiplierUpdate;
    this.onStateChange = onStateChange;

    // Dimensions
    this.width = 800;
    this.height = 405;
    this.dpr = window.devicePixelRatio || 1;

    // Game States: 'WAITING', 'FLYING', 'CRASHED'
    this.state = 'WAITING';
    this.countdownSeconds = 5.0;
    this.countdownStartTime = 0;
    this.countdownDuration = 5000;

    // Flight Dynamics
    this.flightStartTime = 0;
    this.currentMultiplier = 1.00;
    this.targetCrashMultiplier = 2.00;
    this.elapsedFlightTime = 0;

    // Crash Fly-Off Animation
    this.crashTime = 0;
    this.crashPlanePos = { x: 0, y: 0, angle: 0 };

    // Animation & Particles
    this.particles = [];
    this.explosionParticles = [];
    this.propellerAngle = 0;
    this.shockwaveRadius = 0;
    this.shockwaveAlpha = 0;
    this.lastCrashPos = { x: 0, y: 0 };

    // Grid Scaling
    this.maxX = 7;    // flight seconds shown
    this.maxY = 2.2;  // multiplier ceiling shown

    // Animation frame handle
    this.animFrameId = null;

    this.initResize();
    this.startRenderLoop();
  }

  initResize() {
    const handleResize = () => {
      const parent = this.canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : null;
      const w = (rect && rect.width > 20) ? rect.width : (this.canvas.clientWidth || 800);
      const h = (rect && rect.height > 20) ? rect.height : (this.canvas.clientHeight || 405);

      this.width = Math.floor(w);
      this.height = Math.floor(h);
      this.dpr = window.devicePixelRatio || 1;

      const targetW = Math.floor(this.width * this.dpr);
      const targetH = Math.floor(this.height * this.dpr);

      if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
        this.canvas.width = targetW;
        this.canvas.height = targetH;
      }
    };

    window.addEventListener('resize', handleResize);
    if (this.canvas.parentElement && window.ResizeObserver) {
      const ro = new ResizeObserver(() => handleResize());
      ro.observe(this.canvas.parentElement);
    }

    handleResize();
    setTimeout(handleResize, 50);
    setTimeout(handleResize, 200);
  }

  startCountdown(seconds = 5.0, crashMultiplier = 2.00) {
    this.state = 'WAITING';
    this.targetCrashMultiplier = Math.max(1.00, parseFloat(crashMultiplier) || 2.00);
    this.countdownDuration = seconds * 1000;
    this.countdownStartTime = performance.now();
    this.countdownSeconds = seconds;
    this.currentMultiplier = 1.00;
    this.elapsedFlightTime = 0;
    this.particles = [];
    this.explosionParticles = [];
    this.shockwaveRadius = 0;
    this.shockwaveAlpha = 0;
    this.crashTime = 0;
    this.maxX = 7;
    this.maxY = 2.2;

    if (this.onStateChange) {
      this.onStateChange(this.state, { countdown: seconds, crashMultiplier: this.targetCrashMultiplier });
    }
  }

  startFlight(crashMultiplier) {
    this.state = 'FLYING';
    if (crashMultiplier) {
      this.targetCrashMultiplier = Math.max(1.00, parseFloat(crashMultiplier));
    }
    this.flightStartTime = performance.now();
    this.currentMultiplier = 1.00;
    this.elapsedFlightTime = 0;
    this.particles = [];
    this.explosionParticles = [];
    this.crashTime = 0;
    this.maxX = 7;
    this.maxY = 2.2;

    if (this.onStateChange) {
      this.onStateChange(this.state, { crashMultiplier: this.targetCrashMultiplier });
    }
  }

  triggerCrash() {
    this.state = 'CRASHED';
    this.crashTime = performance.now();
    this.lastCrashPos = this.getPlaneCoordinates();
    this.crashPlanePos = { ...this.lastCrashPos };
    this.createExplosion();

    if (this.onStateChange) {
      this.onStateChange(this.state, { finalMultiplier: this.targetCrashMultiplier });
    }
  }

  createExplosion() {
    const planePos = this.lastCrashPos;
    this.shockwaveRadius = 14;
    this.shockwaveAlpha = 1.0;

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 8.0;
      this.explosionParticles.push({
        x: planePos.x,
        y: planePos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        alpha: 1.0,
        color: Math.random() > 0.4 ? '#ff003b' : (Math.random() > 0.5 ? '#ff9800' : '#ffffff')
      });
    }
  }

  computeMultiplierFromTime(t) {
    if (t <= 0) return 1.00;
    const val = Math.pow(Math.E, 0.072 * t) + (0.012 * t * t);
    return Math.max(1.00, Math.floor(val * 100) / 100);
  }

  getPlaneCoordinates() {
    const isMobile = this.width < 500;
    const marginX = isMobile ? 35 : 55;
    const marginY = isMobile ? 30 : 45;
    const usableW = Math.max(100, this.width - marginX - (isMobile ? 40 : 70));
    const usableH = Math.max(100, this.height - marginY - (isMobile ? 35 : 60));
    const originX = marginX + (isMobile ? 20 : 35);
    const originY = this.height - marginY - (isMobile ? 8 : 14);

    if (this.state === 'WAITING') {
      return {
        x: originX,
        y: originY + Math.sin(performance.now() * 0.005) * 2,
        angle: -0.05
      };
    }

    if (this.state === 'CRASHED') {
      // Plane accelerates up and to the right off screen (Spribe "FLEW AWAY" signature animation)
      const crashElapsed = (performance.now() - this.crashTime) / 1000;
      const flyOffSpeed = 500; // px/sec
      return {
        x: this.crashPlanePos.x + crashElapsed * flyOffSpeed,
        y: this.crashPlanePos.y - crashElapsed * (flyOffSpeed * 0.75),
        angle: -0.45
      };
    }

    const t = Math.max(0, this.elapsedFlightTime);
    const normX = Math.min(0.88, (1 - Math.exp(-t * 0.20)) * 0.95);
    const multRatio = (this.currentMultiplier - 1.0) / Math.max(0.5, this.maxY - 1.0);
    const normY = Math.min(0.85, Math.pow(Math.min(1.0, Math.max(0, multRatio)), 0.85) * 0.88);

    const x = originX + normX * usableW;
    const y = originY - normY * usableH;
    const angle = -0.08 - 0.18 * Math.exp(-t * 0.25);

    return { x, y, angle };
  }

  startRenderLoop() {
    const loop = (timestamp) => {
      this.animFrameId = requestAnimationFrame(loop);
      try {
        this.update(timestamp);
        this.render();
      } catch (err) {
        console.error('FlightCanvas loop error:', err);
      }
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  update(timestamp) {
    this.propellerAngle += (this.state === 'FLYING' ? 0.75 : 0.25);

    if (this.state === 'WAITING') {
      const elapsed = timestamp - (this.countdownStartTime || timestamp);
      const remaining = (this.countdownDuration - elapsed) / 1000;
      this.countdownSeconds = Math.max(0, remaining);

      if (this.onMultiplierUpdate) {
        this.onMultiplierUpdate(1.00, this.countdownSeconds);
      }

      if (remaining <= 0) {
        this.startFlight(this.targetCrashMultiplier);
        return;
      }
    } else if (this.state === 'FLYING') {
      if (!this.flightStartTime) this.flightStartTime = timestamp;
      this.elapsedFlightTime = Math.max(0, (timestamp - this.flightStartTime) / 1000);
      this.currentMultiplier = this.computeMultiplierFromTime(this.elapsedFlightTime);

      if (this.currentMultiplier >= this.targetCrashMultiplier) {
        this.currentMultiplier = this.targetCrashMultiplier;
        this.triggerCrash();
      } else {
        if (this.currentMultiplier > this.maxY * 0.75) {
          this.maxY = this.currentMultiplier * 1.35;
        }
        if (this.elapsedFlightTime > this.maxX * 0.75) {
          this.maxX = this.elapsedFlightTime * 1.35;
        }

        if (Math.random() > 0.2) {
          const plane = this.getPlaneCoordinates();
          this.particles.push({
            x: plane.x - 22,
            y: plane.y + 4 + (Math.random() - 0.5) * 4,
            vx: -3.0 - Math.random() * 3.0,
            vy: 0.5 + (Math.random() - 0.5) * 1.5,
            radius: 2.5 + Math.random() * 3.5,
            alpha: 0.8,
            color: Math.random() > 0.4 ? '#ff003b' : '#ff9800'
          });
        }
      }

      if (this.onMultiplierUpdate) {
        this.onMultiplierUpdate(this.currentMultiplier, 0);
      }
    } else if (this.state === 'CRASHED') {
      if (this.shockwaveRadius < 90) {
        this.shockwaveRadius += 3.5;
        this.shockwaveAlpha = Math.max(0, this.shockwaveAlpha - 0.045);
      }
    }

    // Update exhaust particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.035;
      p.radius *= 0.98;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update explosion particles
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const ep = this.explosionParticles[i];
      ep.x += ep.vx;
      ep.y += ep.vy;
      ep.vy += 0.15; // gravity
      ep.alpha -= 0.03;
      if (ep.alpha <= 0) {
        this.explosionParticles.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, w, h);

    // 1. Dark Backdrop & Grid
    this.renderBackgroundGrid(ctx, w, h);

    // 2. Trajectory curve & glowing red area fill
    if (this.state === 'FLYING' || this.state === 'CRASHED') {
      this.renderFlightTrajectory(ctx, w, h);
    }

    // 3. Render exhaust particles
    this.renderParticles(ctx);

    // 4. Render Airplane
    const plane = this.getPlaneCoordinates();
    if (this.state === 'FLYING' || this.state === 'WAITING') {
      this.renderAirplane(ctx, plane.x, plane.y, this.state === 'WAITING', plane.angle);
    } else if (this.state === 'CRASHED') {
      // Draw flying-away plane if still within bounds
      if (plane.x < w + 80 && plane.y > -80) {
        this.renderAirplane(ctx, plane.x, plane.y, false, plane.angle);
      }
      this.renderExplosion(ctx);
    }

    // 5. Center Multiplier or Waiting Display
    this.renderCenterDisplay(ctx, w, h);

    ctx.restore();
  }

  renderBackgroundGrid(ctx, w, h) {
    const isMobile = w < 500;
    const marginX = isMobile ? 35 : 55;
    const marginY = isMobile ? 30 : 45;

    // Dark gradient backdrop
    const safeH = Math.max(10, h);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, safeH);
    bgGrad.addColorStop(0, '#101217');
    bgGrad.addColorStop(1, '#090a0d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle coordinate lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    // Horizontal Y-axis lines (multiplier levels)
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const ratio = i / ySteps;
      const y = (h - marginY - 14) - ratio * (h - marginY - 50);
      const multVal = (1.0 + ratio * (this.maxY - 1.0)).toFixed(1) + 'x';

      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(w - 15, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(multVal, marginX - 6, y + 3);
    }

    // Vertical X-axis lines (seconds)
    const xSteps = 4;
    for (let i = 0; i <= xSteps; i++) {
      const ratio = i / xSteps;
      const x = marginX + 30 + ratio * (w - marginX - 50);
      const timeVal = (ratio * this.maxX).toFixed(0) + 's';

      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, h - marginY);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(timeVal, x, h - marginY + 16);
    }

    // Baseline axis
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(marginX, h - marginY);
    ctx.lineTo(w - 15, h - marginY);
    ctx.stroke();

    ctx.restore();
  }

  renderFlightTrajectory(ctx, w, h) {
    const isMobile = w < 500;
    const marginX = isMobile ? 35 : 55;
    const marginY = isMobile ? 30 : 45;
    const originX = marginX + (isMobile ? 20 : 35);
    const originY = h - marginY - (isMobile ? 8 : 14);
    const plane = (this.state === 'CRASHED') ? this.lastCrashPos : this.getPlaneCoordinates();

    if (plane.x <= originX + 2) return;

    ctx.save();

    // 1. Glowing Red Gradient Fill Under the Curve
    const topY = Math.min(plane.y, originY - 4);
    const fillGrad = ctx.createLinearGradient(0, topY, 0, originY);
    fillGrad.addColorStop(0, 'rgba(255, 0, 59, 0.32)');
    fillGrad.addColorStop(0.6, 'rgba(255, 0, 59, 0.08)');
    fillGrad.addColorStop(1, 'rgba(255, 0, 59, 0.0)');

    ctx.beginPath();
    ctx.moveTo(originX, originY);

    const cp1x = originX + (plane.x - originX) * 0.45;
    const cp1y = originY;
    const cp2x = originX + (plane.x - originX) * 0.70;
    const cp2y = originY - (originY - plane.y) * 0.70;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, plane.x, plane.y);
    ctx.lineTo(plane.x, originY);
    ctx.closePath();

    ctx.fillStyle = fillGrad;
    ctx.fill();

    // 2. Neon Red Trajectory Curve Stroke
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, plane.x, plane.y);

    ctx.strokeStyle = '#ff003b';
    ctx.lineWidth = isMobile ? 3 : 4;
    ctx.shadowColor = '#ff003b';
    ctx.shadowBlur = isMobile ? 12 : 18;
    ctx.stroke();

    ctx.restore();
  }

  renderParticles(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.restore();
  }

  renderAirplane(ctx, x, y, isWaiting = false, customAngle = null) {
    ctx.save();
    ctx.translate(x, y);

    const isMobile = this.width < 500;
    const scale = isMobile ? 1.15 : 1.40;
    ctx.scale(scale, scale);

    const angle = customAngle !== null ? customAngle : (isWaiting ? -0.05 : -0.20);
    ctx.rotate(angle);

    // Jet exhaust glow
    if (!isWaiting && this.state === 'FLYING') {
      const exhaustGlow = ctx.createRadialGradient(-20, 2, 1, -20, 2, 16);
      exhaustGlow.addColorStop(0, '#ffffff');
      exhaustGlow.addColorStop(0.35, '#ff9800');
      exhaustGlow.addColorStop(0.75, '#ff003b');
      exhaustGlow.addColorStop(1, 'rgba(255, 0, 59, 0)');
      ctx.fillStyle = exhaustGlow;
      ctx.beginPath();
      ctx.arc(-20, 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fuselage (Authentic Spribe red aerodynamic sports aircraft)
    ctx.shadowColor = 'rgba(255, 0, 59, 0.7)';
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(30, 0); // Nose tip
    ctx.bezierCurveTo(20, -7, -10, -7, -24, -3);
    ctx.lineTo(-30, -16); // Tail fin top
    ctx.lineTo(-34, -15);
    ctx.lineTo(-28, 2);
    ctx.lineTo(-24, 4);
    ctx.bezierCurveTo(-10, 8, 20, 6, 30, 0);
    ctx.closePath();

    const bodyGrad = ctx.createLinearGradient(-24, -12, 28, 12);
    bodyGrad.addColorStop(0, '#e50033');
    bodyGrad.addColorStop(0.5, '#ff1a4d');
    bodyGrad.addColorStop(1, '#990022');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // White Racing Stripe across fuselage
    ctx.beginPath();
    ctx.moveTo(18, -1);
    ctx.lineTo(2, 4);
    ctx.lineTo(-8, 4);
    ctx.lineTo(6, -2);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Main Wing
    ctx.beginPath();
    ctx.moveTo(6, 2);
    ctx.lineTo(-14, 16);
    ctx.lineTo(-19, 15);
    ctx.lineTo(-4, 0);
    ctx.closePath();
    ctx.fillStyle = '#ff2b5a';
    ctx.fill();

    // Cockpit Windshield (Glossy cyan glass)
    ctx.beginPath();
    ctx.moveTo(16, -2);
    ctx.bezierCurveTo(12, -6, 4, -6, 2, -2);
    ctx.lineTo(4, 0);
    ctx.lineTo(14, 0);
    ctx.closePath();
    const glassGrad = ctx.createLinearGradient(2, -6, 16, 0);
    glassGrad.addColorStop(0, '#e0f2fe');
    glassGrad.addColorStop(0.5, '#38bdf8');
    glassGrad.addColorStop(1, '#0284c7');
    ctx.fillStyle = glassGrad;
    ctx.fill();

    // Spinning Propeller at Nose
    ctx.save();
    ctx.translate(30, 0);
    ctx.rotate(this.propellerAngle);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, -15, 4, 30);

    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = isWaiting ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.22)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  renderExplosion(ctx) {
    ctx.save();
    const planePos = this.lastCrashPos;

    if (this.shockwaveAlpha > 0) {
      ctx.beginPath();
      ctx.arc(planePos.x, planePos.y, this.shockwaveRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 0, 59, ${this.shockwaveAlpha})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff003b';
      ctx.shadowBlur = 15;
      ctx.stroke();
    }

    for (const ep of this.explosionParticles) {
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.radius, 0, Math.PI * 2);
      ctx.fillStyle = ep.color;
      ctx.globalAlpha = Math.max(0, ep.alpha);
      ctx.shadowColor = ep.color;
      ctx.shadowBlur = 10;
      ctx.fill();
    }
    ctx.restore();
  }

  renderCenterDisplay(ctx, w, h) {
    ctx.save();
    const isMobile = w < 500;

    if (this.state === 'WAITING') {
      // Spribe Countdown Display
      const totalSec = (this.countdownDuration / 1000) || 5.0;
      const progress = Math.min(1.0, Math.max(0, this.countdownSeconds / totalSec));

      // Top red progress bar
      const barW = Math.min(320, w * 0.6);
      const barX = (w - barW) / 2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(barX, 22, barW, 4);

      ctx.fillStyle = '#ff003b';
      ctx.shadowColor = '#ff003b';
      ctx.shadowBlur = 10;
      ctx.fillRect(barX, 22, barW * (1 - progress), 4);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = '800 12px Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.shadowBlur = 0;
      ctx.fillText('WAITING FOR NEXT ROUND', w / 2, h / 2 - (isMobile ? 18 : 22));

      ctx.font = `800 ${isMobile ? 40 : 52}px Outfit, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 0, 59, 0.4)';
      ctx.shadowBlur = 16;
      ctx.fillText(`${this.countdownSeconds.toFixed(1)}s`, w / 2, h / 2 + (isMobile ? 18 : 22));

    } else if (this.state === 'FLYING') {
      // Spribe Live Multiplier Display
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const multStr = `${this.currentMultiplier.toFixed(2)}x`;
      const baseFontSize = isMobile ? 46 : 64;
      const fontSize = Math.min(isMobile ? 68 : 88, baseFontSize + Math.log10(this.currentMultiplier) * 16);
      ctx.font = `900 ${fontSize}px Outfit, sans-serif`;

      let fillColor = '#ffffff';
      let shadowColor = 'rgba(255, 255, 255, 0.5)';
      if (this.currentMultiplier >= 10.0) {
        fillColor = '#c017b4'; // Spribe Hot Pink / Magenta
        shadowColor = '#c017b4';
      } else if (this.currentMultiplier >= 2.0) {
        fillColor = '#913ef8'; // Spribe Purple
        shadowColor = '#913ef8';
      }

      ctx.fillStyle = fillColor;
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = 24;
      ctx.fillText(multStr, w / 2, h / 2);

    } else if (this.state === 'CRASHED') {
      // Spribe "FLEW AWAY!" Crash Banner
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.font = `900 ${isMobile ? 24 : 32}px Outfit, sans-serif`;
      ctx.fillStyle = '#ff003b';
      ctx.shadowColor = '#ff003b';
      ctx.shadowBlur = 20;
      ctx.fillText('FLEW AWAY!', w / 2, h / 2 - (isMobile ? 20 : 26));

      ctx.font = `900 ${isMobile ? 44 : 58}px Outfit, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(255, 0, 59, 0.8)';
      ctx.shadowBlur = 25;
      ctx.fillText(`${this.targetCrashMultiplier.toFixed(2)}x`, w / 2, h / 2 + (isMobile ? 24 : 30));
    }

    ctx.restore();
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}
