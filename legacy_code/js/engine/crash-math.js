/**
 * ShiftStack Provably Fair Cryptographic Engine
 * Provides authentic SHA-256 HMAC crash multiplier calculation (97% RTP)
 */

export class CrashMathEngine {
  constructor() {
    this.clientSeed = 'shiftstack_' + Math.random().toString(36).substring(2, 15);
    this.nonce = 0;
    this.currentServerSeed = this.generateRandomHex(64);
    this.currentServerHash = '';
    this.history = [];
  }

  generateRandomHex(length = 64) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  // SHA-256 helper using browser Web Crypto API
  async sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // HMAC-SHA256 implementation using Web Crypto API
  async hmacSha256(keyStr, messageStr) {
    const enc = new TextEncoder();
    const keyData = enc.encode(keyStr);
    const msgData = enc.encode(messageStr);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Derive crash multiplier mathematically from Server Seed, Client Seed, and Nonce
   * Formula mirrors standard Provably Fair crash games (e.g. Spribe Aviator, Roobet, Stake)
   */
  async calculateCrashMultiplier(serverSeed, clientSeed, nonce) {
    const hmacHex = await this.hmacSha256(serverSeed, `${clientSeed}:${nonce}`);
    
    // Take first 52 bits (13 hex characters) of entropy per NotebookLM Section 2.2
    const subHex = hmacHex.substring(0, 13);
    const h = parseInt(subHex, 16);
    const e = Math.pow(2, 52); // 4503599627370496

    // Modulus Bust Gate: 1 in 33 chance of instant crash at 1.00x (3.0% House Edge, 97.0% RTP)
    if (h % 33 === 0) {
      return 1.00;
    }

    // Continuous curve multiplier calculation: floor((100*e - h)/(e - h)) / 100
    const multiplier = Math.floor((100 * e - h) / (e - h)) / 100;
    return Math.max(1.00, multiplier);
  }

  /**
   * Generate next round parameters and return the pre-hashed server seed
   */
  async prepareNextRound() {
    this.nonce += 1;
    // The current server seed for this round
    const serverSeed = this.generateRandomHex(64);
    const serverHash = await this.sha256(serverSeed);

    this.currentServerSeed = serverSeed;
    this.currentServerHash = serverHash;

    // Calculate crash point in advance
    const crashMultiplier = await this.calculateCrashMultiplier(
      serverSeed,
      this.clientSeed,
      this.nonce
    );

    return {
      nonce: this.nonce,
      clientSeed: this.clientSeed,
      serverHash: serverHash,
      serverSeed: serverSeed, // Revealed after round ends
      crashMultiplier: crashMultiplier
    };
  }

  setClientSeed(newSeed) {
    if (newSeed && newSeed.trim().length > 0) {
      this.clientSeed = newSeed.trim();
    }
  }
}
