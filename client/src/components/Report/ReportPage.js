import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography,
  Paper,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BookIcon from '@mui/icons-material/Book';
import TodayIcon from '@mui/icons-material/Today';
import CategoryIcon from '@mui/icons-material/Category';
import PaymentIcon from '@mui/icons-material/Payment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SavingsIcon from '@mui/icons-material/Savings';
import Footer from '../Common/Footer';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { convertToINR, formatINR, formatCurrencyWithOriginal, fetchExchangeRates } from '../../utils/currencyUtils';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function ReportPage() {
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Get expense head from URL parameter
  const expenseHeadFromUrl = searchParams.get('expenseHead');
  
  const [tabValue, setTabValue] = useState(expenseHeadFromUrl ? 1 : 0);
  
  // Ledger states
  const [ledgers, setLedgers] = useState([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(true);
  
  // Transaction states
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  
  // Date filter states
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [transactionTypes, setTransactionTypes] = useState(['credit', 'debit']); // Both enabled by default
  
  // Expense Head filter states
  const [expenseHeads, setExpenseHeads] = useState([]);
  const [selectedExpenseHead, setSelectedExpenseHead] = useState(expenseHeadFromUrl || 'all');
  
  // Payment Mode filter states
  const [paymentModes, setPaymentModes] = useState([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('all');

  // Fetch all ledgers for the user
  const fetchLedgers = async () => {
    try {
      setLedgerLoading(true);
      const ledgerQuery = query(
        collection(db, 'ledgers'),
        where('userId', '==', currentUser.uid)
      );
      const ledgerSnapshot = await getDocs(ledgerQuery);
      const ledgersList = ledgerSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data().startDate?.toDate(),
        endDate: doc.data().endDate?.toDate()
      }));
      
      // Sort by startDate in frontend to avoid composite index requirement
      ledgersList.sort((a, b) => {
        const dateA = a.startDate || new Date(0);
        const dateB = b.startDate || new Date(0);
        return dateB - dateA; // Descending order (newest first)
      });
      
      setLedgers(ledgersList);
      
      // Auto-select the first open ledger or the most recent one
      const openLedger = ledgersList.find(l => l.status === 'open');
      if (openLedger) {
        setSelectedLedger(openLedger.id);
      } else if (ledgersList.length > 0) {
        setSelectedLedger(ledgersList[0].id);
      }
    } catch (error) {
      console.error('Error fetching ledgers:', error);
      setLedgers([]);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Fetch transactions for selected ledger
  const fetchTransactions = async (ledgerId) => {
    if (!ledgerId) {
      setTransactions([]);
      return;
    }

    try {
      setTransactionsLoading(true);
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        where('ledgerId', '==', ledgerId)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));
      
      // Sort by date
      const sortedData = transactionsData.sort((a, b) => {
        const dateA = a.date || new Date(0);
        const dateB = b.date || new Date(0);
        return dateB - dateA;
      });
      
      setTransactions(sortedData);
      
      // Extract unique expense heads from transactions
      const heads = [...new Set(transactionsData
        .filter(t => t.expenseHead)
        .map(t => t.expenseHead))];
      setExpenseHeads(heads.sort());
      
      // Extract unique payment modes from transactions
      const modes = [...new Set(transactionsData
        .filter(t => t.paymentMode)
        .map(t => t.paymentMode))];
      setPaymentModes(modes.sort());
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      // Load exchange rates first, then fetch ledgers
      fetchExchangeRates().then(() => {
        fetchLedgers();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  useEffect(() => {
    if (selectedLedger) {
      fetchTransactions(selectedLedger);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLedger]);

  // Handle URL parameter for expense head
  useEffect(() => {
    if (expenseHeadFromUrl) {
      setTabValue(1); // Switch to Expense Head tab
      setSelectedExpenseHead(expenseHeadFromUrl);
    }
  }, [expenseHeadFromUrl]);

  // Date filtering logic
  const getDateRangeForFilter = useCallback((filter) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: yesterday,
          end: new Date(yesterday.getTime() + 24 * 60 * 60 * 1000 - 1)
        };
      
      case 'thisWeek':
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        return {
          start: startOfWeek,
          end: new Date()
        };
      
      case 'lastWeek':
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        lastWeekEnd.setHours(23, 59, 59, 999);
        return {
          start: lastWeekStart,
          end: lastWeekEnd
        };
      
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1)
          };
        }
        return null;
      
      case 'all':
      default:
        return null;
    }
  }, [customStartDate, customEndDate]);

  // Filtered transactions based on active tab and filters
  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (tabValue === 0) {
      // Date-based filtering
      const dateRange = getDateRangeForFilter(dateFilter);
      if (dateRange) {
        filtered = filtered.filter(t => {
          const transactionDate = t.date || new Date(0);
          return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
        });
      }
      
      // Credit/Debit filtering (only for date-based tab)
      if (transactionTypes.length === 0) {
        // If neither is selected, show no records
        filtered = [];
      } else if (transactionTypes.length === 1) {
        // If only one is selected, filter by that type
        filtered = filtered.filter(t => {
          if (transactionTypes.includes('credit')) {
            return t.type === 'income';
          }
          if (transactionTypes.includes('debit')) {
            return t.type === 'expense';
          }
          return false;
        });
      }
      // If both are selected (length === 2), show all - no additional filtering needed
    } else if (tabValue === 1) {
      // Expense Head filtering
      // Credit/Debit filtering for expense head tab
      if (transactionTypes.length === 0) {
        filtered = [];
      } else if (transactionTypes.length === 1) {
        filtered = filtered.filter(t => {
          if (transactionTypes.includes('credit')) {
            return t.type === 'income';
          }
          if (transactionTypes.includes('debit')) {
            return t.type === 'expense';
          }
          return false;
        });
      }
      
      // Expense head filtering
      if (selectedExpenseHead !== 'all') {
        filtered = filtered.filter(t => t.expenseHead === selectedExpenseHead);
      }
    } else if (tabValue === 2) {
      // Payment Mode filtering
      const dateRange = getDateRangeForFilter(dateFilter);
      if (dateRange) {
        filtered = filtered.filter(t => {
          const transactionDate = t.date || new Date(0);
          return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
        });
      }
      
      // Credit/Debit filtering for payment mode tab
      if (transactionTypes.length === 0) {
        filtered = [];
      } else if (transactionTypes.length === 1) {
        filtered = filtered.filter(t => {
          if (transactionTypes.includes('credit')) {
            return t.type === 'income';
          }
          if (transactionTypes.includes('debit')) {
            return t.type === 'expense';
          }
          return false;
        });
      }
      
      // Payment mode filtering
      if (selectedPaymentMode !== 'all') {
        filtered = filtered.filter(t => t.paymentMode === selectedPaymentMode);
      }
    }

    return filtered;
  }, [transactions, tabValue, dateFilter, selectedExpenseHead, selectedPaymentMode, transactionTypes, getDateRangeForFilter]);

  // Calculate summary statistics for filtered data
  const summary = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
    
    const expenses = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
    
    const investment = filteredTransactions
      .filter(t => t.type === 'expense' && (t.expenseHead === 'Investment' || t.category === 'Investment'))
      .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
    
    return { income, expenses, investment, count: filteredTransactions.length };
  }, [filteredTransactions]);

  const formatCurrency = (amount) => {
    return formatINR(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleLedgerChange = (event) => {
    setSelectedLedger(event.target.value);
  };

  const handleDateFilterChange = (event) => {
    setDateFilter(event.target.value);
  };

  const handleCreditToggle = (event) => {
    if (event.target.checked) {
      setTransactionTypes(prev => [...prev, 'credit']);
    } else {
      setTransactionTypes(prev => prev.filter(t => t !== 'credit'));
    }
  };

  const handleDebitToggle = (event) => {
    if (event.target.checked) {
      setTransactionTypes(prev => [...prev, 'debit']);
    } else {
      setTransactionTypes(prev => prev.filter(t => t !== 'debit'));
    }
  };

  const handleExpenseHeadChange = (event) => {
    setSelectedExpenseHead(event.target.value);
  };

  const handlePaymentModeChange = (event) => {
    setSelectedPaymentMode(event.target.value);
  };

  const selectedLedgerData = ledgers.find(l => l.id === selectedLedger);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa' }}>
      <Box sx={{ pb: 10 }}>
        {/* Page Title - Outside Paper */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <AssessmentIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="700" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Reports
          </Typography>
        </Box>

        <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
          {/* Ledger Selector */}
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Ledger</InputLabel>
              <Select
                value={selectedLedger}
                onChange={handleLedgerChange}
                label="Select Ledger"
                disabled={ledgerLoading}
                startAdornment={<BookIcon sx={{ mr: 1, color: 'action.active' }} />}
                sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
              >
                {ledgers.map((ledger) => (
                  <MenuItem 
                    key={ledger.id} 
                    value={ledger.id}
                    sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'flex-start',
                      py: 1.5 
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 0.5 }}>
                      <Typography variant="body2" fontWeight="600" sx={{ flex: 1 }}>
                        {ledger.name}
                      </Typography>
                      <Chip 
                        label={ledger.status === 'open' ? 'Open' : 'Closed'} 
                        size="small" 
                        color={ledger.status === 'open' ? 'success' : 'default'}
                        sx={{ height: 18, fontSize: '0.65rem', textTransform: 'capitalize' }} 
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {ledger.startDate?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - {ledger.endDate?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* No ledger warning */}
          {!ledgerLoading && ledgers.length === 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              No ledgers found. Please create a ledger from the Admin page.
            </Alert>
          )}

          {/* Show content only if ledger is selected */}
          {selectedLedger && selectedLedgerData && (
            <>
              {/* Summary Cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}>
                  <Card elevation={1} sx={{ bgcolor: '#e8f5e9' }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <TrendingUpIcon sx={{ fontSize: { xs: 16, sm: 20 }, color: '#4caf50', mr: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                          Income
                        </Typography>
                      </Box>
                      <Typography 
                        variant="h6" 
                        fontWeight="700" 
                        color="#4caf50"
                        sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}
                      >
                        {formatCurrency(summary.income)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card elevation={1} sx={{ bgcolor: '#ffebee' }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <TrendingDownIcon sx={{ fontSize: { xs: 16, sm: 20 }, color: '#f44336', mr: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                          Expenses
                        </Typography>
                      </Box>
                      <Typography 
                        variant="h6" 
                        fontWeight="700" 
                        color="#f44336"
                        sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}
                      >
                        {formatCurrency(summary.expenses)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card elevation={1} sx={{ bgcolor: '#e0f2f1' }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <SavingsIcon sx={{ fontSize: { xs: 16, sm: 20 }, color: '#00695c', mr: 0.5 }} />
                        <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                          Investment
                        </Typography>
                      </Box>
                      <Typography 
                        variant="h6" 
                        fontWeight="700" 
                        color="#00695c"
                        sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}
                      >
                        {formatCurrency(summary.investment)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card elevation={1} sx={{ bgcolor: '#e3f2fd' }}>
                    <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                      <Typography variant="caption" sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                        Records
                      </Typography>
                      <Typography 
                        variant="h6" 
                        fontWeight="700" 
                        color="#1976d2"
                        sx={{ fontSize: { xs: '0.9rem', sm: '1.25rem' } }}
                      >
                        {summary.count}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Tabs for Date and Expense Head filters */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{
                    '& .MuiTab-root': {
                      fontSize: { xs: '0.7rem', sm: '0.875rem' },
                      minHeight: { xs: 42, sm: 48 },
                      minWidth: { xs: 'auto', sm: 120 }
                    }
                  }}
                >
                  <Tab 
                    icon={<TodayIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    label="Date Based" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<CategoryIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    label="Expense Head" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<PaymentIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    label="Payment Mode" 
                    iconPosition="start"
                  />
                </Tabs>
              </Box>

              {/* Date-based Filter Tab */}
              <TabPanel value={tabValue} index={0}>
                <Box sx={{ mb: 3 }}>
                  {/* Credit/Debit Checkboxes */}
                  <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={transactionTypes.includes('credit')}
                          onChange={handleCreditToggle}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#4caf50',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#4caf50',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          Credit
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={transactionTypes.includes('debit')}
                          onChange={handleDebitToggle}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#f44336',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#f44336',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          Debit
                        </Typography>
                      }
                    />
                  </Box>

                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Date Filter</InputLabel>
                    <Select
                      value={dateFilter}
                      onChange={handleDateFilterChange}
                      label="Date Filter"
                    >
                      <MenuItem value="all">All Transactions</MenuItem>
                      <MenuItem value="today">Today</MenuItem>
                      <MenuItem value="yesterday">Yesterday</MenuItem>
                      <MenuItem value="thisWeek">This Week</MenuItem>
                      <MenuItem value="lastWeek">Last Week</MenuItem>
                      <MenuItem value="custom">Custom Date Range</MenuItem>
                    </Select>
                  </FormControl>

                  {dateFilter === 'custom' && (
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Start Date"
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="End Date"
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                  )}
                </Box>
              </TabPanel>

              {/* Expense Head Filter Tab */}
              <TabPanel value={tabValue} index={1}>
                <Box sx={{ mb: 3 }}>
                  {/* Credit/Debit Switches */}
                  <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={transactionTypes.includes('credit')}
                          onChange={handleCreditToggle}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#4caf50',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#4caf50',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          Credit
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={transactionTypes.includes('debit')}
                          onChange={handleDebitToggle}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#f44336',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#f44336',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          Debit
                        </Typography>
                      }
                    />
                  </Box>

                  <FormControl fullWidth size="small">
                    <InputLabel>Expense Head</InputLabel>
                    <Select
                      value={selectedExpenseHead}
                      onChange={handleExpenseHeadChange}
                      label="Expense Head"
                    >
                      <MenuItem value="all">All Expense Heads</MenuItem>
                      {expenseHeads.map((head) => (
                        <MenuItem key={head} value={head}>
                          {head}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </TabPanel>

              {/* Payment Mode Filter Tab */}
              <TabPanel value={tabValue} index={2}>
                <Box sx={{ mb: 3 }}>
                  {/* Credit/Debit Switches */}
                  <Box sx={{ mb: 2, display: 'flex', gap: 2 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={transactionTypes.includes('credit')}
                          onChange={handleCreditToggle}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#4caf50',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#4caf50',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          Credit
                        </Typography>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={transactionTypes.includes('debit')}
                          onChange={handleDebitToggle}
                          size="small"
                          sx={{
                            '& .MuiSwitch-switchBase.Mui-checked': {
                              color: '#f44336',
                            },
                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                              backgroundColor: '#f44336',
                            },
                          }}
                        />
                      }
                      label={
                        <Typography sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                          Debit
                        </Typography>
                      }
                    />
                  </Box>

                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Date Filter</InputLabel>
                    <Select
                      value={dateFilter}
                      onChange={handleDateFilterChange}
                      label="Date Filter"
                    >
                      <MenuItem value="all">All Transactions</MenuItem>
                      <MenuItem value="today">Today</MenuItem>
                      <MenuItem value="yesterday">Yesterday</MenuItem>
                      <MenuItem value="thisWeek">This Week</MenuItem>
                      <MenuItem value="lastWeek">Last Week</MenuItem>
                      <MenuItem value="custom">Custom Date Range</MenuItem>
                    </Select>
                  </FormControl>

                  {dateFilter === 'custom' && (
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Start Date"
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <TextField
                          fullWidth
                          size="small"
                          label="End Date"
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                  )}

                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Mode</InputLabel>
                    <Select
                      value={selectedPaymentMode}
                      onChange={handlePaymentModeChange}
                      label="Payment Mode"
                    >
                      <MenuItem value="all">All Payment Modes</MenuItem>
                      {paymentModes.map((mode) => (
                        <MenuItem key={mode} value={mode}>
                          {mode}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </TabPanel>

              {/* Transactions Table */}
              {transactionsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : filteredTransactions.length === 0 ? (
                <Alert severity="info">
                  No transactions found for the selected filters.
                </Alert>
              ) : (
                <TableContainer 
                  component={Paper} 
                  elevation={0} 
                  sx={{ 
                    maxHeight: { xs: 400, sm: 500 },
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ 
                          fontWeight: 700, 
                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                          bgcolor: '#f5f5f5',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Date
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 700, 
                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                          bgcolor: '#f5f5f5',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Type
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 700, 
                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                          bgcolor: '#f5f5f5',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Description
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 700, 
                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                          bgcolor: '#f5f5f5',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Expense Head
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 700, 
                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                          bgcolor: '#f5f5f5',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Payment
                        </TableCell>
                        <TableCell 
                          align="right" 
                          sx={{ 
                            fontWeight: 700, 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            bgcolor: '#f5f5f5',
                            py: { xs: 0.5, sm: 1 }
                          }}
                        >
                          Amount
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredTransactions.map((transaction) => (
                        <TableRow 
                          key={transaction.id}
                          sx={{ 
                            '&:hover': { bgcolor: '#f9f9f9' },
                            '&:nth-of-type(even)': { bgcolor: '#fafafa' }
                          }}
                        >
                          <TableCell sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 }
                          }}>
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell sx={{ py: { xs: 0.75, sm: 1 } }}>
                            <Chip
                              label={transaction.type}
                              size="small"
                              color={transaction.type === 'income' ? 'success' : 'error'}
                              sx={{ 
                                fontSize: { xs: '0.6rem', sm: '0.7rem' },
                                height: { xs: 18, sm: 20 },
                                textTransform: 'capitalize'
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 },
                            maxWidth: { xs: 100, sm: 200 },
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {transaction.transactionDesc || transaction.description || 'N/A'}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 }
                          }}>
                            {transaction.expenseHead || '-'}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 }
                          }}>
                            {transaction.paymentMode || 'N/A'}
                          </TableCell>
                          <TableCell 
                            align="right" 
                            sx={{ 
                              fontSize: { xs: '0.65rem', sm: '0.75rem' },
                              fontWeight: 600,
                              py: { xs: 0.75, sm: 1 },
                              color: transaction.type === 'income' ? '#4caf50' : '#f44336'
                            }}
                          >
                            {formatCurrencyWithOriginal(transaction.amount, transaction.currency, true)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Paper>
      </Box>
      <Footer />
    </Box>
  );
}

export default ReportPage;

