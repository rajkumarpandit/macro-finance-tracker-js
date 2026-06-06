import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Snackbar,
  Chip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import UpdateIcon from '@mui/icons-material/Update';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import Footer from '../Common/Footer';

// Top 10 most used currencies
const TOP_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' }
];

const FREECURRENCY_API_KEY = 'fca_live_t5icKYG6PbxGEEO089iHgYYQzDML64bvuw8J851M';
const FREECURRENCY_API_URL = `https://api.freecurrencyapi.com/v1/latest?apikey=${FREECURRENCY_API_KEY}`;

function CurrencyManager() {
  const { currentUser } = useAuth();
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // Initialize with default rates (fallback)
  const getDefaultRates = () => ({
    INR: 1,
    USD: 84.50,
    EUR: 92.00,
    GBP: 107.00,
    JPY: 0.54,
    AUD: 56.50,
    CAD: 62.00,
    CHF: 95.00,
    CNY: 12.00,
    SGD: 63.00
  });

  // Save rates to Firestore
  const saveRatesToFirestore = async (rates, source = 'default') => {
    try {
      await setDoc(doc(db, 'exchange_rates', 'current'), {
        rates: rates,
        lastUpdated: Timestamp.now(),
        source: source
      });
      return true;
    } catch (error) {
      console.error('Error saving rates to Firestore:', error);
      console.error('Make sure Firestore rules are deployed. Run: npm run deploy-rules');
      return false;
    }
  };

  // Fetch stored exchange rates from Firestore or initialize
  const fetchStoredRates = async () => {
    try {
      setLoading(true);
      const ratesDoc = await getDoc(doc(db, 'exchange_rates', 'current'));
      
      if (ratesDoc.exists()) {
        const data = ratesDoc.data();
        setExchangeRates(data.rates || {});
        setLastUpdated(data.lastUpdated?.toDate());
      } else {
        // No rates exist - fetch from API for the first time
        console.log('No exchange rates found in Firestore. Fetching from API...');
        await fetchLatestRates(true); // Pass true to indicate initialization
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      // Use default rates as fallback
      const defaultRates = getDefaultRates();
      setExchangeRates(defaultRates);
      await saveRatesToFirestore(defaultRates, 'default_fallback');
      setNotification({
        open: true,
        message: 'Using default exchange rates. Please refresh to get latest rates.',
        severity: 'warning'
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch latest rates from FreeCurrency API
  const fetchLatestRates = async (isInitialization = false) => {
    // Rate limiting: Allow refresh only every 6 hours
    if (!isInitialization && lastUpdated) {
      const hoursSinceLastUpdate = (new Date() - lastUpdated) / (1000 * 60 * 60);
      
      if (hoursSinceLastUpdate < 6) {
        const nextAllowedUpdate = new Date(lastUpdated.getTime() + 6 * 60 * 60 * 1000);
        const formattedNextUpdate = nextAllowedUpdate.toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        setNotification({
          open: true,
          message: `Exchange rates are already up to date. Next refresh allowed after ${formattedNextUpdate}`,
          severity: 'info'
        });
        return;
      }
    }

    setRefreshing(true);
    try {
      const response = await fetch(FREECURRENCY_API_URL);
      
      if (!response.ok) {
        throw new Error('Failed to fetch exchange rates from API');
      }

      const data = await response.json();
      
      if (data && data.data) {
        // API returns rates relative to USD (USD = 1)
        // We need to convert to INR base: 1 INR = ?
        const usdToInr = data.data.INR; // e.g., 89.82 means 1 USD = 89.82 INR
        
        if (!usdToInr || usdToInr === 0) {
          throw new Error('Invalid INR rate received from API');
        }

        // Convert all rates to INR base
        // Formula: Rate in INR = (USD to INR) / (Currency to USD)
        const ratesInINR = {};
        TOP_CURRENCIES.forEach(currency => {
          if (currency.code === 'INR') {
            ratesInINR.INR = 1; // Base currency
          } else if (data.data[currency.code]) {
            // For example:
            // If 1 USD = 89.82 INR and 1 EUR = 0.8494 USD
            // Then 1 EUR = ? INR
            // 1 EUR = 0.8494 USD = 0.8494 * 89.82 INR = 76.28 INR
            // But we want: How many INR for 1 unit of foreign currency
            // So if API says EUR: 0.8494 (meaning 1 USD = 0.8494 EUR)
            // We need: 1 EUR = X INR
            // Since API format is: 1 USD = X units of currency
            // For INR base: 1 Currency = (INR/USD) / (Currency/USD) = usdToInr / rateToUSD
            const currencyPerUSD = data.data[currency.code];
            ratesInINR[currency.code] = usdToInr / currencyPerUSD;
          }
        });

        // Save to Firestore
        const saved = await saveRatesToFirestore(ratesInINR, 'freecurrency_api');
        
        if (saved) {
          setExchangeRates(ratesInINR);
          setLastUpdated(new Date());
          
          setNotification({
            open: true,
            message: isInitialization 
              ? 'Exchange rates initialized successfully!' 
              : 'Exchange rates updated successfully!',
            severity: 'success'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching latest rates:', error);
      
      // On error, use default rates if this is initialization
      if (isInitialization) {
        const defaultRates = getDefaultRates();
        await saveRatesToFirestore(defaultRates, 'default_on_error');
        setExchangeRates(defaultRates);
        setLastUpdated(new Date());
      }
      
      setNotification({
        open: true,
        message: isInitialization
          ? 'Could not fetch live rates. Using default rates. You can try refreshing later.'
          : 'Error fetching rates from API. Using stored rates.',
        severity: 'error'
      });
    } finally {
      setRefreshing(false);
      if (isInitialization) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchStoredRates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const formatDate = (date) => {
    if (!date) return 'Never';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRate = (rate) => {
    if (!rate) return 'N/A';
    return `₹${rate.toFixed(2)}`;
  };

  // Calculate time since last update
  const getUpdateStatus = () => {
    if (!lastUpdated) return { text: 'Never updated', color: 'error' };
    
    const hoursSince = (new Date() - lastUpdated) / (1000 * 60 * 60);
    
    if (hoursSince < 24) {
      return { text: 'Up to date', color: 'info' };
    } else if (hoursSince < 72) {
      return { text: 'Needs update', color: 'warning' };
    } else {
      return { text: 'Outdated', color: 'error' };
    }
  };

  const updateStatus = getUpdateStatus();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa', pb: 10 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CurrencyExchangeIcon sx={{ fontSize: 24, color: '#42a5f5' }} />
            <Typography variant="h6" fontWeight="700" sx={{ fontSize: '1.1rem' }}>
              Currency Manager
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
            onClick={() => fetchLatestRates(false)}
            disabled={refreshing || loading}
            sx={{ 
              bgcolor: '#1976d2',
              '&:hover': { bgcolor: '#1565c0' },
              textTransform: 'none',
              fontSize: '0.8rem',
              px: 2,
              py: 0.75
            }}
          >
            {refreshing ? 'Updating...' : 'Refresh'}
          </Button>
        </Box>

        {/* Compact Info Section */}
        <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: '#ffffff', border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <UpdateIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Updated: {formatDate(lastUpdated)}
              </Typography>
            </Box>
            <Chip 
              label={updateStatus.text} 
              color={updateStatus.color}
              size="small"
              sx={{ fontWeight: 600, height: 22, fontSize: '0.7rem', ...(updateStatus.color === 'info' && { bgcolor: '#42a5f5', color: '#fff' }) }}
            />
          </Box>
        </Paper>

        {/* Compact Exchange Rates Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <TableContainer 
            component={Paper} 
            elevation={0} 
            sx={{ 
              border: '1px solid #e0e0e0',
              bgcolor: '#ffffff',
              maxHeight: 'calc(100vh - 300px)',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: '#f5f5f5',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#bdbdbd',
                borderRadius: '4px',
              }
            }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, py: 1, bgcolor: '#ffffff', fontSize: '0.75rem', borderBottom: '2px solid #e0e0e0' }}>
                    Currency
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 1, bgcolor: '#ffffff', fontSize: '0.75rem', borderBottom: '2px solid #e0e0e0' }}>
                    Code
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, py: 1, bgcolor: '#ffffff', fontSize: '0.75rem', borderBottom: '2px solid #e0e0e0' }}>
                    Rate (₹)
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, py: 1, bgcolor: '#ffffff', fontSize: '0.75rem', borderBottom: '2px solid #e0e0e0' }}>
                    For 100 Units
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {TOP_CURRENCIES.map((currency) => (
                  <TableRow 
                    key={currency.code}
                    sx={{ 
                      '&:hover': { bgcolor: '#f9f9f9' },
                      bgcolor: currency.code === 'INR' ? '#f0f8ff' : '#ffffff',
                      borderLeft: currency.code === 'INR' ? '3px solid #1976d2' : 'none'
                    }}
                  >
                    <TableCell sx={{ py: 0.75, fontSize: '0.8rem', bgcolor: 'inherit' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography 
                          component="span" 
                          sx={{ fontSize: '0.8rem', fontWeight: currency.code === 'INR' ? 600 : 400 }}
                        >
                          {currency.symbol} {currency.name}
                        </Typography>
                        {currency.code === 'INR' && (
                          <Chip label="Base" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 0.75, bgcolor: 'inherit' }}>
                      <Chip 
                        label={currency.code} 
                        size="small" 
                        variant="outlined" 
                        sx={{ height: 20, fontSize: '0.7rem', borderColor: '#e0e0e0' }} 
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#1976d2', py: 0.75, fontSize: '0.85rem', bgcolor: 'inherit' }}>
                      {formatRate(exchangeRates[currency.code])}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.secondary', py: 0.75, bgcolor: 'inherit' }}>
                      {formatRate((exchangeRates[currency.code] || 0) * 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Compact Info Alert */}
        <Alert 
          severity="info" 
          sx={{ 
            mt: 1.5,
            py: 0.5, 
            '& .MuiAlert-icon': { fontSize: 18 },
            bgcolor: '#ffffff',
            border: '1px solid #e3f2fd'
          }}
        >
          <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
            All rates shown relative to INR. Click "Refresh" to update from internet.
          </Typography>
        </Alert>

        {/* Compact Footer Note */}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ffffff', borderRadius: 1, border: '1px solid #e0e0e0' }}>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.7rem', mb: 0.5 }}>
            <strong>Note:</strong> Rates from FreeCurrencyAPI.com, converted to INR base. Update weekly for accuracy.
          </Typography>
        </Box>

        <Footer />

        {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setNotification({ ...notification, open: false })} 
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default CurrencyManager;
