import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAb88OQsOQupIatDR8TlDPeTACymyPYKRQ",
  authDomain: "toriyaro-eisei-faf2e.firebaseapp.com",
  databaseURL: "https://toriyaro-eisei-faf2e-default-rtdb.firebaseio.com",
  projectId: "toriyaro-eisei-faf2e",
  storageBucket: "toriyaro-eisei-faf2e.firebasestorage.app",
  messagingSenderId: "120041502005",
  appId: "1:120041502005:web:a9000f1dbfcfc4047bc87c",
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
