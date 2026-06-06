import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Paper,
  Grid,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  IconButton
} from '@mui/material';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SavingsIcon from '@mui/icons-material/Savings';
import CategoryIcon from '@mui/icons-material/Category';
import BookIcon from '@mui/icons-material/Book';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useAuth } from '../Auth/AuthContext';
import Footer from '../Common/Footer';
import { convertToINR, formatINR, fetchExchangeRates } from '../../utils/currencyUtils';

function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentLedger, setCurrentLedger] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [mfSips, setMfSips] = useState([]);
  const [mfSipsLoading, setMfSipsLoading] = useState(true);
  const [loans, setLoans] = useState([]);
  const [loanEmis, setLoanEmis] = useState([]);
  const [emisLoading, setEmisLoading] = useState(true);
  const [showBalances, setShowBalances] = useState(false);

  // Helper function to mask balance values
  const maskBalance = (value) => {
    if (!showBalances) {
      return '***';
    }
    return value;
  };

  const fetchMfSips = async () => {
    try {
      setMfSipsLoading(true);
      const q = query(collection(db, 'mf_sips'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMfSips(records.sort((a, b) => (a.fundName || '').localeCompare(b.fundName || '')));
    } catch (error) {
      console.error('Error fetching MF SIPs:', error);
    } finally {
      setMfSipsLoading(false);
    }
  };

  const fetchLoansAndEmis = async () => {
    try {
      setEmisLoading(true);
      const [loanSnap, emiSnap] = await Promise.all([
        getDocs(query(collection(db, 'loans'), where('userId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'loan_emis'), where('userId', '==', currentUser.uid)))
      ]);
      setLoans(loanSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoanEmis(emiSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching loan EMIs:', error);
    } finally {
      setEmisLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return formatINR(amount);
  };

  // Fetch current open ledger
  const fetchOpenLedger = async () => {
    try {
      setLedgerLoading(true);
      const ledgerQuery = query(
        collection(db, 'ledgers'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'open'),
        limit(1)
      );
      const ledgerSnapshot = await getDocs(ledgerQuery);
      
      if (!ledgerSnapshot.empty) {
        const ledgerDoc = ledgerSnapshot.docs[0];
        setCurrentLedger({
          id: ledgerDoc.id,
          ...ledgerDoc.data()
        });
        return ledgerDoc.id;
      } else {
        setCurrentLedger(null);
        return null;
      }
    } catch (error) {
      console.error('Error fetching open ledger:', error);
      setCurrentLedger(null);
      return null;
    } finally {
      setLedgerLoading(false);
    }
  };

  // Fetch transactions for current ledger
  const fetchTransactions = async (ledgerId) => {
    if (!ledgerId) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
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
      // Sort by date in frontend to avoid needing composite index
      const sortedData = transactionsData.sort((a, b) => {
        const dateA = a.date || new Date(0);
        const dateB = b.date || new Date(0);
        return dateB - dateA;
      });
      setTransactions(sortedData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      // Load exchange rates first
      fetchExchangeRates().then(() => {
        fetchOpenLedger().then(ledgerId => {
          if (ledgerId) {
            fetchTransactions(ledgerId);
          } else {
            setLoading(false);
          }
        });
      });
      fetchMfSips();
      fetchLoansAndEmis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    // Calculate opening balance from accountBalances array
    // Total = sum(bank accounts) - sum(credit card debts)
    let openingBalance = 0;
    const accountClosingBalances = [];
    const accountClosingBalancesWithoutCC = [];
    
    if (currentLedger?.accountBalances && Array.isArray(currentLedger.accountBalances)) {
      openingBalance = currentLedger.accountBalances.reduce((total, account) => {
        return total + (account.openingBalance || 0);
      }, 0);
      
      // Calculate closing balance for each account
      currentLedger.accountBalances.forEach(account => {
        const accountTxns = transactions.filter(t => t.accountId === account.accountId);
        const accountIncome = accountTxns
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
        const accountExpenses = accountTxns
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
        
        const closingBal = (account.openingBalance || 0) + accountIncome - accountExpenses;
        accountClosingBalances.push({
          accountId: account.accountId,
          accountName: account.accountName,
          accountType: account.accountType,
          closingBalance: closingBal
        });
        
        // For non-credit card accounts only
        if (account.accountType !== 'creditCard') {
          accountClosingBalancesWithoutCC.push({
            accountId: account.accountId,
            accountName: account.accountName,
            accountType: account.accountType,
            closingBalance: closingBal
          });
        }
      });
    } else {
      // Fallback to old single openingBalance field for backward compatibility
      openingBalance = currentLedger?.openingBalance || 0;
    }
    
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
    
    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
    
    const investment = transactions
      .filter(t => t.type === 'expense' && (t.expenseHead === 'Investment' || t.category === 'Investment'))
      .reduce((sum, t) => sum + convertToINR(t.amount || 0, t.currency), 0);
    
    // Balance = Opening Balance + Income - Expenses
    const balance = openingBalance + income - expenses;
    
    // Calculate balanceWithCC (sum of all account closing balances including credit cards)
    const balanceWithCC = accountClosingBalances.reduce((sum, acc) => sum + acc.closingBalance, 0) || balance;
    
    // Calculate balanceWithoutCC (sum of account closing balances excluding credit cards)
    const balanceWithoutCC = accountClosingBalancesWithoutCC.reduce((sum, acc) => sum + acc.closingBalance, 0) || balance;
    
    return { 
      openingBalance, 
      income, 
      expenses, 
      investment, 
      balance, 
      balanceWithCC, 
      balanceWithoutCC, 
      accountClosingBalances, 
      accountClosingBalancesWithoutCC 
    };
  }, [transactions, currentLedger]);

  // Calculate expense breakdown by expense head
  const expenseByHead = useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense');
    const headMap = {};
    
    expenseTransactions.forEach(t => {
      const head = t.expenseHead || 'Other';
      if (!headMap[head]) {
        headMap[head] = 0;
      }
      headMap[head] += convertToINR(t.amount || 0, t.currency);
    });
    
    return Object.entries(headMap)
      .map(([head, amount]) => ({ head, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  // Calculate income breakdown by source
  const incomeBySource = useMemo(() => {
    const incomeTransactions = transactions.filter(t => t.type === 'income');
    const sourceMap = {};
    
    incomeTransactions.forEach(t => {
      const source = t.category || t.description || 'Other Income';
      if (!sourceMap[source]) {
        sourceMap[source] = 0;
      }
      sourceMap[source] += convertToINR(t.amount || 0, t.currency);
    });
    
    return Object.entries(sourceMap)
      .map(([source, amount]) => ({ source, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const getExpenseHeadColor = (head) => {
    const colors = {
      'Household Expenses': { bg: '#e8f5e9', text: '#2e7d32' },
      'Transportation': { bg: '#e3f2fd', text: '#1565c0' },
      'Shopping': { bg: '#fce4ec', text: '#ad1457' },
      'Entertainment': { bg: '#f3e5f5', text: '#6a1b9a' },
      'Bills & Utilities': { bg: '#f5f5f5', text: '#e65100' },
      'Healthcare': { bg: '#ffebee', text: '#c62828' },
      'Education': { bg: '#e1f5fe', text: '#01579b' },
      'Food & Dining': { bg: '#fff8e1', text: '#f57f17' },
      'Investment': { bg: '#e0f2f1', text: '#00695c' },
      'Other': { bg: '#f5f5f5', text: '#616161' }
    };
    return colors[head] || { bg: '#e3f2fd', text: '#1976d2' };
  };

  // Aggregate MF SIPs by nextPremiumDate — only upcoming/today dates
  const sipsByDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const grouped = {};
    mfSips.forEach(sip => {
      if (!sip.nextPremiumDate) return;
      const d = new Date(sip.nextPremiumDate);
      d.setHours(0, 0, 0, 0);
      if (d < today) return; // skip past dates
      const key = sip.nextPremiumDate; // ISO string used as grouping key
      if (!grouped[key]) grouped[key] = { date: d, total: 0, funds: [] };
      grouped[key].total += parseFloat(sip.amount) || 0;
      grouped[key].funds.push(sip.fundName || 'Unknown Fund');
    });
    return Object.values(grouped).sort((a, b) => a.date - b.date);
  }, [mfSips]);

  // Aggregate Loan EMIs by nextEmiDate — only upcoming/today dates
  const emisByDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const grouped = {};
    loanEmis.forEach(emi => {
      if (!emi.nextEmiDate) return;
      const d = new Date(emi.nextEmiDate);
      d.setHours(0, 0, 0, 0);
      if (d < today) return;
      const key = emi.nextEmiDate;
      if (!grouped[key]) grouped[key] = { date: d, total: 0, items: [] };
      grouped[key].total += parseFloat(emi.amount) || 0;
      const loan = loans.find(l => l.id === emi.loanId);
      grouped[key].items.push(loan?.loanNickName || 'Unknown Loan');
    });
    return Object.values(grouped).sort((a, b) => a.date - b.date);
  }, [loanEmis, loans]);

  const getIncomeSourceColor = (source) => {
    const colors = {
      'Salary': { bg: '#e8f5e9', text: '#2e7d32' },
      'Freelance': { bg: '#e3f2fd', text: '#1565c0' },
      'Business': { bg: '#f5f5f5', text: '#e65100' },
      'Investment Returns': { bg: '#e0f2f1', text: '#00695c' },
      'Rental Income': { bg: '#f3e5f5', text: '#6a1b9a' },
      'Bonus': { bg: '#fce4ec', text: '#ad1457' },
      'Other Income': { bg: '#f5f5f5', text: '#616161' }
    };
    return colors[source] || { bg: '#e8f5e9', text: '#4caf50' };
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f0f4f8', pb: 10 }}>

      {/* Sticky Header */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 10,
        bgcolor: '#fff', borderBottom: '1px solid #e8ecf0',
        px: 2, py: 1.25,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DashboardIcon sx={{ fontSize: 20, color: '#1976d2' }} />
          <Typography fontWeight="800" sx={{ fontSize: '1rem', letterSpacing: '-0.2px' }}>
            Dashboard
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <IconButton
            size="small"
            onClick={() => setShowBalances(!showBalances)}
            sx={{ color: showBalances ? '#1976d2' : '#bdbdbd', transition: 'color 0.2s' }}
            title={showBalances ? 'Hide balances' : 'Show balances'}
          >
            {showBalances ? <VisibilityIcon sx={{ fontSize: 20 }} /> : <VisibilityOffIcon sx={{ fontSize: 20 }} />}
          </IconButton>
          {ledgerLoading ? (
            <CircularProgress size={18} />
          ) : currentLedger ? (
            <Chip
              icon={<BookIcon sx={{ fontSize: '14px !important' }} />}
              label={currentLedger.name}
              size="small"
              sx={{ fontWeight: 600, fontSize: '0.7rem', bgcolor: '#e3f2fd', color: '#1565c0', border: '1px solid #90caf9' }}
            />
          ) : (
            <Chip label="No Ledger" size="small" color="error" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
          )}
        </Box>
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>

        {/* Warning if no ledger */}
        {!ledgerLoading && !currentLedger && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            No open ledger found. Please start a new monthly ledger from the Ledger page.
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
            <CircularProgress />
          </Box>
        ) : currentLedger ? (
          <>
            {/* ── Hero Balance Card ── */}
            {(() => {
              const spentPct = summary.income > 0 ? Math.min((summary.expenses / summary.income) * 100, 100) : 0;
              const savedPct = summary.income > 0 ? Math.max(((summary.income - summary.expenses) / summary.income) * 100, 0) : 0;
              const isHealthy = savedPct >= 20;
              return (
                <Paper elevation={0} sx={{
                  background: 'linear-gradient(135deg, #415846 0%, #568562 50%, #e8eaef 100%)',
                  border: '1px solid #b5b7bb',
                  p: 2, borderRadius: 3, mb: 2, color: '#1a1a2e', overflow: 'hidden', position: 'relative'
                }}>
                  <Box sx={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.6)' }} />
                  <Box sx={{ position: 'absolute', bottom: -28, right: 44, width: 70, height: 70, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.4)' }} />
                  <Typography sx={{ color: '#c3e918', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Net Balance · {currentLedger.name}
                  </Typography>
                  <Typography fontWeight="800" sx={{ mt: 0.25, mb: 0.75, letterSpacing: '-1px', color: '#111827', fontSize: { xs: '1.7rem', sm: '2rem' } }}>
                    {maskBalance(formatCurrency(summary.balanceWithCC))}
                  </Typography>
                  <Chip
                    label={showBalances ? `${savedPct.toFixed(0)}% saved this month` : '***'}
                    size="small"
                    sx={{
                      mb: 1.5,
                      bgcolor: isHealthy ? '#dcfce7' : '#fef9c3',
                      color: isHealthy ? '#166534' : '#854d0e',
                      fontWeight: 700, fontSize: '0.72rem', height: 22,
                      border: `1px solid ${isHealthy ? '#bbf7d0' : '#fde68a'}`
                    }}
                  />
                  {/* Spend progress bar */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography sx={{ color: '#e5e91c', fontSize: '0.72rem', fontWeight: 500 }}>
                        {showBalances ? `Spent ${spentPct.toFixed(0)}% of income` : 'Spent *** of income'}
                      </Typography>
                      <Typography sx={{ color: '#6b7280', fontSize: '0.72rem' }}>
                        {maskBalance(formatCurrency(summary.expenses))} / {maskBalance(formatCurrency(summary.income))}
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#d1d5db', borderRadius: 4, height: 6 }}>
                      <Box sx={{
                        bgcolor: spentPct > 90 ? '#ef4444' : spentPct > 70 ? '#f59e0b' : '#22c55e',
                        height: 6, borderRadius: 4, width: `${spentPct}%`, transition: 'width 0.6s ease'
                      }} />
                    </Box>
                  </Box>
                </Paper>
              );
            })()}

            {/* ── 4 Quick Stats (2×2 on mobile) ── */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              {[
                { label: 'Opening', value: summary.openingBalance, color: '#7b1fa2', icon: <AccountBalanceWalletIcon sx={{ fontSize: 16, color: '#9c27b0' }} /> },
                { label: 'Income', value: summary.income, color: '#2e7d32', icon: <TrendingUpIcon sx={{ fontSize: 16, color: '#43a047' }} /> },
                { label: 'Expenses', value: summary.expenses, color: '#c62828', icon: <TrendingDownIcon sx={{ fontSize: 16, color: '#e53935' }} /> },
                { label: 'Investment', value: summary.investment, color: '#1565c0', icon: <SavingsIcon sx={{ fontSize: 16, color: '#1e88e5' }} /> },
              ].map(({ label, value, color, icon }) => (
                <Grid item xs={6} key={label}>
                  <Card elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf0', bgcolor: '#fff' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                        {icon}
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', fontWeight: 500 }}>
                          {label}
                        </Typography>
                      </Box>
                      <Typography fontWeight="800" sx={{ fontSize: '0.95rem', color, letterSpacing: '-0.3px' }}>
                        {maskBalance(formatCurrency(value))}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* ── Per-Account Closing Balances ── */}
            {summary.accountClosingBalances && summary.accountClosingBalances.length > 0 && (
              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f0f0f0', bgcolor: '#fafafa', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <AccountBalanceIcon sx={{ fontSize: 17, color: '#1976d2' }} />
                  <Typography variant="subtitle2" fontWeight="700" sx={{ fontSize: '0.85rem' }}>Account Balances</Typography>
                </Box>
                {summary.accountClosingBalances.map((acc, idx) => (
                  <Box key={acc.accountId} sx={{
                    px: 2, py: 1.25,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: idx < summary.accountClosingBalances.length - 1 ? '1px solid #f5f5f5' : 'none'
                  }}>
                    <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#555' }}>{acc.accountName}</Typography>
                    <Typography fontWeight="700" sx={{ fontSize: '0.88rem', color: acc.closingBalance >= 0 ? '#2e7d32' : '#c62828' }}>
                      {maskBalance(formatCurrency(acc.closingBalance))}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}

            {/* ── Spending by Category ── */}
            {expenseByHead.length > 0 && (
              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f0f0f0', bgcolor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CategoryIcon sx={{ fontSize: 17, color: '#e53935' }} />
                    <Typography variant="subtitle2" fontWeight="700" sx={{ fontSize: '0.85rem' }}>Spending by Category</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {maskBalance(formatCurrency(summary.expenses))} total
                  </Typography>
                </Box>
                <Box sx={{ px: 2, py: 0.5 }}>
                  {expenseByHead.map(({ head, amount }) => {
                    const pct = summary.expenses > 0 ? (amount / summary.expenses) * 100 : 0;
                    const { text } = getExpenseHeadColor(head);
                    return (
                      <Box key={head} onClick={() => navigate(`/reports?expenseHead=${encodeURIComponent(head)}`)}
                        sx={{ py: 1, cursor: 'pointer', borderBottom: '1px solid #f8f8f8', '&:last-child': { borderBottom: 'none' } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{head}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{pct.toFixed(0)}%</Typography>
                            <Typography fontWeight="700" sx={{ fontSize: '0.85rem', color: text }}>{formatCurrency(amount)}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ bgcolor: '#f0f0f0', borderRadius: 4, height: 5 }}>
                          <Box sx={{ bgcolor: text, height: 5, borderRadius: 4, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            )}

            {/* ── Income Sources ── */}
            {incomeBySource.length > 0 && (
              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f0f0f0', bgcolor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <TrendingUpIcon sx={{ fontSize: 17, color: '#43a047' }} />
                    <Typography variant="subtitle2" fontWeight="700" sx={{ fontSize: '0.85rem' }}>Income Sources</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                    {maskBalance(formatCurrency(summary.income))} total
                  </Typography>
                </Box>
                <Box sx={{ px: 2, py: 0.5 }}>
                  {incomeBySource.map(({ source, amount }) => {
                    const pct = summary.income > 0 ? (amount / summary.income) * 100 : 0;
                    const { text } = getIncomeSourceColor(source);
                    return (
                      <Box key={source} onClick={() => navigate(`/reports?type=income&source=${encodeURIComponent(source)}`)}
                        sx={{ py: 1, cursor: 'pointer', borderBottom: '1px solid #f8f8f8', '&:last-child': { borderBottom: 'none' } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 500 }}>{source}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
                            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{pct.toFixed(0)}%</Typography>
                            <Typography fontWeight="700" sx={{ fontSize: '0.85rem', color: text }}>{formatCurrency(amount)}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ bgcolor: '#f0f0f0', borderRadius: 4, height: 5 }}>
                          <Box sx={{ bgcolor: text, height: 5, borderRadius: 4, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            )}

            {/* ── Upcoming Payments (SIPs + EMIs merged) ── */}
            {(mfSipsLoading || emisLoading || sipsByDate.length > 0 || emisByDate.length > 0) && (
              <Paper elevation={0} sx={{ borderRadius: 2.5, border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
                <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid #f0f0f0', bgcolor: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <ShowChartIcon sx={{ fontSize: 17, color: '#7b1fa2' }} />
                    <Typography variant="subtitle2" fontWeight="700" sx={{ fontSize: '0.85rem' }}>Upcoming Payments</Typography>
                  </Box>
                  {(sipsByDate.length > 0 || emisByDate.length > 0) && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {formatCurrency([...sipsByDate, ...emisByDate].reduce((s, e) => s + e.total, 0))} due
                    </Typography>
                  )}
                </Box>
                {mfSipsLoading || emisLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 2.5 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <Box sx={{ px: 1.5, py: 0.5 }}>
                    {[
                      ...sipsByDate.map(e => ({ ...e, paymentType: 'SIP' })),
                      ...emisByDate.map(e => ({ ...e, paymentType: 'EMI' }))
                    ].sort((a, b) => a.date - b.date).map(({ date, total, funds, items, paymentType }, idx) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isTomorrow = date.toDateString() === new Date(Date.now() + 86400000).toDateString();
                      const urgent = isToday || isTomorrow;
                      const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                      const isSip = paymentType === 'SIP';
                      const names = isSip ? funds : items;
                      const accentColor = isSip ? '#7b1fa2' : '#c2185b';
                      return (
                        <Box key={`${paymentType}-${date.toISOString()}`}
                          onClick={() => navigate('/master-records')}
                          sx={{
                            py: 1.25, px: 0.75,
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            borderBottom: '1px solid #f5f5f5',
                            cursor: 'pointer', borderRadius: 1.5,
                            bgcolor: urgent ? (isSip ? '#f9f0ff' : '#fff0f5') : 'transparent',
                            '&:hover': { bgcolor: isSip ? '#f3e5f5' : '#fce4ec' },
                            transition: 'background 0.15s'
                          }}>
                          {/* Date badge */}
                          <Box sx={{
                            minWidth: 48, textAlign: 'center', bgcolor: urgent ? accentColor : '#eeeeee',
                            borderRadius: 1.5, py: 0.75
                          }}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: urgent ? '#fff' : '#757575', lineHeight: 1.2 }}>
                              {label.includes(' ') ? label.split(' ')[0] : label}
                            </Typography>
                            {label.includes(' ') && (
                              <Typography sx={{ fontSize: '0.62rem', color: urgent ? 'rgba(255,255,255,0.8)' : '#9e9e9e', lineHeight: 1 }}>
                                {label.split(' ')[1]}
                              </Typography>
                            )}
                          </Box>
                          {/* Labels + name */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                              <Chip label={paymentType} size="small" sx={{
                                height: 17, fontSize: '0.62rem', fontWeight: 700,
                                bgcolor: isSip ? '#f3e5f5' : '#fce4ec', color: accentColor
                              }} />
                              {urgent && <Chip label="Due!" size="small" sx={{ height: 17, fontSize: '0.62rem', fontWeight: 700, bgcolor: '#ffcdd2', color: '#b71c1c' }} />}
                            </Box>
                            <Typography sx={{ fontSize: '0.8rem', color: '#444' }} noWrap>
                              {names.length === 1 ? names[0] : `${names.length} ${paymentType}s`}
                            </Typography>
                          </Box>
                          {/* Amount */}
                          <Typography fontWeight="800" sx={{ fontSize: '0.92rem', color: accentColor, whiteSpace: 'nowrap' }}>
                            {formatCurrency(total)}
                          </Typography>
                        </Box>
                      );
                    })}
                    {sipsByDate.length === 0 && emisByDate.length === 0 && (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center', fontSize: '0.8rem' }}>
                        No upcoming SIP or EMI payments
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
            )}

          </>
        ) : (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px solid #e8ecf0' }}>
            <DashboardIcon sx={{ fontSize: 48, color: '#bdbdbd', mb: 1.5 }} />
            <Typography variant="subtitle1" fontWeight="700" gutterBottom>No Ledger Found</Typography>
            <Typography variant="body2" color="text.secondary">
              Start a new ledger to begin tracking your finances
            </Typography>
          </Paper>
        )}
      </Box>
      <Footer />
    </Box>
  );
}

export default React.memo(Dashboard);

