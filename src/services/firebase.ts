
import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAe8ilE_uPNiBnyMPuk2709Q6Jm5kalwik",
  authDomain: "reparaciones-taller-e3eaa.firebaseapp.com",
  projectId: "reparaciones-taller-e3eaa",
  storageBucket: "reparaciones-taller-e3eaa.firebasestorage.app",
  messagingSenderId: "788991166706",
  appId: "1:788991166706:web:ed5ed3536ae56167b9686b",
  measurementId: "G-QY2DXEKR9J"
};

let db: any = null;
let auth: any = null;

const initialize = () => {
  try {
    const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    
    // Initialize Firestore with specific multi-tab cache settings
    // This is the recommended way to handle "Local Server" behavior in the browser
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log("Firestore initialized with persistent cache.");
    } catch (err: any) {
      // If Firestore is already initialized (common during dev/hot-reloads), 
      // or if initializeFirestore fails, fallback to getFirestore
      console.warn("Using existing Firestore instance or fallback.");
      db = getFirestore(app);
    }
    
    auth = getAuth(app);
    console.log("ReparaPro Multi-Terminal Sincronizado.");
  } catch (e) {
    console.error("Error crítico en la inicialización de Firebase:", e);
    // Attempt one last recovery if possible
    if (getApps().length > 0) {
      try {
        db = getFirestore(getApp());
        auth = getAuth(getApp());
      } catch (recoveryErr) {
        console.error("Recovery failed:", recoveryErr);
      }
    }
  }
};

initialize();

export const isCloudEnabled = () => db !== null;
export const checkCloudHealth = async () => db !== null;

export { db, auth };
