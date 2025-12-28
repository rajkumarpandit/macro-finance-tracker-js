import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  updateProfile,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  sendPasswordResetEmail,
  deleteUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Signup function with name and password
  async function signup(email, password, displayName) {
    if (!auth) {
      console.error("Firebase Auth is not initialized");
      throw new Error("Authentication service is unavailable. Please try again later.");
    }

    // Set local persistence to keep the user logged in
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (persistenceError) {
      console.warn("Failed to set auth persistence:", persistenceError);
      // Continue anyway - this is not critical
    }
    
    try {
      console.log("Starting signup process for email:", email);
      
      // Make sure we have a valid password
      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      
      console.log("Attempting to create user with Firebase Auth");
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User created successfully:", userCredential.user.uid);
      const user = userCredential.user;

      // Set display name in Firebase Auth profile
      console.log("Setting display name in Firebase Auth:", displayName);
      await updateProfile(user, { displayName });

      if (db) {
        // Store user details in Firestore (NO password stored here)
        console.log("Storing user details in Firestore");
        await setDoc(doc(db, 'users', user.uid), {
          displayName,
          email,
          socialLoginEnabled: false, // Default: signed up with email/password
          linkedProviders: ['password'], // Track which providers are linked
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          isEnabled: true // Account enabled by default
        });
        console.log("User data stored in Firestore successfully");
        
        // Update local user details state
        setUserDetails({
          displayName,
          email,
          socialLoginEnabled: false,
          linkedProviders: ['password']
        });
      } else {
        console.warn("Firestore not available, user profile data not saved");
        
        // Still update the local state
        setUserDetails({
          displayName,
          email,
          socialLoginEnabled: false,
          linkedProviders: ['password']
        });
      }
      
      console.log("User registration complete");
      return user;
    } catch (error) {
      console.error("Signup error:", error.code, error.message);
      
      // Specific error handling
      if (error.code === "auth/email-already-in-use") {
        throw new Error("This email is already registered. Please use a different email or login.");
      } else if (error.code === "auth/invalid-email") {
        throw new Error("Please enter a valid email address.");
      } else if (error.code === "auth/weak-password") {
        throw new Error("Your password is too weak. Please use a stronger password.");
      } else if (error.code === "auth/operation-not-allowed") {
        throw new Error("Email/Password sign-up is not enabled in Firebase Console.");
      } else if (error.code === "auth/network-request-failed") {
        throw new Error("Network error. Please check your internet connection.");
      } else if (error.code === "auth/configuration-not-found" || error.code === "auth/project-not-found") {
        // This is our specific error case
        console.error("Firebase project configuration error:", error);
        throw new Error("Firebase project configuration not found. Check the Firebase Console settings.");
      } else {
        throw error;
      }
    }
  }

  // Login function with email and password
  async function login(email, password) {
    if (!auth) {
      console.error("Firebase Auth is not initialized");
      throw new Error("Authentication service is unavailable. Please try again later.");
    }
    
    // Set local persistence to keep the user logged in
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch (persistenceError) {
      console.warn("Failed to set auth persistence:", persistenceError);
      // Continue anyway - this is not critical
    }
    
    try {
      console.log("Attempting login for email:", email);
      
      // Sign in with email and password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("User signed in successfully:", user.uid);
      
      if (db) {
        // Get the user document to load user details
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Check if user account is disabled
          if (userData.isEnabled === false) {
            // Sign out the user immediately
            console.warn("Account is disabled, signing out user");
            await signOut(auth);
            throw new Error("This account has been disabled. Please contact an administrator.");
          }
          
          // Update last login timestamp
          try {
            await setDoc(doc(db, 'users', user.uid), {
              lastLogin: new Date().toISOString()
            }, { merge: true });
          } catch (updateError) {
            console.warn("Failed to update last login:", updateError);
          }
          
          // Update user details from Firestore
          setUserDetails({
            displayName: userData.displayName || user.displayName || email.split('@')[0],
            email: userData.email || user.email,
            isEnabled: userData.isEnabled !== false // Default to enabled if not specified
          });
        } else {
          console.warn("User document not found in Firestore, creating basic profile");
          // Create a basic user profile if one doesn't exist
          await setDoc(doc(db, 'users', user.uid), {
            displayName: user.displayName || email.split('@')[0],
            email: user.email,
            isEnabled: true, // Enabled by default
            createdAt: new Date().toISOString()
          });
          
          // Set user details
          setUserDetails({
            displayName: user.displayName || email.split('@')[0],
            email: user.email,
            isEnabled: true
          });
        }
      } else {
        console.warn("Firestore not available, using basic user profile data");
        // Use basic Auth user info if Firestore is not available
        setUserDetails({
          displayName: user.displayName || email.split('@')[0],
          email: user.email
        });
      }
      
      return user;
    } catch (error) {
      console.error("Login error:", error.code, error.message);
      
      // Specific error handling
      if (error.code === "auth/user-not-found") {
        throw new Error("No account found with this email. Please sign up first.");
      } else if (error.code === "auth/wrong-password") {
        throw new Error("Incorrect password. Please try again.");
      } else if (error.code === "auth/invalid-email") {
        throw new Error("Please enter a valid email address.");
      } else if (error.code === "auth/user-disabled") {
        throw new Error("This account has been disabled. Please contact support.");
      } else if (error.code === "auth/network-request-failed") {
        throw new Error("Network error. Please check your internet connection.");
      } else if (error.code === "auth/configuration-not-found" || error.code === "auth/project-not-found") {
        console.error("Firebase project configuration error:", error);
        throw new Error("Firebase project configuration not found. Check the Firebase Console settings.");
      } else {
        throw error;
      }
    }
  }

  // Google Social Login
  async function loginWithGoogle() {
    if (!auth) {
      throw new Error("Authentication service is unavailable.");
    }

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user document exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // New user - create user document
        await setDoc(doc(db, 'users', user.uid), {
          displayName: user.displayName || user.email.split('@')[0],
          email: user.email,
          photoURL: user.photoURL || null,
          socialLoginEnabled: true,
          linkedProviders: user.providerData.map(p => p.providerId),
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          isEnabled: true
        });
        
        setUserDetails({
          displayName: user.displayName || user.email.split('@')[0],
          email: user.email,
          photoURL: user.photoURL,
          socialLoginEnabled: true,
          linkedProviders: user.providerData.map(p => p.providerId)
        });
      } else {
        // Existing user - update linkedProviders to reflect current state
        const userData = userDoc.data();
        const currentProviders = user.providerData.map(p => p.providerId);
        
        // Update last login and providers
        await setDoc(doc(db, 'users', user.uid), {
          linkedProviders: currentProviders,
          socialLoginEnabled: true,
          photoURL: user.photoURL || userData.photoURL,
          lastLogin: new Date().toISOString()
        }, { merge: true });
        
        // Check if account is disabled
        if (userData.isEnabled === false) {
          await signOut(auth);
          throw new Error("This account has been disabled. Please contact an administrator.");
        }
        
        setUserDetails({
          displayName: userData.displayName || user.displayName,
          email: userData.email || user.email,
          photoURL: user.photoURL,
          socialLoginEnabled: true,
          linkedProviders: currentProviders
        });
      }
      
      return user;
    } catch (error) {
      console.error("Google login error:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed. Please try again.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        throw new Error('Sign-in cancelled. Please try again.');
      } else {
        throw error;
      }
    }
  }

  // Link Google Account to existing user
  async function linkGoogleAccount() {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('Please login first');
    }
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await linkWithPopup(user, provider);
      
      // Update Firestore to reflect linked account
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const linkedProviders = userData.linkedProviders || ['password'];
        
        if (!linkedProviders.includes('google.com')) {
          linkedProviders.push('google.com');
          
          await setDoc(doc(db, 'users', user.uid), {
            ...userData,
            socialLoginEnabled: true,
            linkedProviders: linkedProviders,
            photoURL: result.user.photoURL || userData.photoURL
          }, { merge: true });
        }
      }
      
      return result.user;
    } catch (error) {
      console.error('Link account error:', error);
      
      if (error.code === 'auth/credential-already-in-use') {
        throw new Error('This Google account is already linked to another account.');
      } else if (error.code === 'auth/provider-already-linked') {
        throw new Error('Google account is already linked.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in popup was closed. Please try again.');
      } else {
        throw error;
      }
    }
  }

  // Password Reset
  async function resetPassword(email) {
    if (!auth) {
      throw new Error("Authentication service is unavailable.");
    }
    
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Password reset error:", error);
      throw error;
    }
  }

  // Delete Account - removes user from Firebase Auth, Firestore, and all user data
  async function deleteAccount() {
    const user = auth.currentUser;
    
    if (!user) {
      throw new Error('No user is currently logged in');
    }
    
    try {
      const userId = user.uid;
      console.log('Starting account deletion for user:', userId);
      
      // Delete all user data from Firestore collections
      if (db) {
        const batch = writeBatch(db);
        let batchCount = 0;
        
        // Collections to clean up
        const collectionsToDelete = [
          'daily_food_log',
          'weights',
          'calories_burnt_log',
          'macro_targets',
          'food_calorie_master',
          'user_goals'
        ];
        
        // Delete documents from each collection
        for (const collectionName of collectionsToDelete) {
          try {
            const q = query(collection(db, collectionName), where('userId', '==', userId));
            const querySnapshot = await getDocs(q);
            
            console.log(`Found ${querySnapshot.size} documents in ${collectionName}`);
            
            querySnapshot.forEach((docSnapshot) => {
              batch.delete(docSnapshot.ref);
              batchCount++;
              
              // Firestore has a limit of 500 operations per batch
              // If we hit that, we should commit and start a new batch
              // For now, we'll assume < 500 docs per user
            });
          } catch (error) {
            console.error(`Error deleting from ${collectionName}:`, error);
            // Continue with other collections even if one fails
          }
        }
        
        // Delete user document
        batch.delete(doc(db, 'users', userId));
        batchCount++;
        
        // Commit all deletions
        if (batchCount > 0) {
          await batch.commit();
          console.log(`Successfully deleted ${batchCount} documents from Firestore`);
        }
      }
      
      // Finally, delete the user from Firebase Authentication
      await deleteUser(user);
      console.log('User deleted from Firebase Authentication');
      
      // Clear local state
      setCurrentUser(null);
      setUserDetails(null);
      
    } catch (error) {
      console.error('Delete account error:', error);
      
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('For security, please log out and log back in before deleting your account.');
      } else {
        throw error;
      }
    }
  }

  function logout() {
    setUserDetails(null);
    return signOut(auth);
  }

  // Listen for auth state changes
  useEffect(() => {
    if (!auth) {
      console.error("Firebase Auth is not initialized in useEffect");
      setLoading(false);
      return () => {};
    }
    
    console.log("Setting up Firebase auth state listener");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user ? `User: ${user.uid}` : "No user");
      setCurrentUser(user);
      
      if (user) {
        // Load user details from Firestore
        if (db) {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUserDetails({
                displayName: userData.displayName || user.displayName || "User",
                email: userData.email || user.email
              });
            } else {
              // Create a basic user profile if one doesn't exist
              const defaultDisplayName = user.displayName || "User";
              await setDoc(doc(db, 'users', user.uid), {
                displayName: defaultDisplayName,
                email: user.email,
                createdAt: new Date().toISOString()
              });
              
              setUserDetails({
                displayName: defaultDisplayName,
                email: user.email
              });
            }
          } catch (error) {
            console.error("Error loading user details:", error);
          }
        } else {
          // Firestore not available, use data from Auth
          setUserDetails({
            displayName: user.displayName || "User",
            email: user.email
          });
        }
      } else {
        setUserDetails(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userDetails,
    signup,
    login,
    loginWithGoogle,
    linkGoogleAccount,
    resetPassword,
    deleteAccount,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}