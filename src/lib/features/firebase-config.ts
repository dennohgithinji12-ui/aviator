/**
 * ShiftStack Firebase Spark Plan Configuration & Service Wrapper (TypeScript Version)
 * Optimized for 100% Free Firebase Spark Plan ($0.00 Tier)
 */

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: "AIzaSyBt2tbAjjNpKiciGq5HZs3Bv3a3ebPkyQ4",
  authDomain: "shiftstack-log-in.firebaseapp.com",
  projectId: "shiftstack-log-in",
  storageBucket: "shiftstack-log-in.firebasestorage.app",
  messagingSenderId: "54352624967",
  appId: "1:54352624967:web:247d96b5f0afe002b02062",
  measurementId: "G-XFFZQ513RG"
};

export async function hashPassword(plainText: string, salt: string = 'shiftstack_spark_2026'): Promise<string> {
  if (!plainText) return '';
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(plainText + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let hash = 0;
    const str = plainText + salt;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
}

export async function getActiveFirebaseConfig(): Promise<FirebaseConfig> {
  if (typeof window !== 'undefined' && (window as any).__FIREBASE_CONFIG__ && (window as any).__FIREBASE_CONFIG__.apiKey) {
    return (window as any).__FIREBASE_CONFIG__;
  }
  try {
    const res = await fetch('/api/config/firebase');
    if (res.ok) {
      const serverCfg = await res.json();
      if (serverCfg && serverCfg.isConfigured && serverCfg.apiKey) {
        return serverCfg;
      }
    }
  } catch (e) {
    // Use fallback
  }
  return firebaseConfig;
}

export async function storeUserInDatabase(data: {
  phone: string;
  firebaseUid?: string;
  username?: string;
  passwordHash?: string;
}): Promise<{ success: boolean; user?: any }> {
  try {
    const res = await fetch('/api/auth/phone-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      const responseData = await res.json();
      return responseData;
    }
  } catch (err) {
    console.warn('[DB User Storage Network Notice]:', err instanceof Error ? err.message : 'Unknown error');
  }
  return { success: false };
}

export async function updatePasswordInDatabase(data: {
  phone: string;
  passwordHash: string;
}): Promise<{ success: boolean }> {
  try {
    const res = await fetch('/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[DB Password Update Network Notice]:', err instanceof Error ? err.message : 'Unknown error');
  }
  return { success: false };
}
