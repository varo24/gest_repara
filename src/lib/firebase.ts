import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyBrrv6HYM-0MVxHOaoWbeJMFmQL54l3I3A",
  authDomain: "gestion-reparaciones-45878.firebaseapp.com",
  projectId: "gestion-reparaciones-45878",
  storageBucket: "gestion-reparaciones-45878.firebasestorage.app",
  messagingSenderId: "256056223617",
  appId: "1:256056223617:web:ed79c8d7b0e560cacdea80"
}

export const firebaseApp = initializeApp(firebaseConfig, 'gestrepara-main')
export const db = getFirestore(firebaseApp, 'gestrepara')
export const fbStorage = getStorage(firebaseApp)
export const fbAuth = getAuth(firebaseApp)

// Ensure the client always has a valid Firebase identity before reading/writing.
// Anonymous Auth is free on Spark plan and lets Firestore rules use
// `request.auth != null` instead of `allow read, write: if true`.
export const authReady: Promise<void> = new Promise(resolve => {
  onAuthStateChanged(fbAuth, user => {
    if (user) {
      resolve();
    } else {
      signInAnonymously(fbAuth).then(() => resolve()).catch(() => resolve());
    }
  });
});
