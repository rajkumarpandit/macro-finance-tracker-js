/**
 * Debug utility for conditional logging
 * 
 * Use this utility instead of direct console.log calls to make it easy
 * to disable all logging in production environments.
 */

// Set to false to disable all logging
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';

/**
 * Log a message if debugging is enabled
 * @param {string} component - The component or module name
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 */
export const debug = (component, message, data = null) => {
  if (DEBUG_ENABLED) {
    if (data) {
      console.log(`[${component}] ${message}`, data);
    } else {
      console.log(`[${component}] ${message}`);
    }
  }
};

/**
 * Log an error if debugging is enabled
 * @param {string} component - The component or module name
 * @param {string} message - The error message
 * @param {Error} error - The error object
 */
export const debugError = (component, message, error) => {
  // Always log errors, even in production
  console.error(`[${component}] ${message}`, error);
};

/**
 * Log a warning if debugging is enabled
 * @param {string} component - The component or module name
 * @param {string} message - The warning message
 * @param {any} data - Optional data to log
 */
export const debugWarn = (component, message, data = null) => {
  if (DEBUG_ENABLED) {
    if (data) {
      console.warn(`[${component}] ${message}`, data);
    } else {
      console.warn(`[${component}] ${message}`);
    }
  }
};

const debugUtils = { debug, debugError, debugWarn };
export default debugUtils;