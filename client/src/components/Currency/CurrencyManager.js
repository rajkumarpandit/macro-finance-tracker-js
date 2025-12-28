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
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import UpdateIcon from '@mui/icons-material/Update';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
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
      return { text: 'Up to date', color: 'success' };
    } else if (hoursSince < 72) {
      return { text: 'Needs update', color: 'warning' };
    } else {
      return { text: 'Outdated', color: 'error' };
    }
  };

  const updateStatus = getUpdateStatus();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa' }}>
      <Box sx={{ pb: 10 }}>
        {/* Page Title - Outside Paper */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <CurrencyExchangeIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="700" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Currency Manager
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          {/* Refresh Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
            <Button
              variant="contained"
              startIcon={refreshing ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
              onClick={() => fetchLatestRates(false)}
              disabled={refreshing || loading}
              sx={{ 
                bgcolor: 'primary.main',
                '&:hover': { bgcolor: 'primary.dark' }
              }}
            >
              {refreshing ? 'Updating...' : 'Refresh Rates'}
            </Button>
          </Box>

          {/* Info Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Card elevation={1}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <UpdateIcon sx={{ color: 'text.secondary', mr: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      Last Updated
                    </Typography>
                  </Box>
                  <Typography variant="h6" fontWeight="600">
                    {formatDate(lastUpdated)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card elevation={1}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CurrencyExchangeIcon sx={{ color: 'text.secondary', mr: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                  </Box>
                  <Chip 
                    label={updateStatus.text} 
                    color={updateStatus.color}
                    sx={{ fontWeight: 600 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Info Alert */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              Click "Refresh Rates" to fetch the latest exchange rates from the internet. All rates are shown relative to INR (Indian Rupee).
            </Typography>
          </Alert>

          {/* Exchange Rates Table */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 700, py: 1, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>Currency</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700, py: 1, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>Symbol</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                      Rate
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, py: 1, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                      Example
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {TOP_CURRENCIES.map((currency) => (
                    <TableRow 
                      key={currency.code}
                      sx={{ 
                        '&:hover': { bgcolor: '#f9f9f9' },
                        bgcolor: currency.code === 'INR' ? '#e8f5e9' : 'inherit'
                      }}
                    >
                      <TableCell sx={{ py: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Typography 
                            component="span" 
                            fontWeight={currency.code === 'INR' ? 700 : 400}
                            sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}
                          >
                            {currency.name}
                          </Typography>
                          {currency.code === 'INR' && (
                            <Chip label="Base" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <Chip label={currency.code} size="small" variant="outlined" sx={{ height: 20, fontSize: { xs: '0.6rem', sm: '0.7rem' } }} />
                      </TableCell>
                      <TableCell sx={{ py: 0.75, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>{currency.symbol}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: 'primary.main', py: 0.75, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                        {formatRate(exchangeRates[currency.code])}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, color: 'text.secondary', py: 0.75 }}>
                        {currency.symbol}100 = {formatRate((exchangeRates[currency.code] || 0) * 100)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Additional Info */}
          <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f4f8', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              <strong>Note:</strong> Exchange rates are fetched from FreeCurrencyAPI.com and converted to INR base. 
              The API provides USD-based rates which are automatically converted to show "1 unit of currency = X INR".
              All your transactions will be calculated using these rates.
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              <strong>Recommendation:</strong> Update rates at least once a week for accurate reporting, or whenever you notice they've become stale.
            </Typography>
          </Box>
        </Paper>
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
