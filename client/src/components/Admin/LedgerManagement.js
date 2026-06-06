import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  CircularProgress,
  Collapse,
  IconButton,
  Grid,
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
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp, limit } from 'firebase/firestore';
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
  const [openingEditable, setOpeningEditable] = useState(false);
  
  // Account balances for ledger
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [accountBalances, setAccountBalances] = useState([{ accountId: '', accountName: '', accountType: '', openingBalance: '' }]);
  const [showBalances, setShowBalances] = useState(false);

  // Helper function to mask balance values
  const maskBalance = (value) => {
    if (!showBalances) {
      return '***';
    }
    return value;
  };

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
    
    console.log('📊 calculateLedgerMetrics - Ledger:', ledger.name);
    console.log('   Opening balance:', openingBal);
    console.log('   Total transactions:', txns.length);
    console.log('   Ledger accountBalances:', ledger.accountBalances);
    
    // Only consider transactions with accountId (non-orphan transactions)
    const validTxns = txns.filter(t => t.accountId);
    console.log('   Valid transactions (with accountId):', validTxns.length);
    console.log('   Valid transactions:', validTxns.map(t => ({ 
      id: t.id, 
      type: t.type, 
      paymentMode: t.paymentMode,
      amount: t.amount,
      accountId: t.accountId,
      accountName: t.accountName
    })));
    
    // Helper function to get INR amount
    // - For INR transactions: always use t.amount directly (stored amountInINR can be stale/wrong for INR)
    // - For foreign currency: use stored amountInINR to preserve the historical exchange rate
    const getINRAmount = (t) => {
      const currency = (t.currency || 'INR').toUpperCase();
      if (currency === 'INR' || currency === 'RUPEES') {
        return parseFloat(t.amount) || 0;
      }
      if (t.amountInINR !== undefined && t.amountInINR !== null) {
        return t.amountInINR;
      }
      return convertToINR(t.amount, t.currency);
    };
    
    // Calculate totals from non-orphan transactions only
    const totalIncome = validTxns
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + getINRAmount(t), 0);
    
    const totalInvestment = validTxns
      .filter(t => t.expenseHead === 'Investment')
      .reduce((sum, t) => sum + getINRAmount(t), 0);
    
    const upiExpenses = validTxns
      .filter(t => t.type === 'expense' && t.paymentMode === 'UPI')
      .reduce((sum, t) => sum + getINRAmount(t), 0);
    
    const bankTransferExpenses = validTxns
      .filter(t => t.type === 'expense' && t.paymentMode === 'Bank Transfer')
      .reduce((sum, t) => sum + getINRAmount(t), 0);
    
    const creditCardExpenses = validTxns
      .filter(t => t.type === 'expense' && t.paymentMode === 'Credit Card')
      .reduce((sum, t) => sum + getINRAmount(t), 0);
    
    const totalExpenses = validTxns
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + getINRAmount(t), 0);
    
    console.log('   Totals - Income:', totalIncome, 'Expenses:', totalExpenses, 'CC Expenses:', creditCardExpenses);
    
    // Calculate per-account closing balances
    const accountClosingBalances = {};
    if (ledger.accountBalances && Array.isArray(ledger.accountBalances)) {
      ledger.accountBalances.forEach(account => {
        const accountId = account.accountId;
        const accountOpening = parseFloat(account.openingBalance) || 0;
        const isCreditCard = account.accountType === 'creditCard';
        
        // Get transactions for this specific account (match by accountId only)
        const accountTxns = validTxns.filter(t => t.accountId === accountId);

        // Calculate income and expenses
        const accountIncome = accountTxns
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + getINRAmount(t), 0);
        
        const accountExpenses = accountTxns
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + getINRAmount(t), 0);
        
        let closingBal;
        if (isCreditCard) {
          // For credit cards: Opening (debt) + Expenses (purchases) - Income (payments)
          closingBal = accountOpening + accountExpenses - accountIncome;
          console.log(`💳 ${account.accountName} (Credit Card):`);
          console.log(`   Opening: ${accountOpening}, Income (Payments): ${accountIncome}, Expenses (Purchases): ${accountExpenses}`);
          console.log(`   Closing = ${accountOpening} + ${accountExpenses} - ${accountIncome} = ${closingBal}`);
        } else {
          // For bank accounts: Opening + Income - Expenses
          closingBal = accountOpening + accountIncome - accountExpenses;
          console.log(`🏦 ${account.accountName} (Bank Account):`);
          console.log(`   Opening: ${accountOpening}, Income: ${accountIncome}, Expenses: ${accountExpenses}`);
          console.log(`   Closing = ${accountOpening} + ${accountIncome} - ${accountExpenses} = ${closingBal}`);
        }
        
        accountClosingBalances[accountId] = closingBal;
      });
    }
    
    const runningOutflowBankAccount = upiExpenses + bankTransferExpenses;
    const indicativeClosingWithCC = openingBal + totalIncome - totalExpenses;
    const indicativeClosingWithoutCC = openingBal + totalIncome - runningOutflowBankAccount;
    
    console.log('📈 Final Ledger Metrics:');
    console.log('   accountClosingBalances:', accountClosingBalances);
    console.log('   indicativeClosingWithCC:', indicativeClosingWithCC);
    console.log('   indicativeClosingWithoutCC:', indicativeClosingWithoutCC);
    
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
        where('userId', '==', currentUser.uid)
      );
      const allSnapshot = await getDocs(allQuery);
      const ledgersList = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by createdAt in frontend to avoid composite index requirement
      ledgersList.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });
      setAllLedgers(ledgersList);
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

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetchLedgers();
      await fetchBankAccounts();
      await fetchCreditCards();
    } finally {
      setLoading(false);
    }
  };

  const handleStartLedger = async () => {
    setNewLedgerName(generateLedgerName());
    
    // Fetch the most recent closed ledger to get closing balances
    // NOTE: Sort in frontend to avoid requiring a composite Firestore index
    try {
      const closedLedgersQuery = query(
        collection(db, 'ledgers'),
        where('userId', '==', currentUser.uid),
        where('status', '==', 'closed')
      );
      const snapshot = await getDocs(closedLedgersQuery);
      
      if (!snapshot.empty) {
        // Sort by closingDate descending in JS (avoids composite index requirement)
        const sortedDocs = snapshot.docs.sort((a, b) => {
          const dateA = a.data().closingDate?.toDate() || new Date(0);
          const dateB = b.data().closingDate?.toDate() || new Date(0);
          return dateB - dateA;
        });
        const lastClosedLedger = sortedDocs[0].data();
        
        // If previous ledger had account balances, use closing balances as opening balances
        if (lastClosedLedger.accountBalances && lastClosedLedger.accountBalances.length > 0) {
          const previousBalances = lastClosedLedger.accountBalances.map(acc => ({
            accountId: acc.accountId,
            accountName: acc.accountName,
            accountType: acc.accountType,
            openingBalance: (parseFloat(acc.closingBalance) || 0).toFixed(2)
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
        closingBalance: ledgerMetrics?.accountClosingBalances?.[acc.accountId] !== undefined 
          ? ledgerMetrics.accountClosingBalances[acc.accountId]
          : (acc.openingBalance || 0)
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 4,
        minHeight: showHeader ? '100vh' : 'auto', bgcolor: showHeader ? '#f8f9fb' : 'transparent' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  // ── Shared account selector options ──
  const AccountOptions = () => (
    <>
      <MenuItem value=""><em>Select…</em></MenuItem>
      {bankAccounts.length > 0 && [
        <MenuItem key="bank-hdr" disabled sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary' }}>BANK ACCOUNTS</MenuItem>,
        ...bankAccounts.map(acc => <MenuItem key={acc.id} value={acc.id}>{acc.accountNickName}</MenuItem>)
      ]}
      {creditCards.length > 0 && [
        <MenuItem key="cc-hdr" disabled sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.secondary', mt: 1 }}>CREDIT CARDS</MenuItem>,
        ...creditCards.map(card => <MenuItem key={card.id} value={card.id}>{card.nickName}</MenuItem>)
      ]}
    </>
  );

  // ── Reusable card section header ──
  const SectionHeader = ({ title, subtitle, action }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, bgcolor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
      <Box>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: '0.62rem', color: '#9ca3af', lineHeight: 1.2 }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Box>
  );

  const mainContent = (
    <Box>
      {/* ── Open Ledger / No Ledger ── */}
      {openLedger ? (
        <Box>
          {/* Ledger hero card */}
          <Box sx={{
            background: 'linear-gradient(135deg, #415846 0%, #568562 50%, #e8eaef 100%)',
            border: '1px solid #b5b7bb',
            borderRadius: '16px', p: '16px 18px', mb: 2,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'relative', overflow: 'hidden'
          }}>
            <Box sx={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.6)' }} />
            <Box sx={{ position: 'absolute', bottom: -28, right: 44, width: 70, height: 70, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.4)' }} />
            <Box sx={{ position: 'relative' }}>
              <Typography sx={{ fontSize: '0.65rem', color: '#c3e918', fontWeight: 600, letterSpacing: '0.8px', mb: '4px', textTransform: 'uppercase' }}>ACTIVE LEDGER</Typography>
              <Typography fontWeight="800" sx={{ fontSize: '1.15rem', color: '#111827', letterSpacing: '-0.3px' }}>{openLedger.name}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(0,0,0,0.55)', mt: '4px' }}>
                Started {openLedger.startDate?.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Typography>
            </Box>
            <Chip label="Open" size="small" sx={{ bgcolor: '#22c55e', color: '#fff', fontWeight: 700, fontSize: '0.7rem', position: 'relative' }} />
          </Box>

          {/* Account Closing Balances */}
          <Box sx={{ bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
            <SectionHeader title="Closing Balances" subtitle="Auto-calculated from transactions" />
            <Box sx={{ p: 1.5 }}>
              {accountBalances.filter(acc => acc.accountId).map((account, index) => {
                const closingBal = ledgerMetrics?.accountClosingBalances?.[account.accountId] !== undefined
                  ? ledgerMetrics.accountClosingBalances[account.accountId]
                  : (parseFloat(account.openingBalance) || 0);
                const isCreditCard = account.accountType === 'creditCard';
                const filtered = accountBalances.filter(acc => acc.accountId);
                return (
                  <Box key={index} sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    py: '10px', borderBottom: index < filtered.length - 1 ? '1px solid #f5f5f5' : 'none'
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: '9px', bgcolor: isCreditCard ? '#fff7ed' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: '0.85rem' }}>{isCreditCard ? '💳' : '🏦'}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.83rem', fontWeight: 600, color: '#111827' }}>{account.accountName}</Typography>
                        <Typography sx={{ fontSize: '0.62rem', color: '#9ca3af' }}>{isCreditCard ? 'Credit Card' : 'Bank Account'}</Typography>
                      </Box>
                    </Box>
                    <Typography fontWeight="700" sx={{ fontSize: '0.92rem', color: isCreditCard ? (closingBal > 0 ? '#dc2626' : '#16a34a') : (closingBal >= 0 ? '#16a34a' : '#dc2626') }}>
                      {maskBalance(`₹${Math.abs(closingBal).toFixed(2)}`)}
                    </Typography>
                  </Box>
                );
              })}
              {accountBalances.filter(acc => acc.accountId).length > 0 && ledgerMetrics?.accountClosingBalances && (
                <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1.5px solid #e8ecf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>Total Closing</Typography>
                  <Typography fontWeight="800" sx={{ fontSize: '1rem', color: '#1d4ed8' }}>
                    {maskBalance(`₹${Object.values(ledgerMetrics.accountClosingBalances).reduce((s, b) => s + b, 0).toFixed(2)}`)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Account Opening Balances */}
          <Box sx={{ bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
            <SectionHeader
              title="Opening Balances"
              subtitle={openingEditable ? 'Edit mode active' : 'Read-only — click ✏ to edit'}
              action={
                <IconButton size="small" onClick={() => setOpeningEditable(!openingEditable)}
                  sx={{ color: openingEditable ? '#1d4ed8' : '#9ca3af', p: '5px' }}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              }
            />
            <Box sx={{ p: 1.5 }}>
              {!openingEditable ? (
                /* ── Read-only: same row style as Closing Balances ── */
                <>
                  {accountBalances.filter(acc => acc.accountId).map((account, index) => {
                    const isCreditCard = account.accountType === 'creditCard';
                    const filtered = accountBalances.filter(acc => acc.accountId);
                    return (
                      <Box key={index} sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        py: '10px', borderBottom: index < filtered.length - 1 ? '1px solid #f5f5f5' : 'none'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 34, height: 34, borderRadius: '9px', bgcolor: isCreditCard ? '#fff7ed' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: '0.85rem' }}>{isCreditCard ? '💳' : '🏦'}</Typography>
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '0.83rem', fontWeight: 600, color: '#111827' }}>{account.accountName || 'Unknown'}</Typography>
                            <Typography sx={{ fontSize: '0.62rem', color: '#9ca3af' }}>{isCreditCard ? 'Credit Card' : 'Bank Account'}</Typography>
                          </Box>
                        </Box>
                        <Typography fontWeight="700" sx={{ fontSize: '0.92rem', color: '#374151' }}>
                          {maskBalance(`₹${(parseFloat(account.openingBalance) || 0).toFixed(2)}`)}
                        </Typography>
                      </Box>
                    );
                  })}
                  {accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').length > 0 && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1.5px solid #e8ecf0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#374151' }}>Total Opening</Typography>
                      <Typography fontWeight="800" sx={{ fontSize: '1rem', color: '#1d4ed8' }}>
                        {maskBalance(`₹${accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').reduce((sum, acc) => {
                          const bal = parseFloat(acc.openingBalance) || 0;
                          return acc.accountType === 'creditCard' ? sum - Math.abs(bal) : sum + bal;
                        }, 0).toFixed(2)}`)}
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                /* ── Edit mode: form controls ── */
                <>
                  <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Opening Date" type="date" value={editableOpeningDate}
                        onChange={(e) => setEditableOpeningDate(e.target.value)}
                        InputLabelProps={{ shrink: true }} size="small" />
                    </Grid>
                  </Grid>
                  {accountBalances.map((account, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1.5, alignItems: 'center' }}>
                      <FormControl sx={{ flex: 2 }} size="small">
                        <InputLabel>Account / Card</InputLabel>
                        <Select value={account.accountId} label="Account / Card"
                          onChange={(e) => handleAccountChange(index, 'accountId', e.target.value)}>
                          <AccountOptions />
                        </Select>
                      </FormControl>
                      <TextField sx={{ flex: 1 }} label="Opening Balance" type="number" size="small"
                        value={account.openingBalance}
                        onChange={(e) => handleAccountChange(index, 'openingBalance', e.target.value)}
                        placeholder={account.accountType === 'creditCard' ? 'Negative for debt' : '0.00'}
                        inputProps={{ step: '0.01' }} />
                      <IconButton onClick={() => handleRemoveAccountRow(index)}
                        disabled={accountBalances.length === 1} color="error" size="small">
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  ))}
                  {accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').length > 0 && (
                    <Box sx={{ mt: 0.5, pt: 1.25, borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>Total Opening</Typography>
                        <Typography sx={{ fontSize: '0.62rem', color: '#9ca3af' }}>Banks − CC Debt</Typography>
                      </Box>
                      <Typography fontWeight="700" sx={{ fontSize: '0.95rem', color: '#374151' }}>
                        ₹{accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').reduce((sum, acc) => {
                          const bal = parseFloat(acc.openingBalance) || 0;
                          return acc.accountType === 'creditCard' ? sum - Math.abs(bal) : sum + bal;
                        }, 0).toFixed(2)}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                    <Button size="small" startIcon={<AddIcon sx={{ fontSize: 14 }} />} onClick={handleAddAccountRow}
                      sx={{ fontSize: '0.72rem', color: '#1d4ed8', textTransform: 'none', p: 0 }}>
                      Add Account
                    </Button>
                    <Button variant="contained" size="small" onClick={handleUpdateOpeningDetails}
                      disabled={!editableOpeningDate || accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').length === 0}
                      sx={{ fontSize: '0.75rem', textTransform: 'none', borderRadius: '8px', px: 2 }}>
                      Save Changes
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </Box>

          {/* Calculated Metrics (collapsible) */}
          <Box sx={{ bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0', mb: 2, overflow: 'hidden' }}>
            <Box onClick={() => setDetailsExpanded(!detailsExpanded)} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 2, py: 1.25, bgcolor: '#fafafa', cursor: 'pointer',
              borderBottom: detailsExpanded ? '1px solid #f0f0f0' : 'none'
            }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Calculated Metrics
              </Typography>
              {detailsExpanded ? <ExpandLessIcon sx={{ fontSize: 18, color: '#9ca3af' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: '#9ca3af' }} />}
            </Box>
            <Collapse in={detailsExpanded}>
              {ledgerMetrics && (
                <Grid container spacing={0} sx={{ p: 0 }}>
                  {[
                    { label: 'Income', value: ledgerMetrics.totalIncome, color: '#16a34a' },
                    { label: 'Investment', value: ledgerMetrics.totalInvestment, color: '#0f766e' },
                    { label: 'Total Expenses', value: ledgerMetrics.totalExpenses, color: '#dc2626' },
                    { label: 'UPI Outflow', value: ledgerMetrics.upiExpenses, color: '#b45309' },
                    { label: 'Bank Transfer', value: ledgerMetrics.bankTransferExpenses, color: '#b45309' },
                    { label: 'Credit Card', value: ledgerMetrics.creditCardExpenses, color: '#7c3aed' },
                    { label: 'Closing (with CC)', value: ledgerMetrics.indicativeClosingWithCC, color: '#1d4ed8' },
                    { label: 'Closing (w/o CC)', value: ledgerMetrics.indicativeClosingWithoutCC, color: '#0891b2' },
                  ].map(({ label, value, color }, idx) => (
                    <Grid item xs={6} key={label}>
                      <Box sx={{ py: '9px', px: 2, borderBottom: idx < 6 ? '1px solid #f5f5f5' : 'none', borderRight: idx % 2 === 0 ? '1px solid #f5f5f5' : 'none' }}>
                        <Typography sx={{ fontSize: '0.62rem', color: '#9ca3af', mb: '2px' }}>{label}</Typography>
                        <Typography fontWeight="700" sx={{ fontSize: '0.88rem', color }}>{formatINR(value)}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Collapse>
          </Box>

          {/* Close Ledger */}
          <Button fullWidth variant="contained" color="error" startIcon={<LockIcon />} onClick={handleCloseLedger}
            sx={{ borderRadius: '12px', py: 1.25, fontWeight: 700, textTransform: 'none', fontSize: '0.9rem', mb: 2 }}>
            Close This Ledger
          </Button>
        </Box>
      ) : (
        /* No active ledger */
        <Box sx={{ textAlign: 'center', bgcolor: '#fff', borderRadius: '16px', border: '1px solid #e8ecf0', p: '28px 20px', mb: 2 }}>
          <BookIcon sx={{ fontSize: 52, color: '#d1d5db', mb: 1.5 }} />
          <Typography fontWeight="800" sx={{ fontSize: '1rem', color: '#374151', mb: '6px' }}>No Active Ledger</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: '#9ca3af', mb: 2.5, maxWidth: 280, mx: 'auto' }}>
            Transactions cannot be entered without an active ledger.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleStartLedger}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 3 }}>
            Start New Ledger
          </Button>
        </Box>
      )}

      {/* ── Ledger History ── */}
      <Box sx={{ bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0', overflow: 'hidden' }}>
        <SectionHeader title="Ledger History" subtitle={`${allLedgers.length} ledger${allLedgers.length !== 1 ? 's' : ''}`} />
        {allLedgers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography sx={{ fontSize: '0.85rem', color: '#9ca3af' }}>No ledgers found</Typography>
          </Box>
        ) : (
          <Box>
            {allLedgers.map((ledger, idx) => (
              <Box key={ledger.id} sx={{
                px: 2, py: 1.5,
                borderBottom: idx < allLedgers.length - 1 ? '1px solid #f5f5f5' : 'none',
                '&:hover': { bgcolor: '#fafafa' }, transition: 'background 0.1s'
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: '4px' }}>
                      <Typography fontWeight="700" sx={{ fontSize: '0.9rem', color: '#111827' }}>{ledger.name}</Typography>
                      <Chip label={ledger.status === 'open' ? 'Open' : 'Closed'} size="small"
                        sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700,
                          bgcolor: ledger.status === 'open' ? '#dcfce7' : '#f3f4f6',
                          color: ledger.status === 'open' ? '#16a34a' : '#6b7280' }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', color: '#6b7280' }}>
                      {ledger.startDate?.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {ledger.closingDate && ` → ${ledger.closingDate.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', ml: 1 }}>
                    {ledger.openingBalance != null && (
                      <Typography sx={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        Open: <span style={{ color: '#374151', fontWeight: 600 }}>{formatINR(ledger.openingBalance)}</span>
                      </Typography>
                    )}
                    {ledger.closingBalance != null && (
                      <Typography sx={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        Close: <span style={{ color: '#16a34a', fontWeight: 600 }}>{formatINR(ledger.closingBalance)}</span>
                      </Typography>
                    )}
                  </Box>
                  {ledger.status === 'closed' && (
                    <IconButton size="small" onClick={() => handleViewLedgerDetails(ledger)}
                      sx={{ color: '#9ca3af', ml: 0.5, p: '4px', '&:hover': { color: '#1d4ed8' } }}>
                      <VisibilityIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Box>
                {/* Account-wise mini rows */}
                {ledger.accountBalances && ledger.accountBalances.filter(acc => acc.accountId).length > 0 && (
                  <Box sx={{ mt: 1, bgcolor: '#f9fafb', borderRadius: '8px', p: '8px 10px' }}>
                    {ledger.accountBalances.filter(acc => acc.accountId).map((acc, i) => (
                      <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: '3px' }}>
                        <Typography sx={{ fontSize: '0.68rem', color: '#6b7280' }}>{acc.accountName || 'Unknown'}</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography sx={{ fontSize: '0.68rem', color: '#9ca3af' }}>{formatINR(parseFloat(acc.openingBalance) || 0)}</Typography>
                          {acc.closingBalance !== undefined && (
                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: '#374151' }}>
                              → {formatINR(parseFloat(acc.closingBalance) || 0)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: showHeader ? '100vh' : 'auto', bgcolor: showHeader ? '#f8f9fb' : 'transparent', pb: showHeader ? 10 : 0 }}>
      {showHeader && (
        /* Sticky header for standalone /ledger page */
        <Box sx={{
          position: 'sticky', top: 0, zIndex: 10,
          bgcolor: '#fff', borderBottom: '1px solid #e8ecf0',
          px: 2, py: 1.25,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BookIcon sx={{ fontSize: 20, color: '#1d4ed8' }} />
            <Typography fontWeight="800" sx={{ fontSize: '1rem', letterSpacing: '-0.2px', color: '#1a1a2e' }}>Ledger</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setShowBalances(!showBalances)}
              sx={{ color: showBalances ? '#1d4ed8' : '#9ca3af' }}>
              {showBalances ? <VisibilityIcon sx={{ fontSize: 18 }} /> : <VisibilityOffIcon sx={{ fontSize: 18 }} />}
            </IconButton>
            <IconButton size="small" onClick={handleRefresh} disabled={loading}
              sx={{ color: '#9ca3af', '&:hover': { color: '#374151' } }}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      {!showHeader && (
        /* Compact header when embedded in Admin page */
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography fontWeight="700" sx={{ fontSize: '0.95rem', color: '#111827' }}>Ledger Management</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={() => setShowBalances(!showBalances)}
              sx={{ color: showBalances ? '#1d4ed8' : '#9ca3af' }}>
              {showBalances ? <VisibilityIcon sx={{ fontSize: 16 }} /> : <VisibilityOffIcon sx={{ fontSize: 16 }} />}
            </IconButton>
            <IconButton size="small" onClick={handleRefresh} disabled={loading} sx={{ color: 'text.secondary' }}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>
      )}

      <Box sx={{ px: showHeader ? 2 : 0, pt: showHeader ? 2 : 0 }}>
        {mainContent}
      </Box>

      {/* ── Start Ledger Dialog ── */}
      <Dialog open={startDialogOpen} onClose={() => setStartDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Start New Ledger</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Ledger Name" value={newLedgerName} onChange={(e) => setNewLedgerName(e.target.value)}
            placeholder="e.g., JUN-26" margin="normal" size="small" autoFocus />
          <TextField fullWidth label="Opening Date" type="date" value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)} InputLabelProps={{ shrink: true }} margin="normal" size="small" />
          <Typography variant="subtitle2" sx={{ mt: 2, mb: 0.75, fontWeight: 700 }}>Account Opening Balances</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8rem' }}>
            Add all accounts and credit cards. Credit cards: enter as negative values (debt).
          </Typography>
          {accountBalances.map((account, index) => (
            <Box key={index} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
              <FormControl sx={{ flex: 2 }} size="small">
                <InputLabel>Account / Card</InputLabel>
                <Select value={account.accountId} label="Account / Card"
                  onChange={(e) => handleAccountChange(index, 'accountId', e.target.value)}>
                  <AccountOptions />
                </Select>
              </FormControl>
              <TextField sx={{ flex: 1 }} label="Opening Balance" type="number" value={account.openingBalance}
                onChange={(e) => handleAccountChange(index, 'openingBalance', e.target.value)}
                helperText={account.accountType === 'creditCard' ? 'Enter as negative' : ''} inputProps={{ step: '0.01' }} size="small" />
              <IconButton onClick={() => handleRemoveAccountRow(index)} disabled={accountBalances.length === 1} color="error" sx={{ mt: 0.5 }}>
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          ))}
          <Button startIcon={<AddIcon />} onClick={handleAddAccountRow} variant="outlined" size="small"
            sx={{ mt: 0.5, textTransform: 'none', borderRadius: '8px' }}>
            Add Another Account
          </Button>
          {accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').length > 0 && (
            <Alert severity="info" sx={{ mt: 2, borderRadius: '10px' }}>
              <Typography variant="body2" fontWeight="700">
                Total: ₹{accountBalances.filter(acc => acc.accountId && acc.openingBalance !== '').reduce((sum, acc) => {
                  const bal = parseFloat(acc.openingBalance) || 0;
                  return acc.accountType === 'creditCard' ? sum - Math.abs(bal) : sum + bal;
                }, 0).toFixed(2)}
              </Typography>
              <Typography variant="caption">Banks − Credit Card Debt</Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStartDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleCreateLedger} variant="contained" disabled={!newLedgerName.trim()}
            sx={{ textTransform: 'none', borderRadius: '8px', px: 2.5 }}>
            Create Ledger
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Close Ledger Dialog ── */}
      <Dialog open={closeDialogOpen} onClose={() => setCloseDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Close Ledger</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
            Closing this ledger will prevent further transactions from being added.
          </Alert>
          {ledgerMetrics && (
            <Box sx={{ bgcolor: '#f9fafb', borderRadius: '10px', p: 1.5, mb: 2 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', mb: 1, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Expense Breakdown</Typography>
              {[
                { label: 'UPI', value: ledgerMetrics.upiExpenses },
                { label: 'Bank Transfer', value: ledgerMetrics.bankTransferExpenses },
                { label: 'Credit Card', value: ledgerMetrics.creditCardExpenses },
              ].map(({ label, value }) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: '4px' }}>
                  <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>{label}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151' }}>{formatINR(value)}</Typography>
                </Box>
              ))}
            </Box>
          )}
          <TextField fullWidth label="Closing Balance" type="number" value={closingBalance}
            onChange={(e) => setClosingBalance(e.target.value)} margin="normal" size="small"
            helperText="Pre-filled with calculated balance, editable" />
          <TextField fullWidth label="Closing Date" type="date" value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)} InputLabelProps={{ shrink: true }} margin="normal" size="small" />
          {recurringExpenses.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="700">Verify Recurring Expenses:</Typography>
              <FormGroup>
                {recurringExpenses.map((expense) => (
                  <FormControlLabel key={expense.id}
                    control={<Checkbox checked={checkedExpenses[expense.id] || false}
                      onChange={(e) => setCheckedExpenses({ ...checkedExpenses, [expense.id]: e.target.checked })} />}
                    label={`${expense.name} - ₹${expense.amount}`} />
                ))}
              </FormGroup>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCloseDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleConfirmCloseLedger} variant="contained" color="error"
            sx={{ textTransform: 'none', borderRadius: '8px', px: 2.5 }}>
            Confirm Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── View Ledger Details Dialog ── */}
      <Dialog open={viewDetailsDialogOpen} onClose={() => setViewDetailsDialogOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>{selectedLedger?.name} — Details</DialogTitle>
        <DialogContent>
          {selectedLedger && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {[
                  { label: 'Opening Balance', value: formatINR(selectedLedger.openingBalance || 0) },
                  { label: 'Opening Date', value: selectedLedger.startDate?.toDate().toLocaleDateString('en-IN') },
                  { label: 'Closing Balance', value: selectedLedger.closingBalance !== undefined ? formatINR(selectedLedger.closingBalance) : 'N/A' },
                  { label: 'Closing Date', value: selectedLedger.closingDate ? selectedLedger.closingDate.toDate().toLocaleDateString('en-IN') : 'N/A' },
                ].map(({ label, value }) => (
                  <Grid item xs={6} key={label}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{label}</Typography>
                    <Typography fontWeight="700" sx={{ fontSize: '0.9rem' }}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
              {selectedLedger.accountBalances && selectedLedger.accountBalances.filter(acc => acc.accountId).length > 0 && (
                <Box sx={{ mb: 2, bgcolor: '#f9fafb', borderRadius: '12px', overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', px: 2, py: '8px', bgcolor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                    <Typography sx={{ flex: 1, fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Account</Typography>
                    <Typography sx={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Opening</Typography>
                    <Typography sx={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Closing</Typography>
                  </Box>
                  {selectedLedger.accountBalances.filter(acc => acc.accountId).map((acc, idx) => (
                    <Box key={idx} sx={{ display: 'flex', px: 2, py: '8px', borderBottom: '1px solid #e5e7eb' }}>
                      <Typography sx={{ flex: 1, fontSize: '0.8rem', color: '#374151' }}>{acc.accountName || 'Unknown'}</Typography>
                      <Typography sx={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.8rem', color: '#374151' }}>{formatINR(parseFloat(acc.openingBalance) || 0)}</Typography>
                      <Typography sx={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 600, color: '#16a34a' }}>
                        {acc.closingBalance !== undefined ? formatINR(parseFloat(acc.closingBalance) || 0) : '—'}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', px: 2, py: '8px', bgcolor: '#eff6ff' }}>
                    <Typography sx={{ flex: 1, fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8' }}>Total</Typography>
                    <Typography sx={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8' }}>
                      {formatINR(selectedLedger.accountBalances.filter(acc => acc.accountId).reduce((s, acc) => s + (parseFloat(acc.openingBalance) || 0), 0))}
                    </Typography>
                    <Typography sx={{ flex: '0 0 90px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8' }}>
                      {selectedLedger.accountBalances.some(acc => acc.closingBalance !== undefined)
                        ? formatINR(selectedLedger.accountBalances.filter(acc => acc.accountId).reduce((s, acc) => s + (parseFloat(acc.closingBalance) || 0), 0))
                        : '—'}
                    </Typography>
                  </Box>
                </Box>
              )}
              {selectedLedger.metrics && (
                <Box sx={{ bgcolor: '#f9fafb', borderRadius: '12px', p: 1.5 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', mb: 1, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Calculated Metrics</Typography>
                  {[
                    { label: 'Total Income', value: selectedLedger.metrics.totalIncome },
                    { label: 'Total Investment', value: selectedLedger.metrics.totalInvestment },
                    { label: 'UPI Expenses', value: selectedLedger.metrics.upiExpenses },
                    { label: 'Bank Transfer', value: selectedLedger.metrics.bankTransferExpenses },
                    { label: 'Credit Card', value: selectedLedger.metrics.creditCardExpenses },
                    { label: 'Outflow (Bank)', value: selectedLedger.metrics.runningOutflowBankAccount },
                  ].map(({ label, value }) => (
                    <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: '5px', borderBottom: '1px solid #f0f0f0' }}>
                      <Typography sx={{ fontSize: '0.78rem', color: '#6b7280' }}>{label}</Typography>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151' }}>{formatINR(value)}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setViewDetailsDialogOpen(false)} variant="outlined"
            sx={{ textTransform: 'none', borderRadius: '8px' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification toast */}
      {notification.show && (
        <Alert severity={notification.severity}
          sx={{ position: 'fixed', bottom: 80, right: 16, left: 16, zIndex: 9999, borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
          onClose={() => setNotification({ ...notification, show: false })}>
          {notification.message}
        </Alert>
      )}
    </Box>
  );
}

export default LedgerManagement;
