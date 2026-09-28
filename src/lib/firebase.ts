import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

const app = initializeApp(firebaseConfigured ? config : { apiKey: "missing", projectId: "missing", appId: "missing" });

export const auth = getAuth(app);
export const db = getFirestore(app);

// Firebase email links need the address again when the link is opened.
export const SIGNIN_EMAIL_KEY = "mnq-signin-email";
