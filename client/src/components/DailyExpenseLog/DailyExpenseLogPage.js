import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Snackbar,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, Timestamp, limit } from 'firebase/firestore';
import { parseTransactionWithGemini } from '../../utils/geminiApi';
import { PAYMENT_MODES } from '../../config/constants';
import Footer from '../Common/Footer';
import BookIcon from '@mui/icons-material/Book';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function DailyExpenseLogPage() {
  const { currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [weekTabValue, setWeekTabValue] = useState(0);
  
  // Edit transaction states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  
  // Manual transaction states
  const [manualData, setManualData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Sundry',
    transactionType: 'expense',
    transactionDesc: '',
    expenseHead: '',
    amount: '',
    currency: 'INR',
    paymentMode: 'UPI',
    accountId: '',
    accountName: ''
  });
  const [autoDetecting, setAutoDetecting] = useState(false);
  
  // Income transaction states
  const [incomeData, setIncomeData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'Fixed',
    transactionType: 'income',
    transactionDesc: '',
    expenseHead: 'Salary',
    amount: '',
    currency: 'INR',
    paymentMode: 'UPI',
    accountId: '',
    accountName: ''
  });
  const [incomeAutoDetecting, setIncomeAutoDetecting] = useState(false);
  
  // NLP transaction states (previously One-time)
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [showParsedData, setShowParsedData] = useState(false);
  
  // Recurring expense states
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [selectedRecurringId, setSelectedRecurringId] = useState('');
  const [recurringData, setRecurringData] = useState({
    transactionName: '',
    amount: '',
    currency: 'INR',
    type: 'Others',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'UPI',
    transactionDesc: '',
    expenseHead: '',
    category: 'Recurring',
    accountId: '',
    accountName: ''
  });
  const [recurringAutoDetecting, setRecurringAutoDetecting] = useState(false);
  
  // Common states
  const [transactions, setTransactions] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  // Ledger states
  const [currentLedger, setCurrentLedger] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  
  // Expense Heads
  const [expenseHeads, setExpenseHeads] = useState([]);
  
  // Bank Accounts and Credit Cards
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  
  const paymentTypes = ['Bank Account', 'Cash', 'Credit'];
  const currencies = ['INR', 'USD', 'EUR', 'AUD', 'GBP'];
  const incomeSources = ['Salary', 'Interest-Income', 'Dividend', 'Others'];
  const incomeCategories = ['Fixed', 'NonFixed'];

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
      } else {
        setCurrentLedger(null);
      }
    } catch (error) {
      console.error('Error fetching open ledger:', error);
      setCurrentLedger(null);
    } finally {
      setLedgerLoading(false);
    }
  };

  const fetchRecurringTransactions = async () => {
    try {
      const recurringQuery = query(
        collection(db, 'recurring_expenses'),
        where('userId', '==', currentUser.uid),
        orderBy('transactionName', 'asc')
      );
      const recurringSnapshot = await getDocs(recurringQuery);
      const recurringList = [];
      recurringSnapshot.forEach((doc) => {
        recurringList.push({ id: doc.id, ...doc.data() });
      });
      setRecurringTransactions(recurringList);
    } catch (error) {
      console.error('Error fetching recurring transactions:', error);
    }
  };

  const fetchExpenseHeads = async () => {
    try {
      const expenseHeadsQuery = query(
        collection(db, 'expense_heads'),
        where('userId', '==', currentUser.uid)
      );
      const expenseHeadsSnapshot = await getDocs(expenseHeadsQuery);
      const headsList = [];
      expenseHeadsSnapshot.forEach((doc) => {
        headsList.push(doc.data().name);
      });
      // Sort client-side to avoid composite index requirement
      headsList.sort((a, b) => a.localeCompare(b));
      setExpenseHeads(headsList);
    } catch (error) {
      console.error('Error fetching expense heads:', error);
      setExpenseHeads([]);
    }
  };

  const fetchBankAccounts = async () => {
    try {
      const bankQuery = query(
        collection(db, 'bank_accounts'),
        where('userId', '==', currentUser.uid)
      );
      const bankSnapshot = await getDocs(bankQuery);
      const bankList = [];
      bankSnapshot.forEach((doc) => {
        bankList.push({ id: doc.id, ...doc.data() });
      });
      setBankAccounts(bankList);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      setBankAccounts([]);
    }
  };

  const fetchCreditCards = async () => {
    try {
      const cardQuery = query(
        collection(db, 'credit_cards'),
        where('userId', '==', currentUser.uid)
      );
      const cardSnapshot = await getDocs(cardQuery);
      const cardList = [];
      cardSnapshot.forEach((doc) => {
        cardList.push({ id: doc.id, ...doc.data() });
      });
      setCreditCards(cardList);
    } catch (error) {
      console.error('Error fetching credit cards:', error);
      setCreditCards([]);
    }
  };

  // Calculate week ranges (4 weeks from today going backward)
  const getWeekRanges = () => {
    const weeks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 4; i++) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - (i * 7));
      
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      
      weeks.push({
        start: weekStart,
        end: weekEnd,
        label: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i + 1} Weeks Ago`
      });
    }
    
    return weeks;
  };

  const fetchTransactions = async () => {
    try {
      // Fetch all transactions (both one-time and recurring)
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        orderBy('date', 'desc')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      }));
      setTransactions(transactionsData);
    } catch (error) {
      // Silently handle errors - empty state is perfectly fine
      // Collection might not exist yet or index might be building
      console.log('Transactions not loaded:', error.message);
      setTransactions([]);
    }
  };

  // Helper function to update account balance in ledger after transaction
  const updateAccountBalanceInLedger = async (ledgerId, accountId, amount, transactionType) => {
    try {
      const ledgerRef = doc(db, 'ledgers', ledgerId);
      const ledgerDoc = await getDocs(query(collection(db, 'ledgers'), where('__name__', '==', ledgerId)));
      
      if (!ledgerDoc.empty) {
        const ledgerData = ledgerDoc.docs[0].data();
        const accountBalances = ledgerData.accountBalances || [];
        
        // Find the account in accountBalances array
        const accountIndex = accountBalances.findIndex(ab => ab.accountId === accountId);
        
        if (accountIndex !== -1) {
          // Update the specific account's closing balance
          // For expenses: reduce balance (closingBalance = closingBalance - amount)
          // For income: increase balance (closingBalance = closingBalance + amount)
          const currentClosing = accountBalances[accountIndex].closingBalance || accountBalances[accountIndex].openingBalance || 0;
          
          if (transactionType === 'expense') {
            accountBalances[accountIndex].closingBalance = currentClosing - amount;
          } else if (transactionType === 'income') {
            accountBalances[accountIndex].closingBalance = currentClosing + amount;
          }
          
          // Update the ledger document with modified accountBalances
          await updateDoc(ledgerRef, {
            accountBalances: accountBalances
          });
        }
      }
    } catch (error) {
      console.error('Error updating account balance in ledger:', error);
      // Don't throw error - transaction is already saved, balance update is supplementary
    }
  };

  // Helper function to get available accounts based on payment mode
  const getAvailableAccounts = (paymentMode) => {
    if (paymentMode === 'Cash') {
      return [];
    }
    
    // Filter accounts/cards based on current open ledger's accountBalances
    if (!currentLedger || !currentLedger.accountBalances || currentLedger.accountBalances.length === 0) {
      return [];
    }
    
    const ledgerAccountIds = currentLedger.accountBalances.map(ab => ab.accountId);
    
    if (paymentMode === 'Credit Card') {
      return creditCards.filter(card => ledgerAccountIds.includes(card.id));
    } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(paymentMode)) {
      return bankAccounts.filter(account => ledgerAccountIds.includes(account.id));
    }
    return [];
  };

  // Helper function to check if account dropdown should be shown
  const shouldShowAccountDropdown = (paymentMode) => {
    return paymentMode && paymentMode !== 'Cash';
  };

  useEffect(() => {
    if (currentUser) {
      fetchOpenLedger();
      fetchTransactions();
      fetchRecurringTransactions();
      fetchExpenseHeads();
      fetchBankAccounts();
      fetchCreditCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Auto-select default account when accounts/cards are loaded and payment mode is set
  useEffect(() => {
    if ((bankAccounts.length > 0 || creditCards.length > 0) && currentLedger) {
      // Get account IDs that are part of the current open ledger
      const ledgerAccountIds = currentLedger.accountBalances?.map(ab => ab.accountId) || [];
      
      // Manual tab
      if (manualData.paymentMode && !manualData.accountId) {
        if (manualData.paymentMode === 'Credit Card') {
          const defaultCard = creditCards.find(card => card.isDefault && ledgerAccountIds.includes(card.id));
          if (defaultCard) {
            setManualData(prev => ({
              ...prev,
              accountId: defaultCard.id,
              accountName: defaultCard.nickName
            }));
          }
        } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(manualData.paymentMode)) {
          const defaultBank = bankAccounts.find(bank => bank.isDefault && ledgerAccountIds.includes(bank.id));
          if (defaultBank) {
            setManualData(prev => ({
              ...prev,
              accountId: defaultBank.id,
              accountName: defaultBank.accountNickName
            }));
          }
        }
      }

      // Income tab
      if (incomeData.paymentMode && !incomeData.accountId) {
        if (incomeData.paymentMode === 'Credit Card') {
          const defaultCard = creditCards.find(card => card.isDefault && ledgerAccountIds.includes(card.id));
          if (defaultCard) {
            setIncomeData(prev => ({
              ...prev,
              accountId: defaultCard.id,
              accountName: defaultCard.nickName
            }));
          }
        } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(incomeData.paymentMode)) {
          const defaultBank = bankAccounts.find(bank => bank.isDefault && ledgerAccountIds.includes(bank.id));
          if (defaultBank) {
            setIncomeData(prev => ({
              ...prev,
              accountId: defaultBank.id,
              accountName: defaultBank.accountNickName
            }));
          }
        }
      }

      // Recurring tab
      if (recurringData.paymentMode && !recurringData.accountId) {
        if (recurringData.paymentMode === 'Credit Card') {
          const defaultCard = creditCards.find(card => card.isDefault && ledgerAccountIds.includes(card.id));
          if (defaultCard) {
            setRecurringData(prev => ({
              ...prev,
              accountId: defaultCard.id,
              accountName: defaultCard.nickName
            }));
          }
        } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(recurringData.paymentMode)) {
          const defaultBank = bankAccounts.find(bank => bank.isDefault && ledgerAccountIds.includes(bank.id));
          if (defaultBank) {
            setRecurringData(prev => ({
              ...prev,
              accountId: defaultBank.id,
              accountName: defaultBank.accountNickName
            }));
          }
        }
      }

      // NLP Parsed tab
      if (parsedData?.paymentMode && !parsedData.accountId) {
        if (parsedData.paymentMode === 'Credit Card') {
          const defaultCard = creditCards.find(card => card.isDefault && ledgerAccountIds.includes(card.id));
          if (defaultCard) {
            setParsedData(prev => ({
              ...prev,
              accountId: defaultCard.id,
              accountName: defaultCard.nickName
            }));
          }
        } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(parsedData.paymentMode)) {
          const defaultBank = bankAccounts.find(bank => bank.isDefault && ledgerAccountIds.includes(bank.id));
          if (defaultBank) {
            setParsedData(prev => ({
              ...prev,
              accountId: defaultBank.id,
              accountName: defaultBank.accountNickName
            }));
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccounts, creditCards, currentLedger]);

  const handleParseTransaction = async () => {
    if (!inputText.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a transaction description',
        severity: 'warning'
      });
      return;
    }

    setLoading(true);
    try {
      const parsed = await parseTransactionWithGemini(inputText, currentUser.uid);
      
      // Set payment mode default to UPI and transaction type to Sundry
      parsed.paymentMode = parsed.paymentMode || 'UPI';
      parsed.category = 'Sundry';
      
      // Auto-select default account/card based on payment mode and ledger
      if (currentLedger?.accountBalances) {
        const ledgerAccountIds = currentLedger.accountBalances.map(ab => ab.accountId);
        
        if (parsed.paymentMode === 'Credit Card') {
          const defaultCard = creditCards.find(card => card.isDefault && ledgerAccountIds.includes(card.id));
          if (defaultCard) {
            parsed.accountId = defaultCard.id;
            parsed.accountName = defaultCard.nickName;
          }
        } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(parsed.paymentMode)) {
          const defaultBank = bankAccounts.find(bank => bank.isDefault && ledgerAccountIds.includes(bank.id));
          if (defaultBank) {
            parsed.accountId = defaultBank.id;
            parsed.accountName = defaultBank.accountNickName;
          }
        }
      }
      
      setParsedData(parsed);
      setShowParsedData(true);
    } catch (error) {
      console.error('Error parsing transaction:', error);
      setNotification({
        open: true,
        message: error.message || 'Error parsing transaction. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearParsedData = () => {
    setParsedData(null);
    setShowParsedData(false);
    setInputText('');
  };

  const handleParsedFieldChange = (field, value) => {
    if (field === 'paymentMode') {
      // When payment mode changes, auto-select default account/card
      const newData = { ...parsedData, [field]: value };
      const ledgerAccountIds = currentLedger?.accountBalances?.map(ab => ab.accountId) || [];
      
      if (value === 'Cash') {
        newData.accountId = '';
        newData.accountName = '';
      } else if (value === 'Credit Card') {
        const defaultCard = creditCards.find(card => card.isDefault && ledgerAccountIds.includes(card.id));
        if (defaultCard) {
          newData.accountId = defaultCard.id;
          newData.accountName = defaultCard.nickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(value)) {
        const defaultBank = bankAccounts.find(bank => bank.isDefault && ledgerAccountIds.includes(bank.id));
        if (defaultBank) {
          newData.accountId = defaultBank.id;
          newData.accountName = defaultBank.accountNickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      }
      setParsedData(newData);
    } else {
      setParsedData({ ...parsedData, [field]: value });
    }
  };

  const handleSaveTransaction = async () => {
    if (!parsedData) return;

    // Check if ledger is open
    if (!currentLedger) {
      setNotification({
        open: true,
        message: 'No open ledger found. Please start a new ledger from Admin page.',
        severity: 'error'
      });
      return;
    }

    try {
      // Generate standard description from parsed data
      const descPart = parsedData.transactionDesc || 'Unknown';
      const standardDescription = `${descPart} - ${parsedData.category || 'Sundry'}`;
      
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(parsedData.amount),
        currency: parsedData.currency || 'INR',
        type: parsedData.type || 'expense',
        category: parsedData.category || 'Sundry',
        expenseHead: parsedData.expenseHead || 'Other',
        transactionDesc: parsedData.transactionDesc || '',
        date: parsedData.date ? Timestamp.fromDate(new Date(parsedData.date)) : Timestamp.now(),
        paymentMode: parsedData.paymentMode || 'UPI',
        accountId: parsedData.accountId || '',
        accountName: parsedData.accountName || '',
        description: standardDescription,
        isRecurring: false,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update account balance in ledger if accountId is provided
      if (parsedData.accountId && currentLedger.id) {
        await updateAccountBalanceInLedger(
          currentLedger.id,
          parsedData.accountId,
          parseFloat(parsedData.amount),
          parsedData.type || 'expense'
        );
      }
      
      setNotification({
        open: true,
        message: `${parsedData.type === 'expense' ? 'Expense' : 'Income'} logged successfully!`,
        severity: 'success'
      });
      
      handleClearParsedData();
      setInputText(''); // Clear input text after saving
      fetchTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
      setNotification({
        open: true,
        message: 'Error saving transaction',
        severity: 'error'
      });
    }
  };

  const handleRecurringSelect = (e) => {
    const selectedId = e.target.value;
    setSelectedRecurringId(selectedId);
    
    if (selectedId) {
      const selected = recurringTransactions.find(t => t.id === selectedId);
      if (selected) {
        const paymentMode = selected.usualPaymentMode || 'UPI';
        
        // Get account info from recurring transaction, or fall back to default
        let accountId = selected.accountId || '';
        let accountName = selected.accountName || '';
        
        // If recurring transaction doesn't have account info (legacy data), use default
        if (!accountId && paymentMode !== 'Cash') {
          if (paymentMode === 'Credit Card') {
            const defaultCard = creditCards.find(card => card.isDefault);
            if (defaultCard) {
              accountId = defaultCard.id;
              accountName = defaultCard.nickName;
            }
          } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(paymentMode)) {
            const defaultBank = bankAccounts.find(bank => bank.isDefault);
            if (defaultBank) {
              accountId = defaultBank.id;
              accountName = defaultBank.accountNickName;
            }
          }
        }
        
        setRecurringData({
          transactionName: selected.transactionName,
          amount: selected.amount.toString(),
          currency: selected.currency,
          type: selected.type,
          merchant: selected.merchant,
          date: new Date().toISOString().split('T')[0],
          paymentMode: paymentMode,
          transactionDesc: selected.transactionDesc || '',
          expenseHead: selected.expenseHead || selected.type || 'Other',
          category: selected.category || 'Recurring',
          accountId: accountId,
          accountName: accountName
        });
      }
    } else {
      setRecurringData({
        transactionName: '',
        amount: '',
        currency: 'INR',
        type: 'Others',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'UPI',
        transactionDesc: '',
        expenseHead: '',
        category: 'Recurring',
        accountId: '',
        accountName: ''
      });
    }
  };

  const handleRecurringFieldChange = (field, value) => {
    if (field === 'paymentMode') {
      // When payment mode changes, auto-select default account/card
      const newData = { ...recurringData, [field]: value };
      if (value === 'Cash') {
        newData.accountId = '';
        newData.accountName = '';
      } else if (value === 'Credit Card') {
        const defaultCard = creditCards.find(card => card.isDefault);
        if (defaultCard) {
          newData.accountId = defaultCard.id;
          newData.accountName = defaultCard.nickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(value)) {
        const defaultBank = bankAccounts.find(bank => bank.isDefault);
        if (defaultBank) {
          newData.accountId = defaultBank.id;
          newData.accountName = defaultBank.accountNickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      }
      setRecurringData(newData);
    } else {
      setRecurringData({ ...recurringData, [field]: value });
    }
  };

  const handleRecurringAutoDetectExpenseHead = async () => {
    if (!recurringData.transactionDesc?.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a transaction description first',
        severity: 'warning'
      });
      return;
    }

    setRecurringAutoDetecting(true);
    try {
      // Create a temporary description with a dummy amount for parsing
      const tempDesc = `I spent 1 rupee on ${recurringData.transactionDesc}`;
      const parsed = await parseTransactionWithGemini(tempDesc, currentUser.uid);
      setRecurringData({
        ...recurringData,
        expenseHead: parsed.expenseHead || 'Other'
      });
      setNotification({
        open: true,
        message: 'Expense head detected successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error auto-detecting expense head:', error);
      setNotification({
        open: true,
        message: 'Error detecting expense head. Please enter manually.',
        severity: 'error'
      });
    } finally {
      setRecurringAutoDetecting(false);
    }
  };

  const handleSaveRecurringExpense = async () => {
    if (!currentLedger) {
      setNotification({
        open: true,
        message: 'Cannot save transaction. Please create an open ledger first!',
        severity: 'error'
      });
      return;
    }

    if (!selectedRecurringId || !recurringData.amount || parseFloat(recurringData.amount) <= 0) {
      setNotification({
        open: true,
        message: 'Please select a recurring transaction and enter a valid amount',
        severity: 'error'
      });
      return;
    }

    try {
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(recurringData.amount),
        currency: recurringData.currency,
        type: 'expense',
        category: recurringData.category || 'Recurring',
        expenseHead: recurringData.expenseHead || recurringData.type,
        transactionDesc: recurringData.transactionDesc || recurringData.merchant,
        date: Timestamp.fromDate(new Date(recurringData.date)),
        paymentMode: recurringData.paymentMode,
        accountId: recurringData.accountId || '',
        accountName: recurringData.accountName || '',
        description: recurringData.transactionName,
        isRecurring: true,
        recurringTemplateId: selectedRecurringId,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update account balance in ledger if accountId is provided
      if (recurringData.accountId && currentLedger.id) {
        await updateAccountBalanceInLedger(
          currentLedger.id,
          recurringData.accountId,
          parseFloat(recurringData.amount),
          'expense'
        );
      }
      
      setNotification({
        open: true,
        message: 'Recurring transaction saved successfully!',
        severity: 'success'
      });

      // Reset form
      setSelectedRecurringId('');
      setRecurringData({
        transactionName: '',
        amount: '',
        currency: 'INR',
        type: 'Others',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'UPI',
        transactionDesc: '',
        expenseHead: '',
        category: 'Recurring'
      });

      // Refresh transactions
      fetchTransactions();
    } catch (error) {
      console.error('Error saving recurring expense:', error);
      setNotification({
        open: true,
        message: 'Failed to save recurring transaction',
        severity: 'error'
      });
    }
  };

  // Manual tab handlers
  const handleManualFieldChange = (field, value) => {
    if (field === 'paymentMode') {
      // When payment mode changes, auto-select default account/card
      const newData = { ...manualData, [field]: value };
      if (value === 'Cash') {
        newData.accountId = '';
        newData.accountName = '';
      } else if (value === 'Credit Card') {
        const defaultCard = creditCards.find(card => card.isDefault);
        if (defaultCard) {
          newData.accountId = defaultCard.id;
          newData.accountName = defaultCard.nickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(value)) {
        const defaultBank = bankAccounts.find(bank => bank.isDefault);
        if (defaultBank) {
          newData.accountId = defaultBank.id;
          newData.accountName = defaultBank.accountNickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      }
      setManualData(newData);
    } else {
      setManualData({ ...manualData, [field]: value });
    }
  };

  const handleAutoDetectExpenseHead = async () => {
    if (!manualData.transactionDesc?.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a transaction description first',
        severity: 'warning'
      });
      return;
    }

    setAutoDetecting(true);
    try {
      // Create a temporary description with a dummy amount for parsing
      const tempDesc = `I spent 1 rupee on ${manualData.transactionDesc}`;
      const parsed = await parseTransactionWithGemini(tempDesc, currentUser.uid);
      setManualData({
        ...manualData,
        expenseHead: parsed.expenseHead || 'Other'
      });
      setNotification({
        open: true,
        message: 'Expense head detected successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error auto-detecting expense head:', error);
      setNotification({
        open: true,
        message: 'Error detecting expense head. Please enter manually.',
        severity: 'error'
      });
    } finally {
      setAutoDetecting(false);
    }
  };

  const handleResetManualForm = () => {
    setManualData({
      date: new Date().toISOString().split('T')[0],
      category: 'Sundry',
      transactionType: 'expense',
      transactionDesc: '',
      expenseHead: '',
      amount: '',
      currency: 'INR',
      paymentMode: 'UPI'
    });
  };

  const handleSaveManualTransaction = async () => {
    if (!currentLedger) {
      setNotification({
        open: true,
        message: 'No open ledger found. Please start a new ledger from Admin page.',
        severity: 'error'
      });
      return;
    }

    if (!manualData.amount || parseFloat(manualData.amount) <= 0) {
      setNotification({
        open: true,
        message: 'Please enter a valid amount',
        severity: 'error'
      });
      return;
    }

    if (!manualData.transactionDesc?.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a transaction description',
        severity: 'error'
      });
      return;
    }

    try {
      const descPart = manualData.transactionDesc || 'Unknown';
      const standardDescription = `${descPart} - ${manualData.category}`;
      
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(manualData.amount),
        currency: manualData.currency,
        type: manualData.transactionType,
        category: manualData.category,
        expenseHead: manualData.expenseHead || 'Other',
        transactionDesc: manualData.transactionDesc,
        date: Timestamp.fromDate(new Date(manualData.date)),
        paymentMode: manualData.paymentMode,
        accountId: manualData.accountId || '',
        accountName: manualData.accountName || '',
        description: standardDescription,
        isRecurring: false,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update account balance in ledger if accountId is provided
      if (manualData.accountId && currentLedger.id) {
        await updateAccountBalanceInLedger(
          currentLedger.id,
          manualData.accountId,
          parseFloat(manualData.amount),
          manualData.transactionType
        );
      }
      
      setNotification({
        open: true,
        message: `${manualData.transactionType === 'expense' ? 'Expense' : 'Income'} logged successfully!`,
        severity: 'success'
      });
      
      handleResetManualForm();
      fetchTransactions();
    } catch (error) {
      console.error('Error saving manual transaction:', error);
      setNotification({
        open: true,
        message: 'Error saving transaction',
        severity: 'error'
      });
    }
  };

  // Income tab handlers
  const handleIncomeFieldChange = (field, value) => {
    if (field === 'paymentMode') {
      // When payment mode changes, auto-select default account/card
      const newData = { ...incomeData, [field]: value };
      if (value === 'Cash') {
        newData.accountId = '';
        newData.accountName = '';
      } else if (value === 'Credit Card') {
        const defaultCard = creditCards.find(card => card.isDefault);
        if (defaultCard) {
          newData.accountId = defaultCard.id;
          newData.accountName = defaultCard.nickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(value)) {
        const defaultBank = bankAccounts.find(bank => bank.isDefault);
        if (defaultBank) {
          newData.accountId = defaultBank.id;
          newData.accountName = defaultBank.accountNickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      }
      setIncomeData(newData);
    } else {
      setIncomeData({ ...incomeData, [field]: value });
    }
  };

  const handleIncomeAutoDetectExpenseHead = async () => {
    if (!incomeData.transactionDesc?.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a transaction description first',
        severity: 'warning'
      });
      return;
    }

    setIncomeAutoDetecting(true);
    try {
      const tempDesc = `I received 1 rupee from ${incomeData.transactionDesc}`;
      const parsed = await parseTransactionWithGemini(tempDesc, currentUser.uid);
      // For income, map to income sources
      let detectedSource = 'Others';
      if (parsed.expenseHead) {
        const lowerHead = parsed.expenseHead.toLowerCase();
        if (lowerHead.includes('salary')) detectedSource = 'Salary';
        else if (lowerHead.includes('interest')) detectedSource = 'Interest-Income';
        else if (lowerHead.includes('dividend')) detectedSource = 'Dividend';
      }
      setIncomeData({
        ...incomeData,
        expenseHead: detectedSource
      });
      setNotification({
        open: true,
        message: 'Income source detected successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error auto-detecting income source:', error);
      setNotification({
        open: true,
        message: 'Error detecting income source. Please select manually.',
        severity: 'error'
      });
    } finally {
      setIncomeAutoDetecting(false);
    }
  };

  const handleResetIncomeForm = () => {
    setIncomeData({
      date: new Date().toISOString().split('T')[0],
      category: 'Fixed',
      transactionType: 'income',
      transactionDesc: '',
      expenseHead: 'Salary',
      amount: '',
      currency: 'INR',
      paymentMode: 'UPI'
    });
  };

  const handleSaveIncomeTransaction = async () => {
    if (!currentLedger) {
      setNotification({
        open: true,
        message: 'No open ledger found. Please start a new ledger from Admin page.',
        severity: 'error'
      });
      return;
    }

    if (!incomeData.amount || parseFloat(incomeData.amount) <= 0) {
      setNotification({
        open: true,
        message: 'Please enter a valid amount',
        severity: 'error'
      });
      return;
    }

    if (!incomeData.transactionDesc?.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a transaction description',
        severity: 'error'
      });
      return;
    }

    try {
      const descPart = incomeData.transactionDesc || 'Unknown';
      const standardDescription = `${descPart} - ${incomeData.category}`;
      
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(incomeData.amount),
        currency: incomeData.currency,
        type: 'income',
        category: incomeData.category,
        expenseHead: incomeData.expenseHead,
        transactionDesc: incomeData.transactionDesc,
        date: Timestamp.fromDate(new Date(incomeData.date)),
        paymentMode: incomeData.paymentMode,
        accountId: incomeData.accountId || '',
        accountName: incomeData.accountName || '',
        description: standardDescription,
        isRecurring: false,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update account balance in ledger if accountId is provided
      if (incomeData.accountId && currentLedger.id) {
        await updateAccountBalanceInLedger(
          currentLedger.id,
          incomeData.accountId,
          parseFloat(incomeData.amount),
          'income'
        );
      }
      
      setNotification({
        open: true,
        message: 'Income logged successfully!',
        severity: 'success'
      });
      
      handleResetIncomeForm();
      fetchTransactions();
    } catch (error) {
      console.error('Error saving income transaction:', error);
      setNotification({
        open: true,
        message: 'Error saving transaction',
        severity: 'error'
      });
    }
  };

  const handleDeleteTransaction = async (id) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
      setNotification({
        open: true,
        message: 'Transaction deleted',
        severity: 'success'
      });
      fetchTransactions();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setNotification({
        open: true,
        message: 'Error deleting transaction',
        severity: 'error'
      });
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction({
      id: transaction.id,
      date: transaction.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
      category: transaction.category || 'Sundry',
      type: transaction.type || 'expense',
      description: transaction.description || transaction.transactionDesc || '',
      expenseHead: transaction.expenseHead || '',
      amount: transaction.amount || '',
      currency: transaction.currency || 'INR',
      paymentMode: transaction.paymentMode || 'UPI'
    });
    setEditDialogOpen(true);
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction) return;

    if (!editingTransaction.amount || parseFloat(editingTransaction.amount) <= 0) {
      setNotification({
        open: true,
        message: 'Please enter a valid amount',
        severity: 'warning'
      });
      return;
    }

    try {
      const transactionRef = doc(db, 'transactions', editingTransaction.id);
      await updateDoc(transactionRef, {
        date: Timestamp.fromDate(new Date(editingTransaction.date)),
        category: editingTransaction.category,
        type: editingTransaction.type,
        description: editingTransaction.description,
        transactionDesc: editingTransaction.description,
        expenseHead: editingTransaction.expenseHead,
        amount: parseFloat(editingTransaction.amount),
        currency: editingTransaction.currency,
        paymentMode: editingTransaction.paymentMode,
        updatedAt: Timestamp.now()
      });

      setNotification({
        open: true,
        message: 'Transaction updated successfully',
        severity: 'success'
      });
      setEditDialogOpen(false);
      setEditingTransaction(null);
      fetchTransactions();
    } catch (error) {
      console.error('Error updating transaction:', error);
      setNotification({
        open: true,
        message: 'Error updating transaction',
        severity: 'error'
      });
    }
  };

  const handleEditChange = (field) => (event) => {
    const value = event.target.value;
    
    if (field === 'paymentMode') {
      // When payment mode changes, auto-select default account/card
      const newData = { ...editingTransaction, [field]: value };
      if (value === 'Cash') {
        newData.accountId = '';
        newData.accountName = '';
      } else if (value === 'Credit Card') {
        const defaultCard = creditCards.find(card => card.isDefault);
        if (defaultCard) {
          newData.accountId = defaultCard.id;
          newData.accountName = defaultCard.nickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(value)) {
        const defaultBank = bankAccounts.find(bank => bank.isDefault);
        if (defaultBank) {
          newData.accountId = defaultBank.id;
          newData.accountName = defaultBank.accountNickName;
        } else {
          newData.accountId = '';
          newData.accountName = '';
        }
      }
      setEditingTransaction(newData);
    } else {
      setEditingTransaction({
        ...editingTransaction,
        [field]: value
      });
    }
  };

  const formatCurrency = (amount, currency = 'INR') => {
    if (currency === 'INR' || currency === 'rupees') {
      return `₹${amount.toFixed(2)}`;
    }
    return `${currency} ${amount.toFixed(2)}`;
  };

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header with Ledger Name */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ReceiptLongIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
          <Typography variant="h4" fontWeight="700" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
            Transaction Log
          </Typography>
        </Box>
        
        {/* Current Ledger Display */}
        {ledgerLoading ? (
          <CircularProgress size={20} />
        ) : currentLedger ? (
          <Chip
            icon={<BookIcon />}
            label={currentLedger.name}
            color="primary"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              px: 1
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
        <Alert severity="warning" sx={{ mb: 3 }}>
          No open ledger found. Please start a new monthly ledger from the Admin page before entering transactions.
        </Alert>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid #e0e0e0', mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => {
            setTabValue(newValue);
            handleClearParsedData();
          }}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: { xs: '0.875rem', sm: '1rem' } },
            '& .Mui-selected': { color: '#ff9a56' },
            '& .MuiTabs-indicator': { backgroundColor: '#ff9a56' }
          }}
        >
          <Tab label="Manual" />
          <Tab label="NLP" />
          <Tab label="Recurring" />
          <Tab label="Income" />
        </Tabs>

        {/* MANUAL TRANSACTION TAB */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 } }}>
            <Grid container spacing={2}>
              {/* Row 1: Date and Category */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={manualData.date}
                  onChange={(e) => handleManualFieldChange('date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#ff9a56' },
                      '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Category"
                  value="Sundry"
                  disabled
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#f5f5f5'
                    }
                  }}
                />
              </Grid>

              {/* Row 2: Transaction Type */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Transaction Type"
                  value="Expense"
                  disabled
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#f5f5f5'
                    }
                  }}
                />
              </Grid>

              {/* Row 3: Transaction Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Transaction Description"
                  value={manualData.transactionDesc}
                  onChange={(e) => handleManualFieldChange('transactionDesc', e.target.value)}
                  placeholder="e.g., Bought groceries from BigMarket"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#ff9a56' },
                      '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                    }
                  }}
                />
              </Grid>

              {/* Row 4: Expense Head */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Expense Head</InputLabel>
                  <Select
                    value={manualData.expenseHead}
                    label="Expense Head"
                    onChange={(e) => handleManualFieldChange('expenseHead', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    <MenuItem value="">
                      <em>Select Expense Head</em>
                    </MenuItem>
                    {expenseHeads.map(head => (
                      <MenuItem key={head} value={head}>{head}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 5: Amount and Currency */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={manualData.amount}
                  onChange={(e) => handleManualFieldChange('amount', e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#ff9a56' },
                      '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={manualData.currency}
                    label="Currency"
                    onChange={(e) => handleManualFieldChange('currency', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    {currencies.map(curr => (
                      <MenuItem key={curr} value={curr}>{curr}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 6: Payment Mode */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={manualData.paymentMode}
                    label="Payment Mode"
                    onChange={(e) => handleManualFieldChange('paymentMode', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    {PAYMENT_MODES.map(mode => (
                      <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Bank Account / Credit Card Dropdown */}
              {shouldShowAccountDropdown(manualData.paymentMode) && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>
                      {manualData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                    </InputLabel>
                    <Select
                      value={manualData.accountId}
                      label={manualData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const accounts = getAvailableAccounts(manualData.paymentMode);
                        const selected = accounts.find(acc => acc.id === selectedId);
                        handleManualFieldChange('accountId', selectedId);
                        handleManualFieldChange('accountName', selected ? (selected.accountNickName || selected.nickName) : '');
                      }}
                      sx={{
                        borderRadius: 2,
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                      }}
                    >
                      <MenuItem value="">
                        <em>None (Optional)</em>
                      </MenuItem>
                      {getAvailableAccounts(manualData.paymentMode).map(account => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.accountNickName || account.nickName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSaveManualTransaction}
                    sx={{
                      background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #ff9a56 0%, #ff6f00 100%)',
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleResetManualForm}
                    sx={{
                      py: 1.5,
                      px: 4,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderColor: '#ff9a56',
                      color: '#ff9a56',
                      minWidth: '120px',
                      '&:hover': {
                        borderColor: '#ff6f00',
                        bgcolor: '#fff3e0'
                      }
                    }}
                  >
                    Reset
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>

        {/* NLP TRANSACTION TAB (previously ONE-TIME) */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 } }}>
            {/* Input Text Field */}
            {!showParsedData ? (
              <>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder='Example: "I spent 100 rupees on Uber and paid using UPI"'
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                  sx={{
                    mb: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#ff9a56' },
                      '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                    }
                  }}
                />
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    endIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                    onClick={handleParseTransaction}
                    disabled={loading || !inputText.trim()}
                    fullWidth
                    sx={{
                      background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #ff9a56 0%, #ff6f00 100%)',
                      }
                    }}
                  >
                    {loading ? 'Parsing...' : 'Parse'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setInputText('')}
                    disabled={loading || !inputText.trim()}
                    sx={{
                      py: 1.5,
                      px: 3,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderColor: '#ff9a56',
                      color: '#ff9a56',
                      minWidth: '100px',
                      '&:hover': {
                        borderColor: '#ff6f00',
                        bgcolor: '#fff3e0'
                      }
                    }}
                  >
                    Clear
                  </Button>
                </Box>
              </>
            ) : (
              <>
                {/* Parsed Data - Editable Fields */}
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight="600">
                    Transaction Details
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<RefreshIcon />}
                    onClick={handleClearParsedData}
                    sx={{ color: '#ff9a56', textTransform: 'none' }}
                  >
                    Clear
                  </Button>
                </Box>

                <Grid container spacing={2}>
                  {/* Row 1: Date and Category */}
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Date"
                      type="date"
                      value={parsedData.date || new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleParsedFieldChange('date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#ff9a56' },
                          '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Category"
                      value={parsedData.category}
                      onChange={(e) => handleParsedFieldChange('category', e.target.value)}
                      disabled
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: '#f5f5f5'
                        }
                      }}
                    />
                  </Grid>

                  {/* Row 2: Transaction Type and Expense Head */}
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Transaction Type</InputLabel>
                      <Select
                        value={parsedData.type}
                        label="Transaction Type"
                        onChange={(e) => handleParsedFieldChange('type', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                        }}
                      >
                        <MenuItem value="expense">Expense</MenuItem>
                        <MenuItem value="income">Income</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Expense Head</InputLabel>
                      <Select
                        value={parsedData.expenseHead || ''}
                        label="Expense Head"
                        onChange={(e) => handleParsedFieldChange('expenseHead', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                        }}
                      >
                        <MenuItem value="">
                          <em>Select Expense Head</em>
                        </MenuItem>
                        {expenseHeads.map(head => (
                          <MenuItem key={head} value={head}>{head}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Row 3: Amount and Currency */}
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Amount"
                      type="number"
                      value={parsedData.amount}
                      onChange={(e) => handleParsedFieldChange('amount', e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#ff9a56' },
                          '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Currency"
                      value={parsedData.currency || 'INR'}
                      onChange={(e) => handleParsedFieldChange('currency', e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#ff9a56' },
                          '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                        }
                      }}
                    />
                  </Grid>

                  {/* Row 4: Transaction Desc and Payment Mode */}
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Transaction Desc"
                      value={parsedData.transactionDesc || ''}
                      onChange={(e) => handleParsedFieldChange('transactionDesc', e.target.value)}
                      placeholder="e.g., BigMarket, groceries"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#ff9a56' },
                          '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Mode</InputLabel>
                      <Select
                        value={parsedData.paymentMode}
                        label="Payment Mode"
                        onChange={(e) => handleParsedFieldChange('paymentMode', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                        }}
                      >
                        {PAYMENT_MODES.map(mode => (
                          <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Bank Account / Credit Card Dropdown */}
                  {shouldShowAccountDropdown(parsedData.paymentMode) && (
                    <Grid item xs={6}>
                      <FormControl fullWidth>
                        <InputLabel>
                          {parsedData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                        </InputLabel>
                        <Select
                          value={parsedData.accountId || ''}
                          label={parsedData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const accounts = getAvailableAccounts(parsedData.paymentMode);
                            const selected = accounts.find(acc => acc.id === selectedId);
                            handleParsedFieldChange('accountId', selectedId);
                            handleParsedFieldChange('accountName', selected ? (selected.accountNickName || selected.nickName) : '');
                          }}
                          sx={{
                            borderRadius: 2,
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                          }}
                        >
                          <MenuItem value="">
                            <em>None (Optional)</em>
                          </MenuItem>
                          {getAvailableAccounts(parsedData.paymentMode).map(account => (
                            <MenuItem key={account.id} value={account.id}>
                              {account.accountNickName || account.nickName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}
                </Grid>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleSaveTransaction}
                  sx={{
                    mt: 3,
                    background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 600,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #ff9a56 0%, #ff6f00 100%)',
                    }
                  }}
                >
                  Save Transaction
                </Button>
              </>
            )}
          </Box>
        </TabPanel>

        {/* RECURRING EXPENSES TAB */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Grid container spacing={2}>
              {/* Select Recurring Transaction Template */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Recurring Transaction</InputLabel>
                  <Select
                    value={selectedRecurringId}
                    label="Select Recurring Transaction"
                    onChange={handleRecurringSelect}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    <MenuItem value="">
                      <em>{recurringTransactions.length === 0 ? 'No recurring transactions setup' : 'Select a transaction'}</em>
                    </MenuItem>
                    {recurringTransactions.map((transaction) => (
                      <MenuItem key={transaction.id} value={transaction.id}>
                        {transaction.transactionName} ({transaction.currency} {transaction.amount})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {selectedRecurringId && (
                <>
                  {/* Row 1: Date & Category (read-only from template) */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Date"
                      type="date"
                      value={recurringData.date}
                      onChange={(e) => handleRecurringFieldChange('date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#ff9a56' },
                          '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Category"
                      value={recurringData.category}
                      disabled
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: '#f5f5f5'
                        }
                      }}
                    />
                  </Grid>

                  {/* Row 2: Merchant (read-only) */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Merchant"
                      value={recurringData.merchant}
                      disabled
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: '#f5f5f5'
                        }
                      }}
                    />
                  </Grid>

                  {/* Row 3: Amount & Currency */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Amount"
                      type="number"
                      value={recurringData.amount}
                      onChange={(e) => handleRecurringFieldChange('amount', e.target.value)}
                      inputProps={{ min: 0, step: 0.01 }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#ff9a56' },
                          '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Currency</InputLabel>
                      <Select
                        value={recurringData.currency}
                        label="Currency"
                        onChange={(e) => handleRecurringFieldChange('currency', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                        }}
                      >
                        <MenuItem value="INR">INR</MenuItem>
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="EUR">EUR</MenuItem>
                        <MenuItem value="GBP">GBP</MenuItem>
                        <MenuItem value="AED">AED</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Row 4: Payment Mode */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Payment Mode</InputLabel>
                      <Select
                        value={recurringData.paymentMode}
                        label="Payment Mode"
                        onChange={(e) => handleRecurringFieldChange('paymentMode', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                        }}
                      >
                        {PAYMENT_MODES.map(mode => (
                          <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Bank Account / Credit Card Dropdown */}
                  {shouldShowAccountDropdown(recurringData.paymentMode) && (
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth>
                        <InputLabel>
                          {recurringData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                        </InputLabel>
                        <Select
                          value={recurringData.accountId || ''}
                          label={recurringData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const accounts = getAvailableAccounts(recurringData.paymentMode);
                            const selected = accounts.find(acc => acc.id === selectedId);
                            handleRecurringFieldChange('accountId', selectedId);
                            handleRecurringFieldChange('accountName', selected ? (selected.accountNickName || selected.nickName) : '');
                          }}
                          sx={{
                            borderRadius: 2,
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                          }}
                        >
                          <MenuItem value="">
                            <em>None (Optional)</em>
                          </MenuItem>
                          {getAvailableAccounts(recurringData.paymentMode).map(account => (
                            <MenuItem key={account.id} value={account.id}>
                              {account.accountNickName || account.nickName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  {/* Row 5: Transaction Description */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Transaction Description"
                      value={recurringData.transactionDesc}
                      onChange={(e) => handleRecurringFieldChange('transactionDesc', e.target.value)}
                      placeholder="e.g., Monthly electricity bill, rent payment"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#ff9a56' },
                          '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                        }
                      }}
                    />
                  </Grid>

                  {/* Row 6: Expense Head */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Expense Head</InputLabel>
                      <Select
                        value={recurringData.expenseHead}
                        label="Expense Head"
                        onChange={(e) => handleRecurringFieldChange('expenseHead', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                        }}
                      >
                        <MenuItem value="">
                          <em>Select Expense Head</em>
                        </MenuItem>
                        {expenseHeads.map(head => (
                          <MenuItem key={head} value={head}>{head}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Save Button */}
                  <Grid item xs={12}>
                    <Button
                      variant="contained"
                      fullWidth
                      onClick={handleSaveRecurringExpense}
                      sx={{
                        background: 'linear-gradient(45deg, #ff9a56 30%, #ff6b35 90%)',
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontSize: '1rem',
                        fontWeight: 600,
                        '&:hover': {
                          background: 'linear-gradient(45deg, #9c27b0 30%, #6a1b9a 90%)',
                        }
                      }}
                    >
                      Save Transaction
                    </Button>
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </TabPanel>

        {/* INCOME TRANSACTION TAB */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 } }}>
            <Grid container spacing={2}>
              {/* Row 1: Date and Transaction Type */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={incomeData.date}
                  onChange={(e) => handleIncomeFieldChange('date', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#ff9a56' },
                      '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Transaction Type"
                  value="Income"
                  disabled
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#f5f5f5'
                    }
                  }}
                />
              </Grid>

              {/* Row 2: Category Dropdown */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={incomeData.category}
                    label="Category"
                    onChange={(e) => handleIncomeFieldChange('category', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    {incomeCategories.map(cat => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 3: Transaction Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Transaction Description"
                  value={incomeData.transactionDesc}
                  onChange={(e) => handleIncomeFieldChange('transactionDesc', e.target.value)}
                  placeholder="e.g., Monthly salary from company"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#ff9a56' },
                      '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                    }
                  }}
                />
              </Grid>

              {/* Row 4: Income Source */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Income Source</InputLabel>
                  <Select
                    value={incomeData.expenseHead}
                    label="Income Source"
                    onChange={(e) => handleIncomeFieldChange('expenseHead', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    {incomeSources.map(source => (
                      <MenuItem key={source} value={source}>{source}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 5: Amount and Currency */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={incomeData.amount}
                  onChange={(e) => handleIncomeFieldChange('amount', e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#ff9a56' },
                      '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={incomeData.currency}
                    label="Currency"
                    onChange={(e) => handleIncomeFieldChange('currency', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    {currencies.map(curr => (
                      <MenuItem key={curr} value={curr}>{curr}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 6: Payment Mode */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={incomeData.paymentMode}
                    label="Payment Mode"
                    onChange={(e) => handleIncomeFieldChange('paymentMode', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                    }}
                  >
                    {PAYMENT_MODES.map(mode => (
                      <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Bank Account / Credit Card Dropdown */}
              {shouldShowAccountDropdown(incomeData.paymentMode) && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>
                      {incomeData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                    </InputLabel>
                    <Select
                      value={incomeData.accountId || ''}
                      label={incomeData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        const accounts = getAvailableAccounts(incomeData.paymentMode);
                        const selected = accounts.find(acc => acc.id === selectedId);
                        handleIncomeFieldChange('accountId', selectedId);
                        handleIncomeFieldChange('accountName', selected ? (selected.accountNickName || selected.nickName) : '');
                      }}
                      sx={{
                        borderRadius: 2,
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#ff9a56' }
                      }}
                    >
                      <MenuItem value="">
                        <em>None (Optional)</em>
                      </MenuItem>
                      {getAvailableAccounts(incomeData.paymentMode).map(account => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.accountNickName || account.nickName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSaveIncomeTransaction}
                    sx={{
                      background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #ff9a56 0%, #ff6f00 100%)',
                      }
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleResetIncomeForm}
                    sx={{
                      py: 1.5,
                      px: 4,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      borderColor: '#ff9a56',
                      color: '#ff9a56',
                      minWidth: '120px',
                      '&:hover': {
                        borderColor: '#ff6f00',
                        bgcolor: '#fff3e0'
                      }
                    }}
                  >
                    Reset
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </TabPanel>
      </Paper>

      {/* Transaction History - Week-wise Tabs */}
      <Typography variant="h6" fontWeight="600" sx={{ mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
        Transactions Log
      </Typography>
      
      {transactions.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="body2" color="text.secondary">
            No transactions yet. Add your first transaction above!
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ borderRadius: 2 }}>
          <Tabs
            value={weekTabValue}
            onChange={(e, newValue) => setWeekTabValue(newValue)}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                minHeight: { xs: 48, sm: 56 },
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                fontWeight: 600
              }
            }}
          >
            {getWeekRanges().map((week, index) => {
              const weekTransactions = transactions.filter(t => {
                const txDate = new Date(t.date);
                txDate.setHours(0, 0, 0, 0);
                return txDate >= week.start && txDate <= week.end;
              });
              return (
                <Tab
                  key={index}
                  label={
                    <Box>
                      <Typography variant="caption" fontWeight="600" display="block">
                        {week.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {weekTransactions.length} txns
                      </Typography>
                    </Box>
                  }
                />
              );
            })}
          </Tabs>
          
          {getWeekRanges().map((week, weekIndex) => {
            const weekTransactions = transactions.filter(t => {
              const txDate = new Date(t.date);
              txDate.setHours(0, 0, 0, 0);
              return txDate >= week.start && txDate <= week.end;
            });
            
            return (
              <TabPanel key={weekIndex} value={weekTabValue} index={weekIndex}>
                {weekTransactions.length === 0 ? (
                  <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No transactions for {week.label.toLowerCase()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      {week.start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - {week.end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ p: { xs: 1, sm: 2 } }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, px: 0.5 }}>
                      {week.start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} - {week.end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Typography>
                    {weekTransactions.map((transaction) => (
                      <Card key={transaction.id} elevation={0} sx={{ mb: 1, border: '1px solid #e0e0e0', borderRadius: 1.5 }}>
                        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5, flexWrap: 'wrap' }}>
                                {transaction.type === 'income' ? (
                                  <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 18 }} />
                                ) : (
                                  <TrendingDownIcon sx={{ color: '#f44336', fontSize: 18 }} />
                                )}
                                <Typography variant="h6" sx={{ color: transaction.type === 'income' ? '#4caf50' : '#f44336', fontWeight: 600, fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                                  {formatCurrency(transaction.amount, transaction.currency)}
                                </Typography>
                                <Chip 
                                  label={transaction.category} 
                                  size="small" 
                                  sx={{ 
                                    bgcolor: transaction.type === 'income' ? '#e8f5e9' : '#ffebee',
                                    color: transaction.type === 'income' ? '#2e7d32' : '#c62828',
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    height: '20px'
                                  }} 
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.7rem', display: 'block' }}>
                                {transaction.description}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                <Chip label={transaction.paymentMode} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: '20px' }} />
                                <Chip label={transaction.date?.toLocaleDateString()} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: '20px' }} />
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton 
                                size="small" 
                                onClick={() => handleEditTransaction(transaction)}
                                sx={{ color: 'primary.main' }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteTransaction(transaction.id)}
                                sx={{ color: '#f44336' }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                )}
              </TabPanel>
            );
          })}
        </Paper>
      )}

      {/* Edit Transaction Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Transaction</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={editingTransaction?.date || ''}
                onChange={handleEditChange('date')}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Type"
                value={editingTransaction?.type || 'expense'}
                onChange={handleEditChange('type')}
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={editingTransaction?.description || ''}
                onChange={handleEditChange('description')}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Category"
                value={editingTransaction?.category || ''}
                onChange={handleEditChange('category')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Expense Head"
                value={editingTransaction?.expenseHead || ''}
                onChange={handleEditChange('expenseHead')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={editingTransaction?.amount || ''}
                onChange={handleEditChange('amount')}
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Currency"
                value={editingTransaction?.currency || 'INR'}
                onChange={handleEditChange('currency')}
              >
                {currencies.map((curr) => (
                  <MenuItem key={curr} value={curr}>{curr}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Payment Mode"
                value={editingTransaction?.paymentMode || 'UPI'}
                onChange={handleEditChange('paymentMode')}
              >
                {PAYMENT_MODES.map((mode) => (
                  <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                ))}
              </TextField>
            </Grid>

            {/* Bank Account / Credit Card Dropdown */}
            {shouldShowAccountDropdown(editingTransaction?.paymentMode) && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>
                    {editingTransaction?.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                  </InputLabel>
                  <Select
                    value={editingTransaction?.accountId || ''}
                    label={editingTransaction?.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const accounts = getAvailableAccounts(editingTransaction?.paymentMode);
                      const selected = accounts.find(acc => acc.id === selectedId);
                      setEditingTransaction({
                        ...editingTransaction,
                        accountId: selectedId,
                        accountName: selected ? (selected.accountNickName || selected.nickName) : ''
                      });
                    }}
                  >
                    <MenuItem value="">
                      <em>None (Optional)</em>
                    </MenuItem>
                    {getAvailableAccounts(editingTransaction?.paymentMode).map(account => (
                      <MenuItem key={account.id} value={account.id}>
                        {account.accountNickName || account.nickName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUpdateTransaction} 
            variant="contained"
            color="primary"
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
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

      <Footer />
    </Box>
  );
}

export default DailyExpenseLogPage;
