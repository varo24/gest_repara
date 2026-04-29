import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

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
