import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export function getFirebaseAdminAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase server credentials are not configured');
  }

  const appName = 'shiftstack-auth';
  const existing = getApps().find((app) => app.name === appName);
  const app = existing || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId
  }, appName);
  return getAuth(app);
}
