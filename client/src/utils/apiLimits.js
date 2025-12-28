import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { DEFAULT_GEMINI_API_LIMIT, DEFAULT_MAX_NEW_USERS_PER_DAY } from '../config/constants';

/**
 * Get API limits from Firestore
 * @returns {Promise<{geminiApiLimitPerUser: number, maxNewUsersPerDay: number}>}
 */
export async function getApiLimits() {
  try {
    const limitsDoc = await getDoc(doc(db, 'app_settings', 'api_limits'));
    
    if (limitsDoc.exists()) {
      const data = limitsDoc.data();
      return {
        geminiApiLimitPerUser: data.geminiApiLimitPerUser || DEFAULT_GEMINI_API_LIMIT,
        maxNewUsersPerDay: data.maxNewUsersPerDay || DEFAULT_MAX_NEW_USERS_PER_DAY
      };
    }
    
    // Return defaults if document doesn't exist
    return {
      geminiApiLimitPerUser: DEFAULT_GEMINI_API_LIMIT,
      maxNewUsersPerDay: DEFAULT_MAX_NEW_USERS_PER_DAY
    };
  } catch (error) {
    console.error('Error fetching API limits:', error);
    // Return defaults on error
    return {
      geminiApiLimitPerUser: DEFAULT_GEMINI_API_LIMIT,
      maxNewUsersPerDay: DEFAULT_MAX_NEW_USERS_PER_DAY
    };
  }
}

/**
 * Check if user has reached their Gemini API call limit
 * @param {string} userId - User ID
 * @returns {Promise<{allowed: boolean, currentCount: number, limit: number, message: string}>}
 */
export async function checkGeminiApiLimit(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // Get the configured limit
    const limits = await getApiLimits();
    const limit = limits.geminiApiLimitPerUser;

    // Get current usage for today
    const today = new Date().toISOString().split('T')[0];
    const usageDocRef = doc(db, 'user_api_usage', `${userId}_${today}`);
    const usageDoc = await getDoc(usageDocRef);

    let currentCount = 0;
    if (usageDoc.exists()) {
      currentCount = usageDoc.data().geminiApiCalls || 0;
    }

    if (currentCount >= limit) {
      return {
        allowed: false,
        currentCount,
        limit,
        message: `You've reached your daily limit of ${limit} AI API calls. Please use the dropdown to select food items from your saved database, or save new items for faster future access.`
      };
    }

    return {
      allowed: true,
      currentCount,
      limit,
      message: `${currentCount}/${limit} AI API calls used today`
    };
  } catch (error) {
    console.error('Error checking Gemini API limit:', error);
    // Allow on error to avoid blocking users
    return {
      allowed: true,
      currentCount: 0,
      limit: DEFAULT_GEMINI_API_LIMIT,
      message: 'Unable to check API limit'
    };
  }
}

/**
 * Increment user's Gemini API call count
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function incrementGeminiApiCount(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const today = new Date().toISOString().split('T')[0];
    const usageDocRef = doc(db, 'user_api_usage', `${userId}_${today}`);
    const usageDoc = await getDoc(usageDocRef);

    if (usageDoc.exists()) {
      // Increment existing count
      await updateDoc(usageDocRef, {
        geminiApiCalls: increment(1),
        lastUpdated: new Date().toISOString()
      });
    } else {
      // Create new document
      await setDoc(usageDocRef, {
        userId,
        date: today,
        geminiApiCalls: 1,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error incrementing Gemini API count:', error);
    // Don't throw - we don't want to block the user if tracking fails
  }
}

/**
 * Check if daily signup limit has been reached by querying actual user accounts created today
 * @returns {Promise<{allowed: boolean, currentCount: number, limit: number, message: string}>}
 */
export async function checkDailySignupLimit() {
  try {
    // Get the configured limit
    const limits = await getApiLimits();
    const limit = limits.maxNewUsersPerDay;

    // Get start of today as ISO string (since createdAt is stored as ISO string, not Timestamp)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfTodayISO = today.toISOString();

    // Query users collection for accounts created today
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('createdAt', '>=', startOfTodayISO)
    );
    
    const querySnapshot = await getDocs(q);
    const currentCount = querySnapshot.size;

    console.log(`Signup limit check: ${currentCount} users created today (limit: ${limit})`);

    // Check if limit is reached
    if (currentCount >= limit) {
      return {
        allowed: false,
        currentCount,
        limit,
        message: `We've reached our maximum capacity for new registrations today (${limit} users). Please try again tomorrow. We appreciate your patience!`
      };
    }

    return {
      allowed: true,
      currentCount,
      limit,
      message: 'Registration available'
    };
  } catch (error) {
    console.error('Error checking signup limit:', error);
    // Allow on error to avoid blocking legitimate users
    return {
      allowed: true,
      currentCount: 0,
      limit: 100,
      message: 'Unable to check signup limit'
    };
  }
}



/**
 * Increment daily signup count after successful registration
 * @returns {Promise<void>}
 */
export async function incrementDailySignupCount() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const signupDocRef = doc(db, 'app_settings', `daily_signups_${today}`);
    const signupDoc = await getDoc(signupDocRef);

    if (signupDoc.exists()) {
      await updateDoc(signupDocRef, {
        count: increment(1),
        lastUpdated: new Date().toISOString()
      });
    } else {
      await setDoc(signupDocRef, {
        date: today,
        count: 1,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error incrementing daily signup count:', error);
  }
}
