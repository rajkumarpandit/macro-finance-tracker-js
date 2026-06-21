import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
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
  Fab,
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

// ── Expandable transaction row — must be a component (not inline) so useState is valid ──
function TransactionRow({ t, idx, totalInGroup, onEdit, onDelete }) {
  const [expanded, setExpanded] = React.useState(false);
  const isExpense = t.type === 'expense';
  const formatAmt = (amount, currency = 'INR') => {
    if (!currency || currency === 'INR' || currency === 'rupees') return `₹${(parseFloat(amount) || 0).toFixed(2)}`;
    return `${currency} ${(parseFloat(amount) || 0).toFixed(2)}`;
  };
  return (
    <Box>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', px: 2, py: '7px',
          borderBottom: (expanded || idx < totalInGroup - 1) ? '1px solid #f5f5f5' : 'none',
          cursor: 'pointer', '&:active': { bgcolor: '#f9fafb' }, transition: 'background 0.1s',
          bgcolor: expanded ? '#fafafa' : '#fff'
        }}
      >
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: isExpense ? '#dc2626' : '#16a34a', flexShrink: 0, mr: 1.25 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 400, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.transactionDesc || t.description || 'N/A'}
          </Typography>
          {t.expenseHead && (
            <Typography sx={{ fontSize: '0.58rem', color: '#9ca3af', mt: '1px' }}>{t.expenseHead}</Typography>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.82rem', ml: 1, color: isExpense ? '#dc2626' : '#16a34a', flexShrink: 0 }}>
          {isExpense ? '−' : '+'}{formatAmt(t.amount, t.currency)}
        </Typography>
        <Typography sx={{ fontSize: '0.6rem', color: '#d1d5db', ml: '6px', transition: 'transform 0.15s', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</Typography>
      </Box>
      {expanded && (
        <Box sx={{ px: 2, py: 1.25, bgcolor: '#f9fafb', borderBottom: idx < totalInGroup - 1 ? '1px solid #f0f0f0' : 'none' }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '6px', mb: 1.25 }}>
            {t.paymentMode && (
              <Typography sx={{ fontSize: '0.68rem', bgcolor: '#eff6ff', color: '#1d4ed8', px: '8px', py: '3px', borderRadius: '10px', fontWeight: 600 }}>{t.paymentMode}</Typography>
            )}
            {t.accountName && (
              <Typography sx={{ fontSize: '0.68rem', bgcolor: '#f3f4f6', color: '#6b7280', px: '8px', py: '3px', borderRadius: '10px' }}>{t.accountName}</Typography>
            )}
            {t.currency && t.currency !== 'INR' && (
              <Typography sx={{ fontSize: '0.68rem', bgcolor: '#fef3c7', color: '#92400e', px: '8px', py: '3px', borderRadius: '10px' }}>{t.currency}</Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" startIcon={<EditIcon sx={{ fontSize: 13 }} />}
              onClick={(e) => { e.stopPropagation(); onEdit(t); setExpanded(false); }}
              sx={{ fontSize: '0.72rem', color: '#1d4ed8', textTransform: 'none', py: '4px', px: 1.25, bgcolor: '#eff6ff', borderRadius: '8px', '&:hover': { bgcolor: '#dbeafe' }, minWidth: 0 }}>
              Edit
            </Button>
            <Button size="small" startIcon={<DeleteIcon sx={{ fontSize: 13 }} />}
              onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
              sx={{ fontSize: '0.72rem', color: '#dc2626', textTransform: 'none', py: '4px', px: 1.25, bgcolor: '#fff5f5', borderRadius: '8px', '&:hover': { bgcolor: '#fee2e2' }, minWidth: 0 }}>
              Delete
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

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

  // SMS Import states
  const [smsText, setSmsText] = useState('');
  const [smsParsing, setSmsParsing] = useState(false);
  const [smsRows, setSmsRows] = useState([]); // [{ raw, parsed, selected, saving, saved, error }]

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

  // ── SMS PARSE ──────────────────────────────────────────────────
  const splitSmsMessages = (text) => {
    const chunks = text.split(/\n{2,}/).map(c => c.trim()).filter(c => c.length > 10);
    return chunks;
  };

  // Match raw SMS text against the user's accounts to infer account + payment mode
  const inferAccountFromSms = (raw) => {
    const lowerRaw = raw.toLowerCase();

    // Helper: extract significant words from a string (3+ chars, strip common noise words)
    const sigWords = (str) =>
      (str || '').toLowerCase()
        .replace(/credit\s*card|debit\s*card|cc|dc|bank|account|savings|current|card/gi, ' ')
        .split(/[\s\-_,./|&]+/)
        .filter(w => w.length > 2);

    // 1. Credit cards — match by last 4 digits of cardNumber, OR by words in nickName
    for (const card of creditCards) {
      // Last-4 match: strip all non-digits first, then take last 4
      const last4 = (card.cardNumber || '').replace(/\D/g, '').slice(-4);
      if (last4 && lowerRaw.includes(last4)) {
        return { accountId: card.id, accountName: card.nickName || card.accountNickName || '', paymentMode: 'Credit Card' };
      }
      // Nickname word match (e.g. "ICICI CC" → word "icici" found in SMS)
      const words = sigWords(card.nickName || card.accountNickName);
      if (words.length > 0 && words.some(w => lowerRaw.includes(w))) {
        return { accountId: card.id, accountName: card.nickName || card.accountNickName || '', paymentMode: 'Credit Card' };
      }
    }

    // 2. Bank accounts — match by last 4 digits of accountNumber, bankName field, OR by words in accountNickName
    for (const bank of bankAccounts) {
      // Last-4 match: strip all non-digits first, then take last 4
      const last4 = (bank.accountNumber || '').replace(/\D/g, '').slice(-4);
      if (last4 && lowerRaw.includes(last4)) {
        return { accountId: bank.id, accountName: bank.accountNickName || '', paymentMode: 'UPI' };
      }
      // bankName field match (e.g. "Axis Bank" → word "axis" found in SMS)
      const bankNameWords = sigWords(bank.bankName);
      if (bankNameWords.length > 0 && bankNameWords.some(w => lowerRaw.includes(w))) {
        return { accountId: bank.id, accountName: bank.accountNickName || '', paymentMode: 'UPI' };
      }
      // Nickname word match fallback
      const nickWords = sigWords(bank.accountNickName);
      if (nickWords.length > 0 && nickWords.some(w => lowerRaw.includes(w))) {
        return { accountId: bank.id, accountName: bank.accountNickName || '', paymentMode: 'UPI' };
      }
    }

    // 3. Fallback to first bank account
    const defaultBank = bankAccounts[0] || null;
    return { accountId: defaultBank?.id || '', accountName: defaultBank?.accountNickName || '', paymentMode: 'UPI' };
  };

  // Detect transaction type from SMS keywords
  const inferTypeFromSms = (raw) => {
    const lower = raw.toLowerCase();
    if (/credited|received|credit/i.test(lower)) return 'income';
    if (/debited|debit|spent|payment|purchase/i.test(lower)) return 'expense';
    return 'expense';
  };

  // Detect currency from SMS text — checks symbols, codes and words
  const inferCurrencyFromSms = (raw) => {
    // Order matters: check more specific patterns first
    if (/\bINR\b|Rs\.?\s*\d|Rupees?\b|₹/i.test(raw)) return 'INR';
    if (/\bUSD\b|\$\s*\d|US\s*Dollar/i.test(raw)) return 'USD';
    if (/\bEUR\b|€\s*\d|Euro/i.test(raw)) return 'EUR';
    if (/\bGBP\b|£\s*\d|Pound/i.test(raw)) return 'GBP';
    if (/\bAUD\b|A\$\s*\d|Australian\s*Dollar/i.test(raw)) return 'AUD';
    return 'INR'; // default for Indian bank SMS
  };

  const handleParseSms = async () => {
    const chunks = splitSmsMessages(smsText);
    if (!chunks.length) return;
    setSmsParsing(true);
    const today = new Date().toISOString().split('T')[0];
    const results = [];
    for (const raw of chunks) {
      try {
        const parsed = await parseTransactionWithGemini(raw, currentUser.uid);
        const { accountId, accountName, paymentMode } = inferAccountFromSms(raw);
        const type = inferTypeFromSms(raw);
        const currency = inferCurrencyFromSms(raw);
        results.push({
          raw,
          selected: true,
          saving: false,
          saved: false,
          error: null,
          parsed: {
            date: parsed.date || today,
            transactionDesc: parsed.transactionDesc || parsed.description || '',
            amount: parsed.amount || '',
            currency,
            expenseHead: parsed.expenseHead || '',
            paymentMode,
            category: 'Sundry',
            type,
            accountId,
            accountName,
          }
        });
      } catch (err) {
        results.push({ raw, selected: false, saving: false, saved: false, error: err?.message || 'Parse failed', parsed: null });
      }
    }
    setSmsRows(results);
    setSmsParsing(false);
  };

  const handleSmsRowFieldChange = (idx, field, value) => {
    setSmsRows(prev => prev.map((r, i) => i === idx ? { ...r, parsed: { ...r.parsed, [field]: value } } : r));
  };

  const handleSmsRowToggle = (idx) => {
    setSmsRows(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const handleSubmitSmsRows = async () => {
    if (!currentLedger) {
      setNotification({ open: true, message: 'No open ledger. Please start a ledger first.', severity: 'error' }); return;
    }
    const selectedRows = smsRows.filter(r => r.selected && !r.saved && r.parsed);
    if (!selectedRows.length) {
      setNotification({ open: true, message: 'No rows selected.', severity: 'warning' }); return;
    }
    setSmsRows(prev => prev.map(r => r.selected && !r.saved ? { ...r, saving: true } : r));
    let saved = 0;
    for (let i = 0; i < smsRows.length; i++) {
      const row = smsRows[i];
      if (!row.selected || row.saved || !row.parsed) continue;
      try {
        const p = row.parsed;
        const txDate = new Date(p.date);
        txDate.setHours(12, 0, 0, 0);
        const amountINR = p.currency === 'INR' ? parseFloat(p.amount) : await convertToINR(parseFloat(p.amount), p.currency);
        await addDoc(collection(db, 'transactions'), {
          userId: currentUser.uid,
          ledgerId: currentLedger.id,
          date: Timestamp.fromDate(txDate),
          transactionDesc: p.transactionDesc,
          amount: parseFloat(p.amount) || 0,
          amountInINR: amountINR,
          currency: p.currency,
          paymentMode: p.paymentMode,
          category: p.category,
          type: p.type || 'expense',
          expenseHead: p.expenseHead,
          accountId: p.accountId,
          accountName: p.accountName,
          createdAt: Timestamp.now(),
          source: 'sms_import',
        });
        setSmsRows(prev => prev.map((r, idx) => idx === i ? { ...r, saving: false, saved: true } : r));
        saved++;
      } catch (err) {
        setSmsRows(prev => prev.map((r, idx) => idx === i ? { ...r, saving: false, error: 'Save failed' } : r));
      }
    }
    if (saved > 0) {
      setNotification({ open: true, message: `${saved} transaction${saved > 1 ? 's' : ''} saved!`, severity: 'success' });
      fetchTransactions();
      fetchOpenLedger();
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
            { value: 0, label: 'Smart',     icon: '✨', color: '#5e35b1' },
            { value: 1, label: 'Template',  icon: '📋', color: '#1565c0' },
            { value: 2, label: 'Manual',    icon: '✏️', color: '#b45309' },
            { value: 3, label: 'Recurring', icon: '🔁', color: '#0f766e' },
            { value: 4, label: 'Income',    icon: '💰', color: '#15803d' },
            { value: 5, label: 'SMS',       icon: '📩', color: '#b91c1c' },
          ];
          return (
            <Box sx={{ mb: 1.5, display: 'flex', borderRadius: '10px', overflow: 'hidden', border: '1.5px solid #e5e7eb' }}>
              {modes.map((m, i) => {
                const selected = tabValue === m.value;
                return (
                  <Box
                    key={m.value}
                    onClick={() => { setTabValue(m.value); handleClearParsedData(); }}
                    sx={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      py: '8px', px: '2px', cursor: 'pointer',
                      borderRight: i < modes.length - 1 ? '1.5px solid #e5e7eb' : 'none',
                      bgcolor: selected ? m.color : '#fff',
                      transition: 'background 0.15s ease',
                      '&:active': { filter: 'brightness(0.94)' }
                    }}
                  >
                    <Typography sx={{ fontSize: '0.95rem', lineHeight: 1, mb: '3px' }}>{m.icon}</Typography>
                    <Typography sx={{ fontSize: '0.52rem', fontWeight: selected ? 700 : 500, color: selected ? '#fff' : '#6b7280', lineHeight: 1.2, textAlign: 'center' }}>
                      {m.label}
                    </Typography>
                  </Box>
                );
              })}
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

        {/* ── SMS IMPORT TAB ── */}
        <TabPanel value={tabValue} index={5}>
          <Box sx={{ p: 2, pt: 1 }}>
            {/* Step 1 — Paste area */}
            {smsRows.length === 0 && (
              <Box>
                <Typography sx={{ fontSize: '0.72rem', color: '#6b7280', mb: 1, lineHeight: 1.5 }}>
                  Copy your bank SMS messages and paste them below. Separate multiple messages with a blank line.
                </Typography>
                <TextField
                  fullWidth multiline minRows={5} maxRows={12}
                  placeholder={"INR 350.00 debited\nA/c no. XX5118\n31-05-26, 16:31:57\nUPI/P2M/651708045993/Purohit Jitendra\nAxis Bank\n\nINR 150.00 debited\nA/c no. XX5118\n01-06-26, 09:26:58\nUPI/P2M/615270115293/MUNAJIR\nAxis Bank"}
                  value={smsText}
                  onChange={e => setSmsText(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.78rem', bgcolor: '#fafafa' } }}
                />
                <Button
                  fullWidth variant="contained" disabled={!smsText.trim() || smsParsing}
                  onClick={handleParseSms}
                  startIcon={smsParsing ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                  sx={{
                    mt: 1.5,
                    background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                    color: '#ffffff !important',
                    py: 1.5, borderRadius: 2, textTransform: 'none', fontSize: '1rem', fontWeight: 600,
                    '&:hover': { background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important' },
                    '&.Mui-disabled': { background: '#bdbdbd !important', color: '#fff !important' }
                  }}
                >
                  {smsParsing ? 'Parsing…' : '📩 Parse SMS'}
                </Button>
              </Box>
            )}

            {/* Step 2 — Review table */}
            {smsRows.length > 0 && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#111827' }}>
                    {smsRows.length} message{smsRows.length > 1 ? 's' : ''} parsed — review &amp; select
                  </Typography>
                  <Button size="small" onClick={() => { setSmsRows([]); setSmsText(''); }}
                    sx={{ fontSize: '0.68rem', color: '#6b7280', textTransform: 'none' }}>
                    ← Back
                  </Button>
                </Box>

                {smsRows.map((row, idx) => (
                  <Box key={idx} sx={{
                    mb: 1.5, border: `2px solid ${row.saved ? '#bbf7d0' : row.error ? '#fecaca' : row.selected ? '#b91c1c' : '#e5e7eb'}`,
                    borderRadius: '12px', overflow: 'hidden', opacity: row.saved ? 0.7 : 1,
                    bgcolor: row.saved ? '#f0fdf4' : row.error ? '#fef2f2' : '#fff'
                  }}>
                    {/* Row header — raw SMS + checkbox */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', px: 1.5, py: 1, bgcolor: '#f9fafb', borderBottom: '1px solid #f0f0f0', gap: 1 }}>
                      <Box
                        onClick={() => !row.saved && handleSmsRowToggle(idx)}
                        sx={{
                          width: 18, height: 18, borderRadius: '4px', flexShrink: 0, mt: '1px', cursor: 'pointer',
                          border: `2px solid ${row.selected ? '#b91c1c' : '#d1d5db'}`,
                          bgcolor: row.selected ? '#b91c1c' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                      >
                        {row.selected && <Typography sx={{ color: '#fff', fontSize: '0.6rem', lineHeight: 1, fontWeight: 900 }}>✓</Typography>}
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', color: '#6b7280', lineHeight: 1.5, flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {row.raw}
                      </Typography>
                      {row.saved && <Typography sx={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700, flexShrink: 0 }}>✓ Saved</Typography>}
                      {row.error && <Typography sx={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>⚠️ Failed</Typography>}
                    </Box>

                    {/* Error display */}
                    {row.error && (
                      <Box sx={{ px: 2, py: 1.5 }}>
                        <Alert severity="error" variant="outlined" sx={{ fontSize: '0.72rem', py: 0.5, borderRadius: '8px' }}>
                          {row.error}
                        </Alert>
                      </Box>
                    )}

                    {/* Parsed fields — editable */}
                    {row.parsed && !row.saved && (
                      <Box sx={{ px: 2, py: 2 }}>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <TextField fullWidth size="small" label="Date" type="date"
                              value={row.parsed.date}
                              onChange={e => handleSmsRowFieldChange(idx, 'date', e.target.value)}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <TextField fullWidth size="small" label="Amount" type="number"
                              value={row.parsed.amount}
                              onChange={e => handleSmsRowFieldChange(idx, 'amount', e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField fullWidth size="small" label="Description"
                              value={row.parsed.transactionDesc}
                              onChange={e => handleSmsRowFieldChange(idx, 'transactionDesc', e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Expense Head</InputLabel>
                              <Select value={row.parsed.expenseHead}
                                onChange={e => handleSmsRowFieldChange(idx, 'expenseHead', e.target.value)}
                                label="Expense Head">
                                {expenseHeads.map(h => <MenuItem key={h.id || h} value={h.name || h}>{h.name || h}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Account</InputLabel>
                              <Select value={row.parsed.accountId}
                                onChange={e => {
                                  const isCreditCard = creditCards.some(c => c.id === e.target.value);
                                  const acct = [...bankAccounts, ...creditCards].find(a => a.id === e.target.value);
                                  handleSmsRowFieldChange(idx, 'accountId', e.target.value);
                                  handleSmsRowFieldChange(idx, 'accountName', acct?.accountNickName || acct?.nickName || '');
                                  handleSmsRowFieldChange(idx, 'paymentMode', isCreditCard ? 'Credit Card' : 'UPI');
                                }}
                                label="Account">
                                <MenuItem value=""><em>None</em></MenuItem>
                                {getAvailableAccounts('Credit Card').map(card => (
                                  <MenuItem key={card.id} value={card.id}>💳 {card.accountNickName || card.nickName}</MenuItem>
                                ))}
                                {getAvailableAccounts('UPI').map(bank => (
                                  <MenuItem key={bank.id} value={bank.id}>🏦 {bank.accountNickName || bank.nickName}</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Payment Mode</InputLabel>
                              <Select value={row.parsed.paymentMode}
                                onChange={e => handleSmsRowFieldChange(idx, 'paymentMode', e.target.value)}
                                label="Payment Mode">
                                {PAYMENT_MODES.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Currency</InputLabel>
                              <Select value={row.parsed.currency}
                                onChange={e => handleSmsRowFieldChange(idx, 'currency', e.target.value)}
                                label="Currency">
                                {currencies.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Type</InputLabel>
                              <Select value={row.parsed.type}
                                onChange={e => handleSmsRowFieldChange(idx, 'type', e.target.value)}
                                label="Type">
                                <MenuItem value="expense">Expense</MenuItem>
                                <MenuItem value="income">Income</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Category</InputLabel>
                              <Select value={row.parsed.category}
                                onChange={e => handleSmsRowFieldChange(idx, 'category', e.target.value)}
                                label="Category">
                                <MenuItem value="Sundry">Sundry</MenuItem>
                                <MenuItem value="Recurring">Recurring</MenuItem>
                                <MenuItem value="Fixed">Fixed</MenuItem>
                                <MenuItem value="NonFixed">NonFixed</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </Box>
                ))}

                {/* Submit bar */}
                {smsRows.some(r => !r.saved) && (
                  <Box sx={{ position: 'sticky', bottom: 0, bgcolor: '#fff', pt: 1, pb: 0.5 }}>
                    <Button fullWidth variant="contained"
                      disabled={!smsRows.some(r => r.selected && !r.saved && r.parsed) || smsRows.some(r => r.saving)}
                      onClick={handleSubmitSmsRows}
                      startIcon={smsRows.some(r => r.saving) ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
                      sx={{
                        background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                        color: '#ffffff !important',
                        py: 1.5, borderRadius: 2, textTransform: 'none', fontSize: '1rem', fontWeight: 600,
                        '&:hover': { background: 'linear-gradient(135deg, #616161 0%, #424242 100%) !important' },
                        '&.Mui-disabled': { background: '#bdbdbd !important', color: '#fff !important' }
                      }}
                    >
                      {smsRows.some(r => r.saving)
                        ? 'Saving…'
                        : `Save ${smsRows.filter(r => r.selected && !r.saved && r.parsed).length} Transaction${smsRows.filter(r => r.selected && !r.saved).length !== 1 ? 's' : ''}`
                      }
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </TabPanel>

      {/* ── Separator between Add section and Transaction History ── */}
      <Box sx={{ mt: 3, mb: 2, borderTop: '1.5px solid #e8ecf0' }} />

      {/* Transaction History - Week-wise Tabbed Feed */}
      {(() => {
        if (transactions.length === 0) {
          return (
            <Box sx={{ textAlign: 'center', py: 5, bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0' }}>
              <ReceiptLongIcon sx={{ fontSize: 44, color: '#d1d5db', mb: 1 }} />
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151' }}>No transactions yet</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#9ca3af', mt: '4px' }}>Add your first transaction above</Typography>
            </Box>
          );
        }

        // ── Helper: get Monday of the week for a given date string ──
        const getWeekStart = (dateStr) => {
          const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
          const day = d.getDay(); // 0=Sun … 6=Sat
          const diff = day === 0 ? -6 : 1 - day; // shift to Monday
          d.setDate(d.getDate() + diff);
          return d;
        };

        const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
        const yesterday = new Date(todayDate); yesterday.setDate(todayDate.getDate() - 1);
        const thisWeekStart = getWeekStart(todayDate.toISOString());

        // ── Build ordered array of week buckets (newest first) ──
        const weekMap = {};
        transactions.forEach(t => {
          const ws = getWeekStart(t.date);
          const key = ws.toISOString().split('T')[0];
          if (!weekMap[key]) {
            const we = new Date(ws); we.setDate(ws.getDate() + 6);
            const fmtDay = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            const isThisWeek = ws.getTime() === thisWeekStart.getTime();
            weekMap[key] = {
              key,
              wsDate: ws,
              label: isThisWeek ? 'This Week' : `${fmtDay(ws)} – ${fmtDay(we)}`,
              isThisWeek,
              transactions: [],
            };
          }
          weekMap[key].transactions.push(t);
        });

        // Sort newest week first
        const weeks = Object.values(weekMap).sort((a, b) => b.wsDate - a.wsDate);

        // Clamp weekTabValue in range
        const safeWeekTab = Math.min(weekTabValue, weeks.length - 1);
        const activeWeek = weeks[safeWeekTab];

        // ── Date label helper for transactions within the selected week ──
        const getDateLabel = (dateStr) => {
          const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
          if (d.getTime() === todayDate.getTime()) return 'Today';
          if (d.getTime() === yesterday.getTime()) return 'Yesterday';
          return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
        };

        // Group active week's transactions by date label (preserve date order newest-first)
        const dateGroups = {};
        activeWeek.transactions.forEach(t => {
          const lbl = getDateLabel(t.date);
          if (!dateGroups[lbl]) dateGroups[lbl] = [];
          dateGroups[lbl].push(t);
        });

        // Week-level totals
        const weekExpense = activeWeek.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        const weekIncome  = activeWeek.transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);

        return (
          <Box>
            {/* ── Header ── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.2 }}>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Transactions
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: '#9ca3af' }}>{transactions.length} total</Typography>
            </Box>

            {/* ── Week Tab Pills (horizontal scroll) ── */}
            <Box sx={{
              display: 'flex', gap: '6px', overflowX: 'auto', mb: 1.2, pb: '4px',
              '&::-webkit-scrollbar': { height: '3px' },
              '&::-webkit-scrollbar-thumb': { bgcolor: '#d1d5db', borderRadius: '4px' },
            }}>
              {weeks.map((w, idx) => {
                const active = idx === safeWeekTab;
                return (
                  <Box
                    key={w.key}
                    onClick={() => setWeekTabValue(idx)}
                    sx={{
                      flexShrink: 0,
                      px: '10px', py: '5px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      bgcolor: active ? '#212121' : '#f3f4f6',
                      border: `1.5px solid ${active ? '#212121' : '#e5e7eb'}`,
                      transition: 'all 0.15s ease',
                      '&:active': { filter: 'brightness(0.9)' },
                    }}
                  >
                    <Typography sx={{
                      fontSize: '0.65rem', fontWeight: active ? 700 : 500,
                      color: active ? '#fff' : '#374151',
                      whiteSpace: 'nowrap',
                    }}>
                      {w.label}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* ── Week summary strip ── */}
            <Box sx={{
              display: 'flex', gap: 2, mb: 1.5, px: '2px',
              alignItems: 'center',
            }}>
              <Typography sx={{ fontSize: '0.68rem', color: '#9ca3af' }}>
                {activeWeek.transactions.length} txn{activeWeek.transactions.length !== 1 ? 's' : ''}
              </Typography>
              {weekExpense > 0 && (
                <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: '#dc2626' }}>
                  −{formatCurrency(weekExpense, 'INR')}
                </Typography>
              )}
              {weekIncome > 0 && (
                <Typography sx={{ fontSize: '0.70rem', fontWeight: 700, color: '#16a34a' }}>
                  +{formatCurrency(weekIncome, 'INR')}
                </Typography>
              )}
            </Box>

            {/* ── Date-grouped transaction feed for active week ── */}
            {Object.entries(dateGroups).map(([dateLabel, dayTxns]) => {
              const dayExpenses = dayTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
              const dayIncome  = dayTxns.filter(t => t.type === 'income' ).reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
              return (
                <Box key={dateLabel} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: '2px', mb: '6px' }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280' }}>{dateLabel}</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {dayExpenses > 0 && (
                        <Typography sx={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 600 }}>
                          −{formatCurrency(dayExpenses, 'INR')}
                        </Typography>
                      )}
                      {dayIncome > 0 && (
                        <Typography sx={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 600 }}>
                          +{formatCurrency(dayIncome, 'INR')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <Box sx={{ bgcolor: '#fff', borderRadius: '14px', border: '1px solid #e8ecf0', overflow: 'hidden' }}>
                    {dayTxns.map((t, idx) => (
                      <TransactionRow key={t.id} t={t} idx={idx} totalInGroup={dayTxns.length} onEdit={handleEditTransaction} onDelete={handleDeleteTransaction} />
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        );
      })()}
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
