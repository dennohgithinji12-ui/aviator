'use client';

import { getApp, getApps, initializeApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';

export async function getFirebaseClientAuth() {
  const response = await fetch('/api/config/firebase', { cache: 'no-store' });
  const config = await response.json();
  if (!response.ok || !config.isConfigured) {
    throw new Error('Phone verification is not configured yet. Please contact support.');
  }

  const options = {
    apiKey: config.apiKey as string,
    authDomain: config.authDomain as string,
    projectId: config.projectId as string,
    ...(config.storageBucket ? { storageBucket: config.storageBucket as string } : {}),
    messagingSenderId: config.messagingSenderId as string,
    appId: config.appId as string,
    ...(config.measurementId ? { measurementId: config.measurementId as string } : {})
  };
  const appName = 'shiftstack-web-auth';
  const app = getApps().some((item) => item.name === appName)
    ? getApp(appName)
    : initializeApp(options, appName);
  return getAuth(app);
}
