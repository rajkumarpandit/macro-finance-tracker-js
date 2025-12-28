import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

// Utility function to delete all data without a user ID
export const cleanupLegacyData = async () => {
  try {
    console.log('Starting legacy data cleanup');
    
    // 1. Clean daily_food_log collection
    const foodLogSnapshot = await getDocs(collection(db, 'daily_food_log'));
    let deletedLogs = 0;
    
    for (const docSnapshot of foodLogSnapshot.docs) {
      const data = docSnapshot.data();
      if (!data.userId) {
        await deleteDoc(doc(db, 'daily_food_log', docSnapshot.id));
        deletedLogs++;
      }
    }
    
    // 2. Update food_calorie_master items with default values if they don't have userId
    const foodMasterSnapshot = await getDocs(collection(db, 'food_calorie_master'));
    let updatedFoodItems = 0;
    
    for (const docSnapshot of foodMasterSnapshot.docs) {
      const data = docSnapshot.data();
      if (!data.userId) {
        // Since food master items should be available to all users,
        // we'll keep them and mark them as public system data
        await updateDoc(doc(db, 'food_calorie_master', docSnapshot.id), {
          isPublic: true,
          isSystemData: true // Flag to indicate this was from the initial data load
        });
        updatedFoodItems++;
      }
    }
    
    console.log(`Data cleanup completed: ${deletedLogs} food logs deleted, ${updatedFoodItems} food master items updated`);
    return {
      deletedLogs,
      updatedFoodItems
    };
  } catch (error) {
    console.error('Error during data cleanup:', error);
    throw error;
  }
};