/**
 * Application Configuration Constants
 * Centralized location for all hardcoded values and constants
 * 
 * IMPORTANT: Exchange Rates
 * ---------------------------
 * To update exchange rates, modify the EXCHANGE_RATES object below.
 * All rates are relative to INR (1 INR = 1).
 * 
 * Example: If 1 USD = 84.50 INR, then USD: 84.50
 * 
 * Last Updated: December 27, 2025
 */

// ===== DEFAULT VALUES =====
export const DEFAULT_BUDGET = {
  monthly: 50000,  // Default monthly budget in your currency
  daily: 1667      // Default daily budget (monthly / 30)
};

// ===== EXPENSE CATEGORIES =====
export const EXPENSE_CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Education',
  'Personal Care',
  'Home & Rent',
  'Investment',
  'Other'
];

// ===== PAYMENT METHODS =====
export const PAYMENT_METHODS = [
  'Cash',
  'Credit Card',
  'Debit Card',
  'UPI',
  'Net Banking',
  'Wallet',
  'Other'
];

// ===== PAYMENT MODES =====
export const PAYMENT_MODES = [
  'UPI',
  'Cash',
  'Credit Card',
  'Cheque',
  'Bank Transfer'
];

// ===== RECURRING TRANSACTION FREQUENCIES =====
export const RECURRING_FREQUENCIES = [
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
];

// ===== UI CONFIGURATION =====
export const UI_CONFIG = {
  BOTTOM_NAV_ICONS_REGULAR: 5,  // Number of bottom navigation icons for regular users
  BOTTOM_NAV_ICONS_ADMIN: 7,    // Number of bottom navigation icons for admin users
  PROGRESS_BAR_MAX_PERCENT: 100,
  SNACKBAR_AUTO_HIDE_DURATION: 6000, // milliseconds
};

// ===== GEMINI API CONFIGURATION =====
export const GEMINI_CONFIG = {
  MODEL_NAME: 'gemini-2.5-flash',
  API_VERSION: 'v1beta',
  API_BASE_URL: 'https://generativelanguage.googleapis.com'
};

// ===== API LIMITS =====
export const DEFAULT_GEMINI_API_LIMIT = 100; // Default daily Gemini API calls per user
export const DEFAULT_MAX_NEW_USERS_PER_DAY = 100;

// ===== FIREBASE COLLECTION NAMES =====
export const FIREBASE_COLLECTIONS = {
  DAILY_EXPENSES: 'daily_expenses',
  BUDGETS: 'budgets',
  CATEGORIES: 'categories',
  USERS: 'users',
  ADMIN_USERS: 'admin_users'
};

// ===== DATE FORMATS =====
export const DATE_FORMATS = {
  FIREBASE_DATE: 'yyyy-MM-dd',      // Format used for Firestore date storage
  DISPLAY_DATE: 'MMM dd, yyyy',     // Format for displaying dates to users
  MONTH_YEAR: 'MMM yyyy',           // Format for monthly views
};

// ===== CURRENCY CONFIGURATION =====
export const CURRENCY_CONFIG = {
  SYMBOL: '₹',           // Currency symbol
  CODE: 'INR',           // Currency code
  DECIMAL_PLACES: 2      // Number of decimal places
};

// ===== EXCHANGE RATES (Base: INR) =====
// Update these rates periodically or allow admin to configure
export const EXCHANGE_RATES = {
  INR: 1,           // Base currency
  USD: 84.50,       // 1 USD = 84.50 INR (approximate)
  EUR: 92.00,       // 1 EUR = 92.00 INR (approximate)
  GBP: 107.00,      // 1 GBP = 107.00 INR (approximate)
  AUD: 56.50,       // 1 AUD = 56.50 INR (approximate)
  rupees: 1         // Handle 'rupees' as INR
};

// ===== COPYRIGHT INFO =====
export const APP_INFO = {
  AUTHOR: 'Raj Kumar Pandit',
  START_YEAR: 2025,
  APP_NAME: 'Macro Finance Tracker'
};

// ===== API RATE LIMIT HANDLING =====
export const API_CONFIG = {
  RETRY_DELAY_SECONDS: 5,  // Seconds to wait before retrying after rate limit
  MAX_RETRY_ATTEMPTS: 3,   // Maximum number of retry attempts
};
