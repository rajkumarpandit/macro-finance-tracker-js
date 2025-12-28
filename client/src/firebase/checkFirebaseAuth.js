// This script checks if Firebase Email/Password authentication is enabled
// Run it with: node checkFirebaseAuth.js

const { initializeApp } = require("firebase/app");
const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } = require("firebase/auth");

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDv6SMyi6odYTRYN7SYJ5lYsk2mIpEyr4Q",
  authDomain: "macro-tracker-and-planner.firebaseapp.com",
  projectId: "macro-tracker-and-planner",
  storageBucket: "macro-tracker-and-planner.appspot.com", 
  messagingSenderId: "639766321681",
  appId: "1:639766321681:web:3390eb8e094be440b2efb0",
  measurementId: "G-6R9NSS475H"
};

async function checkFirebaseAuth() {
  console.log("Checking Firebase Authentication configuration...");
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    console.log("Firebase app initialized successfully");
    
    // Get Auth instance
    const auth = getAuth(app);
    console.log("Firebase auth retrieved:", auth ? "Success" : "Failed");
    
    // Check if Email/Password provider is enabled by attempting to create a test user
    // This will fail if the provider is not enabled, but the error message will be different
    try {
      // Use a random email to avoid conflicts
      const testEmail = `test_${Math.random().toString(36).substring(2, 15)}@example.com`;
      const testPassword = "testPassword123";
      
      console.log(`Attempting to create test user with email ${testEmail}`);
      const userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
      console.log("Test user created successfully, Email/Password auth is enabled");
      
      // Clean up by deleting the test user
      if (userCredential.user) {
        await userCredential.user.delete();
        console.log("Test user deleted");
      }
      
    } catch (error) {
      console.error("Error creating test user:", error.code, error.message);
      
      if (error.code === "auth/operation-not-allowed") {
        console.error("Email/Password authentication is not enabled in the Firebase Console.");
        console.error("Please enable it in: Firebase Console > Authentication > Sign-in method > Email/Password");
      } else if (error.code === "auth/configuration-not-found") {
        console.error("Firebase project configuration not found. Check your Firebase project ID and config.");
      } else {
        console.error("Other error occurred:", error);
      }
    }
  } catch (error) {
    console.error("Failed to initialize Firebase:", error);
  }
}

// Run the check
checkFirebaseAuth();