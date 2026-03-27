import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDlyiIqmHdJ7wyIvEcIU6l_BL0JON7Jy-g",
  authDomain: "lobby-8eb74.firebaseapp.com",
  projectId: "lobby-8eb74",
  storageBucket: "lobby-8eb74.firebasestorage.app",
  messagingSenderId: "645972054284",
  appId: "1:645972054284:web:e4dc7139bd8518c08fb929",
  measurementId: "G-LVFDCK4PZJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
