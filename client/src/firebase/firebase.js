// Import Firebase modules
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAi0twMu3lz7ArV7vi8PPHn9vxJk7J_FXY",
  authDomain: "the-macro-finance-tracker.firebaseapp.com",
  projectId: "the-macro-finance-tracker",
  storageBucket: "the-macro-finance-tracker.firebasestorage.app",
  messagingSenderId: "1007759632472",
  appId: "1:1007759632472:web:dddcd37aacd86bd743822d",
  measurementId: "G-Y5F64BQMQH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
