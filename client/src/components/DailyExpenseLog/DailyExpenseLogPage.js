import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Tabs,
  Tab,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fab,
  ToggleButtonGroup,
  ToggleButton,
  Backdrop,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTheme } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, addDoc, query, where, orderBy, getDocs, deleteDoc, doc, updateDoc, Timestamp, limit, getDoc } from 'firebase/firestore';
import { parseTransactionWithGemini } from '../../utils/geminiApi';
import { PAYMENT_MODES } from '../../config/constants';
import { convertToINR } from '../../utils/currencyUtils';
import Footer from '../Common/Footer';
import BookIcon from '@mui/icons-material/Book';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3, backgroundColor: '#ffffff', borderRadius: 1 }}>{children}</Box>}
    </div>
  );
}

function DailyExpenseLogPage() {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  const [isSaving, setIsSaving] = useState(false);
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
  
  // Template expense states
  const [templateTransactions, setTemplateTransactions] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateData, setTemplateData] = useState({
    transactionName: '',
    amount: '',
    currency: 'INR',
    type: 'Others',
    merchant: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'UPI',
    transactionDesc: '',
    expenseHead: '',
    category: 'Sundry',
    accountId: '',
    accountName: ''
  });
  const [templateAutoDetecting, setTemplateAutoDetecting] = useState(false);
  
  // Common states
  const [transactions, setTransactions] = useState([]);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  // Ledger states
  const [currentLedger, setCurrentLedger] = useState(null);
  const [openLedgers, setOpenLedgers] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  
  // Expense Heads
  const [expenseHeads, setExpenseHeads] = useState([]);
  
  // Bank Accounts and Credit Cards
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);

  // Compute the periodic-only options for recurring dropdown and log them for diagnosis
  const periodicRecurringOptions = useMemo(() => {
    const list = recurringTransactions.filter((transaction) => {
      const recurrenceType = transaction.recurrenceType || 'periodic';
      return recurrenceType === 'periodic';
    });
    console.log('Recurring dropdown options (periodic only):', list.map(r => ({ id: r.id, transactionName: r.transactionName, recurrenceType: r.recurrenceType })));
    return list;
  }, [recurringTransactions]);
  
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
        const ledgers = ledgerSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          startDate: doc.data().startDate?.toDate(),
          endDate: doc.data().endDate?.toDate()
        })).sort((a, b) => {
          const dateA = a.createdAt?.toDate() || new Date(0);
          const dateB = b.createdAt?.toDate() || new Date(0);
          return dateB - dateA; // Descending order (newest first)
        });
        
        setOpenLedgers(ledgers);
        // Set the first (most recent) as current
        setCurrentLedger(ledgers[0]);
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
        const data = doc.data();
        recurringList.push({ id: doc.id, ...data });
        // Log each fetched record for diagnosis
        console.log('Fetched recurring_expense:', { id: doc.id, transactionName: data.transactionName, recurrenceType: data.recurrenceType });
      });
      // Also log summary counts
      const counts = recurringList.reduce((acc, r) => {
        const t = r.recurrenceType || 'periodic';
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {});
      console.log('Recurring transactions fetched. Counts by recurrenceType:', counts);
      setRecurringTransactions(recurringList);
    } catch (error) {
      console.error('Error fetching recurring transactions:', error);
    }
  };

  const fetchTemplateTransactions = async () => {
    try {
      const templateQuery = query(
        collection(db, 'recurring_expenses'),
        where('userId', '==', currentUser.uid),
        orderBy('transactionName', 'asc')
      );
      const templateSnapshot = await getDocs(templateQuery);
      const templateList = [];
      templateSnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter for templates only (client-side to avoid index requirement initially)
        if (data.recurrenceType === 'template') {
          templateList.push({ id: doc.id, ...data });
        }
      });
      setTemplateTransactions(templateList);
    } catch (error) {
      console.error('Error fetching template transactions:', error);
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

  // Calculate week ranges based on ledger start date
  const getWeekRanges = () => {
    if (!currentLedger || !currentLedger.startDate) {
      console.log('No current ledger or start date:', { currentLedger });
      return [];
    }

    try {
      const weeks = [];
      const ledgerStart = new Date(currentLedger.startDate);
      
      // Validate the date
      if (isNaN(ledgerStart.getTime())) {
        console.error('Invalid ledger start date:', currentLedger.startDate);
        return [];
      }
      
      ledgerStart.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const ledgerEnd = currentLedger.endDate ? new Date(currentLedger.endDate) : today;
      ledgerEnd.setHours(23, 59, 59, 999);
    
    // Calculate the number of days from ledger start to today (or ledger end if closed)
    const daysDiff = Math.floor((ledgerEnd - ledgerStart) / (1000 * 60 * 60 * 24));
    const numberOfWeeks = Math.ceil((daysDiff + 1) / 7);
    
    // Generate weeks starting from ledger start date
    for (let i = 0; i < numberOfWeeks; i++) {
      const weekStart = new Date(ledgerStart);
      weekStart.setDate(ledgerStart.getDate() + (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      // Don't let week end exceed ledger end date
      if (weekEnd > ledgerEnd) {
        weekEnd.setTime(ledgerEnd.getTime());
      }
      
      weeks.push({
        start: weekStart,
        end: weekEnd,
        label: `Week ${i + 1}`
      });
    }
    
    console.log('Generated weeks:', weeks.length, weeks);
    return weeks.reverse(); // Reverse to show most recent week first
    } catch (error) {
      console.error('Error in getWeekRanges:', error);
      return [];
    }
  };

  const fetchTransactions = async () => {
    try {
      // Only fetch transactions for the current ledger
      if (!currentLedger) {
        setTransactions([]);
        console.log('🔍 fetchTransactions: No current ledger');
        return;
      }
      
      console.log('🔍 fetchTransactions: Fetching for ledger', currentLedger.id);
      // Remove orderBy to avoid Firebase composite index requirement
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('userId', '==', currentUser.uid),
        where('ledgerId', '==', currentLedger.id)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate()
      })).sort((a, b) => {
        // Sort by date descending in memory
        const dateA = a.date || new Date(0);
        const dateB = b.date || new Date(0);
        return dateB - dateA;
      });
      console.log('✅ Fetched', transactionsData.length, 'transactions:', transactionsData.map(t => ({ 
        id: t.id,
        type: t.type,
        paymentMode: t.paymentMode,
        amount: t.amount,
        accountId: t.accountId,
        accountName: t.accountName
      })));
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
      console.log('🔄 updateAccountBalanceInLedger called:', { ledgerId, accountId, amount, transactionType });
      const ledgerRef = doc(db, 'ledgers', ledgerId);
      const ledgerDocSnapshot = await getDoc(ledgerRef);
      
      if (ledgerDocSnapshot.exists()) {
        const ledgerData = ledgerDocSnapshot.data();
        const accountBalances = ledgerData.accountBalances || [];
        console.log('📊 Ledger found. Current accountBalances:', accountBalances);
        
        // Find the account in accountBalances array
        const accountIndex = accountBalances.findIndex(ab => ab.accountId === accountId);
        console.log('🔍 Account index for', accountId, ':', accountIndex);
        
        if (accountIndex !== -1) {
          const isCreditCard = accountBalances[accountIndex].accountType === 'creditCard';
          const currentClosing = accountBalances[accountIndex].closingBalance || accountBalances[accountIndex].openingBalance || 0;
          console.log('💳 Account details:', { 
            isCreditCard, 
            currentClosing, 
            accountType: accountBalances[accountIndex].accountType 
          });
          
          // For credit cards: Opening (debt) + Expenses (purchases) - Income (payments)
          // For bank accounts: Opening + Income - Expenses
          if (isCreditCard) {
            if (transactionType === 'expense') {
              accountBalances[accountIndex].closingBalance = currentClosing + amount; // Debt increases
              console.log('➕ Credit Card Expense: New balance =', accountBalances[accountIndex].closingBalance);
            } else if (transactionType === 'income') {
              accountBalances[accountIndex].closingBalance = currentClosing - amount; // Debt decreases (payment)
              console.log('➖ Credit Card Income (Payment): New balance =', accountBalances[accountIndex].closingBalance);
            }
          } else {
            // Bank account logic
            if (transactionType === 'expense') {
              accountBalances[accountIndex].closingBalance = currentClosing - amount;
              console.log('➖ Bank Account Expense: New balance =', accountBalances[accountIndex].closingBalance);
            } else if (transactionType === 'income') {
              accountBalances[accountIndex].closingBalance = currentClosing + amount;
              console.log('➕ Bank Account Income: New balance =', accountBalances[accountIndex].closingBalance);
            }
          }
          
          // Update the ledger document with modified accountBalances
          console.log('📝 Updating ledger with new accountBalances:', accountBalances);
          await updateDoc(ledgerRef, {
            accountBalances: accountBalances
          });
          console.log('✅ Ledger updated successfully');
        } else {
          console.warn('⚠️ Account not found in ledger accountBalances');
        }
      } else {
        console.warn('⚠️ Ledger document not found');
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
      fetchRecurringTransactions();
      fetchTemplateTransactions();
      fetchExpenseHeads();
      fetchBankAccounts();
      fetchCreditCards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Refetch transactions when currentLedger changes
  useEffect(() => {
    if (currentUser && currentLedger) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, currentLedger]);

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
      
      // Set payment mode default to UPI
      parsed.paymentMode = parsed.paymentMode || 'UPI';
      
      // Set default category based on transaction type
      if (!parsed.category) {
        parsed.category = parsed.type === 'income' ? 'Fixed' : 'Sundry';
      }
      
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

    // Validate transaction date is not in future
    const transactionDate = new Date(parsedData.date);
    transactionDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (transactionDate > today) {
      setNotification({
        open: true,
        message: 'Transaction date cannot be in the future',
        severity: 'error'
      });
      return;
    }

    // Validate bank account selection for payment modes that require it
    if (shouldShowAccountDropdown(parsedData.paymentMode) && !parsedData.accountId) {
      setNotification({
        open: true,
        message: `Please select a bank account for ${parsedData.paymentMode} payment mode`,
        severity: 'error'
      });
      return;
    }

    // Validate accountId/accountName consistency
    if (parsedData.accountId) {
      const allAccounts = [...bankAccounts, ...creditCards];
      const matchedAccount = allAccounts.find(a => a.id === parsedData.accountId);
      if (matchedAccount) {
        const expectedName = matchedAccount.accountNickName || matchedAccount.nickName || '';
        if (parsedData.accountName && parsedData.accountName !== expectedName) {
          setNotification({
            open: true,
            message: `Account mismatch: selected ID belongs to "${expectedName}" but name shows "${parsedData.accountName}". Please reselect the account.`,
            severity: 'error'
          });
          return;
        }
      }
    }

    setIsSaving(true);
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
        amountInINR: convertToINR(parseFloat(parsedData.amount), parsedData.currency || 'INR'),
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

      console.log('💾 Saving transaction from parsed data:', transactionData);
      await addDoc(collection(db, 'transactions'), transactionData);
      console.log('✅ Transaction saved successfully');
      
      // Update account balance in ledger if accountId is provided
      if (parsedData.accountId && currentLedger.id) {
        console.log('🔄 Calling updateAccountBalanceInLedger for account:', parsedData.accountId);
        await updateAccountBalanceInLedger(
          currentLedger.id,
          parsedData.accountId,
          parseFloat(parsedData.amount),
          parsedData.type || 'expense'
        );
      } else {
        console.warn('⚠️ No accountId or ledger ID, skipping balance update');
      }
      
      setNotification({
        open: true,
        message: `${parsedData.type === 'expense' ? 'Expense' : 'Income'} logged successfully! Refresh the Ledger page to see updated balance.`,
        severity: 'success'
      });
      
      handleClearParsedData();
      setInputText(''); // Clear input text after saving
      console.log('📡 Transaction saved. Refetching transactions and ledger data...');
      fetchTransactions();
      // Refetch the open ledger to update the accountBalances in other components
      await fetchOpenLedger();
      console.log('✅ All data refreshed. Updated balance should now be visible on Ledger page.');
    } catch (error) {
      console.error('Error saving transaction:', error);
      setNotification({
        open: true,
        message: 'Error saving transaction',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
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

    // Validate transaction date is not in future
    const transactionDate = new Date(recurringData.date);
    transactionDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (transactionDate > today) {
      setNotification({
        open: true,
        message: 'Transaction date cannot be in the future',
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

    // Validate bank account selection for payment modes that require it
    if (shouldShowAccountDropdown(recurringData.paymentMode) && !recurringData.accountId) {
      setNotification({
        open: true,
        message: `Please select a bank account for ${recurringData.paymentMode} payment mode`,
        severity: 'error'
      });
      return;
    }

    // Validate accountId/accountName consistency
    if (recurringData.accountId) {
      const allAccounts = [...bankAccounts, ...creditCards];
      const matchedAccount = allAccounts.find(a => a.id === recurringData.accountId);
      if (matchedAccount) {
        const expectedName = matchedAccount.accountNickName || matchedAccount.nickName || '';
        if (recurringData.accountName && recurringData.accountName !== expectedName) {
          setNotification({
            open: true,
            message: `Account mismatch: selected ID belongs to "${expectedName}" but name shows "${recurringData.accountName}". Please reselect the account.`,
            severity: 'error'
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(recurringData.amount),
        currency: recurringData.currency,
        amountInINR: convertToINR(parseFloat(recurringData.amount), recurringData.currency),
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
        message: 'Recurring transaction saved successfully! Refresh the Ledger page to see updated balance.',
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

      // Refresh transactions and ledger data
      console.log('📡 Recurring transaction saved. Refetching transactions and ledger data...');
      fetchTransactions();
      await fetchOpenLedger();
      console.log('✅ All data refreshed. Updated balance should now be visible on Ledger page.');
    } catch (error) {
      console.error('Error saving recurring expense:', error);
      setNotification({
        open: true,
        message: 'Failed to save recurring transaction',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetRecurringForm = () => {
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
      category: 'Recurring',
      accountId: '',
      accountName: ''
    });
  };

  // Template tab handlers
  const handleTemplateSelect = (e) => {
    const selectedId = e.target.value;
    setSelectedTemplateId(selectedId);
    
    if (selectedId) {
      const selected = templateTransactions.find(t => t.id === selectedId);
      if (selected) {
        const paymentMode = selected.usualPaymentMode || 'UPI';
        
        // Get account info from template transaction, or fall back to default
        let accountId = selected.accountId || '';
        let accountName = selected.accountName || '';
        
        // If template transaction doesn't have account info (legacy data), use default
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
        
        setTemplateData({
          transactionName: selected.transactionName,
          amount: selected.amount.toString(),
          currency: selected.currency,
          type: selected.type,
          merchant: selected.merchant,
          date: new Date().toISOString().split('T')[0],
          paymentMode: paymentMode,
          transactionDesc: selected.transactionDesc || '',
          expenseHead: selected.expenseHead || selected.type || 'Other',
          category: 'Sundry', // Always use Sundry for template transactions
          accountId: accountId,
          accountName: accountName
        });
      }
    } else {
      setTemplateData({
        transactionName: '',
        amount: '',
        currency: 'INR',
        type: 'Others',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'UPI',
        transactionDesc: '',
        expenseHead: '',
        category: 'Sundry',
        accountId: '',
        accountName: ''
      });
    }
  };

  const handleTemplateFieldChange = (field, value) => {
    if (field === 'paymentMode') {
      // When payment mode changes, auto-select default account/card
      const ledgerAccountIds = currentLedger?.accountBalances?.map(ab => ab.accountId) || [];
      const newData = { ...templateData, [field]: value };
      if (value === 'Cash') {
        newData.accountId = '';
        newData.accountName = '';
      } else if (value === 'Credit Card') {
        const defaultCard = creditCards.find(card => card.isDefault && ledgerAccountIds.includes(card.id));
        if (defaultCard) {
          newData.accountId = defaultCard.id;
          newData.accountName = defaultCard.nickName;
        }
      } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(value)) {
        const defaultBank = bankAccounts.find(bank => bank.isDefault && ledgerAccountIds.includes(bank.id));
        if (defaultBank) {
          newData.accountId = defaultBank.id;
          newData.accountName = defaultBank.accountNickName;
        }
      }
      setTemplateData(newData);
    } else {
      setTemplateData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleTemplateAutoDetectExpenseHead = async () => {
    if (!templateData.transactionDesc) {
      setNotification({
        open: true,
        message: 'Please enter a transaction description first',
        severity: 'warning'
      });
      return;
    }

    setTemplateAutoDetecting(true);
    try {
      const result = await parseTransactionWithGemini(
        `Determine expense head for: ${templateData.transactionDesc}`,
        currentUser.uid
      );
      
      if (result.expenseHead) {
        setTemplateData(prev => ({ ...prev, expenseHead: result.expenseHead }));
        setNotification({
          open: true,
          message: 'Expense head detected successfully!',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error auto-detecting expense head:', error);
      setNotification({
        open: true,
        message: 'Error detecting expense head. Please enter manually.',
        severity: 'error'
      });
    } finally {
      setTemplateAutoDetecting(false);
    }
  };

  const handleResetTemplateForm = () => {
    setSelectedTemplateId('');
    setTemplateData({
      transactionName: '',
      amount: '',
      currency: 'INR',
      type: 'Others',
      merchant: '',
      date: new Date().toISOString().split('T')[0],
      paymentMode: 'UPI',
      transactionDesc: '',
      expenseHead: '',
      category: 'Sundry',
      accountId: '',
      accountName: ''
    });
  };

  const handleSaveTemplateExpense = async () => {
    if (!currentLedger) {
      setNotification({
        open: true,
        message: 'Cannot save transaction. Please create an open ledger first!',
        severity: 'error'
      });
      return;
    }

    // Validate transaction date is not in future
    const transactionDate = new Date(templateData.date);
    transactionDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (transactionDate > today) {
      setNotification({
        open: true,
        message: 'Transaction date cannot be in the future',
        severity: 'error'
      });
      return;
    }

    if (!selectedTemplateId || !templateData.amount || parseFloat(templateData.amount) <= 0) {
      setNotification({
        open: true,
        message: 'Please select a template transaction and enter a valid amount',
        severity: 'error'
      });
      return;
    }

    // Validate bank account selection for payment modes that require it
    if (shouldShowAccountDropdown(templateData.paymentMode) && !templateData.accountId) {
      setNotification({
        open: true,
        message: `Please select a bank account for ${templateData.paymentMode} payment mode`,
        severity: 'error'
      });
      return;
    }

    // Validate accountId/accountName consistency
    if (templateData.accountId) {
      const allAccounts = [...bankAccounts, ...creditCards];
      const matchedAccount = allAccounts.find(a => a.id === templateData.accountId);
      if (matchedAccount) {
        const expectedName = matchedAccount.accountNickName || matchedAccount.nickName || '';
        if (templateData.accountName && templateData.accountName !== expectedName) {
          setNotification({
            open: true,
            message: `Account mismatch: selected ID belongs to "${expectedName}" but name shows "${templateData.accountName}". Please reselect the account.`,
            severity: 'error'
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(templateData.amount),
        currency: templateData.currency,
        amountInINR: convertToINR(parseFloat(templateData.amount), templateData.currency),
        type: 'expense',
        category: templateData.category || 'Sundry',
        expenseHead: templateData.expenseHead || templateData.type,
        transactionDesc: templateData.transactionDesc || templateData.merchant,
        date: Timestamp.fromDate(new Date(templateData.date)),
        paymentMode: templateData.paymentMode,
        accountId: templateData.accountId || '',
        accountName: templateData.accountName || '',
        description: templateData.transactionName,
        isTemplate: true,
        templateId: selectedTemplateId,
        createdAt: Timestamp.now()
      };

      await addDoc(collection(db, 'transactions'), transactionData);
      
      // Update account balance in ledger if accountId is provided
      if (templateData.accountId && currentLedger.id) {
        await updateAccountBalanceInLedger(
          currentLedger.id,
          templateData.accountId,
          parseFloat(templateData.amount),
          'expense'
        );
      }
      
      setNotification({
        open: true,
        message: 'Template transaction saved successfully! Refresh the Ledger page to see updated balance.',
        severity: 'success'
      });

      // Reset form
      setSelectedTemplateId('');
      setTemplateData({
        transactionName: '',
        amount: '',
        currency: 'INR',
        type: 'Others',
        merchant: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'UPI',
        transactionDesc: '',
        expenseHead: '',
        category: 'Sundry',
        accountId: '',
        accountName: ''
      });

      // Refresh transactions and ledger data
      console.log('📋 Template transaction saved. Refetching transactions and ledger data...');
      fetchTransactions();
      await fetchOpenLedger();
      console.log('✅ All data refreshed. Updated balance should now be visible on Ledger page.');
    } catch (error) {
      console.error('Error saving template expense:', error);
      setNotification({
        open: true,
        message: 'Failed to save template transaction',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
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
      paymentMode: 'UPI',
      accountId: '',
      accountName: ''
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

    // Validate transaction date is not in future
    const transactionDate = new Date(manualData.date);
    transactionDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (transactionDate > today) {
      setNotification({
        open: true,
        message: 'Transaction date cannot be in the future',
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

    // Validate bank account selection for payment modes that require it
    if (shouldShowAccountDropdown(manualData.paymentMode) && !manualData.accountId) {
      setNotification({
        open: true,
        message: `Please select a bank account for ${manualData.paymentMode} payment mode`,
        severity: 'error'
      });
      return;
    }

    // Validate accountId/accountName consistency
    if (manualData.accountId) {
      const allAccounts = [...bankAccounts, ...creditCards];
      const matchedAccount = allAccounts.find(a => a.id === manualData.accountId);
      if (matchedAccount) {
        const expectedName = matchedAccount.accountNickName || matchedAccount.nickName || '';
        if (manualData.accountName && manualData.accountName !== expectedName) {
          setNotification({
            open: true,
            message: `Account mismatch: selected ID belongs to "${expectedName}" but name shows "${manualData.accountName}". Please reselect the account.`,
            severity: 'error'
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const descPart = manualData.transactionDesc || 'Unknown';
      const standardDescription = `${descPart} - ${manualData.category}`;
      
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(manualData.amount),
        currency: manualData.currency,
        amountInINR: convertToINR(parseFloat(manualData.amount), manualData.currency),
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

      console.log('💾 Saving manual transaction:', transactionData);
      await addDoc(collection(db, 'transactions'), transactionData);
      console.log('✅ Manual transaction saved successfully');
      
      // Update account balance in ledger if accountId is provided
      if (manualData.accountId && currentLedger.id) {
        console.log('🔄 Calling updateAccountBalanceInLedger for account:', manualData.accountId);
        await updateAccountBalanceInLedger(
          currentLedger.id,
          manualData.accountId,
          parseFloat(manualData.amount),
          manualData.transactionType
        );
      }
      
      setNotification({
        open: true,
        message: `${manualData.transactionType === 'expense' ? 'Expense' : 'Income'} logged successfully! Refresh the Ledger page to see updated balance.`,
        severity: 'success'
      });
      
      handleResetManualForm();
      console.log('📡 Manual transaction saved. Refetching transactions and ledger data...');
      fetchTransactions();
      // Refetch the open ledger to update the accountBalances in other components
      await fetchOpenLedger();
      console.log('✅ All data refreshed. Updated balance should now be visible on Ledger page.');
    } catch (error) {
      console.error('Error saving manual transaction:', error);
      setNotification({
        open: true,
        message: 'Error saving transaction',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
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
    } else if (field === 'expenseHead') {
      // Auto-update category based on income source
      const newData = { ...incomeData, [field]: value };
      newData.category = value === 'Salary' ? 'Fixed' : 'NonFixed';
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

    // Validate transaction date is not in future
    const transactionDate = new Date(incomeData.date);
    transactionDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (transactionDate > today) {
      setNotification({
        open: true,
        message: 'Transaction date cannot be in the future',
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

    // Validate bank account selection for payment modes that require it
    if (shouldShowAccountDropdown(incomeData.paymentMode) && !incomeData.accountId) {
      setNotification({
        open: true,
        message: `Please select a bank account for ${incomeData.paymentMode} payment mode`,
        severity: 'error'
      });
      return;
    }

    // Validate accountId/accountName consistency
    if (incomeData.accountId) {
      const allAccounts = [...bankAccounts, ...creditCards];
      const matchedAccount = allAccounts.find(a => a.id === incomeData.accountId);
      if (matchedAccount) {
        const expectedName = matchedAccount.accountNickName || matchedAccount.nickName || '';
        if (incomeData.accountName && incomeData.accountName !== expectedName) {
          setNotification({
            open: true,
            message: `Account mismatch: selected ID belongs to "${expectedName}" but name shows "${incomeData.accountName}". Please reselect the account.`,
            severity: 'error'
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      const descPart = incomeData.transactionDesc || 'Unknown';
      const standardDescription = `${descPart} - ${incomeData.category}`;
      
      const transactionData = {
        userId: currentUser.uid,
        ledgerId: currentLedger.id,
        ledgerName: currentLedger.name,
        amount: parseFloat(incomeData.amount),
        currency: incomeData.currency,
        amountInINR: convertToINR(parseFloat(incomeData.amount), incomeData.currency),
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
        message: 'Income logged successfully! Refresh the Ledger page to see updated balance.',
        severity: 'success'
      });
      
      handleResetIncomeForm();
      console.log('💡 Income transaction saved. Refetching transactions and ledger data...');
      fetchTransactions();
      await fetchOpenLedger();
      console.log('✅ All data refreshed. Updated balance should now be visible on Ledger page.');
    } catch (error) {
      console.error('Error saving income transaction:', error);
      setNotification({
        open: true,
        message: 'Error saving transaction',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
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
      paymentMode: transaction.paymentMode || 'UPI',
      accountId: transaction.accountId || '',
      accountName: transaction.accountName || ''
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

    // Validate accountId/accountName consistency
    if (editingTransaction.accountId) {
      const allAccounts = [...bankAccounts, ...creditCards];
      const matchedAccount = allAccounts.find(a => a.id === editingTransaction.accountId);
      if (matchedAccount) {
        const expectedName = matchedAccount.accountNickName || matchedAccount.nickName || '';
        if (editingTransaction.accountName && editingTransaction.accountName !== expectedName) {
          setNotification({
            open: true,
            message: `Account mismatch: selected ID belongs to "${expectedName}" but name shows "${editingTransaction.accountName}". Please reselect the account.`,
            severity: 'error'
          });
          return;
        }
      }
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
        accountId: editingTransaction.accountId || '',
        accountName: editingTransaction.accountName || '',
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

  // Per-account running closing balance — mirrors LedgerManagement.calculateLedgerMetrics logic
  const accountBalanceSummary = useMemo(() => {
    if (!currentLedger?.accountBalances?.length || !transactions) return [];

    const getINRAmount = (t) => {
      const currency = (t.currency || 'INR').toUpperCase();
      if (currency === 'INR' || currency === 'RUPEES') return parseFloat(t.amount) || 0;
      if (t.amountInINR !== undefined && t.amountInINR !== null) return t.amountInINR;
      return convertToINR(t.amount, t.currency);
    };

    // Only transactions linked to an account (no orphan/cash entries)
    const validTxns = transactions.filter(t => t.accountId);

    return currentLedger.accountBalances.map((account) => {
      const accountId = account.accountId;
      const openingBal = parseFloat(account.openingBalance) || 0;
      const isCreditCard = account.accountType === 'creditCard';
      const accountTxns = validTxns.filter(t => t.accountId === accountId);

      const accountIncome = accountTxns
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + getINRAmount(t), 0);
      const accountExpenses = accountTxns
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + getINRAmount(t), 0);

      const closingBal = isCreditCard
        ? openingBal + accountExpenses - accountIncome   // credit card: debt increases
        : openingBal + accountIncome - accountExpenses;  // bank: balance decreases

      return {
        accountId,
        accountName: account.accountName || account.accountNickName || accountId,
        accountType: account.accountType,
        balance: closingBal,
        isCreditCard
      };
    });
  }, [transactions, currentLedger]);

  return (
    <Box sx={{ pb: 10, position: 'relative', bgcolor: '#f8f9fb', minHeight: '100vh' }}>

      {/* Save-in-progress overlay */}
      <Backdrop open={isSaving} sx={{ position: 'fixed', zIndex: 1400, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'column', gap: 2 }}>
        <CircularProgress sx={{ color: '#fff' }} size={48} thickness={4} />
        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600, letterSpacing: 0.5 }}>Saving…</Typography>
      </Backdrop>

      {/* ── Sticky Header ── */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 10,
        bgcolor: '#fff', borderBottom: '1px solid #e8ecf0',
        px: 2, py: 1.25,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptLongIcon sx={{ fontSize: 20, color: '#5e35b1' }} />
          <Typography fontWeight="800" sx={{ fontSize: '1rem', letterSpacing: '-0.2px', color: '#1a1a2e' }}>
            Add Transaction
          </Typography>
        </Box>
        {ledgerLoading ? (
          <CircularProgress size={18} />
        ) : currentLedger ? (
          <Chip
            icon={<BookIcon sx={{ fontSize: '14px !important' }} />}
            label={currentLedger.name}
            size="small"
            sx={{ fontWeight: 600, fontSize: '0.7rem', bgcolor: '#ede7f6', color: '#4527a0', border: '1px solid #d1c4e9' }}
          />
        ) : (
          <Chip label="No Ledger" size="small" color="error" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
        )}
      </Box>

      <Box sx={{ px: 2, pt: 2 }}>

        {/* Warning if no ledger */}
        {!ledgerLoading && !currentLedger && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            No open ledger found. Please start a new monthly ledger from the Ledger page before entering transactions.
          </Alert>
        )}

        {/* ── Balance Summary (compact inline row) ── */}
        {accountBalanceSummary.length > 0 && (
          <Accordion disableGutters elevation={0} sx={{
            mb: 2, borderRadius: '12px !important', overflow: 'hidden',
            border: '1px solid #e8ecf0', bgcolor: '#fff',
            '&:before': { display: 'none' }
          }}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ fontSize: 18, color: '#9e9e9e' }} />}
              sx={{
                minHeight: '44px !important', px: 2, py: 0,
                '& .MuiAccordionSummary-content': { my: '0 !important', alignItems: 'center', gap: 1 }
              }}
            >
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Account Balances
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                · {accountBalanceSummary.length} account{accountBalanceSummary.length > 1 ? 's' : ''}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
              <Divider sx={{ mb: 1 }} />
              {accountBalanceSummary.map((acc, idx) => (
                <Box key={acc.accountId} sx={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  py: '6px', borderBottom: idx < accountBalanceSummary.length - 1 ? '1px solid #f5f5f5' : 'none'
                }}>
                  <Typography sx={{ fontSize: '0.82rem', color: '#555' }}>
                    {acc.accountName}{acc.isCreditCard ? ' (CC)' : ''}
                  </Typography>
                  <Typography fontWeight="700" sx={{
                    fontSize: '0.82rem',
                    color: acc.isCreditCard
                      ? (acc.balance > 0 ? '#dc2626' : '#16a34a')
                      : (acc.balance >= 0 ? '#16a34a' : '#dc2626')
                  }}>
                    {formatCurrency(acc.balance, 'INR')}
                  </Typography>
                </Box>
              ))}
            </AccordionDetails>
          </Accordion>
        )}

        {/* ── Mode Selector ── */}
        {(() => {
          const modes = [
            { value: 0, label: 'Smart', sublabel: 'NLP', icon: '✨', color: '#5e35b1', bg: '#ede7f6', border: '#d1c4e9' },
            { value: 1, label: 'Template', sublabel: 'TMPL', icon: '📋', color: '#1565c0', bg: '#e3f2fd', border: '#bbdefb' },
            { value: 2, label: 'Manual', sublabel: 'MNL', icon: '✏️', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { value: 3, label: 'Recurring', sublabel: 'RCNG', icon: '🔁', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
            { value: 4, label: 'Income', sublabel: 'INCM', icon: '💰', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
          ];
          return (
            <Box sx={{ mb: 2 }}>
              {/* Mode label */}
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', mb: 1 }}>
                Entry Mode
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {modes.map(m => {
                  const selected = tabValue === m.value;
                  return (
                    <Box
                      key={m.value}
                      onClick={() => { setTabValue(m.value); handleClearParsedData(); }}
                      sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        py: '10px', px: '4px', borderRadius: '12px', cursor: 'pointer',
                        border: `2px solid ${selected ? m.color : m.border}`,
                        bgcolor: selected ? m.color : m.bg,
                        transition: 'all 0.15s ease',
                        boxShadow: selected ? `0 2px 8px ${m.color}40` : 'none',
                        '&:active': { transform: 'scale(0.96)' }
                      }}
                    >
                      <Typography sx={{ fontSize: '1.1rem', lineHeight: 1, mb: '4px' }}>{m.icon}</Typography>
                      <Typography sx={{
                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.3px',
                        color: selected ? '#fff' : m.color, lineHeight: 1.2, textAlign: 'center'
                      }}>
                        {m.sublabel}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
              {/* Active mode banner */}
              {(() => {
                const active = modes.find(m => m.value === tabValue);
                const descriptions = {
                  0: 'Describe your expense in plain English — AI will parse it',
                  1: 'Pick from your saved transaction templates',
                  2: 'Fill in all fields manually',
                  3: 'Log a scheduled recurring expense',
                  4: 'Record salary, freelance, or other income',
                };
                return (
                  <Box sx={{
                    mt: 1.5, px: 1.5, py: 1, borderRadius: '10px',
                    bgcolor: active.bg, border: `1px solid ${active.border}`,
                    display: 'flex', alignItems: 'center', gap: 1
                  }}>
                    <Typography sx={{ fontSize: '0.88rem' }}>{active.icon}</Typography>
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: active.color }}>{active.label}</Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: '#6b7280', lineHeight: 1.3 }}>{descriptions[tabValue]}</Typography>
                    </Box>
                  </Box>
                );
              })()}
            </Box>
          );
        })()}


        {/* MANUAL TRANSACTION TAB */}
        <TabPanel value={tabValue} index={2}>
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
                  size="small"
                />
              </Grid>

              {/* Row 2: Amount and Currency */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={manualData.amount}
                  onChange={(e) => handleManualFieldChange('amount', e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  size="small"
                />
              </Grid>

              {/* Row 4: Expense Head */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={manualData.currency}
                    label="Currency"
                    onChange={(e) => handleManualFieldChange('currency', e.target.value)}
                  >
                    {currencies.map(curr => (
                      <MenuItem key={curr} value={curr}>{curr}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 6: Payment Mode */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={manualData.paymentMode}
                    label="Payment Mode"
                    onChange={(e) => handleManualFieldChange('paymentMode', e.target.value)}
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
                  <FormControl fullWidth size="small">
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
                        
                        setManualData({
                          ...manualData,
                          accountId: selectedId,
                          accountName: selected ? (selected.accountNickName || selected.nickName) : ''
                        });
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

              {/* Row 4: Transaction Description and Expense Head */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Transaction Description"
                  value={manualData.transactionDesc}
                  onChange={(e) => handleManualFieldChange('transactionDesc', e.target.value)}
                  placeholder="e.g., Bought groceries from BigMarket"
                  size="small"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Expense Head</InputLabel>
                  <Select
                    value={manualData.expenseHead}
                    label="Expense Head"
                    onChange={(e) => handleManualFieldChange('expenseHead', e.target.value)}
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

              {/* Row 5: Category and Transaction Type as Text Labels */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', height: '100%', pl: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Category
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      Sundry
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Type
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      Expense
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSaveManualTransaction}
                    disabled={isSaving}
                    startIcon={isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                    sx={{
                      background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                      color: '#ffffff !important',
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important',
                      },
                      '&.Mui-disabled': { background: '#bdbdbd !important', color: '#fff !important' }
                    }}
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleResetManualForm}
                    size="medium"
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: '#616161',
                      color: '#616161',
                      minWidth: '100px',
                      '&:hover': {
                        borderColor: '#212121',
                        bgcolor: '#f5f5f5'
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
        <TabPanel value={tabValue} index={0}>
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
                      '&:hover fieldset': { borderColor: '#616161' },
                      '&.Mui-focused fieldset': { borderColor: '#616161' }
                    }
                  }}
                />
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    endIcon={loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : <SendIcon sx={{ color: '#fff' }} />}
                    onClick={handleParseTransaction}
                    disabled={loading || !inputText.trim()}
                    fullWidth
                    sx={{
                      background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                      color: '#ffffff !important',
                      py: 1.5,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontSize: '1rem',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important',
                      },
                      '&.Mui-disabled': {
                        background: '#bdbdbd !important',
                        color: '#ffffff !important',
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
                      borderColor: '#616161',
                      color: '#616161',
                      minWidth: '100px',
                      '&:hover': {
                        borderColor: '#212121',
                        bgcolor: '#f5f5f5'
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
                    sx={{ color: '#616161', textTransform: 'none' }}
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
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Amount"
                      type="number"
                      value={parsedData.amount}
                      onChange={(e) => handleParsedFieldChange('amount', e.target.value)}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: '#f5f5f5'
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Currency</InputLabel>
                      <Select
                        value={parsedData.currency || 'INR'}
                        label="Currency"
                        onChange={(e) => handleParsedFieldChange('currency', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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

                  {/* Row 3: Payment Mode */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Mode</InputLabel>
                      <Select
                        value={parsedData.paymentMode}
                        label="Payment Mode"
                        onChange={(e) => handleParsedFieldChange('paymentMode', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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
                      <FormControl fullWidth size="small">
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
                            
                            // Update both accountId and accountName in a single state update
                            setParsedData(prev => ({
                              ...prev,
                              accountId: selectedId,
                              accountName: selected ? (selected.accountNickName || selected.nickName) : ''
                            }));
                          }}
                          sx={{
                            borderRadius: 2,
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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

                  {/* Row 4: Transaction Description and Expense Head */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Transaction Description"
                      value={parsedData.transactionDesc || ''}
                      onChange={(e) => handleParsedFieldChange('transactionDesc', e.target.value)}
                      placeholder="e.g., BigMarket, groceries"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
                        }
                      }}
                    />
                  </Grid>

                  {/* Conditional Fields Based on Transaction Type */}
                  {parsedData.type === 'income' ? (
                    <>
                      {/* For Income: Category Dropdown */}
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Category</InputLabel>
                          <Select
                            value={parsedData.category || 'Fixed'}
                            label="Category"
                            onChange={(e) => handleParsedFieldChange('category', e.target.value)}
                            sx={{
                              borderRadius: 2,
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                            }}
                          >
                            {incomeCategories.map(cat => (
                              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      {/* For Income: Income Source Dropdown */}
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Income Source</InputLabel>
                          <Select
                            value={parsedData.expenseHead || ''}
                            label="Income Source"
                            onChange={(e) => handleParsedFieldChange('expenseHead', e.target.value)}
                            sx={{
                              borderRadius: 2,
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                            }}
                          >
                            <MenuItem value="">
                              <em>Select Income Source</em>
                            </MenuItem>
                            {incomeSources.map(source => (
                              <MenuItem key={source} value={source}>{source}</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  ) : (
                    <>
                      {/* For Expense: Expense Head Dropdown */}
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Expense Head</InputLabel>
                          <Select
                            value={parsedData.expenseHead || ''}
                            label="Expense Head"
                            onChange={(e) => handleParsedFieldChange('expenseHead', e.target.value)}
                            sx={{
                              borderRadius: 2,
                              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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

                      {/* For Expense: Category and Type as Text Labels */}
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', height: '100%', pl: 1 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              Category
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              {parsedData.category || 'Sundry'}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                              Type
                            </Typography>
                            <Typography variant="body2" fontWeight={500}>
                              Expense
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                    </>
                  )}
                </Grid>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleSaveTransaction}
                  disabled={isSaving}
                  startIcon={isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                  size="medium"
                  sx={{
                    mt: 3,
                    background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                    color: '#ffffff !important',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important',
                    },
                    '&.Mui-disabled': { background: '#bdbdbd !important', color: '#fff !important' }
                  }}
                >
                  {isSaving ? 'Saving…' : 'Save Transaction'}
                </Button>
              </>
            )}
          </Box>
        </TabPanel>

        {/* TEMPLATE EXPENSES TAB */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 } }}>
            <Grid container spacing={2}>
              {/* Select Template Transaction */}
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Template Transaction</InputLabel>
                  <Select
                    value={selectedTemplateId}
                    label="Select Template Transaction"
                    onChange={handleTemplateSelect}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                    }}
                  >
                    <MenuItem value="">
                      <em>{templateTransactions.length === 0 ? 'No template transactions setup' : 'Select a transaction'}</em>
                    </MenuItem>
                    {templateTransactions.map((transaction) => (
                      <MenuItem key={transaction.id} value={transaction.id}>
                        {transaction.transactionName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {selectedTemplateId && (
                <>
                  {/* Row 1: Date */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Date"
                      type="date"
                      value={templateData.date}
                      onChange={(e) => handleTemplateFieldChange('date', e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
                        }
                      }}
                    />
                  </Grid>

                  {/* Row 2: Amount & Currency */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Amount"
                      type="number"
                      value={templateData.amount}
                      onChange={(e) => handleTemplateFieldChange('amount', e.target.value)}
                      inputProps={{ min: 0, step: 0.01 }}
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Currency</InputLabel>
                      <Select
                        value={templateData.currency}
                        label="Currency"
                        onChange={(e) => handleTemplateFieldChange('currency', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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

                  {/* Row 3: Payment Mode */}
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Mode</InputLabel>
                      <Select
                        value={templateData.paymentMode}
                        label="Payment Mode"
                        onChange={(e) => handleTemplateFieldChange('paymentMode', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                        }}
                      >
                        {PAYMENT_MODES.map(mode => (
                          <MenuItem key={mode} value={mode}>{mode}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Bank Account / Credit Card Dropdown */}
                  {shouldShowAccountDropdown(templateData.paymentMode) && (
                    <Grid item xs={12} sm={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>
                          {templateData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                        </InputLabel>
                        <Select
                          value={templateData.accountId || ''}
                          label={templateData.paymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const accounts = getAvailableAccounts(templateData.paymentMode);
                            const selected = accounts.find(acc => acc.id === selectedId);
                            
                            // Update both accountId and accountName in a single state update
                            setTemplateData(prev => ({
                              ...prev,
                              accountId: selectedId,
                              accountName: selected ? (selected.accountNickName || selected.nickName) : ''
                            }));
                          }}
                          sx={{
                            borderRadius: 2,
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                          }}
                        >
                          <MenuItem value="">
                            <em>None (Optional)</em>
                          </MenuItem>
                          {getAvailableAccounts(templateData.paymentMode).map(account => (
                            <MenuItem key={account.id} value={account.id}>
                              {account.accountNickName || account.nickName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  {/* Row 4: Transaction Description and Expense Head */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Transaction Description"
                      value={templateData.transactionDesc}
                      onChange={(e) => handleTemplateFieldChange('transactionDesc', e.target.value)}
                      placeholder="e.g., BigBasket grocery, Licious meat"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Expense Head</InputLabel>
                      <Select
                        value={templateData.expenseHead}
                        label="Expense Head"
                        onChange={(e) => handleTemplateFieldChange('expenseHead', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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

                  {/* Row 5: Category and Transaction Type as Text Labels */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', height: '100%', pl: 1 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          Category
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {templateData.category || 'Sundry'}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          Type
                        </Typography>
                        <Typography variant="body2" fontWeight={500}>
                          Expense
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Save and Reset Buttons */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleSaveTemplateExpense}
                        disabled={isSaving}
                        startIcon={isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                        size="medium"
                        sx={{
                          background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                          color: '#ffffff !important',
                          textTransform: 'none',
                          fontWeight: 600,
                          '&:hover': {
                            background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important',
                          },
                          '&.Mui-disabled': { background: '#bdbdbd !important', color: '#fff !important' }
                        }}
                      >
                        {isSaving ? 'Saving…' : 'Save Transaction'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleResetTemplateForm}
                        sx={{
                          py: 1.5,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontSize: '1rem',
                          fontWeight: 600,
                          minWidth: '120px',
                          borderColor: '#424242',
                          color: '#424242',
                          '&:hover': {
                            borderColor: '#9c27b0',
                            color: '#9c27b0',
                            backgroundColor: 'rgba(156, 39, 176, 0.04)'
                          }
                        }}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </TabPanel>

        {/* RECURRING EXPENSES TAB */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: { xs: 2, sm: 3 }, pt: { xs: 1, sm: 2 } }}>
            <Grid container spacing={2}>
              {/* Select Recurring Transaction Template */}
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Select Recurring Transaction</InputLabel>
                  <Select
                    value={selectedRecurringId}
                    label="Select Recurring Transaction"
                    onChange={handleRecurringSelect}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                    }}
                  >
                    <MenuItem value="">
                      <em>{recurringTransactions.length === 0 ? 'No recurring transactions setup' : 'Select a transaction'}</em>
                    </MenuItem>
                    {recurringTransactions
                      .filter((transaction) => {
                        const recurrenceType = transaction.recurrenceType || 'periodic';
                        return recurrenceType === 'periodic';
                      })
                      .map((transaction) => (
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
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
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
                      size="small"
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
                      size="small"
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
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Currency</InputLabel>
                      <Select
                        value={recurringData.currency}
                        label="Currency"
                        onChange={(e) => handleRecurringFieldChange('currency', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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
                    <FormControl fullWidth size="small">
                      <InputLabel>Payment Mode</InputLabel>
                      <Select
                        value={recurringData.paymentMode}
                        label="Payment Mode"
                        onChange={(e) => handleRecurringFieldChange('paymentMode', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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
                      <FormControl fullWidth size="small">
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
                            
                            setRecurringData({
                              ...recurringData,
                              accountId: selectedId,
                              accountName: selected ? (selected.accountNickName || selected.nickName) : ''
                            });
                          }}
                          sx={{
                            borderRadius: 2,
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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

                  {/* Row 5: Transaction Description and Expense Head */}
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Transaction Description"
                      value={recurringData.transactionDesc}
                      onChange={(e) => handleRecurringFieldChange('transactionDesc', e.target.value)}
                      placeholder="e.g., Monthly electricity bill, rent payment"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': { borderColor: '#616161' },
                          '&.Mui-focused fieldset': { borderColor: '#616161' }
                        }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Expense Head</InputLabel>
                      <Select
                        value={recurringData.expenseHead}
                        label="Expense Head"
                        onChange={(e) => handleRecurringFieldChange('expenseHead', e.target.value)}
                        sx={{
                          borderRadius: 2,
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleSaveRecurringExpense}
                        disabled={isSaving}
                        startIcon={isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                        size="medium"
                        sx={{
                          background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                          color: '#ffffff !important',
                          textTransform: 'none',
                          fontWeight: 600,
                          '&:hover': {
                            background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important',
                          },
                          '&.Mui-disabled': { background: '#bdbdbd !important', color: '#fff !important' }
                        }}
                      >
                        {isSaving ? 'Saving…' : 'Save Transaction'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleResetRecurringForm}
                        sx={{
                          py: 1.5,
                          px: 4,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontSize: '1rem',
                          fontWeight: 600,
                          borderColor: '#616161',
                          color: '#616161',
                          minWidth: '120px',
                          '&:hover': {
                            borderColor: '#212121',
                            bgcolor: '#f5f5f5'
                          }
                        }}
                      >
                        Reset
                      </Button>
                    </Box>
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </TabPanel>

        {/* INCOME TRANSACTION TAB */}
        <TabPanel value={tabValue} index={4}>
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
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#616161' },
                      '&.Mui-focused fieldset': { borderColor: '#616161' }
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
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      bgcolor: '#f5f5f5'
                    }
                  }}
                />
              </Grid>

              {/* Row 2: Category */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={incomeData.category}
                    label="Category"
                    onChange={(e) => handleIncomeFieldChange('category', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                    }}
                  >
                    {incomeCategories.map(cat => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 3: Amount and Currency */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={incomeData.amount}
                  onChange={(e) => handleIncomeFieldChange('amount', e.target.value)}
                  inputProps={{ min: 0, step: 0.01 }}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#616161' },
                      '&.Mui-focused fieldset': { borderColor: '#616161' }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Currency</InputLabel>
                  <Select
                    value={incomeData.currency}
                    label="Currency"
                    onChange={(e) => handleIncomeFieldChange('currency', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                    }}
                  >
                    {currencies.map(curr => (
                      <MenuItem key={curr} value={curr}>{curr}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 4: Payment Mode */}
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Payment Mode</InputLabel>
                  <Select
                    value={incomeData.paymentMode}
                    label="Payment Mode"
                    onChange={(e) => handleIncomeFieldChange('paymentMode', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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
                  <FormControl fullWidth size="small">
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
                        
                        setIncomeData({
                          ...incomeData,
                          accountId: selectedId,
                          accountName: selected ? (selected.accountNickName || selected.nickName) : ''
                        });
                      }}
                      sx={{
                        borderRadius: 2,
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
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

              {/* Row 5: Transaction Description and Income Source */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Transaction Description"
                  value={incomeData.transactionDesc}
                  onChange={(e) => handleIncomeFieldChange('transactionDesc', e.target.value)}
                  placeholder="e.g., Monthly salary from company"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                      '&:hover fieldset': { borderColor: '#616161' },
                      '&.Mui-focused fieldset': { borderColor: '#616161' }
                    }
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Income Source</InputLabel>
                  <Select
                    value={incomeData.expenseHead}
                    label="Income Source"
                    onChange={(e) => handleIncomeFieldChange('expenseHead', e.target.value)}
                    sx={{
                      borderRadius: 2,
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' }
                    }}
                  >
                    {incomeSources.map(source => (
                      <MenuItem key={source} value={source}>{source}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 6: Category and Transaction Type as Text Labels */}
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', height: '100%', pl: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Category
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {incomeData.category || 'Fixed'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                      Type
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      Income
                    </Typography>
                  </Box>
                </Box>
              </Grid>

              {/* Action Buttons */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleSaveIncomeTransaction}
                    disabled={isSaving}
                    startIcon={isSaving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                    size="medium"
                    sx={{
                      background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                      color: '#ffffff !important',
                      textTransform: 'none',
                      fontWeight: 600,
                      '&:hover': {
                        background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important',
                      },
                      '&.Mui-disabled': { background: '#bdbdbd !important', color: '#fff !important' }
                    }}
                  >
                    {isSaving ? 'Saving…' : 'Save'}
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
                      borderColor: '#616161',
                      color: '#616161',
                      minWidth: '120px',
                      '&:hover': {
                        borderColor: '#212121',
                        bgcolor: '#f5f5f5'
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

      {/* Transaction History - Week-wise Tabs */}
      <Box sx={{ bgcolor: '#f0f0f0', px: 2, py: 1.5, borderRadius: 1, mb: 2 }}>
        <Typography variant="h6" fontWeight="600" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          Transactions Log
        </Typography>
      </Box>
      
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
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1 }}>Date</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1 }}>Amount</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1 }}>Description</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1 }}>Bank Account</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1 }}>Payment</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem', py: 1 }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {weekTransactions.map((transaction) => (
                            <TableRow 
                              key={transaction.id}
                              sx={{ 
                                '&:hover': { bgcolor: '#f9f9f9' },
                                borderLeft: `3px solid ${transaction.type === 'income' ? '#4caf50' : '#f44336'}`
                              }}
                            >
                              <TableCell sx={{ fontSize: '0.75rem', py: 1, whiteSpace: 'nowrap' }}>
                                {transaction.date?.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                              </TableCell>
                              <TableCell align="right" sx={{ fontSize: '0.75rem', py: 1, fontWeight: 600 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                  {transaction.type === 'income' ? (
                                    <TrendingUpIcon sx={{ color: '#4caf50', fontSize: 16 }} />
                                  ) : (
                                    <TrendingDownIcon sx={{ color: '#f44336', fontSize: 16 }} />
                                  )}
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      color: transaction.type === 'income' ? '#4caf50' : '#f44336',
                                      fontWeight: 600,
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    {formatCurrency(transaction.amount, transaction.currency)}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.75rem', py: 1, maxWidth: 200 }}>
                                <Box>
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                    {transaction.transactionDesc || transaction.description}
                                  </Typography>
                                  {transaction.expenseHead && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                      {transaction.expenseHead}
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.75rem', py: 1 }}>
                                {transaction.accountName ? (
                                  <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                                    {transaction.accountName}
                                  </Typography>
                                ) : (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', fontStyle: 'italic' }}>
                                    {transaction.paymentMode === 'Cash' ? 'Cash' : 'N/A'}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontSize: '0.75rem', py: 1 }}>
                                <Chip 
                                  label={transaction.paymentMode} 
                                  size="small" 
                                  variant="outlined" 
                                  sx={{ fontSize: '0.65rem', height: '20px' }} 
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ py: 1 }}>
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleEditTransaction(transaction)}
                                    sx={{ color: 'primary.main', padding: '4px' }}
                                  >
                                    <EditIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleDeleteTransaction(transaction.id)}
                                    sx={{ color: '#f44336', padding: '4px' }}
                                  >
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
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
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}
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
        <DialogActions sx={{ p: 2, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            fullWidth={isMobile}
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

      {/* Quick Add FAB - Mobile Only */}
      <Fab 
        color="primary" 
        aria-label="quick add"
        onClick={() => setTabValue(0)}
        sx={{ 
          position: 'fixed', 
          bottom: { xs: 70, sm: 80 }, 
          right: { xs: 16, sm: 24 },
          display: tabValue === 0 ? 'none' : { xs: 'flex', sm: 'none' },
          background: 'linear-gradient(135deg, #5e35b1 0%, #7c4dff 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #7c4dff 0%, #5e35b1 100%)',
          }
        }}
      >
        <AddIcon />
      </Fab>

      </Box>{/* end px wrapper */}
      <Footer />
    </Box>
  );
}

export default DailyExpenseLogPage;
