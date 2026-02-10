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
  FormControlLabel,
  Button,
  Stack
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BookIcon from '@mui/icons-material/Book';
import TodayIcon from '@mui/icons-material/Today';
import CategoryIcon from '@mui/icons-material/Category';
import PaymentIcon from '@mui/icons-material/Payment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SavingsIcon from '@mui/icons-material/Savings';
import DownloadIcon from '@mui/icons-material/Download';
import TableViewIcon from '@mui/icons-material/TableView';
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
  
  // Bank Account filter states
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankAccount, setSelectedBankAccount] = useState('all');

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
      
      // Extract unique bank accounts from transactions
      const accounts = [...new Set(transactionsData
        .filter(t => t.accountName)
        .map(t => t.accountName))];
      setBankAccounts(accounts.sort());
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

    // Apply Credit/Debit filtering to all tabs
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

    if (tabValue === 0) {
      // Bank Account filtering (index 0)
      if (selectedBankAccount !== 'all') {
        filtered = filtered.filter(t => t.accountName === selectedBankAccount);
      }
    } else if (tabValue === 1) {
      // Date-based filtering (index 1)
      const dateRange = getDateRangeForFilter(dateFilter);
      if (dateRange) {
        filtered = filtered.filter(t => {
          const transactionDate = t.date || new Date(0);
          return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
        });
      }
    } else if (tabValue === 2) {
      // Expense Head filtering (index 2)
      if (selectedExpenseHead !== 'all') {
        filtered = filtered.filter(t => t.expenseHead === selectedExpenseHead);
      }
    } else if (tabValue === 3) {
      // Payment Mode filtering (index 3)
      if (selectedPaymentMode !== 'all') {
        filtered = filtered.filter(t => t.paymentMode === selectedPaymentMode);
      }
    }

    return filtered;
  }, [transactions, tabValue, dateFilter, selectedExpenseHead, selectedPaymentMode, selectedBankAccount, transactionTypes, getDateRangeForFilter]);

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

  const handleBankAccountChange = (event) => {
    setSelectedBankAccount(event.target.value);
  };

  // Download functions
  const downloadCSV = () => {
    if (filteredTransactions.length === 0) return;
    
    const headers = ['Date', 'Type', 'Bank Account', 'Amount (INR)', 'Currency', 'Original Amount', 'Description', 'Expense Head', 'Payment Mode', 'Category'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(t => {
        const amount = t.type === 'income' ? t.amount : -Math.abs(t.amount);
        const amountINR = t.type === 'income' ? convertToINR(t.amount, t.currency) : -Math.abs(convertToINR(t.amount, t.currency));
        return [
          formatDate(t.date),
          t.type || '',
          t.accountName || 'Cash',
          amountINR.toFixed(2),
          t.currency || 'INR',
          amount.toFixed(2),
          `"${(t.transactionDesc || t.description || '').replace(/"/g, '""')}"`,
          t.expenseHead || '',
          t.paymentMode || '',
          t.category || ''
        ].join(',');
      })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${selectedLedgerData?.name || 'report'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadExcel = () => {
    if (filteredTransactions.length === 0) return;
    
    // Create Excel-compatible HTML table
    const headers = ['Date', 'Type', 'Bank Account', 'Amount (INR)', 'Currency', 'Original Amount', 'Description', 'Expense Head', 'Payment Mode', 'Category'];
    const tableHTML = `
      <table>
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${filteredTransactions.map(t => {
            const amount = t.type === 'income' ? t.amount : -Math.abs(t.amount);
            const amountINR = t.type === 'income' ? convertToINR(t.amount, t.currency) : -Math.abs(convertToINR(t.amount, t.currency));
            return `<tr>
              <td>${formatDate(t.date)}</td>
              <td>${t.type || ''}</td>
              <td>${t.accountName || 'Cash'}</td>
              <td>${amountINR.toFixed(2)}</td>
              <td>${t.currency || 'INR'}</td>
              <td>${amount.toFixed(2)}</td>
              <td>${t.transactionDesc || t.description || ''}</td>
              <td>${t.expenseHead || ''}</td>
              <td>${t.paymentMode || ''}</td>
              <td>${t.category || ''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    
    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${selectedLedgerData?.name || 'report'}_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedLedgerData = ledgers.find(l => l.id === selectedLedger);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7fa' }}>
      <Box sx={{ pb: 10 }}>
        {/* Page Title - Outside Paper */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AssessmentIcon sx={{ fontSize: 24, color: '#42a5f5' }} />
          <Typography variant="h6" fontWeight="700" sx={{ fontSize: '1.1rem' }}>
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
                startAdornment={<BookIcon sx={{ mr: 1, color: '#42a5f5' }} />}
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
                        sx={{ height: 18, fontSize: '0.65rem', textTransform: 'capitalize', ...(ledger.status === 'open' ? { bgcolor: '#42a5f5', color: '#fff' } : {}) }} 
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
                  <Card elevation={1} sx={{ bgcolor: '#ffffff', borderLeft: '4px solid #4caf50' }}>
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
                  <Card elevation={1} sx={{ bgcolor: '#ffffff', borderLeft: '4px solid #f44336' }}>
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
                  <Card elevation={1} sx={{ bgcolor: '#ffffff', borderLeft: '4px solid #00695c' }}>
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
                  <Card elevation={1} sx={{ bgcolor: '#ffffff', borderLeft: '4px solid #1976d2' }}>
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

              {/* Tabs for filters */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs 
                  value={tabValue} 
                  onChange={handleTabChange}
                  variant="fullWidth"
                  sx={{
                    '& .MuiTab-root': {
                      fontSize: { xs: '0.7rem', sm: '0.875rem' },
                      minHeight: { xs: 42, sm: 48 },
                      minWidth: { xs: 'auto', sm: 120 },
                      bgcolor: '#ffffff',
                      borderLeft: '3px solid transparent',
                      transition: 'all 0.3s ease',
                      '&.Mui-selected': {
                        bgcolor: '#ffffff',
                        borderLeft: '3px solid #1976d2',
                        fontWeight: 600
                      }
                    },
                    '& .MuiTabs-indicator': {
                      display: 'none'
                    }
                  }}
                >
                  <Tab 
                    icon={<SavingsIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    label="B/Acct" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<TodayIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    label="Date" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<CategoryIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    label="Head" 
                    iconPosition="start"
                  />
                  <Tab 
                    icon={<PaymentIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />} 
                    label="P/Mode" 
                    iconPosition="start"
                  />
                </Tabs>
              </Box>

              {/* Date-based Filter Tab */}
              <TabPanel value={tabValue} index={1}>
                <Box sx={{ mb: 3 }}>
                  {/* Credit/Debit Switches and Download Buttons */}
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={downloadCSV}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#4caf50',
                          '&:hover': { bgcolor: '#45a049' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        CSV
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<TableViewIcon />}
                        onClick={downloadExcel}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#2196f3',
                          '&:hover': { bgcolor: '#1976d2' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        Excel
                      </Button>
                    </Box>
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
              <TabPanel value={tabValue} index={2}>
                <Box sx={{ mb: 3 }}>
                  {/* Credit/Debit Switches and Download Buttons */}
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={downloadCSV}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#4caf50',
                          '&:hover': { bgcolor: '#45a049' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        CSV
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<TableViewIcon />}
                        onClick={downloadExcel}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#2196f3',
                          '&:hover': { bgcolor: '#1976d2' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        Excel
                      </Button>
                    </Box>
                  </Box>

                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
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

              {/* Payment Mode Filter Tab */}
              <TabPanel value={tabValue} index={3}>
                <Box sx={{ mb: 3 }}>
                  {/* Credit/Debit Switches and Download Buttons */}
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={downloadCSV}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#4caf50',
                          '&:hover': { bgcolor: '#45a049' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        CSV
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<TableViewIcon />}
                        onClick={downloadExcel}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#2196f3',
                          '&:hover': { bgcolor: '#1976d2' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        Excel
                      </Button>
                    </Box>
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

              {/* Bank Account Filter Tab */}
              <TabPanel value={tabValue} index={0}>
                <Box sx={{ mb: 3 }}>
                  {/* Credit/Debit Switches and Download Buttons */}
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
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
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<DownloadIcon />}
                        onClick={downloadCSV}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#4caf50',
                          '&:hover': { bgcolor: '#45a049' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        CSV
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<TableViewIcon />}
                        onClick={downloadExcel}
                        disabled={filteredTransactions.length === 0}
                        sx={{ 
                          bgcolor: '#2196f3',
                          '&:hover': { bgcolor: '#1976d2' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem' }
                        }}
                      >
                        Excel
                      </Button>
                    </Box>
                  </Box>

                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Bank Account</InputLabel>
                    <Select
                      value={selectedBankAccount}
                      onChange={handleBankAccountChange}
                      label="Bank Account"
                    >
                      <MenuItem value="all">All Accounts</MenuItem>
                      {bankAccounts.map((account) => (
                        <MenuItem key={account} value={account}>
                          {account}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

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
                          bgcolor: '#ffffff',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Date
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 700, 
                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                          bgcolor: '#ffffff',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Bank Acct
                        </TableCell>
                        <TableCell 
                          align="right" 
                          sx={{ 
                            fontWeight: 700, 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            bgcolor: '#ffffff',
                            py: { xs: 0.5, sm: 1 }
                          }}
                        >
                          Amount
                        </TableCell>
                        <TableCell sx={{ 
                          fontWeight: 700, 
                          fontSize: { xs: '0.65rem', sm: '0.75rem' },
                          bgcolor: '#ffffff',
                          py: { xs: 0.5, sm: 1 }
                        }}>
                          Description
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredTransactions.map((transaction) => (
                        <TableRow 
                          key={transaction.id}
                          sx={{ 
                            '&:hover': { bgcolor: '#f9f9f9' },
                            bgcolor: '#ffffff'
                          }}
                        >
                          <TableCell sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 }
                          }}>
                            {formatDate(transaction.date)}
                          </TableCell>
                          <TableCell sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 }
                          }}>
                            {transaction.accountName || 'Cash'}
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
                          <TableCell sx={{ 
                            fontSize: { xs: '0.65rem', sm: '0.75rem' },
                            py: { xs: 0.75, sm: 1 },
                            maxWidth: { xs: 150, sm: 300 }
                          }}>
                            {transaction.transactionDesc || transaction.description || 'N/A'}
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

