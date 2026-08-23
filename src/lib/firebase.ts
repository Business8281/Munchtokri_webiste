import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, signOut, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: "AIzaSyDKctDmrf-dlQPL0uubS3RPdugR7FOVfms",
    authDomain: "munch-tokri.firebaseapp.com",
    databaseURL: "https://munch-tokri-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "munch-tokri",
    storageBucket: "munch-tokri.firebasestorage.app",
    messagingSenderId: "792278763159",
    appId: "1:792278763159:web:dd7795b3e474bae60c0bd2",
    measurementId: "G-Y8XJ4VX60N"
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
