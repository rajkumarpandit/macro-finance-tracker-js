import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

/**
 * Custom hook to check if the current user is an admin
 * @returns {boolean} isAdmin status
 */
export const useIsAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const isUserAdmin = await checkIfUserIsAdmin(user.email);
        setIsAdmin(isUserAdmin);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return isAdmin;
};

/**
 * Custom hook that provides both admin status and loading state
 * @returns {Object} { isAdmin, loading }
 */
export const useAdminStatus = () => {
  const [state, setState] = useState({
    isAdmin: false,
    loading: true
  });

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const isUserAdmin = await checkIfUserIsAdmin(user.email);
        setState({
          isAdmin: isUserAdmin,
          loading: false
        });
      } else {
        setState({
          isAdmin: false,
          loading: false
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return state;
};

/**
 * Function to check if a user is an admin
 * @param {string} email - The email address to check
 * @returns {Promise<boolean>} Whether the user is an admin
 */
export const checkIfUserIsAdmin = async (email) => {
  try {
    if (!email) return false;
    
    // First try the direct document approach
    const adminDocRef = doc(db, 'admin_users', email.toLowerCase());
    const adminDoc = await getDoc(adminDocRef);
    
    if (adminDoc.exists()) {
      return true;
    }

    // If not found directly, query by email field as fallback
    const adminQuery = query(
      collection(db, 'admin_users'), 
      where('email', '==', email.toLowerCase())
    );
    
    const querySnapshot = await getDocs(adminQuery);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Function to check if a user can access admin features
 * Used for conditional rendering or access control
 * @param {Object} user - The Firebase user object
 * @returns {Promise<boolean>} Whether the user can access admin features
 */
export const canAccessAdminFeatures = async (user) => {
  if (!user || !user.email) {
    return false;
  }
  
  return await checkIfUserIsAdmin(user.email);
};

/**
 * Function to check admin status from inside a component
 * @param {string} email - The email to check
 * @param {Function} callback - Function to call with result (boolean)
 */
export const checkAdminStatus = (email, callback) => {
  if (!email) {
    callback(false);
    return;
  }
  
  checkIfUserIsAdmin(email)
    .then(isAdmin => callback(isAdmin))
    .catch(() => callback(false));
};