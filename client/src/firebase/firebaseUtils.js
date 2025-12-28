import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Cache for storing query results
const queryCache = new Map();

// Function to get cache key from query parameters
const getCacheKey = (collectionName, fieldPath, opStr, value) => {
  return `${collectionName}:${fieldPath}:${opStr}:${value}`;
};

// Function to get data with caching
export const getDataWithCache = async (collectionName, fieldPath, opStr, value, maxCacheAge = 60000) => {
  const cacheKey = getCacheKey(collectionName, fieldPath, opStr, value);
  
  // Check if we have cached data and it's not expired
  const cachedData = queryCache.get(cacheKey);
  if (cachedData && (Date.now() - cachedData.timestamp < maxCacheAge)) {
    return cachedData.data;
  }
  
  // No cache or cache expired, fetch from Firestore
  const q = query(
    collection(db, collectionName),
    where(fieldPath, opStr, value)
  );
  
  const querySnapshot = await getDocs(q);
  const data = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Store in cache
  queryCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  return data;
};

// Get all docs from a collection with caching
export const getCollectionWithCache = async (collectionName, maxCacheAge = 60000) => {
  const cacheKey = `collection:${collectionName}`;
  
  // Check if we have cached data and it's not expired
  const cachedData = queryCache.get(cacheKey);
  if (cachedData && (Date.now() - cachedData.timestamp < maxCacheAge)) {
    return cachedData.data;
  }
  
  // No cache or cache expired, fetch from Firestore
  const querySnapshot = await getDocs(collection(db, collectionName));
  const data = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Store in cache
  queryCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
  
  return data;
};

// Clear all cache
export const clearCache = () => {
  queryCache.clear();
};

// Clear specific cache entry
export const clearCacheEntry = (collectionName, fieldPath = null, opStr = null, value = null) => {
  if (fieldPath && opStr && value) {
    const cacheKey = getCacheKey(collectionName, fieldPath, opStr, value);
    queryCache.delete(cacheKey);
  } else {
    const cacheKey = `collection:${collectionName}`;
    queryCache.delete(cacheKey);
  }
};