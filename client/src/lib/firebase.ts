import { initializeApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDYSg1a4HoiK0fPHVuBmogKj43I2DQyQA8",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "zaply-d9945.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "zaply-d9945",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "zaply-d9945.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "295217540901",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:295217540901:web:5e267ebc9b8abc54c774cc",
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  } catch (e) {
    console.warn('Firebase init error:', e);
  }
}

export { auth };

let recaptchaVerifierInstance: RecaptchaVerifier | null = null;

export const initRecaptcha = (containerId = 'recaptcha-container'): RecaptchaVerifier | null => {
  if (!isFirebaseConfigured || !auth) return null;
  try {
    if (recaptchaVerifierInstance) {
      try { recaptchaVerifierInstance.clear(); } catch { /* ignore */ }
      recaptchaVerifierInstance = null;
    }
    recaptchaVerifierInstance = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved
      },
    });
    return recaptchaVerifierInstance;
  } catch (err) {
    console.warn('RecaptchaVerifier init error:', err);
    return null;
  }
};

export const sendFirebasePhoneOTP = async (
  phoneNumber: string,
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> => {
  if (!auth) throw new Error('Firebase Auth not initialized');
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
};
