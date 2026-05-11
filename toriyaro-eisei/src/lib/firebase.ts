import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyD1xffqVr8Eir6IxJKF2PkgdCfYL2VUcQ8',
  authDomain: 'toriyaro-eisei-v2.firebaseapp.com',
  databaseURL:
    'https://toriyaro-eisei-v2-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'toriyaro-eisei-v2',
  storageBucket: 'toriyaro-eisei-v2.firebasestorage.app',
  messagingSenderId: '135163583805',
  appId: '1:135163583805:web:05d3bb3d553aeea452b954',
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);
