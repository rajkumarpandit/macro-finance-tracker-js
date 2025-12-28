/**
 * Currency Utility Functions
 * Handles currency conversion and formatting
 * Uses exchange rates from Firestore (updated via Currency Manager)
 */

import { db } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';

// Cache for exchange rates to avoid frequent Firestore reads
let cachedRates = null;
let cacheTimestamp = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

// Default fallback rates
const DEFAULT_RATES = {
  INR: 1,
  USD: 84.50,
  EUR: 92.00,
  GBP: 107.00,
  JPY: 0.54,
  AUD: 56.50,
  CAD: 62.00,
  CHF: 95.00,
  CNY: 12.00,
  SGD: 63.00,
  rupees: 1
};

/**
 * Fetch exchange rates from Firestore
 * @returns {Promise<Object>} - Exchange rates object
 */
export const fetchExchangeRates = async () => {
  // Return cached rates if still valid
  if (cachedRates && cacheTimestamp && (Date.now() - cacheTimestamp < CACHE_DURATION)) {
    return cachedRates;
  }

  try {
    const ratesDoc = await getDoc(doc(db, 'exchange_rates', 'current'));
    
    if (ratesDoc.exists()) {
      cachedRates = ratesDoc.data().rates || DEFAULT_RATES;
      cacheTimestamp = Date.now();
      return cachedRates;
    }
  } catch (error) {
    console.warn('Error fetching exchange rates from Firestore, using defaults:', error);
  }
  
  // Fallback to default rates
  cachedRates = DEFAULT_RATES;
  cacheTimestamp = Date.now();
  return cachedRates;
};

/**
 * Get exchange rate synchronously from cache
 * @param {string} currency - Currency code
 * @returns {number} - Exchange rate
 */
const getExchangeRateSync = (currency) => {
  const normalizedCurrency = (currency || 'INR').toUpperCase();
  
  if (normalizedCurrency === 'RUPEES') return 1;
  
  if (cachedRates && cachedRates[normalizedCurrency]) {
    return cachedRates[normalizedCurrency];
  }
  
  // Fallback to default rates
  return DEFAULT_RATES[normalizedCurrency] || 1;
};

/**
 * Convert any currency to INR (base currency)
 * @param {number} amount - The amount to convert
 * @param {string} fromCurrency - The source currency code (USD, EUR, INR, etc.)
 * @returns {number} - The amount converted to INR
 */
export const convertToINR = (amount, fromCurrency) => {
  if (!amount || amount === 0) return 0;
  
  // Normalize currency code
  const currency = (fromCurrency || 'INR').toUpperCase();
  
  // Handle 'rupees' as INR
  if (currency === 'RUPEES' || currency === 'INR') return amount;
  
  // Get exchange rate
  const rate = getExchangeRateSync(currency);
  
  if (!rate || rate === 1) {
    console.warn(`Exchange rate not found for ${currency}, assuming INR`);
    return amount;
  }
  
  // Convert to INR
  return amount * rate;
};

/**
 * Format currency for display
 * @param {number} amount - Amount in INR
 * @param {boolean} showSymbol - Whether to show currency symbol
 * @returns {string} - Formatted currency string
 */
export const formatINR = (amount, showSymbol = true) => {
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return showSymbol ? `₹${formatted}` : formatted;
};

/**
 * Format currency with original currency notation
 * @param {number} amount - Original amount
 * @param {string} currency - Original currency
 * @param {boolean} showINREquivalent - Whether to show INR equivalent
 * @returns {string} - Formatted string
 */
export const formatCurrencyWithOriginal = (amount, currency, showINREquivalent = false) => {
  const normalizedCurrency = (currency || 'INR').toUpperCase();
  
  let formatted = '';
  
  // Format based on currency
  if (normalizedCurrency === 'INR' || normalizedCurrency === 'RUPEES') {
    formatted = formatINR(amount);
  } else if (normalizedCurrency === 'USD') {
    formatted = `$${amount.toFixed(2)}`;
  } else if (normalizedCurrency === 'EUR') {
    formatted = `€${amount.toFixed(2)}`;
  } else if (normalizedCurrency === 'GBP') {
    formatted = `£${amount.toFixed(2)}`;
  } else if (normalizedCurrency === 'AUD') {
    formatted = `A$${amount.toFixed(2)}`;
  } else {
    formatted = `${normalizedCurrency} ${amount.toFixed(2)}`;
  }
  
  // Add INR equivalent if requested and not already INR
  if (showINREquivalent && normalizedCurrency !== 'INR' && normalizedCurrency !== 'RUPEES') {
    const inrAmount = convertToINR(amount, currency);
    formatted += ` (${formatINR(inrAmount)})`;
  }
  
  return formatted;
};

/**
 * Get the current exchange rate for a currency
 * @param {string} currency - The currency code
 * @returns {number} - The exchange rate
 */
export const getExchangeRate = (currency) => {
  return getExchangeRateSync(currency);
};

/**
 * Clear the exchange rate cache (useful after updating rates)
 */
export const clearExchangeRateCache = () => {
  cachedRates = null;
  cacheTimestamp = null;
};

/**
 * Sum amounts in different currencies and return total in INR
 * @param {Array} transactions - Array of transaction objects with amount and currency fields
 * @returns {number} - Total in INR
 */
export const sumTransactionsInINR = (transactions) => {
  if (!transactions || transactions.length === 0) return 0;
  
  return transactions.reduce((sum, transaction) => {
    const amount = transaction.amount || 0;
    const currency = transaction.currency || 'INR';
    return sum + convertToINR(amount, currency);
  }, 0);
};
