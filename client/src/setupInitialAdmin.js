import { db } from './firebase/firebase';
import { doc, setDoc } from 'firebase/firestore';

// This is a one-time setup script to add the initial admin
const setupInitialAdmin = async () => {
  const adminEmail = 'rajkumarpandit@gmail.com';
  
  try {
    // Add the initial admin to the admin_users collection
    await setDoc(doc(db, 'admin_users', adminEmail), {
      email: adminEmail,
      createdAt: new Date()
    });
    
    console.log(`Successfully added initial admin: ${adminEmail}`);
  } catch (error) {
    console.error("Error setting up initial admin:", error);
  }
};

// Call the function
setupInitialAdmin();