import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, signOut, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'asia-south1');
const googleProvider = new GoogleAuthProvider();

// Initialize Analytics (Safe for SSR)
let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Initialize Admin Firebase (Secondary instance for parallel sessions)
const adminApp = getApps().length <= 1 ? initializeApp(firebaseConfig, "MT-Admin-App") : getApps().find(a => a.name === "MT-Admin-App") || initializeApp(firebaseConfig, "MT-Admin-App");
const adminAuth = getAuth(adminApp);
const adminDb = getFirestore(adminApp);
const adminStorage = getStorage(adminApp);
const adminFunctions = getFunctions(adminApp, "asia-south1");

export const logOut = async () => {
    try {
        await signOut(auth);
        window.location.href = "/";
    } catch (error) {
        console.error("Error signing out user:", error);
    }
};

export const adminLogOut = async () => {
    try {
        await signOut(adminAuth);
        window.location.href = "/admin/login";
    } catch (error) {
        console.error("Error signing out admin:", error);
    }
};

export {
    auth, db, rtdb, storage, functions, googleProvider, analytics,
    adminApp, adminAuth, adminDb, adminStorage, adminFunctions
};
