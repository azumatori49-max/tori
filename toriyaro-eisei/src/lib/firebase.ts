import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDsRagWJDajT9yL864k_44TGo4YaxW7xzk",
  authDomain: "staff-award.firebaseapp.com",
  databaseURL:
    "https://staff-award-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "staff-award",
  storageBucket: "staff-award.firebasestorage.app",
  messagingSenderId: "758757705763",
  appId: "1:758757705763:web:5517fb9c0594949dd44996",
  measurementId: "G-0YQD2DZG6K",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
