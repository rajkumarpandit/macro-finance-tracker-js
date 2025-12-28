import { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import adminConfig from '../config/adminConfig.json';

// Helper function to check if a user is an admin - async version
export const isAdminAsync = async (user) => {
  if (!user || !user.email) {
    return false;
  }
  
  const userEmail = user.email.toLowerCase();
  
  // First check config file (for super admins who always have access)
  const isInConfig = adminConfig.adminUsers.some(adminEmail => 
    adminEmail.toLowerCase() === userEmail
  );
  
  if (isInConfig) {
    return true;
  }
  
  // Then check Firestore admin_users collection (for regular admins)
  try {
    const adminRef = doc(db, 'admin_users', userEmail);
    const adminDoc = await getDoc(adminRef);
    return adminDoc.exists();
  } catch (error) {
    console.error("Error checking admin status in Firestore:", error);
    return false;
  }
};

// Synchronous version for immediate checks (uses config file)
export const isAdmin = (user) => {
  if (!user || !user.email) {
    return false;
  }
  
  // Convert email to lowercase for case-insensitive comparison
  const userEmail = user.email.toLowerCase();
  
  // Check if the email is in the adminUsers list
  return adminConfig.adminUsers.some(adminEmail => 
    adminEmail.toLowerCase() === userEmail
  );
};

// Custom React hook to check admin status
export const useIsAdmin = (currentUser) => {
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (currentUser) {
        // First check config file synchronously (includes super admin)
        const configCheck = isAdmin(currentUser);
        setIsAdminUser(configCheck);
        
        try {
          // Then verify with Firestore
          const adminStatus = await isAdminAsync(currentUser);
          setIsAdminUser(adminStatus);
        } catch (error) {
          console.error("Error in useIsAdmin hook:", error);
          // Keep the config check result if Firestore fails
          setIsAdminUser(configCheck);
        }
      } else {
        setIsAdminUser(false);
      }
      setLoading(false);
    };
    
    checkAdminStatus();
  }, [currentUser]);
  
  return { isAdmin: isAdminUser, loading };
};

// Function to add a new admin
export const addAdmin = async (email) => {
  if (!email) return false;
  
  try {
    const normalizedEmail = email.toLowerCase();
    await setDoc(doc(db, 'admin_users', normalizedEmail), {
      email: normalizedEmail,
      createdAt: new Date()
    });
    return true;
  } catch (error) {
    console.error("Error adding admin:", error);
    return false;
  }
};

// Function to remove an admin
export const removeAdmin = async (email) => {
  if (!email) return false;
  
  try {
    const normalizedEmail = email.toLowerCase();
    await deleteDoc(doc(db, 'admin_users', normalizedEmail));
    return true;
  } catch (error) {
    console.error("Error removing admin:", error);
    return false;
  }
};

// Function to get all admins
export const getAllAdmins = async () => {
  try {
    const adminsCollection = collection(db, 'admin_users');
    const adminsSnapshot = await getDocs(adminsCollection);
    
    return adminsSnapshot.docs.map(doc => doc.data().email);
  } catch (error) {
    console.error("Error getting all admins:", error);
    // Fall back to config file if Firestore query fails
    return adminConfig.adminUsers;
  }
};