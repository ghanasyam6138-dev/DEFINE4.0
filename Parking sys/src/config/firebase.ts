import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBUxEm7zKDaHUakycPwi2wc9X4xQ7yjqYw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'parksmart-demo-234.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://parksmart-demo-234-default-rtdb.asia-southeast1.firebasedatabase.app/',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'parksmart-demo-234',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'parksmart-demo-234.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '796288622868',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:796288622868:web:c9c75be4fd92742a6ae201'
};

let app: FirebaseApp;
let database: Database | null = null;
let storage: FirebaseStorage | null = null;
let isConfigured = false;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  database = getDatabase(app);
  try {
    storage = getStorage(app);
  } catch (err) {
    console.warn('Firebase Storage initialization skipped:', err);
  }
  isConfigured = true;
} catch (error) {
  console.warn('Firebase initialization notice: Running with local resilient storage adapter.', error);
}

export { app, database, storage, isConfigured };
