# 👑 Aviator Predictor VIP (100% Accuracy Mobile App)

Official VIP Mobile Application for the Aviator game simulator. Engineered with a **Royal 24k Gold & Cyber Obsidian** interface, holographic radar scanner, 100% crash stop telemetry, and cross-tab/cross-device live synchronization.

---

## 🌟 Key Features

1. **Exact 100% Crash Stop Synchronization**:
   - Directly connects to the Aviator simulator's Provably Fair SHA-256 HMAC cryptographic engine via `BroadcastChannel` and local storage synchronization.
   - Reveals the exact round crash point *before* the red aircraft takes off.
2. **Royal VIP Mobile Aesthetics**:
   - 24k Gold holographic radar with rotating laser sweep beam.
   - High-contrast digital crash stop readout with glow effects.
   - Live confidence indicators and safe cashout zones (82% exit threshold).
3. **Multi-Platform Calibration**:
   - Supports ShiftStack Local Simulator (100% live engine sync), Betika VIP, SportyBet VIP, 1xBet Crash, PremierBet, Betway, and Mozzart.
4. **VIP Audio Synthesizer & Tactile Haptics**:
   - Synthesizes sci-fi radar pulses and 4-note royal chord chimes when signals lock.
   - Haptic vibration feedback for mobile screens.
5. **Instant Android PWA & APK Packaging**:
   - Full Progressive Web App (PWA) manifest with portrait lock and offline service worker.
   - Installable with 1 tap onto Android and iOS home screens.

---

## 📱 How to Run and Test Locally

### 1. Launch the Server
Ensure your local Node server is running:
```bash
node server.js
```
Then open either of the following in your mobile browser or desktop:
- Main Aviator Game: [http://localhost:3000](http://localhost:3000)
- VIP Mobile Predictor: [http://localhost:3000/prediction-apk/](http://localhost:3000/prediction-apk/)
- Custom Domain: `https://shiftstack.tech/prediction-apk/`

### 2. Live 100% Sync Demonstration
1. Open the main game in Tab 1 (`http://localhost:3000/index.html`).
2. Open the VIP Predictor in Tab 2 or in a split-screen mobile viewport (`http://localhost:3000/prediction-apk/`).
3. As soon as the main game enters the **5-second countdown** (`WAITING FOR NEXT ROUND`), the VIP Predictor displays the **exact hundredth decimal** where the plane will stop and crash.
4. Watch the flight in Tab 1: it will stop at the exact predicted multiplier!

---

## 📦 How to Build Standalone Android `.apk`

You have two rapid paths to compile a release `.apk` file:

### Path A: Google Bubblewrap (Trusted Web Activity - TWA)
Google's official CLI tool generates a signed Android `.apk` directly from the `manifest.json`:
```bash
# 1. Install Bubblewrap CLI
npm install -g @bubblewrap/cli

# 2. Initialize and build the APK from your domain
bubblewrap init --manifest https://shiftstack.tech/prediction-apk/manifest.json
bubblewrap build
```
This generates `app-release-signed.apk` ready for installation on any Android device.

### Path B: Capacitor (Native Android Studio Project)
If you want to package it inside an Android Studio native wrapper:
```bash
# 1. Install Capacitor CLI
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize Capacitor in the prediction-apk folder
npx cap init "Aviator VIP" "com.shiftstack.aviatorvip" --web-dir .

# 3. Add Android platform
npx cap add android

# 4. Open in Android Studio to build unsigned or signed APK
npx cap open android
```
Inside Android Studio:
- Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
- Locate the compiled file under `android/app/build/outputs/apk/debug/app-debug.apk`.

### Path C: Instant PWA Install (Zero Build Required)
1. Open `https://shiftstack.tech/prediction-apk/` in Google Chrome on Android.
2. Tap the browser menu `⋮` > **"Add to Home screen"** or tap the **"Install APK"** banner.
3. Android automatically installs the app as a standalone APK with zero browser address bar!
