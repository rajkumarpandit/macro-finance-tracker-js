// Firebase project configuration test
// Save this as verifyFirebase.js in the client/src directory

import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDv6SMyi6odYTRYN7SYJ5lYsk2mIpEyr4Q",
  authDomain: "macro-tracker-and-planner.firebaseapp.com",
  projectId: "macro-tracker-and-planner",
  storageBucket: "macro-tracker-and-planner.appspot.com",
  messagingSenderId: "639766321681",
  appId: "1:639766321681:web:3390eb8e094be440b2efb0",
  measurementId: "G-6R9NSS475H"
};

// Test Firebase initialization
console.log("Starting Firebase verification test...");
console.log("Firebase Config:", JSON.stringify(firebaseConfig, null, 2));

try {
  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  console.log("Firebase app initialized successfully");
  
  // Get Auth instance
  const auth = getAuth(app);
  console.log("Firebase Auth instance created:", auth ? "Success" : "Failed");
  
  // Check if we're in development mode, use emulator if needed
  if (process.env.NODE_ENV === 'development') {
    console.log("Development mode detected, checking for Auth emulator");
    // Uncomment below if you want to use the Auth emulator
    // connectAuthEmulator(auth, "http://localhost:9099");
  }

  // Export for potential use elsewhere
  export { app, auth };

  // This is just for the test script, normally won't be executed
  console.log("Firebase verification successful!");
} catch (error) {
  console.error("Firebase initialization failed:", error);
}