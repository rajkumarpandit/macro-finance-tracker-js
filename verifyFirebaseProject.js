// Node.js script to verify Firebase project configuration
// Save this file as verifyFirebaseProject.js in the project root
// Run with: node verifyFirebaseProject.js

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Firebase configuration - same as in your app
const firebaseConfig = {
  apiKey: "AIzaSyDv6SMyi6odYTRYN7SYJ5lYsk2mIpEyr4Q",
  authDomain: "macro-tracker-and-planner.firebaseapp.com",
  projectId: "macro-tracker-and-planner",
  storageBucket: "macro-tracker-and-planner.appspot.com",
  messagingSenderId: "639766321681",
  appId: "1:639766321681:web:3390eb8e094be440b2efb0",
  measurementId: "G-6R9NSS475H"
};

async function verifyFirebaseProject() {
  console.log("Starting Firebase project verification");
  console.log("---------------------------------");
  console.log("Project ID:", firebaseConfig.projectId);
  console.log("Auth Domain:", firebaseConfig.authDomain);
  console.log("---------------------------------");
  
  try {
    // 1. Initialize Firebase
    console.log("1. Initializing Firebase app...");
    const app = initializeApp(firebaseConfig);
    console.log("✓ Firebase app initialized successfully");
    
    // 2. Verify Auth service
    console.log("\n2. Verifying Auth service...");
    const auth = getAuth(app);
    console.log("✓ Auth service initialized:", auth ? "Success" : "Failed");
    
    // 3. Check if Email/Password provider is enabled (without actually creating a user)
    console.log("\n3. Checking if Email/Password provider is enabled...");
    console.log("   (Will show auth/user-not-found if configured correctly)");
    try {
      // This will fail with "auth/user-not-found" if auth is working, or with 
      // "auth/configuration-not-found" if there's a project configuration issue
      await signInWithEmailAndPassword(auth, "test@example.com", "password123");
      console.log("✓ Unexpected success. This should have failed with auth/user-not-found");
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        console.log("✓ Authentication service is properly configured (got expected auth/user-not-found error)");
      } else if (error.code === "auth/configuration-not-found" || error.code === "auth/project-not-found") {
        console.error("✗ Firebase project configuration not found. Possible issues:");
        console.error("  - Project ID may be incorrect");
        console.error("  - Firebase project may not exist");
        console.error("  - API key may be invalid");
        console.error("  - Email/Password authentication may not be enabled in Firebase Console");
      } else {
        console.log("? Auth check resulted in error:", error.code, error.message);
      }
    }
    
    // 4. Verify Firestore service
    console.log("\n4. Verifying Firestore service...");
    try {
      const db = getFirestore(app);
      console.log("✓ Firestore service initialized");
      
      // Attempt to list collections (will succeed or fail based on rules)
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        console.log("✓ Firestore read operation succeeded, found", usersSnapshot.size, "users");
      } catch (firestoreError) {
        if (firestoreError.code === 'permission-denied') {
          console.log("✓ Firestore is working, but read permissions denied (expected with security rules)");
        } else {
          console.warn("? Firestore read operation failed:", firestoreError.code, firestoreError.message);
        }
      }
    } catch (firestoreError) {
      console.error("✗ Firestore service failed to initialize:", firestoreError);
    }
    
    console.log("\n---------------------------------");
    console.log("Verification complete");
    
  } catch (error) {
    console.error("Firebase verification failed:", error);
    console.error("Full error details:", error);
  }
}

verifyFirebaseProject();