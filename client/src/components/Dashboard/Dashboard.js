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
  Chip
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
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', pb: 8 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DashboardIcon sx={{ fontSize: 24, color: '#42a5f5' }} />
            <Typography variant="h6" fontWeight="700" sx={{ fontSize: '1.1rem' }}>
              Dashboard
            </Typography>
          </Box>
          
          {/* Current Ledger Display */}
          {ledgerLoading ? (
            <CircularProgress size={20} />
          ) : currentLedger ? (
            <Chip
              icon={<BookIcon />}
              label={currentLedger.name}
              sx={{
                fontWeight: 600,
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                px: 1,
                bgcolor: '#42a5f5',
                color: '#fff',
                '& .MuiChip-icon': { color: '#fff' }
              }}
            />
          ) : (
            <Chip
              label="No Open Ledger"
              color="error"
              sx={{
                fontWeight: 600,
                fontSize: { xs: '0.75rem', sm: '0.875rem' }
              }}
            />
          )}
        </Box>

        {/* Warning if no ledger */}
        {!ledgerLoading && !currentLedger && (
          <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
            No open ledger found. Please start a new monthly ledger from the Admin page to view dashboard data.
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress size={30} />
          </Box>
        ) : currentLedger ? (
          <>
            {/* Summary Cards */}
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              {/* Opening Balance */}
              <Grid item xs={6} sm={4} md={2}>
                <Card elevation={1} sx={{ borderRadius: 1.5, height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', py: 1, px: 1, '&:last-child': { pb: 1 } }}>
                    <AccountBalanceWalletIcon sx={{ fontSize: 26, color: '#9c27b0', mb: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.65rem' }}>
                      Opening
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#9c27b0" sx={{ fontSize: '0.85rem' }}>
                      {formatCurrency(summary.openingBalance)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Total Income */}
              <Grid item xs={6} sm={4} md={2}>
                <Card elevation={1} sx={{ borderRadius: 1.5, height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', py: 1, px: 1, '&:last-child': { pb: 1 } }}>
                    <TrendingUpIcon sx={{ fontSize: 26, color: '#4caf50', mb: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.65rem' }}>
                      Income
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#4caf50" sx={{ fontSize: '0.85rem' }}>
                      {formatCurrency(summary.income)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Total Expenses */}
              <Grid item xs={6} sm={4} md={2}>
                <Card elevation={1} sx={{ borderRadius: 1.5, height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', py: 1, px: 1, '&:last-child': { pb: 1 } }}>
                    <TrendingDownIcon sx={{ fontSize: 26, color: '#f44336', mb: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.65rem' }}>
                      Expenses
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#f44336" sx={{ fontSize: '0.85rem' }}>
                      {formatCurrency(summary.expenses)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Investment */}
              <Grid item xs={6} sm={4} md={2}>
                <Card elevation={1} sx={{ borderRadius: 1.5, height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', py: 1, px: 1, '&:last-child': { pb: 1 } }}>
                    <SavingsIcon sx={{ fontSize: 26, color: '#2196f3', mb: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.65rem' }}>
                      Investment
                    </Typography>
                    <Typography variant="body2" fontWeight="700" color="#2196f3" sx={{ fontSize: '0.85rem' }}>
                      {formatCurrency(summary.investment)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {/* Closing Balance with CC */}
              <Grid item xs={6} sm={4} md={2}>
                <Card elevation={1} sx={{ borderRadius: 1.5, height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', py: 1, px: 1, '&:last-child': { pb: 1 } }}>
                    <AccountBalanceIcon sx={{ fontSize: 26, color: summary.balanceWithCC >= 0 ? '#4caf50' : '#f44336', mb: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.65rem' }}>
                      Closing (with CC)
                    </Typography>
                    <Typography variant="body1" fontWeight="700" color={summary.balanceWithCC >= 0 ? '#4caf50' : '#f44336'} sx={{ fontSize: '0.9rem' }}>
                      {formatCurrency(summary.balanceWithCC)}
                    </Typography>
                    {summary.accountClosingBalances && summary.accountClosingBalances.length > 0 && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem', mt: 0.25, lineHeight: 1.3 }}>
                        {summary.accountClosingBalances.map((acc, idx) => (
                          <span key={acc.accountId}>
                            {acc.accountName}: {formatCurrency(acc.closingBalance)}
                            {idx < summary.accountClosingBalances.length - 1 ? ' | ' : ''}
                          </span>
                        ))}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Closing Balance without CC */}
              <Grid item xs={6} sm={4} md={2}>
                <Card elevation={1} sx={{ borderRadius: 1.5, height: '100%' }}>
                  <CardContent sx={{ textAlign: 'center', py: 1, px: 1, '&:last-child': { pb: 1 } }}>
                    <AccountBalanceWalletIcon sx={{ fontSize: 26, color: summary.balanceWithoutCC >= 0 ? '#00897b' : '#d32f2f', mb: 0.25 }} />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25, fontSize: '0.65rem' }}>
                      Closing (w/o CC)
                    </Typography>
                    <Typography variant="body1" fontWeight="700" color={summary.balanceWithoutCC >= 0 ? '#00897b' : '#d32f2f'} sx={{ fontSize: '0.9rem' }}>
                      {formatCurrency(summary.balanceWithoutCC)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Expense Breakdown by Head */}
            <Paper elevation={1} sx={{ p: 1.5, borderRadius: 1.5, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <CategoryIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight="600" sx={{ fontSize: '0.85rem' }}>
                  Expense Breakdown
                </Typography>
              </Box>
              
              {expenseByHead.length > 0 ? (
                <Grid container spacing={1}>
                  {expenseByHead.map(({ head, amount }) => (
                    <Grid item xs={6} sm={4} md={3} key={head}>
                      <Box
                        onClick={() => navigate(`/reports?expenseHead=${encodeURIComponent(head)}`)}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: getExpenseHeadColor(head).bg,
                          border: `1px solid ${getExpenseHeadColor(head).text}20`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                            border: `2px solid ${getExpenseHeadColor(head).text}40`
                          }
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mb: 0.25, fontSize: '0.65rem', lineHeight: 1.2 }}
                        >
                          {head}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight="700"
                          sx={{ color: getExpenseHeadColor(head).text, fontSize: '0.8rem' }}
                        >
                          {formatCurrency(amount)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: getExpenseHeadColor(head).text, opacity: 0.7, fontSize: '0.6rem' }}
                        >
                          {((amount / summary.expenses) * 100).toFixed(1)}% of total
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No expense data available
                </Typography>
              )}
            </Paper>

            {/* Income Breakdown by Source */}
            <Paper elevation={1} sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <TrendingUpIcon sx={{ color: 'success.main', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight="600" sx={{ fontSize: '0.85rem' }}>
                  Income Breakdown
                </Typography>
              </Box>
              
              {incomeBySource.length > 0 ? (
                <Grid container spacing={1}>
                  {incomeBySource.map(({ source, amount }) => (
                    <Grid item xs={6} sm={4} md={3} key={source}>
                      <Box
                        onClick={() => navigate(`/reports?type=income&source=${encodeURIComponent(source)}`)}
                        sx={{
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: getIncomeSourceColor(source).bg,
                          border: `1px solid ${getIncomeSourceColor(source).text}20`,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                            border: `2px solid ${getIncomeSourceColor(source).text}40`
                          }
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          display="block"
                          sx={{ mb: 0.25, fontSize: '0.65rem', lineHeight: 1.2 }}
                        >
                          {source}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight="700"
                          sx={{ color: getIncomeSourceColor(source).text, fontSize: '0.8rem' }}
                        >
                          {formatCurrency(amount)}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: getIncomeSourceColor(source).text, opacity: 0.7, fontSize: '0.6rem' }}
                        >
                          {((amount / summary.income) * 100).toFixed(1)}% of total
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No income data available
                </Typography>
              )}
            </Paper>
          </>
        ) : (
          <Paper elevation={1} sx={{ p: 2.5, textAlign: 'center', borderRadius: 1.5 }}>
            <DashboardIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
            <Typography variant="subtitle2" gutterBottom>
              No Data Available
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Start a new ledger to begin tracking your finances
            </Typography>
          </Paper>
        )}
      <Footer />
    </Box>
  );
}

export default React.memo(Dashboard);
