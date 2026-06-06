import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Typography,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  Grid,
  Button,
  IconButton
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
import RefreshIcon from '@mui/icons-material/Refresh';
import Footer from '../Common/Footer';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { convertToINR, formatINR, formatCurrencyWithOriginal, fetchExchangeRates } from '../../utils/currencyUtils';

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
  
  const [selectedBankAccount, setSelectedBankAccount] = useState('all');

  // Refresh transactions for current ledger
  const handleRefresh = () => {
    if (selectedLedger) fetchTransactions(selectedLedger);
  };

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
      
      // Extract unique bank accounts from transactions (used for filter options via selectedLedgerData)
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

  // ── Shared Credit/Debit pill toggles + Download buttons ──
  const FilterToolbar = () => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: '6px' }}>
        <Box
          onClick={handleCreditToggle.bind(null, { target: { checked: !transactionTypes.includes('credit') } })}
          sx={{
            px: 1.5, py: '5px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
            border: `1.5px solid ${transactionTypes.includes('credit') ? '#16a34a' : '#d1d5db'}`,
            bgcolor: transactionTypes.includes('credit') ? '#dcfce7' : '#f9fafb',
            color: transactionTypes.includes('credit') ? '#16a34a' : '#9ca3af',
            transition: 'all 0.15s', userSelect: 'none',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}
        >
          ▲ Credit
        </Box>
        <Box
          onClick={handleDebitToggle.bind(null, { target: { checked: !transactionTypes.includes('debit') } })}
          sx={{
            px: 1.5, py: '5px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
            border: `1.5px solid ${transactionTypes.includes('debit') ? '#dc2626' : '#d1d5db'}`,
            bgcolor: transactionTypes.includes('debit') ? '#fee2e2' : '#f9fafb',
            color: transactionTypes.includes('debit') ? '#dc2626' : '#9ca3af',
            transition: 'all 0.15s', userSelect: 'none',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}
        >
          ▼ Debit
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <IconButton size="small" onClick={handleRefresh} disabled={transactionsLoading} title="Refresh"
          sx={{ color: '#9ca3af', '&:hover': { color: '#374151' } }}>
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Button size="small" startIcon={<DownloadIcon sx={{ fontSize: 14 }} />} onClick={downloadCSV}
          disabled={filteredTransactions.length === 0}
          sx={{ fontSize: '0.72rem', fontWeight: 700, bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
            borderRadius: '8px', py: '4px', px: 1.25, '&:hover': { bgcolor: '#dcfce7' }, textTransform: 'none', minWidth: 0 }}>
          CSV
        </Button>
        <Button size="small" startIcon={<TableViewIcon sx={{ fontSize: 14 }} />} onClick={downloadExcel}
          disabled={filteredTransactions.length === 0}
          sx={{ fontSize: '0.72rem', fontWeight: 700, bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
            borderRadius: '8px', py: '4px', px: 1.25, '&:hover': { bgcolor: '#dbeafe' }, textTransform: 'none', minWidth: 0 }}>
          Excel
        </Button>
      </Box>
    </Box>
  );

  // ── Reusable date filter sub-form ──
  const DateFilterForm = () => (
    <>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel>Date Range</InputLabel>
        <Select value={dateFilter} onChange={handleDateFilterChange} label="Date Range">
          <MenuItem value="all">All time</MenuItem>
          <MenuItem value="today">Today</MenuItem>
          <MenuItem value="yesterday">Yesterday</MenuItem>
          <MenuItem value="thisWeek">This Week</MenuItem>
          <MenuItem value="lastWeek">Last Week</MenuItem>
          <MenuItem value="custom">Custom range…</MenuItem>
        </Select>
      </FormControl>
      {dateFilter === 'custom' && (
        <Grid container spacing={1.5}>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="From" type="date" value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="To" type="date" value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          </Grid>
        </Grid>
      )}
    </>
  );

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8f9fb', pb: 10 }}>

      {/* ── Sticky Header ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 10,
        bgcolor: '#fff', borderBottom: '1px solid #e8ecf0',
        px: 2, py: 1.25,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon sx={{ fontSize: 20, color: '#1d4ed8' }} />
          <Typography fontWeight="800" sx={{ fontSize: '1rem', letterSpacing: '-0.2px', color: '#1a1a2e' }}>
            Reports
          </Typography>
        </Box>
        {selectedLedgerData && (
          <Chip
            icon={<BookIcon sx={{ fontSize: '14px !important' }} />}
            label={selectedLedgerData.name}
            size="small"
            sx={{
              fontWeight: 600, fontSize: '0.7rem',
              bgcolor: selectedLedgerData.status === 'open' ? '#eff6ff' : '#f9fafb',
              color: selectedLedgerData.status === 'open' ? '#1d4ed8' : '#6b7280',
              border: `1px solid ${selectedLedgerData.status === 'open' ? '#bfdbfe' : '#e5e7eb'}`
            }}
          />
        )}
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>

        {/* ── Ledger Selector ── */}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Select Ledger</InputLabel>
          <Select value={selectedLedger} onChange={handleLedgerChange} label="Select Ledger"
            disabled={ledgerLoading} sx={{ bgcolor: '#fff', borderRadius: 2 }}>
            {ledgers.map((ledger) => (
              <MenuItem key={ledger.id} value={ledger.id}
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="body2" fontWeight="600" sx={{ flex: 1 }}>{ledger.name}</Typography>
                <Chip label={ledger.status === 'open' ? 'Open' : 'Closed'} size="small"
                  sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700,
                    bgcolor: ledger.status === 'open' ? '#eff6ff' : '#f9fafb',
                    color: ledger.status === 'open' ? '#1d4ed8' : '#6b7280' }} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {!ledgerLoading && ledgers.length === 0 && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            No ledgers found. Please create a ledger from the Ledger page.
          </Alert>
        )}

        {selectedLedger && selectedLedgerData && (
          <>
            {/* ── Summary Cards 2×2 ── */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              {[
                { label: 'Income', value: formatCurrency(summary.income), color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: <TrendingUpIcon sx={{ fontSize: 16, color: '#16a34a' }} /> },
                { label: 'Expenses', value: formatCurrency(summary.expenses), color: '#dc2626', bg: '#fff5f5', border: '#fecaca', icon: <TrendingDownIcon sx={{ fontSize: 16, color: '#dc2626' }} /> },
                { label: 'Investment', value: formatCurrency(summary.investment), color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4', icon: <SavingsIcon sx={{ fontSize: 16, color: '#0f766e' }} /> },
                { label: 'Records', value: `${summary.count}`, color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: <AssessmentIcon sx={{ fontSize: 16, color: '#1d4ed8' }} /> },
              ].map(({ label, value, color, bg, border, icon }) => (
                <Grid item xs={6} key={label}>
                  <Box sx={{ bgcolor: bg, border: `1.5px solid ${border}`, borderRadius: '12px', p: '10px 12px', height: '68px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {icon}
                      <Typography sx={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>{label}</Typography>
                    </Box>
                    <Typography fontWeight="800" sx={{ fontSize: '0.95rem', color, letterSpacing: '-0.3px' }}>
                      {value}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>

            {/* ── Filter Card ── */}
            <Box sx={{ bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
              {/* Tab strip */}
              <Box sx={{ display: 'flex', borderBottom: '1px solid #f0f0f0', bgcolor: '#fafafa' }}>
                {[
                  { index: 0, icon: <SavingsIcon sx={{ fontSize: 15 }} />, label: 'Account' },
                  { index: 1, icon: <TodayIcon sx={{ fontSize: 15 }} />, label: 'Date' },
                  { index: 2, icon: <CategoryIcon sx={{ fontSize: 15 }} />, label: 'Category' },
                  { index: 3, icon: <PaymentIcon sx={{ fontSize: 15 }} />, label: 'Payment' },
                ].map(({ index, icon, label }) => (
                  <Box key={index} onClick={() => handleTabChange(null, index)} sx={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                    py: '10px', cursor: 'pointer',
                    borderBottom: tabValue === index ? '2px solid #1d4ed8' : '2px solid transparent',
                    bgcolor: tabValue === index ? '#fff' : 'transparent',
                    transition: 'all 0.15s',
                    color: tabValue === index ? '#1d4ed8' : '#9ca3af',
                  }}>
                    {icon}
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: tabValue === index ? 700 : 500, lineHeight: 1 }}>{label}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Filter controls for active tab */}
              <Box sx={{ p: 1.5, pt: 1.25 }}>
                {tabValue === 0 && (
                  <>
                    <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                      <InputLabel>Bank Account</InputLabel>
                      <Select value={selectedBankAccount} onChange={handleBankAccountChange} label="Bank Account">
                        <MenuItem value="all">All Accounts</MenuItem>
                        {(selectedLedgerData?.accountBalances || []).filter(a => a.accountId).map((account) => (
                          <MenuItem key={account.accountId} value={account.accountId}>
                            {account.accountName || account.accountId}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <DateFilterForm />
                  </>
                )}
                {tabValue === 1 && <DateFilterForm />}
                {tabValue === 2 && (
                  <>
                    <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
                      <InputLabel>Expense Category</InputLabel>
                      <Select value={selectedExpenseHead} onChange={handleExpenseHeadChange} label="Expense Category">
                        <MenuItem value="all">All Categories</MenuItem>
                        {expenseHeads.map((head) => <MenuItem key={head} value={head}>{head}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <DateFilterForm />
                  </>
                )}
                {tabValue === 3 && (
                  <>
                    <DateFilterForm />
                    <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
                      <InputLabel>Payment Mode</InputLabel>
                      <Select value={selectedPaymentMode} onChange={handlePaymentModeChange} label="Payment Mode">
                        <MenuItem value="all">All Modes</MenuItem>
                        {paymentModes.map((mode) => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </>
                )}
              </Box>
            </Box>

            {/* ── Shared Credit/Debit + Download toolbar ── */}
            <FilterToolbar />

            {/* ── Transaction List ── */}
            {transactionsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                <CircularProgress />
              </Box>
            ) : filteredTransactions.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, bgcolor: '#fff', borderRadius: 2, border: '1px solid #e8ecf0' }}>
                <AssessmentIcon sx={{ fontSize: 40, color: '#d1d5db', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">No transactions for the selected filters</Typography>
              </Box>
            ) : (
              <Box sx={{ bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0', overflow: 'hidden' }}>
                {/* Header row */}
                <Box sx={{ display: 'flex', px: 2, py: 1, bgcolor: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                  <Typography sx={{ flex: '0 0 72px', fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Date</Typography>
                  <Typography sx={{ flex: 1, fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Description</Typography>
                  <Typography sx={{ flex: '0 0 80px', textAlign: 'right', fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Amount</Typography>
                </Box>
                {/* Transaction rows */}
                {filteredTransactions.map((t, idx) => (
                  <Box key={t.id} sx={{
                    display: 'flex', alignItems: 'center', px: 2, py: '10px',
                    borderBottom: idx < filteredTransactions.length - 1 ? '1px solid #f5f5f5' : 'none',
                    '&:hover': { bgcolor: '#fafafa' }, transition: 'background 0.1s'
                  }}>
                    {/* Date */}
                    <Box sx={{ flex: '0 0 72px' }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#374151', fontWeight: 500, lineHeight: 1.3 }}>
                        {t.date ? t.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.62rem', color: '#9ca3af' }}>
                        {t.date ? t.date.getFullYear() : ''}
                      </Typography>
                    </Box>
                    {/* Description + tags */}
                    <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.transactionDesc || t.description || 'N/A'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: '4px', mt: '3px', flexWrap: 'wrap' }}>
                        {t.expenseHead && (
                          <Typography sx={{ fontSize: '0.62rem', color: '#6b7280', bgcolor: '#f3f4f6', px: '6px', py: '1px', borderRadius: '10px' }}>
                            {t.expenseHead}
                          </Typography>
                        )}
                        {t.paymentMode && (
                          <Typography sx={{ fontSize: '0.62rem', color: '#6b7280', bgcolor: '#f3f4f6', px: '6px', py: '1px', borderRadius: '10px' }}>
                            {t.paymentMode}
                          </Typography>
                        )}
                        {t.accountName && (
                          <Typography sx={{ fontSize: '0.62rem', color: '#9ca3af' }}>{t.accountName}</Typography>
                        )}
                      </Box>
                    </Box>
                    {/* Amount */}
                    <Typography fontWeight="700" sx={{
                      flex: '0 0 80px', textAlign: 'right', fontSize: '0.85rem',
                      color: t.type === 'income' ? '#16a34a' : '#dc2626'
                    }}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrencyWithOriginal(t.amount, t.currency, true)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </Box>
      <Footer />
    </Box>
  );
}

export default ReportPage;
