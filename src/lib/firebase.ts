import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore with named database
// Note: named database is specified in firebase-applet-config.json firestoreDatabaseId: "ai-studio-c3a10e35-4891-482f-bd4d-8ff978e63a3e"
export const db = initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId);

export default app;
