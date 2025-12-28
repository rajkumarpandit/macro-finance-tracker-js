import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  CircularProgress,
  Divider,
  Collapse,
  IconButton,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BookIcon from '@mui/icons-material/Book';
import LockIcon from '@mui/icons-material/Lock';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { convertToINR, formatINR } from '../../utils/currencyUtils';

function LedgerManagement({ showHeader = false }) {
  const { currentUser } = useAuth();
  const [openLedger, setOpenLedger] = useState(null);
  const [allLedgers, setAllLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [viewDetailsDialogOpen, setViewDetailsDialogOpen] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [newLedgerName, setNewLedgerName] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [closingBalance, setClosingBalance] = useState('');
  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [checkedExpenses, setCheckedExpenses] = useState({});
  const [notification, setNotification] = useState({ show: false, message: '', severity: 'success' });
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [ledgerMetrics, setLedgerMetrics] = useState(null);
  const [editableOpeningBalance, setEditableOpeningBalance] = useState('');
  const [editableOpeningDate, setEditableOpeningDate] = useState('');
  
  // Account balances for ledger
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [accountBalances, setAccountBalances] = useState([{ accountId: '', accountName: '', accountType: '', openingBalance: '' }]);

  const fetchTransactionsForLedger = useCallback(async (ledgerId) => {
    try {
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        where('ledgerId', '==', ledgerId)
      );
      const snapshot = await getDocs(transactionsQuery);
      const txns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));
      calculateLedgerMetrics(txns, openLedger);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  }, [currentUser.uid, openLedger]);

  const calculateLedgerMetrics = async (txns, ledger) => {
    // Calculate opening balance from accountBalances or fallback to old field
    let openingBal = 0;
    if (ledger.accountBalances && Array.isArray(ledger.accountBalances)) {
      openingBal = ledger.accountBalances.reduce((total, acc) => {
        return total + (parseFloat(acc.openingBalance) || 0);
      }, 0);
    } else {
      openingBal = parseFloat(ledger.openingBalance || 0);
    }
    
    // Only consider transactions with accountId (non-orphan transactions)
    const validTxns = txns.filter(t => t.accountId);
    
    // Calculate totals from non-orphan transactions only
    const totalIncome = validTxns
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
    
    const totalInvestment = validTxns
      .filter(t => t.expenseHead === 'Investment')
      .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
    
    const upiExpenses = validTxns
      .filter(t => t.type === 'expense' && t.paymentMode === 'UPI')
      .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
    
    const bankTransferExpenses = validTxns
      .filter(t => t.type === 'expense' && t.paymentMode === 'Bank Transfer')
      .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
    
    const creditCardExpenses = validTxns
      .filter(t => t.type === 'expense' && t.paymentMode === 'Credit Card')
      .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
    
    const totalExpenses = validTxns
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
    
    // Calculate per-account closing balances
    const accountClosingBalances = {};
    if (ledger.accountBalances && Array.isArray(ledger.accountBalances)) {
      ledger.accountBalances.forEach(account => {
        const accountId = account.accountId;
        const accountOpening = parseFloat(account.openingBalance) || 0;
        
        // Get transactions for this specific account
        const accountTxns = validTxns.filter(t => t.accountId === accountId);
        
        const accountIncome = accountTxns
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
        
        const accountExpenses = accountTxns
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
        
        accountClosingBalances[accountId] = accountOpening + accountIncome - accountExpenses;
      });
    }
    
    const runningOutflowBankAccount = upiExpenses + bankTransferExpenses;
    const indicativeClosingWithCC = openingBal + totalIncome - totalExpenses;
    const indicativeClosingWithoutCC = openingBal + totalIncome - runningOutflowBankAccount;
    
    setLedgerMetrics({
      totalIncome,
      totalInvestment,
      totalExpenses,
      upiExpenses,
      bankTransferExpenses,
      creditCardExpenses,
      runningOutflowBankAccount,
      indicativeClosingWithCC,
      indicativeClosingWithoutCC,
      accountClosingBalances
    });
  };

  const fetchLedgers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch open ledger
      const openQuery = query(
        collection(db, 'ledgers'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'open'),
        limit(1)
      );
      const openSnapshot = await getDocs(openQuery);
      
      if (!openSnapshot.empty) {
        setOpenLedger({
          id: openSnapshot.docs[0].id,
          ...openSnapshot.docs[0].data()
        });
      } else {
        setOpenLedger(null);
      }

      // Fetch all ledgers
      const allQuery = query(
        collection(db, 'ledgers'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const allSnapshot = await getDocs(allQuery);
      setAllLedgers(allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    } catch (error) {
      console.error('Error fetching ledgers:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchLedgers();
      fetchBankAccounts();
      fetchCreditCards();
    }
  }, [currentUser, fetchLedgers]);

  useEffect(() => {
    if (openLedger) {
      fetchTransactionsForLedger(openLedger.id);
      setEditableOpeningBalance(openLedger.openingBalance || '');
      setEditableOpeningDate(openLedger.startDate?.toDate().toISOString().split('T')[0] || '');
      
      // Load account balances from ledger if they exist
      if (openLedger.accountBalances && openLedger.accountBalances.length > 0) {
        setAccountBalances(openLedger.accountBalances.map(acc => ({
          accountId: acc.accountId,
          accountName: acc.accountName,
          accountType: acc.accountType,
          openingBalance: acc.openingBalance.toString()
        })));
      } else {
        // No account balances exist, preserve old opening balance in first row
        const oldBalance = openLedger.openingBalance || '';
        setAccountBalances([{ accountId: '', accountName: '', accountType: '', openingBalance: oldBalance.toString() }]);
      }
    }
  }, [openLedger, fetchTransactionsForLedger]);

  const fetchRecurringExpenses = async () => {
    try {
      const recurringQuery = query(
        collection(db, 'recurring_expenses'),
        where('userId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(recurringQuery);
      const expenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRecurringExpenses(expenses);
      
      // Initialize checked state
      const checked = {};
      expenses.forEach(expense => {
        checked[expense.id] = false;
      });
      setCheckedExpenses(checked);
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const bankQuery = query(
        collection(db, 'bank_accounts'),
        where('userId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(bankQuery);
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBankAccounts(accounts);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const fetchCreditCards = async () => {
    try {
      const cardQuery = query(
        collection(db, 'credit_cards'),
        where('userId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(cardQuery);
      const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCreditCards(cards);
    } catch (error) {
      console.error('Error fetching credit cards:', error);
    }
  };

  const generateLedgerName = () => {
    const now = new Date();
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = monthNames[now.getMonth()];
    const year = now.getFullYear().toString().slice(-2);
    return `${month}-${year}`;
  };

  const handleStartLedger = async () => {
    setNewLedgerName(generateLedgerName());
    
    // Fetch the most recent closed ledger to get closing balances
    try {
      const closedLedgersQuery = query(
        collection(db, 'ledgers'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'closed'),
        orderBy('closingDate', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(closedLedgersQuery);
      
      if (!snapshot.empty) {
        const lastClosedLedger = snapshot.docs[0].data();
        
        // If previous ledger had account balances, use closing balances as opening balances
        if (lastClosedLedger.accountBalances && lastClosedLedger.accountBalances.length > 0) {
          const previousBalances = lastClosedLedger.accountBalances.map(acc => ({
            accountId: acc.accountId,
            accountName: acc.accountName,
            accountType: acc.accountType,
            openingBalance: acc.closingBalance || '0'
          }));
          setAccountBalances(previousBalances);
        } else {
          // No previous account balances, start fresh
          setAccountBalances([{ accountId: '', accountName: '', accountType: '', openingBalance: '' }]);
        }
        
        setOpeningBalance(lastClosedLedger.closingBalance || '0');
      } else {
        setOpeningBalance('0');
        setAccountBalances([{ accountId: '', accountName: '', accountType: '', openingBalance: '' }]);
      }
    } catch (error) {
      console.error('Error fetching last ledger:', error);
      setOpeningBalance('0');
      setAccountBalances([{ accountId: '', accountName: '', accountType: '', openingBalance: '' }]);
    }
    
    setOpeningDate(new Date().toISOString().split('T')[0]);
    setStartDialogOpen(true);
  };

  const handleCreateLedger = async () => {
    if (!newLedgerName.trim()) {
      setNotification({ show: true, message: 'Ledger name is required', severity: 'error' });
      return;
    }

    // Validate at least one account is selected
    const validAccounts = accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '');
    if (validAccounts.length === 0) {
      setNotification({ show: true, message: 'Please add at least one account with opening balance', severity: 'error' });
      return;
    }

    try {
      // Calculate total opening balance: sum of banks - sum of credit cards
      const totalOpening = validAccounts.reduce((sum, acc) => {
        const balance = parseFloat(acc.openingBalance) || 0;
        if (acc.accountType === 'creditCard') {
          return sum - Math.abs(balance); // Credit cards reduce total (they're debt)
        }
        return sum + balance;
      }, 0);

      // Prepare account balances with initial closing balance same as opening
      const accountBalancesData = validAccounts.map(acc => ({
        accountId: acc.accountId,
        accountName: acc.accountName,
        accountType: acc.accountType,
        openingBalance: parseFloat(acc.openingBalance) || 0,
        closingBalance: parseFloat(acc.openingBalance) || 0 // Initially same as opening
      }));

      await addDoc(collection(db, 'ledgers'), {
        userId: currentUser.uid,
        name: newLedgerName,
        status: 'open',
        createdAt: Timestamp.now(),
        startDate: Timestamp.fromDate(new Date(openingDate)),
        openingBalance: totalOpening,
        closingDate: null,
        closingBalance: null,
        accountBalances: accountBalancesData
      });

      setNotification({ show: true, message: `Ledger "${newLedgerName}" started successfully!`, severity: 'success' });
      setStartDialogOpen(false);
      setOpeningBalance('');
      setNewLedgerName('');
      setAccountBalances([{ accountId: '', accountName: '', accountType: '', openingBalance: '' }]);
      fetchLedgers();
    } catch (error) {
      console.error('Error creating ledger:', error);
      setNotification({ show: true, message: 'Error creating ledger', severity: 'error' });
    }
  };

  const handleAddAccountRow = () => {
    setAccountBalances([...accountBalances, { accountId: '', accountName: '', accountType: '', openingBalance: '' }]);
  };

  const handleRemoveAccountRow = (index) => {
    const newBalances = accountBalances.filter((_, i) => i !== index);
    setAccountBalances(newBalances.length > 0 ? newBalances : [{ accountId: '', accountName: '', accountType: '', openingBalance: '' }]);
  };

  const handleAccountChange = (index, field, value) => {
    const newBalances = [...accountBalances];
    newBalances[index][field] = value;
    
    // If changing account selection, update type and name
    if (field === 'accountId') {
      const allAccounts = [...bankAccounts.map(a => ({ ...a, type: 'bank' })), ...creditCards.map(c => ({ ...c, type: 'creditCard' }))];
      const selected = allAccounts.find(a => a.id === value);
      if (selected) {
        newBalances[index].accountName = selected.accountNickName || selected.nickName;
        newBalances[index].accountType = selected.type;
      }
    }
    
    setAccountBalances(newBalances);
  };

  const handleCloseLedger = async () => {
    await fetchRecurringExpenses();
    
    // Pre-calculate closing balance
    if (ledgerMetrics && openLedger) {
      const calculatedClosingBalance = ledgerMetrics.indicativeClosingWithCC;
      setClosingBalance(calculatedClosingBalance.toFixed(2));
    }
    
    setClosingDate(new Date().toISOString().split('T')[0]);
    setCloseDialogOpen(true);
  };

  const handleConfirmCloseLedger = async () => {
    if (!closingBalance || parseFloat(closingBalance) < 0) {
      setNotification({ show: true, message: 'Valid closing balance is required', severity: 'error' });
      return;
    }

    try {
      // Update account balances with calculated closing balances
      const updatedAccountBalances = openLedger.accountBalances?.map(acc => ({
        ...acc,
        closingBalance: ledgerMetrics?.accountClosingBalances?.[acc.accountId] || acc.openingBalance || 0
      })) || [];
      
      // Calculate total closing balance from account balances
      const totalClosing = updatedAccountBalances.reduce((sum, acc) => 
        sum + (acc.closingBalance || 0), 0
      );

      // Close the ledger
      await updateDoc(doc(db, 'ledgers', openLedger.id), {
        status: 'closed',
        closingDate: Timestamp.fromDate(new Date(closingDate)),
        closingBalance: totalClosing,
        accountBalances: updatedAccountBalances
      });

      setNotification({ show: true, message: `Ledger "${openLedger.name}" closed successfully!`, severity: 'success' });
      setCloseDialogOpen(false);
      setClosingBalance('');
      fetchLedgers();
    } catch (error) {
      console.error('Error closing ledger:', error);
      setNotification({ show: true, message: 'Error closing ledger', severity: 'error' });
    }
  };

  const handleUpdateOpeningDetails = async () => {
    if (!openLedger) return;
    
    // Validate at least one account with opening balance
    const validAccounts = accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '');
    if (validAccounts.length === 0) {
      setNotification({ show: true, message: 'Please add at least one account with opening balance', severity: 'error' });
      return;
    }
    
    try {
      // Calculate total opening balance (banks - credit cards)
      const totalOpening = validAccounts.reduce((sum, acc) => {
        const balance = parseFloat(acc.openingBalance) || 0;
        return acc.accountType === 'creditCard' ? sum - Math.abs(balance) : sum + balance;
      }, 0);
      
      // Prepare account balances with closingBalance initialized
      const preparedBalances = validAccounts.map(acc => ({
        accountId: acc.accountId,
        accountName: acc.accountName,
        accountType: acc.accountType,
        openingBalance: parseFloat(acc.openingBalance) || 0,
        closingBalance: parseFloat(acc.openingBalance) || 0 // Initially same as opening
      }));
      
      await updateDoc(doc(db, 'ledgers', openLedger.id), {
        openingBalance: totalOpening,
        accountBalances: preparedBalances,
        startDate: Timestamp.fromDate(new Date(editableOpeningDate))
      });
      
      setNotification({ show: true, message: 'Opening details updated successfully!', severity: 'success' });
      fetchLedgers();
    } catch (error) {
      console.error('Error updating opening details:', error);
      setNotification({ show: true, message: 'Error updating opening details', severity: 'error' });
    }
  };

  const handleViewLedgerDetails = async (ledger) => {
    setSelectedLedger(ledger);
    
    // Fetch transactions for this ledger
    try {
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        where('ledgerId', '==', ledger.id)
      );
      const snapshot = await getDocs(transactionsQuery);
      const txns = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));
      
      // Calculate metrics for this ledger
      const totalIncome = txns.filter(t => t.type === 'income').reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
      const totalInvestment = txns.filter(t => t.expenseHead === 'Investment').reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
      const upiExpenses = txns.filter(t => t.type === 'expense' && t.paymentMode === 'UPI').reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
      const bankTransferExpenses = txns.filter(t => t.type === 'expense' && t.paymentMode === 'Bank Transfer').reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
      const creditCardExpenses = txns.filter(t => t.type === 'expense' && t.paymentMode === 'Credit Card').reduce((sum, t) => sum + convertToINR(t.amount, t.currency), 0);
      
      setSelectedLedger({
        ...ledger,
        metrics: {
          totalIncome,
          totalInvestment,
          upiExpenses,
          bankTransferExpenses,
          creditCardExpenses,
          runningOutflowBankAccount: upiExpenses + bankTransferExpenses
        }
      });
    } catch (error) {
      console.error('Error fetching ledger details:', error);
    }
    
    setViewDetailsDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header - Only show when used as standalone page */}
      {showHeader && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <BookIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="700" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Ledger Management
          </Typography>
        </Box>
      )}
      
      {/* Subheading for when used within Admin page */}
      {!showHeader && (
        <Typography variant="h5" fontWeight="700" gutterBottom sx={{ mb: 3 }}>
          Ledger Management
        </Typography>
      )}

      {/* Current Open Ledger */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        {openLedger ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Chip
                icon={<BookIcon />}
                label={openLedger.name}
                color="success"
                sx={{ fontSize: '1rem', fontWeight: 600, px: 2, py: 2.5 }}
              />
              <Typography variant="body2" color="text.secondary">
                Started: {openLedger.startDate?.toDate().toLocaleDateString()}
              </Typography>
            </Box>
            
            {/* Editable Fields */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Opening Date"
                  type="date"
                  value={editableOpeningDate}
                  onChange={(e) => setEditableOpeningDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Account Opening Balances */}
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
              Account Opening Balances
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add all accounts and credit cards with their opening balances. 
              Credit cards should be entered as negative values (debt).
            </Typography>

            {accountBalances.map((account, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
                <FormControl sx={{ width: 280 }} size="small">
                  <InputLabel>Account/Card</InputLabel>
                  <Select
                    value={account.accountId}
                    label="Account/Card"
                    onChange={(e) => handleAccountChange(index, 'accountId', e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Select...</em>
                    </MenuItem>
                    {bankAccounts.length > 0 && [
                      <MenuItem key="bank-header" disabled sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>
                        BANK ACCOUNTS
                      </MenuItem>,
                      ...bankAccounts.map(acc => (
                        <MenuItem key={acc.id} value={acc.id}>
                          {acc.accountNickName}
                        </MenuItem>
                      ))
                    ]}
                    {creditCards.length > 0 && [
                      <MenuItem key="cc-header" disabled sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
                        CREDIT CARDS
                      </MenuItem>,
                      ...creditCards.map(card => (
                        <MenuItem key={card.id} value={card.id}>
                          {card.nickName}
                        </MenuItem>
                      ))
                    ]}
                  </Select>
                </FormControl>

                <TextField
                  sx={{ flex: 1, minWidth: 200 }}
                  label="Opening Balance"
                  type="number"
                  size="small"
                  value={account.openingBalance}
                  onChange={(e) => handleAccountChange(index, 'openingBalance', e.target.value)}
                  placeholder={account.accountType === 'creditCard' ? 'Negative for debt' : '0.00'}
                  inputProps={{ step: '0.01' }}
                />

                <IconButton
                  onClick={() => handleRemoveAccountRow(index)}
                  disabled={accountBalances.length === 1}
                  color="error"
                  size="small"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}

            {accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').length > 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="600">
                  Total Opening Balance: ₹{accountBalances
                    .filter(acc => acc.accountId && acc.openingBalance !== '')
                    .reduce((sum, acc) => {
                      const balance = parseFloat(acc.openingBalance) || 0;
                      return acc.accountType === 'creditCard' ? sum - Math.abs(balance) : sum + balance;
                    }, 0)
                    .toFixed(2)}
                </Typography>
                <Typography variant="caption" display="block">
                  (Bank Accounts - Credit Card Debt)
                </Typography>
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2, mb: 3 }}>
              <IconButton
                onClick={handleAddAccountRow}
                color="primary"
                size="small"
                sx={{ 
                  border: '1px solid',
                  borderColor: 'primary.main',
                  borderRadius: 1
                }}
              >
                <AddIcon />
              </IconButton>
              <Button
                variant="contained"
                size="small"
                onClick={handleUpdateOpeningDetails}
                disabled={!editableOpeningDate || accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').length === 0}
              >
                Save Open Ledger
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Account Closing Balances */}
            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
              Account Closing Balances
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Auto-calculated based on transactions. Only transactions with linked accounts are included.
            </Typography>

            {accountBalances.filter(acc => acc.accountId).map((account, index) => {
              const closingBalance = ledgerMetrics?.accountClosingBalances?.[account.accountId] || parseFloat(account.openingBalance) || 0;
              return (
                <Box key={index} sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center' }}>
                  <TextField
                    sx={{ width: 280 }}
                    label="Account/Card"
                    size="small"
                    value={account.accountName || 'Unknown Account'}
                    disabled
                    InputProps={{
                      readOnly: true,
                    }}
                  />

                  <TextField
                    sx={{ flex: 1, minWidth: 200 }}
                    label="Closing Balance"
                    type="number"
                    size="small"
                    value={closingBalance.toFixed(2)}
                    disabled
                    InputProps={{
                      readOnly: true,
                    }}
                    inputProps={{ step: '0.01' }}
                  />
                </Box>
              );
            })}

            {accountBalances.filter(acc => acc.accountId).length > 0 && ledgerMetrics?.accountClosingBalances && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="600">
                  Total Closing Balance: ₹{Object.values(ledgerMetrics.accountClosingBalances)
                    .reduce((sum, bal) => sum + bal, 0)
                    .toFixed(2)}
                </Typography>
                <Typography variant="caption" display="block">
                  Sum of all account closing balances
                </Typography>
              </Alert>
            )}

            {/* Expandable Calculated Metrics */}
            <Box sx={{ mb: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                endIcon={detailsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setDetailsExpanded(!detailsExpanded)}
                sx={{ justifyContent: 'space-between', textTransform: 'none' }}
              >
                View Calculated Metrics
              </Button>
              <Collapse in={detailsExpanded}>
                {ledgerMetrics && (
                  <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: '#f5f7fa', borderRadius: 1 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">As of Date Income</Typography>
                        <Typography variant="body1" fontWeight="600">{formatINR(ledgerMetrics.totalIncome)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">As of Date Investment</Typography>
                        <Typography variant="body1" fontWeight="600">{formatINR(ledgerMetrics.totalInvestment)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">As of Date Expenses</Typography>
                        <Typography variant="body1" fontWeight="600">{formatINR(ledgerMetrics.totalExpenses)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Running Outflow (Bank Account)</Typography>
                        <Typography variant="body1" fontWeight="600">{formatINR(ledgerMetrics.runningOutflowBankAccount)}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">UPI + Bank Transfer</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Running Outflow (Credit Card)</Typography>
                        <Typography variant="body1" fontWeight="600">{formatINR(ledgerMetrics.creditCardExpenses)}</Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="caption" color="text.secondary">Indicative Closing (with CC)</Typography>
                        <Typography variant="body1" fontWeight="600" color="primary.main">
                          {formatINR(ledgerMetrics.indicativeClosingWithCC)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12}>
                        <Typography variant="caption" color="text.secondary">Indicative Closing (without CC)</Typography>
                        <Typography variant="body1" fontWeight="600" color="secondary.main">
                          {formatINR(ledgerMetrics.indicativeClosingWithoutCC)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                )}
              </Collapse>
            </Box>
            
            <Button
              variant="contained"
              color="error"
              startIcon={<LockIcon />}
              onClick={handleCloseLedger}
              sx={{ textTransform: 'none' }}
            >
              Close Ledger
            </Button>
          </Box>
        ) : (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              No open ledger. Transactions cannot be entered without an active ledger.
            </Alert>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleStartLedger}
              sx={{ textTransform: 'none' }}
            >
              Start New Ledger
            </Button>
          </Box>
        )}
      </Paper>

      {/* Ledger History */}
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight="600" gutterBottom>
          Ledger History
        </Typography>
        
        {allLedgers.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No ledgers found
          </Typography>
        ) : (
          <List>
            {allLedgers.map((ledger) => (
              <React.Fragment key={ledger.id}>
                <ListItem
                  secondaryAction={
                    ledger.status === 'closed' && (
                      <IconButton edge="end" onClick={() => handleViewLedgerDetails(ledger)}>
                        <VisibilityIcon />
                      </IconButton>
                    )
                  }
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography fontWeight="600">{ledger.name}</Typography>
                        <Chip 
                          label={ledger.status} 
                          size="small" 
                          color={ledger.status === 'open' ? 'success' : 'default'}
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" component="span">
                          Started: {ledger.startDate?.toDate().toLocaleDateString()}
                        </Typography>
                        {ledger.openingBalance !== undefined && (
                          <Typography variant="body2" component="span" sx={{ ml: 2 }}>
                            Opening: {formatINR(ledger.openingBalance)}
                          </Typography>
                        )}
                        {ledger.closingDate && (
                          <>
                            <Typography variant="body2" component="span" sx={{ ml: 2 }}>
                              Closed: {ledger.closingDate?.toDate().toLocaleDateString()}
                            </Typography>
                            {ledger.closingBalance !== undefined && (
                              <Typography variant="body2" component="span" sx={{ ml: 2 }}>
                                Closing: {formatINR(ledger.closingBalance)}
                              </Typography>
                            )}
                          </>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Start Ledger Dialog */}
      <Dialog open={startDialogOpen} onClose={() => setStartDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Start New Ledger</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Ledger Name"
            value={newLedgerName}
            onChange={(e) => setNewLedgerName(e.target.value)}
            placeholder="e.g., January 2024"
            margin="normal"
            autoFocus
          />
          <TextField
            fullWidth
            label="Opening Date"
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />

          <Typography variant="subtitle1" sx={{ mt: 3, mb: 2, fontWeight: 600 }}>
            Account Opening Balances
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add all accounts and credit cards with their opening balances. 
            Credit cards should be entered as negative values (debt).
          </Typography>

          {accountBalances.map((account, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
              <FormControl sx={{ flex: 2 }}>
                <InputLabel>Select Account/Card</InputLabel>
                <Select
                  value={account.accountId}
                  label="Select Account/Card"
                  onChange={(e) => handleAccountChange(index, 'accountId', e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select...</em>
                  </MenuItem>
                  {bankAccounts.length > 0 && [
                    <MenuItem key="bank-header" disabled sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary' }}>
                      BANK ACCOUNTS
                    </MenuItem>,
                    ...bankAccounts.map(acc => (
                      <MenuItem key={acc.id} value={acc.id}>
                        {acc.accountNickName}
                      </MenuItem>
                    ))
                  ]}
                  {creditCards.length > 0 && [
                    <MenuItem key="cc-header" disabled sx={{ fontWeight: 600, fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
                      CREDIT CARDS
                    </MenuItem>,
                    ...creditCards.map(card => (
                      <MenuItem key={card.id} value={card.id}>
                        {card.nickName}
                      </MenuItem>
                    ))
                  ]}
                </Select>
              </FormControl>

              <TextField
                sx={{ flex: 1 }}
                label="Opening Balance"
                type="number"
                value={account.openingBalance}
                onChange={(e) => handleAccountChange(index, 'openingBalance', e.target.value)}
                helperText={account.accountType === 'creditCard' ? 'Enter as negative' : ''}
                inputProps={{ step: '0.01' }}
              />

              <IconButton
                onClick={() => handleRemoveAccountRow(index)}
                disabled={accountBalances.length === 1}
                color="error"
                sx={{ mt: 1 }}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={handleAddAccountRow}
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
          >
            Add Another Account
          </Button>

          {accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').length > 0 && (
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2" fontWeight="600">
                Total Opening Balance: ₹{accountBalances
                  .filter(acc => acc.accountId && acc.openingBalance !== '')
                  .reduce((sum, acc) => {
                    const balance = parseFloat(acc.openingBalance) || 0;
                    return acc.accountType === 'creditCard' ? sum - Math.abs(balance) : sum + balance;
                  }, 0)
                  .toFixed(2)}
              </Typography>
              <Typography variant="caption" display="block">
                (Bank Accounts - Credit Card Debt)
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateLedger} variant="contained" disabled={!newLedgerName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Close Ledger Dialog */}
      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Close Ledger</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Closing a ledger will prevent any further transactions from being added to it.
          </Alert>

          {ledgerMetrics && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="600">
                Expense Breakdown:
              </Typography>
              <Grid container spacing={1} sx={{ mb: 2 }}>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>UPI Expenses:</strong> {formatINR(ledgerMetrics.upiExpenses)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>Bank Transfer Expenses:</strong> {formatINR(ledgerMetrics.bankTransferExpenses)}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2">
                    <strong>Credit Card Expenses:</strong> {formatINR(ledgerMetrics.creditCardExpenses)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          <TextField
            fullWidth
            label="Closing Balance"
            type="number"
            value={closingBalance}
            onChange={(e) => setClosingBalance(e.target.value)}
            margin="normal"
            helperText="Pre-filled with calculated balance, editable"
          />
          <TextField
            fullWidth
            label="Closing Date"
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            margin="normal"
          />

          {recurringExpenses.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Verify Recurring Expenses:
              </Typography>
              <FormGroup>
                {recurringExpenses.map((expense) => (
                  <FormControlLabel
                    key={expense.id}
                    control={
                      <Checkbox
                        checked={checkedExpenses[expense.id] || false}
                        onChange={(e) => setCheckedExpenses({
                          ...checkedExpenses,
                          [expense.id]: e.target.checked
                        })}
                      />
                    }
                    label={`${expense.name} - ₹${expense.amount}`}
                  />
                ))}
              </FormGroup>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmCloseLedger} variant="contained" color="error">
            Confirm Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Ledger Details Dialog */}
      <Dialog open={viewDetailsDialogOpen} onClose={() => setViewDetailsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedLedger?.name} - Details
        </DialogTitle>
        <DialogContent>
          {selectedLedger && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Opening Balance</Typography>
                  <Typography variant="body1" fontWeight="600">
                    {formatINR(selectedLedger.openingBalance || 0)}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Opening Date</Typography>
                  <Typography variant="body1" fontWeight="600">
                    {selectedLedger.startDate?.toDate().toLocaleDateString()}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Closing Balance</Typography>
                  <Typography variant="body1" fontWeight="600">
                    {selectedLedger.closingBalance !== undefined ? formatINR(selectedLedger.closingBalance) : 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" color="text.secondary">Closing Date</Typography>
                  <Typography variant="body1" fontWeight="600">
                    {selectedLedger.closingDate ? selectedLedger.closingDate.toDate().toLocaleDateString() : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              {selectedLedger.metrics && (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Calculated Metrics
                  </Typography>
                  <Table size="small">
                    <TableBody>
                      <TableRow>
                        <TableCell><strong>Total Income</strong></TableCell>
                        <TableCell align="right">{formatINR(selectedLedger.metrics.totalIncome)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Total Investment</strong></TableCell>
                        <TableCell align="right">{formatINR(selectedLedger.metrics.totalInvestment)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>UPI Expenses</strong></TableCell>
                        <TableCell align="right">{formatINR(selectedLedger.metrics.upiExpenses)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Bank Transfer Expenses</strong></TableCell>
                        <TableCell align="right">{formatINR(selectedLedger.metrics.bankTransferExpenses)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell><strong>Credit Card Expenses</strong></TableCell>
                        <TableCell align="right">{formatINR(selectedLedger.metrics.creditCardExpenses)}</TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: '#f5f7fa' }}>
                        <TableCell><strong>Running Outflow (Bank Account)</strong></TableCell>
                        <TableCell align="right">{formatINR(selectedLedger.metrics.runningOutflowBankAccount)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Notification */}
      {notification.show && (
        <Alert 
          severity={notification.severity} 
          sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}
          onClose={() => setNotification({ ...notification, show: false })}
        >
          {notification.message}
        </Alert>
      )}
    </Box>
  );
}

export default LedgerManagement;
