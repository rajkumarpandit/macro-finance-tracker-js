import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SecurityIcon from '@mui/icons-material/Security';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SavingsIcon from '@mui/icons-material/Savings';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CategoryIcon from '@mui/icons-material/Category';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import Footer from '../Common/Footer';

function MasterRecords() {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expandedPanel, setExpandedPanel] = useState('bank');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', severity: 'success' });

  // Bank Account states
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  const [visibleAccountNumbers, setVisibleAccountNumbers] = useState({});
  const [bankForm, setBankForm] = useState({
    accountNickName: '',
    accountNumber: '',
    customerID: '',
    bankName: '',
    branchAddress: '',
    ifscCode: '',
    upiIDs: [''],
    isDefault: false
  });

  // Credit Card states
  const [creditCards, setCreditCards] = useState([]);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [visibleCardNumbers, setVisibleCardNumbers] = useState({});
  const [cardForm, setCardForm] = useState({
    nickName: '',
    cardNumber: '',
    expiryDate: '',
    isDefault: false
  });

  // Demat states
  const [demats, setDemats] = useState([]);
  const [dematDialogOpen, setDematDialogOpen] = useState(false);
  const [editingDemat, setEditingDemat] = useState(null);
  const [dematForm, setDematForm] = useState({
    brokerName: '',
    clientID: '',
    startDate: ''
  });

  // Loan states
  const [loans, setLoans] = useState([]);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [loanForm, setLoanForm] = useState({
    bankName: '',
    loanNickName: '',
    loanType: '',
    loanAmount: '',
    tenure: '',
    interestRate: '',
    loanAccountNumber: '',
    endDate: '',
    emiFrequency: '',
    emiPaymentDay: ''
  });

  // Loan EMI states
  const [loanEmis, setLoanEmis] = useState([]);
  const [loanEmiDialogOpen, setLoanEmiDialogOpen] = useState(false);
  const [editingLoanEmi, setEditingLoanEmi] = useState(null);
  const [loanEmiForm, setLoanEmiForm] = useState({
    loanId: '',
    amount: '',
    lastEmiPaidDate: '',
    nextEmiDate: '',
    loanEndDate: '',
    expenseHead: '',
    debitBankId: '',
    debitBankName: ''
  });

  // Term Deposit states
  const [termDeposits, setTermDeposits] = useState([]);
  const [tdDialogOpen, setTdDialogOpen] = useState(false);
  const [editingTd, setEditingTd] = useState(null);
  const [tdForm, setTdForm] = useState({
    bankAccountId: '',
    bankName: '',
    tdAccountNumber: '',
    principalAmount: '',
    rateOfInterest: '',
    maturityAmount: '',
    maturityDate: ''
  });

  // MF-SIP states
  const [mfSips, setMfSips] = useState([]);
  const [mfSipDialogOpen, setMfSipDialogOpen] = useState(false);
  const [editingMfSip, setEditingMfSip] = useState(null);
  const [sipPayConfirmOpen, setSipPayConfirmOpen] = useState(false);
  const [sipPayTarget, setSipPayTarget] = useState(null);
  const [emiPayConfirmOpen, setEmiPayConfirmOpen] = useState(false);
  const [emiPayTarget, setEmiPayTarget] = useState(null);
  const [mfSipForm, setMfSipForm] = useState({
    dematId: '',
    dematBrokerName: '',
    amount: '',
    amcFundHouseName: '',
    fundName: '',
    debitBankId: '',
    debitBankName: '',
    debitFrequency: '',
    debitDay: '',
    stepUpEnabled: false,
    lastPremiumPaidDate: '',
    nextPremiumDate: '',
    expenseHead: ''
  });

  // Insurance states
  const [insurances, setInsurances] = useState([]);
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState(null);
  const [insuranceForm, setInsuranceForm] = useState({
    nickName: '',
    insuranceProvider: '',
    insuranceType: '',
    startDate: '',
    endDate: '',
    premiumAmount: '',
    maturityAmount: '',
    insuranceNumber: '',
    emiFrequency: '',
    emiPaymentDay: ''
  });

  // Expense Head states
  const [expenseHeads, setExpenseHeads] = useState([]);
  const [expenseHeadDialogOpen, setExpenseHeadDialogOpen] = useState(false);
  const [editingExpenseHead, setEditingExpenseHead] = useState(null);
  const [expenseHeadForm, setExpenseHeadForm] = useState({
    name: ''
  });

  // Fetch all records
  useEffect(() => {
    if (currentUser) {
      fetchAllRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const fetchAllRecords = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchBankAccounts(),
        fetchCreditCards(),
        fetchDemats(),
        fetchLoans(),
        fetchInsurances(),
        fetchLoanEmis(),
        fetchTermDeposits(),
        fetchMfSips(),
        fetchExpenseHeads()
      ]);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  // Finds the next FUTURE occurrence of the payment day, scanning forward from tomorrow.
  // Used by Mark as Paid so the stored next date is the true upcoming payment.
  const calculateNextPaymentDate = (frequency, paymentDay) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (frequency) {
      case 'Monthly': {
        const day = parseInt(paymentDay);
        if (!day) return '';
        // Try this month first
        const candidate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), day);
        if (candidate >= tomorrow) return candidate.toISOString().split('T')[0];
        // Otherwise next month
        const next = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + 1, day);
        return next.toISOString().split('T')[0];
      }
      case 'Quarterly': {
        const day = parseInt(paymentDay);
        if (!day) return '';
        for (let m = 0; m < 4; m++) {
          const candidate = new Date(tomorrow.getFullYear(), tomorrow.getMonth() + m, day);
          if (candidate >= tomorrow) return candidate.toISOString().split('T')[0];
        }
        return '';
      }
      case 'Weekly': {
        const weekDays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const target = weekDays.indexOf(paymentDay);
        if (target === -1) return '';
        const d = new Date(tomorrow);
        while (d.getDay() !== target) d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      }
      case 'Yearly': {
        if (!paymentDay || !paymentDay.includes('-')) return '';
        const [month, date] = paymentDay.split('-').map(Number);
        if (!month || !date) return '';
        const candidate = new Date(tomorrow.getFullYear(), month - 1, date);
        if (candidate >= tomorrow) return candidate.toISOString().split('T')[0];
        const next = new Date(tomorrow.getFullYear() + 1, month - 1, date);
        return next.toISOString().split('T')[0];
      }
      default:
        return '';
    }
  };

  // Advances exactly ONE period from lastPaidDate (no skip-to-today loop).
  // Used in the edit form so the displayed next date reflects the actual next cycle.
  const calculateOneNextDate = (lastPaidDate, frequency, paymentDay) => {
    if (!lastPaidDate || !frequency || frequency === 'Lumpsum') return '';
    const lastDate = new Date(lastPaidDate);
    let nextDate = new Date(lastDate);
    switch (frequency) {
      case 'Weekly': {
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      }
      case 'Monthly': {
        const day = parseInt(paymentDay);
        if (!day) return '';
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(Math.min(day, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
        break;
      }
      case 'Quarterly': {
        const qDay = parseInt(paymentDay);
        if (!qDay) return '';
        nextDate.setMonth(nextDate.getMonth() + 3);
        nextDate.setDate(Math.min(qDay, new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate()));
        break;
      }
      case 'Yearly': {
        if (!paymentDay || !paymentDay.includes('-')) return '';
        const [month, date] = paymentDay.split('-').map(num => parseInt(num));
        if (!month || !date) return '';
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        nextDate.setMonth(month - 1);
        nextDate.setDate(date);
        break;
      }
      default:
        return '';
    }
    return nextDate.toISOString().split('T')[0];
  };

  // Bank Account CRUD operations
  const fetchBankAccounts = async () => {
    try {
      const q = query(collection(db, 'bank_accounts'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const accounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBankAccounts(accounts);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    }
  };

  const handleSaveBankAccount = async () => {
    try {
      const data = {
        ...bankForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      // If setting this as default, remove default from others
      if (bankForm.isDefault) {
        const q = query(collection(db, 'bank_accounts'), where('userId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        const updatePromises = snapshot.docs.map(docSnap => 
          updateDoc(doc(db, 'bank_accounts', docSnap.id), { isDefault: false })
        );
        await Promise.all(updatePromises);
      }

      if (editingBank) {
        await updateDoc(doc(db, 'bank_accounts', editingBank.id), data);
        setNotification({ show: true, message: 'Bank account updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'bank_accounts'), data);
        setNotification({ show: true, message: 'Bank account added successfully!', severity: 'success' });
      }

      setBankDialogOpen(false);
      resetBankForm();
      fetchBankAccounts();
    } catch (error) {
      console.error('Error saving bank account:', error);
      setNotification({ show: true, message: 'Error saving bank account', severity: 'error' });
    }
  };

  const handleDeleteBankAccount = async (id) => {
    if (window.confirm('Are you sure you want to delete this bank account?')) {
      try {
        await deleteDoc(doc(db, 'bank_accounts', id));
        setNotification({ show: true, message: 'Bank account deleted successfully!', severity: 'success' });
        fetchBankAccounts();
      } catch (error) {
        console.error('Error deleting bank account:', error);
        setNotification({ show: true, message: 'Error deleting bank account', severity: 'error' });
      }
    }
  };

  const resetBankForm = () => {
    setBankForm({
      accountNickName: '',
      accountNumber: '',
      customerID: '',
      bankName: '',
      branchAddress: '',
      ifscCode: '',
      upiIDs: [''],
      isDefault: false
    });
    setEditingBank(null);
  };

  const handleAddUPI = () => {
    setBankForm({ ...bankForm, upiIDs: [...bankForm.upiIDs, ''] });
  };

  const handleRemoveUPI = (index) => {
    const newUPIs = bankForm.upiIDs.filter((_, i) => i !== index);
    setBankForm({ ...bankForm, upiIDs: newUPIs.length > 0 ? newUPIs : [''] });
  };

  const handleUPIChange = (index, value) => {
    const newUPIs = [...bankForm.upiIDs];
    newUPIs[index] = value;
    setBankForm({ ...bankForm, upiIDs: newUPIs });
  };

  // Credit Card CRUD operations
  const fetchCreditCards = async () => {
    try {
      const q = query(collection(db, 'credit_cards'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCreditCards(cards);
    } catch (error) {
      console.error('Error fetching credit cards:', error);
    }
  };

  const handleSaveCreditCard = async () => {
    try {
      const data = {
        ...cardForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      // If setting this as default, remove default from others
      if (cardForm.isDefault) {
        const q = query(collection(db, 'credit_cards'), where('userId', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        const updatePromises = snapshot.docs.map(docSnap => 
          updateDoc(doc(db, 'credit_cards', docSnap.id), { isDefault: false })
        );
        await Promise.all(updatePromises);
      }

      if (editingCard) {
        await updateDoc(doc(db, 'credit_cards', editingCard.id), data);
        setNotification({ show: true, message: 'Credit card updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'credit_cards'), data);
        setNotification({ show: true, message: 'Credit card added successfully!', severity: 'success' });
      }

      setCardDialogOpen(false);
      resetCardForm();
      fetchCreditCards();
    } catch (error) {
      console.error('Error saving credit card:', error);
      setNotification({ show: true, message: 'Error saving credit card', severity: 'error' });
    }
  };

  const handleDeleteCreditCard = async (id) => {
    if (window.confirm('Are you sure you want to delete this credit card?')) {
      try {
        await deleteDoc(doc(db, 'credit_cards', id));
        setNotification({ show: true, message: 'Credit card deleted successfully!', severity: 'success' });
        fetchCreditCards();
      } catch (error) {
        console.error('Error deleting credit card:', error);
        setNotification({ show: true, message: 'Error deleting credit card', severity: 'error' });
      }
    }
  };

  const resetCardForm = () => {
    setCardForm({
      nickName: '',
      cardNumber: '',
      expiryDate: '',
      isDefault: false
    });
    setEditingCard(null);
  };

  // Demat CRUD operations
  const fetchDemats = async () => {
    try {
      const q = query(collection(db, 'demats'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const dematAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDemats(dematAccounts);
    } catch (error) {
      console.error('Error fetching demats:', error);
    }
  };

  const handleSaveDemat = async () => {
    try {
      const data = {
        ...dematForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      if (editingDemat) {
        await updateDoc(doc(db, 'demats', editingDemat.id), data);
        setNotification({ show: true, message: 'Demat account updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'demats'), data);
        setNotification({ show: true, message: 'Demat account added successfully!', severity: 'success' });
      }

      setDematDialogOpen(false);
      resetDematForm();
      fetchDemats();
    } catch (error) {
      console.error('Error saving demat:', error);
      setNotification({ show: true, message: 'Error saving demat account', severity: 'error' });
    }
  };

  const handleDeleteDemat = async (id) => {
    if (window.confirm('Are you sure you want to delete this demat account?')) {
      try {
        await deleteDoc(doc(db, 'demats', id));
        setNotification({ show: true, message: 'Demat account deleted successfully!', severity: 'success' });
        fetchDemats();
      } catch (error) {
        console.error('Error deleting demat:', error);
        setNotification({ show: true, message: 'Error deleting demat account', severity: 'error' });
      }
    }
  };

  const resetDematForm = () => {
    setDematForm({
      brokerName: '',
      clientID: '',
      startDate: ''
    });
    setEditingDemat(null);
  };

  // Loan CRUD operations
  const fetchLoans = async () => {
    try {
      const q = query(collection(db, 'loans'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const loanAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLoans(loanAccounts);
    } catch (error) {
      console.error('Error fetching loans:', error);
    }
  };

  const handleSaveLoan = async () => {
    try {
      const data = {
        ...loanForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      if (editingLoan) {
        await updateDoc(doc(db, 'loans', editingLoan.id), data);
        setNotification({ show: true, message: 'Loan updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'loans'), data);
        setNotification({ show: true, message: 'Loan added successfully!', severity: 'success' });
      }

      setLoanDialogOpen(false);
      resetLoanForm();
      fetchLoans();
    } catch (error) {
      console.error('Error saving loan:', error);
      setNotification({ show: true, message: 'Error saving loan', severity: 'error' });
    }
  };

  const handleDeleteLoan = async (id) => {
    if (window.confirm('Are you sure you want to delete this loan?')) {
      try {
        await deleteDoc(doc(db, 'loans', id));
        setNotification({ show: true, message: 'Loan deleted successfully!', severity: 'success' });
        fetchLoans();
      } catch (error) {
        console.error('Error deleting loan:', error);
        setNotification({ show: true, message: 'Error deleting loan', severity: 'error' });
      }
    }
  };

  const resetLoanForm = () => {
    setLoanForm({
      bankName: '',
      loanNickName: '',
      loanType: '',
      loanAmount: '',
      tenure: '',
      interestRate: '',
      loanAccountNumber: '',
      endDate: '',
      emiFrequency: '',
      emiPaymentDay: ''
    });
    setEditingLoan(null);
  };

  // Loan EMI CRUD operations
  const fetchLoanEmis = async () => {
    try {
      const q = query(collection(db, 'loan_emis'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const emiRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLoanEmis(emiRecords);
    } catch (error) {
      console.error('Error fetching loan EMIs:', error);
    }
  };

  const handleSaveLoanEmi = async () => {
    try {
      const data = {
        ...loanEmiForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      if (editingLoanEmi) {
        await updateDoc(doc(db, 'loan_emis', editingLoanEmi.id), data);
        setNotification({ show: true, message: 'Loan EMI updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'loan_emis'), data);
        setNotification({ show: true, message: 'Loan EMI added successfully!', severity: 'success' });
      }

      setLoanEmiDialogOpen(false);
      resetLoanEmiForm();
      fetchLoanEmis();
    } catch (error) {
      console.error('Error saving loan EMI:', error);
      setNotification({ show: true, message: 'Error saving loan EMI', severity: 'error' });
    }
  };

  const handleDeleteLoanEmi = async (id) => {
    if (window.confirm('Are you sure you want to delete this EMI record?')) {
      try {
        await deleteDoc(doc(db, 'loan_emis', id));
        setNotification({ show: true, message: 'Loan EMI deleted successfully!', severity: 'success' });
        fetchLoanEmis();
      } catch (error) {
        console.error('Error deleting loan EMI:', error);
        setNotification({ show: true, message: 'Error deleting loan EMI', severity: 'error' });
      }
    }
  };

  const resetLoanEmiForm = () => {
    setLoanEmiForm({
      loanId: '',
      amount: '',
      lastEmiPaidDate: '',
      nextEmiDate: '',
      loanEndDate: '',
      expenseHead: '',
      debitBankId: '',
      debitBankName: ''
    });
    setEditingLoanEmi(null);
  };

  // Term Deposit CRUD operations
  const fetchTermDeposits = async () => {
    try {
      const q = query(collection(db, 'term_deposits'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const tdRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTermDeposits(tdRecords);
    } catch (error) {
      console.error('Error fetching term deposits:', error);
    }
  };

  const handleSaveTermDeposit = async () => {
    try {
      const data = {
        ...tdForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      if (editingTd) {
        await updateDoc(doc(db, 'term_deposits', editingTd.id), data);
        setNotification({ show: true, message: 'Term Deposit updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'term_deposits'), data);
        setNotification({ show: true, message: 'Term Deposit added successfully!', severity: 'success' });
      }

      setTdDialogOpen(false);
      resetTdForm();
      fetchTermDeposits();
    } catch (error) {
      console.error('Error saving term deposit:', error);
      setNotification({ show: true, message: 'Error saving term deposit', severity: 'error' });
    }
  };

  const handleDeleteTermDeposit = async (id) => {
    if (window.confirm('Are you sure you want to delete this term deposit?')) {
      try {
        await deleteDoc(doc(db, 'term_deposits', id));
        setNotification({ show: true, message: 'Term Deposit deleted successfully!', severity: 'success' });
        fetchTermDeposits();
      } catch (error) {
        console.error('Error deleting term deposit:', error);
        setNotification({ show: true, message: 'Error deleting term deposit', severity: 'error' });
      }
    }
  };

  const resetTdForm = () => {
    setTdForm({
      bankAccountId: '',
      bankName: '',
      tdAccountNumber: '',
      principalAmount: '',
      rateOfInterest: '',
      maturityAmount: '',
      maturityDate: ''
    });
    setEditingTd(null);
  };

  const handleTdBankAccountChange = (accountId) => {
    const selectedBank = bankAccounts.find(b => b.id === accountId);
    if (selectedBank) {
      setTdForm({
        ...tdForm,
        bankAccountId: accountId,
        bankName: selectedBank.bankName || ''
      });
    } else {
      setTdForm({
        ...tdForm,
        bankAccountId: accountId,
        bankName: ''
      });
    }
  };

  // MF-SIP CRUD operations
  const fetchMfSips = async () => {
    try {
      const q = query(collection(db, 'mf_sips'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const sipRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMfSips(sipRecords);
    } catch (error) {
      console.error('Error fetching MF-SIPs:', error);
    }
  };

  const handleSaveMfSip = async () => {
    try {
      const data = {
        ...mfSipForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      if (editingMfSip) {
        await updateDoc(doc(db, 'mf_sips', editingMfSip.id), data);
        setNotification({ show: true, message: 'MF-SIP updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'mf_sips'), data);
        setNotification({ show: true, message: 'MF-SIP added successfully!', severity: 'success' });
      }

      setMfSipDialogOpen(false);
      resetMfSipForm();
      fetchMfSips();
    } catch (error) {
      console.error('Error saving MF-SIP:', error);
      setNotification({ show: true, message: 'Error saving MF-SIP', severity: 'error' });
    }
  };

  const handleMarkSipPaid = (sip) => {
    setSipPayTarget(sip);
    setSipPayConfirmOpen(true);
  };

  const handleConfirmSipPaid = async () => {
    const sip = sipPayTarget;
    setSipPayConfirmOpen(false);
    setSipPayTarget(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const nextDate = calculateNextPaymentDate(sip.debitFrequency, sip.debitDay);
      // Resolve to nickname for consistency with transaction log display;
      // falls back to stored debitBankName for SIPs saved before this fix
      const resolvedBankAccountName = bankAccounts.find(b => b.id === sip.debitBankId)?.accountNickName
        || sip.debitBankName || '';

      // 1. Advance the SIP dates
      await updateDoc(doc(db, 'mf_sips', sip.id), {
        lastPremiumPaidDate: todayStr,
        nextPremiumDate: nextDate || sip.nextPremiumDate
      });

      // 2. Find the active (open) ledger for this user
      const ledgerSnap = await getDocs(
        query(collection(db, 'ledgers'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'open')
        )
      );

      if (!ledgerSnap.empty) {
        const ledgerDoc = ledgerSnap.docs[0];
        const ledger = { id: ledgerDoc.id, ...ledgerDoc.data() };
        const amount = parseFloat(sip.amount) || 0;

        // 3. Write the debit transaction
        await addDoc(collection(db, 'transactions'), {
          userId: currentUser.uid,
          ledgerId: ledger.id,
          ledgerName: ledger.name,
          amount,
          currency: 'INR',
          amountInINR: amount,
          type: 'expense',
          category: 'Investment',
          expenseHead: sip.expenseHead || 'Investment',
          transactionDesc: `SIP - ${sip.fundName}`,
          description: `SIP - ${sip.fundName} - ${sip.amcFundHouseName || ''}`,
          date: Timestamp.fromDate(new Date(todayStr)),
          paymentMode: 'Bank Transfer',
          accountId: sip.debitBankId || '',
          accountName: resolvedBankAccountName,
          isRecurring: true,
          createdAt: Timestamp.now()
        });

        // 4. Deduct from the bank account balance inside the ledger
        if (sip.debitBankId) {
          const accountBalances = ledger.accountBalances || [];
          const idx = accountBalances.findIndex(ab => ab.accountId === sip.debitBankId);
          if (idx !== -1) {
            const current = parseFloat(accountBalances[idx].closingBalance ?? accountBalances[idx].openingBalance) || 0;
            accountBalances[idx].closingBalance = current - amount;
            await updateDoc(doc(db, 'ledgers', ledger.id), { accountBalances });
          }
        }

        setNotification({ show: true, message: `SIP payment recorded & transaction logged! Next date: ${nextDate || 'unchanged'}`, severity: 'success' });
      } else {
        setNotification({ show: true, message: `SIP dates updated. No open ledger found — transaction not logged.`, severity: 'warning' });
      }

      fetchMfSips();
    } catch (error) {
      console.error('Error marking SIP paid:', error);
      setNotification({ show: true, message: 'Error recording SIP payment', severity: 'error' });
    }
  };

  const handleDeleteMfSip = async (id) => {
    if (window.confirm('Are you sure you want to delete this MF-SIP?')) {
      try {
        await deleteDoc(doc(db, 'mf_sips', id));
        setNotification({ show: true, message: 'MF-SIP deleted successfully!', severity: 'success' });
        fetchMfSips();
      } catch (error) {
        console.error('Error deleting MF-SIP:', error);
        setNotification({ show: true, message: 'Error deleting MF-SIP', severity: 'error' });
      }
    }
  };

  const resetMfSipForm = () => {
    setMfSipForm({
      dematId: '',
      dematBrokerName: '',
      amount: '',
      amcFundHouseName: '',
      fundName: '',
      debitBankId: '',
      debitBankName: '',
      debitFrequency: '',
      debitDay: '',
      stepUpEnabled: false,
      lastPremiumPaidDate: '',
      nextPremiumDate: '',
      expenseHead: ''
    });
    setEditingMfSip(null);
  };

  const handleMfSipDematChange = (dematId) => {
    const selectedDemat = demats.find(d => d.id === dematId);
    if (selectedDemat) {
      setMfSipForm({
        ...mfSipForm,
        dematId,
        dematBrokerName: selectedDemat.brokerName || ''
      });
    } else {
      setMfSipForm({
        ...mfSipForm,
        dematId,
        dematBrokerName: ''
      });
    }
  };

  const handleMfSipDebitBankChange = (bankId) => {
    const selectedBank = bankAccounts.find(b => b.id === bankId);
    if (selectedBank) {
      setMfSipForm({
        ...mfSipForm,
        debitBankId: bankId,
        // Store nickname (e.g. 'SBI-KHB') so transaction log shows consistent name
        debitBankName: selectedBank.accountNickName || selectedBank.bankName || ''
      });
    } else {
      setMfSipForm({
        ...mfSipForm,
        debitBankId: bankId,
        debitBankName: ''
      });
    }
  };

  const handleMfSipFrequencyChange = (frequency) => {
    setMfSipForm({
      ...mfSipForm,
      debitFrequency: frequency,
      debitDay: '',
      nextPremiumDate: ''
    });
  };

  const handleMfSipDebitDayChange = (day) => {
    setMfSipForm(prev => {
      if (prev.lastPremiumPaidDate && prev.debitFrequency && prev.debitFrequency !== 'Lumpsum') {
        const nextDate = calculateOneNextDate(prev.lastPremiumPaidDate, prev.debitFrequency, day);
        return { ...prev, debitDay: day, nextPremiumDate: nextDate };
      }
      return { ...prev, debitDay: day };
    });
  };

  const handleMfSipLastPremiumDateChange = (date) => {
    setMfSipForm(prev => {
      if (prev.debitFrequency && prev.debitDay && prev.debitFrequency !== 'Lumpsum') {
        const nextDate = calculateOneNextDate(date, prev.debitFrequency, prev.debitDay);
        return { ...prev, lastPremiumPaidDate: date, nextPremiumDate: nextDate };
      }
      return { ...prev, lastPremiumPaidDate: date };
    });
  };

  const handleLoanEmiLoanChange = (loanId) => {
    const selectedLoan = loans.find(l => l.id === loanId);
    setLoanEmiForm(prev => {
      if (selectedLoan) {
        const lastPaidDate = prev.lastEmiPaidDate || new Date().toISOString().split('T')[0];
        const nextEmi = calculateOneNextDate(lastPaidDate, selectedLoan.emiFrequency, selectedLoan.emiPaymentDay);
        return { ...prev, loanId, loanEndDate: selectedLoan.endDate || '', nextEmiDate: nextEmi };
      }
      return { ...prev, loanId, loanEndDate: '', nextEmiDate: '' };
    });
  };

  const handleLoanEmiLastPaidDateChange = (date) => {
    setLoanEmiForm(prev => {
      const selectedLoan = loans.find(l => l.id === prev.loanId);
      if (selectedLoan) {
        const nextEmi = calculateOneNextDate(date, selectedLoan.emiFrequency, selectedLoan.emiPaymentDay);
        return { ...prev, lastEmiPaidDate: date, nextEmiDate: nextEmi };
      }
      return { ...prev, lastEmiPaidDate: date };
    });
  };

  const handleLoanEmiBankChange = (bankId) => {
    const selectedBank = bankAccounts.find(b => b.id === bankId);
    setLoanEmiForm(prev => ({
      ...prev,
      debitBankId: bankId,
      debitBankName: selectedBank?.accountNickName || selectedBank?.bankName || ''
    }));
  };

  const handleMarkEmiPaid = (emi) => {
    setEmiPayTarget(emi);
    setEmiPayConfirmOpen(true);
  };

  const handleConfirmEmiPaid = async () => {
    const emi = emiPayTarget;
    setEmiPayConfirmOpen(false);
    setEmiPayTarget(null);
    try {
      const loan = loans.find(l => l.id === emi.loanId);
      const todayStr = new Date().toISOString().split('T')[0];
      const nextDate = loan
        ? calculateNextPaymentDate(loan.emiFrequency, loan.emiPaymentDay)
        : '';
      const resolvedBankName = bankAccounts.find(b => b.id === emi.debitBankId)?.accountNickName
        || emi.debitBankName || '';

      // 1. Advance EMI dates
      await updateDoc(doc(db, 'loan_emis', emi.id), {
        lastEmiPaidDate: todayStr,
        nextEmiDate: nextDate || emi.nextEmiDate
      });

      // 2. Find the active (open) ledger
      const ledgerSnap = await getDocs(
        query(collection(db, 'ledgers'),
          where('userId', '==', currentUser.uid),
          where('status', '==', 'open')
        )
      );

      if (!ledgerSnap.empty) {
        const ledgerDoc = ledgerSnap.docs[0];
        const ledger = { id: ledgerDoc.id, ...ledgerDoc.data() };
        const amount = parseFloat(emi.amount) || 0;

        // 3. Write the debit transaction
        await addDoc(collection(db, 'transactions'), {
          userId: currentUser.uid,
          ledgerId: ledger.id,
          ledgerName: ledger.name,
          amount,
          currency: 'INR',
          amountInINR: amount,
          type: 'expense',
          category: 'Loan EMI',
          expenseHead: emi.expenseHead || 'Loan Repayment',
          transactionDesc: `EMI - ${loan?.loanNickName || ''}`,
          description: `Loan EMI - ${loan?.loanNickName || ''} - ${loan?.bankName || ''}`,
          date: Timestamp.fromDate(new Date(todayStr)),
          paymentMode: 'Bank Transfer',
          accountId: emi.debitBankId || '',
          accountName: resolvedBankName,
          isRecurring: true,
          createdAt: Timestamp.now()
        });

        // 4. Deduct from bank account balance
        if (emi.debitBankId) {
          const accountBalances = ledger.accountBalances || [];
          const idx = accountBalances.findIndex(ab => ab.accountId === emi.debitBankId);
          if (idx !== -1) {
            const current = parseFloat(accountBalances[idx].closingBalance ?? accountBalances[idx].openingBalance) || 0;
            accountBalances[idx].closingBalance = current - amount;
            await updateDoc(doc(db, 'ledgers', ledger.id), { accountBalances });
          }
        }
        setNotification({ show: true, message: `EMI payment recorded & transaction logged! Next date: ${nextDate || 'unchanged'}`, severity: 'success' });
      } else {
        setNotification({ show: true, message: `EMI dates updated. No open ledger found — transaction not logged.`, severity: 'warning' });
      }
      fetchLoanEmis();
    } catch (error) {
      console.error('Error marking EMI paid:', error);
      setNotification({ show: true, message: 'Error recording EMI payment', severity: 'error' });
    }
  };

  // Insurance CRUD operations
  const fetchInsurances = async () => {
    try {
      const q = query(collection(db, 'insurances'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const insurancePolicies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInsurances(insurancePolicies);
    } catch (error) {
      console.error('Error fetching insurances:', error);
    }
  };

  const handleSaveInsurance = async () => {
    try {
      const data = {
        ...insuranceForm,
        userId: currentUser.uid,
        createdAt: Timestamp.now()
      };

      if (editingInsurance) {
        await updateDoc(doc(db, 'insurances', editingInsurance.id), data);
        setNotification({ show: true, message: 'Insurance updated successfully!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'insurances'), data);
        setNotification({ show: true, message: 'Insurance added successfully!', severity: 'success' });
      }

      setInsuranceDialogOpen(false);
      resetInsuranceForm();
      fetchInsurances();
    } catch (error) {
      console.error('Error saving insurance:', error);
      setNotification({ show: true, message: 'Error saving insurance', severity: 'error' });
    }
  };

  const handleDeleteInsurance = async (id) => {
    if (window.confirm('Are you sure you want to delete this insurance?')) {
      try {
        await deleteDoc(doc(db, 'insurances', id));
        setNotification({ show: true, message: 'Insurance deleted successfully!', severity: 'success' });
        fetchInsurances();
      } catch (error) {
        console.error('Error deleting insurance:', error);
        setNotification({ show: true, message: 'Error deleting insurance', severity: 'error' });
      }
    }
  };

  const resetInsuranceForm = () => {
    setInsuranceForm({
      nickName: '',
      insuranceProvider: '',
      insuranceType: '',
      startDate: '',
      endDate: '',
      premiumAmount: '',
      maturityAmount: '',
      insuranceNumber: '',
      emiFrequency: '',
      emiPaymentDay: ''
    });
    setEditingInsurance(null);
  };

  // Expense Head CRUD operations
  const fetchExpenseHeads = async () => {
    try {
      const q = query(collection(db, 'expense_heads'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const heads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      heads.sort((a, b) => a.name.localeCompare(b.name));
      setExpenseHeads(heads);
    } catch (error) {
      console.error('Error fetching expense heads:', error);
    }
  };

  const handleSaveExpenseHead = async () => {
    if (!expenseHeadForm.name.trim()) {
      setNotification({ show: true, message: 'Expense head name is required', severity: 'error' });
      return;
    }

    // Check for duplicates
    const duplicate = expenseHeads.find(
      head => head.name.toLowerCase() === expenseHeadForm.name.trim().toLowerCase() && 
      head.id !== editingExpenseHead?.id
    );
    
    if (duplicate) {
      setNotification({ show: true, message: 'This expense head already exists', severity: 'error' });
      return;
    }

    try {
      const data = {
        userId: currentUser.uid,
        name: expenseHeadForm.name.trim(),
        updatedAt: Timestamp.now()
      };

      if (editingExpenseHead) {
        await updateDoc(doc(db, 'expense_heads', editingExpenseHead.id), data);
        setNotification({ show: true, message: 'Expense head updated successfully!', severity: 'success' });
      } else {
        data.createdAt = Timestamp.now();
        await addDoc(collection(db, 'expense_heads'), data);
        setNotification({ show: true, message: 'Expense head added successfully!', severity: 'success' });
      }

      setExpenseHeadDialogOpen(false);
      resetExpenseHeadForm();
      fetchExpenseHeads();
    } catch (error) {
      console.error('Error saving expense head:', error);
      setNotification({ show: true, message: 'Error saving expense head', severity: 'error' });
    }
  };

  const handleDeleteExpenseHead = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense head?')) {
      try {
        await deleteDoc(doc(db, 'expense_heads', id));
        setNotification({ show: true, message: 'Expense head deleted successfully!', severity: 'success' });
        fetchExpenseHeads();
      } catch (error) {
        console.error('Error deleting expense head:', error);
        setNotification({ show: true, message: 'Error deleting expense head', severity: 'error' });
      }
    }
  };

  const resetExpenseHeadForm = () => {
    setExpenseHeadForm({
      name: ''
    });
    setEditingExpenseHead(null);
  };

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedPanel(isExpanded ? panel : false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AccountBalanceWalletIcon sx={{ fontSize: 24, color: '#42a5f5' }} />
        <Typography variant="h6" fontWeight="700" sx={{ fontSize: '1.1rem' }}>
          Master Records
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Bank Accounts Card */}
        <Accordion 
          expanded={expandedPanel === 'bank'} 
          onChange={handleAccordionChange('bank')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'bank' ? '#e3f2fd' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <AccountBalanceIcon sx={{ color: '#1976d2', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Bank Accounts</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetBankForm();
                  setBankDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#1976d2', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#1565c0' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>
            {bankAccounts.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No bank accounts added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {bankAccounts.map((account) => (
                  <React.Fragment key={account.id}>
                    <ListItem
                      sx={{ 
                        py: 1.5, 
                        borderLeft: account.isDefault ? '3px solid #4caf50' : 'none',
                        bgcolor: account.isDefault ? '#f1f8e9' : 'inherit'
                      }}
                      secondaryAction={
                        <Box>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => {
                              setEditingBank(account);
                              setBankForm(account);
                              setBankDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" edge="end" onClick={() => handleDeleteBankAccount(account.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>{account.accountNickName}</Typography>
                            <Chip label={account.bankName} size="small" color="primary" sx={{ height: '20px', fontSize: '0.7rem' }} />
                            {account.isDefault && <Chip label="Default" size="small" color="success" sx={{ height: '20px', fontSize: '0.7rem' }} />}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                Account: {visibleAccountNumbers[account.id] 
                                  ? account.accountNumber 
                                  : account.accountNumber.slice(0, 4) + '****' + account.accountNumber.slice(-4)}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setVisibleAccountNumbers(prev => ({ ...prev, [account.id]: true }));
                                  setTimeout(() => {
                                    setVisibleAccountNumbers(prev => ({ ...prev, [account.id]: false }));
                                  }, 10000);
                                }}
                                disabled={visibleAccountNumbers[account.id]}
                                sx={{ p: 0.25 }}
                              >
                                <VisibilityIcon sx={{ fontSize: '0.9rem' }} />
                              </IconButton>
                            </Box>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>IFSC: {account.ifscCode}</Typography>
                            {account.upiIDs && account.upiIDs.length > 0 && (
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>UPI: {account.upiIDs.filter(u => u).join(', ')}</Typography>
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
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* Credit Cards Card */}
        <Accordion 
          expanded={expandedPanel === 'creditcard'} 
          onChange={handleAccordionChange('creditcard')}
          elevation={2}
          sx={{ borderRadius: 1, overflow:'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'creditcard' ? '#e3f2fd' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <CreditCardIcon sx={{ color: '#d32f2f', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Credit Cards</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {creditCards.length} card{creditCards.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetCardForm();
                  setCardDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#d32f2f', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#c62828' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {creditCards.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No credit cards added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {creditCards.map((card) => (
                  <React.Fragment key={card.id}>
                    <ListItem
                      sx={{ 
                        py: 1.5, 
                        borderLeft: card.isDefault ? '3px solid #4caf50' : 'none',
                        bgcolor: card.isDefault ? '#f1f8e9' : 'inherit'
                      }}
                      secondaryAction={
                        <Box>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => {
                              setEditingCard(card);
                              setCardForm(card);
                              setCardDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" edge="end" onClick={() => handleDeleteCreditCard(card.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>{card.nickName}</Typography>
                            {card.isDefault && <Chip label="Default" size="small" color="success" sx={{ height: '20px', fontSize: '0.7rem' }} />}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                                Card: {visibleCardNumbers[card.id]
                                  ? card.cardNumber
                                  : '**** **** **** ' + card.cardNumber.slice(-4)}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setVisibleCardNumbers(prev => ({ ...prev, [card.id]: true }));
                                  setTimeout(() => {
                                    setVisibleCardNumbers(prev => ({ ...prev, [card.id]: false }));
                                  }, 10000);
                                }}
                                disabled={visibleCardNumbers[card.id]}
                                sx={{ p: 0.25 }}
                              >
                                <VisibilityIcon sx={{ fontSize: '0.9rem' }} />
                              </IconButton>
                            </Box>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Expiry: {card.expiryDate}</Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* Demat Accounts Card */}
        <Accordion 
          expanded={expandedPanel === 'demat'} 
          onChange={handleAccordionChange('demat')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'demat' ? '#e8f5e9' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <ShowChartIcon sx={{ color: '#388e3c', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Demat Accounts</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {demats.length} account{demats.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetDematForm();
                  setDematDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#388e3c', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#2e7d32' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {demats.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No demat accounts added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {demats.map((demat) => (
                  <React.Fragment key={demat.id}>
                    <ListItem
                      sx={{ py: 1.5 }}
                      secondaryAction={
                        <Box>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => {
                              setEditingDemat(demat);
                              setDematForm(demat);
                              setDematDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" edge="end" onClick={() => handleDeleteDemat(demat.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={<Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>{demat.brokerName}</Typography>}
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Client ID: {demat.clientID}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Start Date: {demat.startDate}</Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* Loans Card */}
        <Accordion 
          expanded={expandedPanel === 'loan'} 
          onChange={handleAccordionChange('loan')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'loan' ? '#fff3e0' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <ReceiptLongIcon sx={{ color: '#f57c00', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Loans</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {loans.length} loan{loans.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetLoanForm();
                  setLoanDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#f57c00', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#ef6c00' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {loans.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No loans added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {loans.map((loan) => (
                  <React.Fragment key={loan.id}>
                    <ListItem
                      sx={{ py: 1.5 }}
                      secondaryAction={
                        <Box>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => {
                              setEditingLoan(loan);
                              setLoanForm(loan);
                              setLoanDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" edge="end" onClick={() => handleDeleteLoan(loan.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>{loan.bankName}</Typography>
                            <Chip label={loan.loanType} size="small" color="secondary" sx={{ height: '20px', fontSize: '0.7rem' }} />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Account: {loan.loanAccount}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Amount: ₹{loan.loanAmount} | Rate: {loan.interestRate}% | Tenure: {loan.tenure} months</Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* Insurance Card */}
        <Accordion 
          expanded={expandedPanel === 'insurance'} 
          onChange={handleAccordionChange('insurance')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'insurance' ? '#f3e5f5' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <SecurityIcon sx={{ color: '#7b1fa2', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Insurance Policies</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {insurances.length} polic{insurances.length !== 1 ? 'ies' : 'y'}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetInsuranceForm();
                  setInsuranceDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#7b1fa2', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#6a1b9a' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {insurances.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No insurance policies added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {insurances.map((insurance) => (
                  <React.Fragment key={insurance.id}>
                    <ListItem
                      sx={{ py: 1.5 }}
                      secondaryAction={
                        <Box>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => {
                              setEditingInsurance(insurance);
                              setInsuranceForm(insurance);
                              setInsuranceDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" edge="end" onClick={() => handleDeleteInsurance(insurance.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>{insurance.nickName}</Typography>
                            <Chip label={insurance.insuranceType} size="small" color="info" sx={{ height: '20px', fontSize: '0.7rem' }} />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Provider: {insurance.insuranceProvider}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Period: {insurance.startDate} to {insurance.endDate}</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Premium: ₹{insurance.premiumAmount} | Maturity: ₹{insurance.maturityAmount}</Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* Loan EMI Card */}
        <Accordion 
          expanded={expandedPanel === 'loanemi'} 
          onChange={handleAccordionChange('loanemi')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'loanemi' ? '#fce4ec' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <ReceiptLongIcon sx={{ color: '#c2185b', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Loan EMI Records</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {loanEmis.length} record{loanEmis.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetLoanEmiForm();
                  setLoanEmiDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#c2185b', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#ad1457' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {loanEmis.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No EMI records added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {loanEmis.map((emi) => {
                  const loan = loans.find(l => l.id === emi.loanId);
                  return (
                    <React.Fragment key={emi.id}>
                      <ListItem
                        sx={{ py: 1.5 }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <IconButton
                              size="small"
                              title="Mark EMI as Paid"
                              onClick={() => handleMarkEmiPaid(emi)}
                              sx={{ color: 'success.main' }}
                            >
                              <TaskAltIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={() => {
                                setEditingLoanEmi(emi);
                                setLoanEmiForm(emi);
                                setLoanEmiDialogOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" edge="end" onClick={() => handleDeleteLoanEmi(emi.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>
                                {loan ? loan.loanNickName : 'Unknown Loan'}
                              </Typography>
                              {loan && (
                                <Chip label={loan.loanType} size="small" color="primary" sx={{ height: '20px', fontSize: '0.7rem' }} />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>EMI Amount: ₹{emi.amount}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Last Paid: {emi.lastEmiPaidDate}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'primary.main' }}>Next Due: {emi.nextEmiDate}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Loan End: {emi.loanEndDate || 'N/A'}</Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* Term Deposit Card */}
        <Accordion 
          expanded={expandedPanel === 'td'} 
          onChange={handleAccordionChange('td')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'td' ? '#e0f2f1' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <SavingsIcon sx={{ color: '#00897b', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Term Deposits</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {termDeposits.length} deposit{termDeposits.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetTdForm();
                  setTdDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#00897b', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#00796b' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {termDeposits.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No term deposits added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {termDeposits.map((td) => {
                  const bank = bankAccounts.find(b => b.id === td.bankAccountId);
                  return (
                    <React.Fragment key={td.id}>
                      <ListItem
                        sx={{ py: 1.5 }}
                        secondaryAction={
                          <Box>
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={() => {
                                setEditingTd(td);
                                setTdForm(td);
                                setTdDialogOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" edge="end" onClick={() => handleDeleteTermDeposit(td.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>
                                {td.bankName || (bank ? bank.bankName : 'Unknown Bank')}
                              </Typography>
                              <Chip label="TD" size="small" color="success" sx={{ height: '20px', fontSize: '0.7rem' }} />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Account: {td.tdAccountNumber}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Principal: ₹{td.principalAmount} | Interest: {td.rateOfInterest}%</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'success.main' }}>Maturity: ₹{td.maturityAmount} on {td.maturityDate}</Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* MF-SIP Card */}
        <Accordion 
          expanded={expandedPanel === 'mfsip'} 
          onChange={handleAccordionChange('mfsip')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'mfsip' ? '#fff8e1' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <TrendingUpIcon sx={{ color: '#f57f17', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>MF-SIP Records</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {mfSips.length} SIP{mfSips.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetMfSipForm();
                  setMfSipDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#f57f17', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#ef6c00' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {mfSips.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No MF-SIP records added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {mfSips.map((sip) => {
                  const demat = demats.find(d => d.id === sip.dematId);
                  const bank = bankAccounts.find(b => b.id === sip.debitBankId);
                  return (
                    <React.Fragment key={sip.id}>
                      <ListItem
                        sx={{ py: 1.5 }}
                        secondaryAction={
                          <Box>
                            <IconButton
                              size="small"
                              edge="end"
                              title="Mark as Paid"
                              onClick={() => handleMarkSipPaid(sip)}
                              sx={{ color: 'success.main' }}
                            >
                              <TaskAltIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              edge="end"
                              onClick={() => {
                                setEditingMfSip(sip);
                                setMfSipForm(sip);
                                setMfSipDialogOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" edge="end" onClick={() => handleDeleteMfSip(sip.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>
                                {sip.fundName}
                              </Typography>
                              <Chip label="SIP" size="small" color="secondary" sx={{ height: '20px', fontSize: '0.7rem' }} />
                              {sip.stepUpEnabled && (
                                <Chip label="Step Up" size="small" color="info" sx={{ height: '20px', fontSize: '0.7rem' }} />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>AMC: {sip.amcFundHouseName}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Demat: {sip.dematBrokerName || (demat ? demat.brokerName : 'N/A')}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Amount: ₹{sip.amount} | {sip.debitFrequency}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>Bank: {sip.debitBankName || (bank ? bank.bankName : 'N/A')}</Typography>
                              <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'secondary.main' }}>Next Debit: {sip.nextPremiumDate}</Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>

        {/* Expense Heads Card */}
        <Accordion 
          expanded={expandedPanel === 'expensehead'} 
          onChange={handleAccordionChange('expensehead')}
          elevation={2}
          sx={{ borderRadius: 1, overflow: 'hidden' }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{
              bgcolor: expandedPanel === 'expensehead' ? '#fce4ec' : '#ffffff',
              '&:hover': { bgcolor: '#f5f5f5' },
              minHeight: 56,
              '& .MuiAccordionSummary-content': { my: 1.5, alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <CategoryIcon sx={{ color: '#e91e63', fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight="600" sx={{ fontSize: '0.95rem' }}>Expense Heads</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                  {expenseHeads.length} categor{expenseHeads.length !== 1 ? 'ies' : 'y'}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetExpenseHeadForm();
                  setExpenseHeadDialogOpen(true);
                }}
                sx={{ 
                  bgcolor: '#e91e63', 
                  color: '#fff',
                  '&:hover': { bgcolor: '#c2185b' },
                  width: 32,
                  height: 32
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0, bgcolor: '#fafafa' }}>
            <Box sx={{ p: 2 }}>

            {expenseHeads.length === 0 ? (
              <Alert severity="info" sx={{ py: 0.5, fontSize: '0.85rem' }}>No expense heads added yet. Click + to get started.</Alert>
            ) : (
              <List sx={{ py: 0, bgcolor: '#ffffff', borderRadius: 1 }}>
                {expenseHeads.map((head) => (
                  <React.Fragment key={head.id}>
                    <ListItem
                      sx={{ py: 1.5 }}
                      secondaryAction={
                        <Box>
                          <IconButton
                            size="small"
                            edge="end"
                            onClick={() => {
                              setEditingExpenseHead(head);
                              setExpenseHeadForm({ name: head.name });
                              setExpenseHeadDialogOpen(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" edge="end" onClick={() => handleDeleteExpenseHead(head.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={<Typography fontWeight="600" sx={{ fontSize: '0.9rem' }}>{head.name}</Typography>}
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Bank Account Dialog */}
      <Dialog open={bankDialogOpen} onClose={() => setBankDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}>
        <DialogTitle>{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Account Nick Name"
                value={bankForm.accountNickName}
                onChange={(e) => setBankForm({ ...bankForm, accountNickName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Account Number"
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Customer ID"
                value={bankForm.customerID}
                onChange={(e) => setBankForm({ ...bankForm, customerID: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Bank Name"
                value={bankForm.bankName}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Branch Address"
                value={bankForm.branchAddress}
                onChange={(e) => setBankForm({ ...bankForm, branchAddress: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="IFSC Code"
                value={bankForm.ifscCode}
                onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>UPI IDs</Typography>
              {bankForm.upiIDs.map((upi, index) => (
                <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="UPI ID (e.g., user@paytm)"
                    value={upi}
                    onChange={(e) => handleUPIChange(index, e.target.value)}
                  />
                  {bankForm.upiIDs.length > 1 && (
                    <IconButton onClick={() => handleRemoveUPI(index)} color="error">
                      <CloseIcon />
                    </IconButton>
                  )}
                </Box>
              ))}
              <Button startIcon={<AddIcon />} size="small" onClick={handleAddUPI}>
                Add UPI ID
              </Button>
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={bankForm.isDefault || false}
                    onChange={(e) => setBankForm({ ...bankForm, isDefault: e.target.checked })}
                  />
                }
                label="Set as Default Bank Account"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: { xs: 3, sm: 2 }, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setBankDialogOpen(false)}>Cancel</Button>
          <Button fullWidth={isMobile} onClick={handleSaveBankAccount} variant="contained">
            {editingBank ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Credit Card Dialog */}
      <Dialog open={cardDialogOpen} onClose={() => setCardDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}>
        <DialogTitle>{editingCard ? 'Edit Credit Card' : 'Add Credit Card'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nick Name"
                value={cardForm.nickName}
                onChange={(e) => setCardForm({ ...cardForm, nickName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Credit Card Number"
                value={cardForm.cardNumber}
                onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value })}
                inputProps={{ maxLength: 16 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Expiry Date"
                type="month"
                value={cardForm.expiryDate}
                onChange={(e) => setCardForm({ ...cardForm, expiryDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={cardForm.isDefault || false}
                    onChange={(e) => setCardForm({ ...cardForm, isDefault: e.target.checked })}
                  />
                }
                label="Set as Default Credit Card"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: { xs: 3, sm: 2 }, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setCardDialogOpen(false)}>Cancel</Button>
          <Button fullWidth={isMobile} onClick={handleSaveCreditCard} variant="contained">
            {editingCard ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Demat Dialog */}
      <Dialog open={dematDialogOpen} onClose={() => setDematDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}>
        <DialogTitle>{editingDemat ? 'Edit Demat Account' : 'Add Demat Account'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Broker Name"
                value={dematForm.brokerName}
                onChange={(e) => setDematForm({ ...dematForm, brokerName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Client ID"
                value={dematForm.clientID}
                onChange={(e) => setDematForm({ ...dematForm, clientID: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={dematForm.startDate}
                onChange={(e) => setDematForm({ ...dematForm, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: { xs: 3, sm: 2 }, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setDematDialogOpen(false)}>Cancel</Button>
          <Button fullWidth={isMobile} onClick={handleSaveDemat} variant="contained">
            {editingDemat ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loan Dialog */}
      <Dialog open={loanDialogOpen} onClose={() => setLoanDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}>
        <DialogTitle>{editingLoan ? 'Edit Loan' : 'Add Loan'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Bank Name"
                value={loanForm.bankName}
                onChange={(e) => setLoanForm({ ...loanForm, bankName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Loan Nick Name"
                value={loanForm.loanNickName}
                onChange={(e) => setLoanForm({ ...loanForm, loanNickName: e.target.value })}
                placeholder="e.g., My Home Loan"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Loan Type"
                value={loanForm.loanType}
                onChange={(e) => setLoanForm({ ...loanForm, loanType: e.target.value })}
                placeholder="e.g., Home Loan, Personal Loan"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Loan Amount"
                type="number"
                value={loanForm.loanAmount}
                onChange={(e) => setLoanForm({ ...loanForm, loanAmount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tenure (months)"
                type="number"
                value={loanForm.tenure}
                onChange={(e) => setLoanForm({ ...loanForm, tenure: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Interest Rate (%)"
                type="number"
                value={loanForm.interestRate}
                onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
                inputProps={{ step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Loan Account Number"
                value={loanForm.loanAccountNumber}
                onChange={(e) => setLoanForm({ ...loanForm, loanAccountNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={loanForm.endDate}
                onChange={(e) => setLoanForm({ ...loanForm, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>EMI Frequency</InputLabel>
                <Select
                  value={loanForm.emiFrequency}
                  label="EMI Frequency"
                  onChange={(e) => setLoanForm({ ...loanForm, emiFrequency: e.target.value, emiPaymentDay: '' })}
                >
                  <MenuItem value="">Select Frequency</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                  <MenuItem value="Quarterly">Quarterly</MenuItem>
                  <MenuItem value="Yearly">Yearly</MenuItem>
                  <MenuItem value="Lumpsum">Lumpsum</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              {loanForm.emiFrequency === 'Weekly' && (
                <FormControl fullWidth>
                  <InputLabel>EMI Payment Day</InputLabel>
                  <Select
                    value={loanForm.emiPaymentDay}
                    label="EMI Payment Day"
                    onChange={(e) => setLoanForm({ ...loanForm, emiPaymentDay: e.target.value })}
                  >
                    <MenuItem value="">Select Day</MenuItem>
                    <MenuItem value="Monday">Monday</MenuItem>
                    <MenuItem value="Tuesday">Tuesday</MenuItem>
                    <MenuItem value="Wednesday">Wednesday</MenuItem>
                    <MenuItem value="Thursday">Thursday</MenuItem>
                    <MenuItem value="Friday">Friday</MenuItem>
                    <MenuItem value="Saturday">Saturday</MenuItem>
                    <MenuItem value="Sunday">Sunday</MenuItem>
                  </Select>
                </FormControl>
              )}
              {(loanForm.emiFrequency === 'Monthly' || loanForm.emiFrequency === 'Quarterly') && (
                <FormControl fullWidth>
                  <InputLabel>EMI Payment Day</InputLabel>
                  <Select
                    value={loanForm.emiPaymentDay}
                    label="EMI Payment Day"
                    onChange={(e) => setLoanForm({ ...loanForm, emiPaymentDay: e.target.value })}
                  >
                    <MenuItem value="">Select Day</MenuItem>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <MenuItem key={day} value={day}>{day}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {loanForm.emiFrequency === 'Yearly' && (
                <TextField
                  fullWidth
                  label="EMI Payment Day (MM-DD)"
                  value={loanForm.emiPaymentDay}
                  onChange={(e) => setLoanForm({ ...loanForm, emiPaymentDay: e.target.value })}
                  placeholder="e.g., 01-15 for Jan 15"
                  helperText="Format: MM-DD"
                />
              )}
              {loanForm.emiFrequency === 'Lumpsum' && (
                <TextField
                  fullWidth
                  label="EMI Payment Day"
                  value="Not Applicable"
                  disabled
                />
              )}
              {!loanForm.emiFrequency && (
                <TextField
                  fullWidth
                  label="EMI Payment Day"
                  value=""
                  disabled
                  helperText="Select EMI Frequency first"
                />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: { xs: 3, sm: 2 }, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setLoanDialogOpen(false)}>Cancel</Button>
          <Button fullWidth={isMobile} onClick={handleSaveLoan} variant="contained">
            {editingLoan ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Insurance Dialog */}
      <Dialog open={insuranceDialogOpen} onClose={() => setInsuranceDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}>
        <DialogTitle>{editingInsurance ? 'Edit Insurance' : 'Add Insurance'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nick Name"
                value={insuranceForm.nickName}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, nickName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insurance Provider"
                value={insuranceForm.insuranceProvider}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceProvider: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insurance Type"
                value={insuranceForm.insuranceType}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceType: e.target.value })}
                placeholder="e.g., Life, Health, Term"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={insuranceForm.startDate}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={insuranceForm.endDate}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Premium Amount"
                type="number"
                value={insuranceForm.premiumAmount}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, premiumAmount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maturity Amount"
                type="number"
                value={insuranceForm.maturityAmount}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, maturityAmount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insurance Number"
                type="number"
                value={insuranceForm.insuranceNumber}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, insuranceNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>EMI Frequency</InputLabel>
                <Select
                  value={insuranceForm.emiFrequency}
                  label="EMI Frequency"
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, emiFrequency: e.target.value, emiPaymentDay: '' })}
                >
                  <MenuItem value="">Select Frequency</MenuItem>
                  <MenuItem value="Weekly">Weekly</MenuItem>
                  <MenuItem value="Monthly">Monthly</MenuItem>
                  <MenuItem value="Quarterly">Quarterly</MenuItem>
                  <MenuItem value="Yearly">Yearly</MenuItem>
                  <MenuItem value="Lumpsum">Lumpsum</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              {insuranceForm.emiFrequency === 'Weekly' && (
                <FormControl fullWidth>
                  <InputLabel>EMI Payment Day</InputLabel>
                  <Select
                    value={insuranceForm.emiPaymentDay}
                    label="EMI Payment Day"
                    onChange={(e) => setInsuranceForm({ ...insuranceForm, emiPaymentDay: e.target.value })}
                  >
                    <MenuItem value="">Select Day</MenuItem>
                    <MenuItem value="Monday">Monday</MenuItem>
                    <MenuItem value="Tuesday">Tuesday</MenuItem>
                    <MenuItem value="Wednesday">Wednesday</MenuItem>
                    <MenuItem value="Thursday">Thursday</MenuItem>
                    <MenuItem value="Friday">Friday</MenuItem>
                    <MenuItem value="Saturday">Saturday</MenuItem>
                    <MenuItem value="Sunday">Sunday</MenuItem>
                  </Select>
                </FormControl>
              )}
              {(insuranceForm.emiFrequency === 'Monthly' || insuranceForm.emiFrequency === 'Quarterly') && (
                <FormControl fullWidth>
                  <InputLabel>EMI Payment Day</InputLabel>
                  <Select
                    value={insuranceForm.emiPaymentDay}
                    label="EMI Payment Day"
                    onChange={(e) => setInsuranceForm({ ...insuranceForm, emiPaymentDay: e.target.value })}
                  >
                    <MenuItem value="">Select Day</MenuItem>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                      <MenuItem key={day} value={day}>{day}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              {insuranceForm.emiFrequency === 'Yearly' && (
                <TextField
                  fullWidth
                  label="EMI Payment Day (MM-DD)"
                  value={insuranceForm.emiPaymentDay}
                  onChange={(e) => setInsuranceForm({ ...insuranceForm, emiPaymentDay: e.target.value })}
                  placeholder="e.g., 01-15 for Jan 15"
                  helperText="Format: MM-DD"
                />
              )}
              {insuranceForm.emiFrequency === 'Lumpsum' && (
                <TextField
                  fullWidth
                  label="EMI Payment Day"
                  value="Not Applicable"
                  disabled
                />
              )}
              {!insuranceForm.emiFrequency && (
                <TextField
                  fullWidth
                  label="EMI Payment Day"
                  value=""
                  disabled
                  helperText="Select EMI Frequency first"
                />
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: { xs: 3, sm: 2 }, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setInsuranceDialogOpen(false)}>Cancel</Button>
          <Button fullWidth={isMobile} onClick={handleSaveInsurance} variant="contained">
            {editingInsurance ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Term Deposit Dialog */}
      <Dialog open={tdDialogOpen} onClose={() => setTdDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}>
        <DialogTitle>{editingTd ? 'Edit Term Deposit' : 'Add Term Deposit'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Select Bank Account</InputLabel>
                <Select
                  value={tdForm.bankAccountId}
                  label="Select Bank Account"
                  onChange={(e) => handleTdBankAccountChange(e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select a bank account</em>
                  </MenuItem>
                  {bankAccounts.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.accountNickName} - {bank.bankName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Bank Name"
                value={tdForm.bankName}
                InputProps={{
                  readOnly: true,
                }}
                helperText="Auto-filled from bank account"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="TD Account Number"
                value={tdForm.tdAccountNumber}
                onChange={(e) => setTdForm({ ...tdForm, tdAccountNumber: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Principal Amount"
                type="number"
                value={tdForm.principalAmount}
                onChange={(e) => setTdForm({ ...tdForm, principalAmount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Rate of Interest (%)"
                type="number"
                value={tdForm.rateOfInterest}
                onChange={(e) => setTdForm({ ...tdForm, rateOfInterest: e.target.value })}
                inputProps={{ step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maturity Amount"
                type="number"
                value={tdForm.maturityAmount}
                onChange={(e) => setTdForm({ ...tdForm, maturityAmount: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Maturity Date"
                type="date"
                value={tdForm.maturityDate}
                onChange={(e) => setTdForm({ ...tdForm, maturityDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: { xs: 3, sm: 2 }, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setTdDialogOpen(false)}>Cancel</Button>
          <Button fullWidth={isMobile} onClick={handleSaveTermDeposit} variant="contained">
            {editingTd ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MF-SIP Dialog */}
      <Dialog
        open={mfSipDialogOpen}
        onClose={() => setMfSipDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, overflow: 'hidden' } }}
      >
        {/* Coloured header */}
        <Box sx={{
          bgcolor: '#f57f17',
          px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 },
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon sx={{ color: '#fff', fontSize: 26 }} />
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>
              {editingMfSip ? 'Edit MF-SIP' : 'Add MF-SIP'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setMfSipDialogOpen(false)} sx={{ color: '#fff' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 0, overflowY: 'auto' }}>

          {/* ── Section 1: Fund Details ── */}
          <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1 }}>
            <Typography variant="overline" sx={{ color: '#f57f17', fontWeight: 700, fontSize: '0.7rem', letterSpacing: 1 }}>
              Fund Details
            </Typography>
            <Divider sx={{ mb: 2, borderColor: '#ffe0b2' }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Fund Name"
                  value={mfSipForm.fundName}
                  onChange={(e) => setMfSipForm({ ...mfSipForm, fundName: e.target.value })}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="SIP Amount (₹)"
                  type="number"
                  value={mfSipForm.amount}
                  onChange={(e) => setMfSipForm({ ...mfSipForm, amount: e.target.value })}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="AMC / Fund House Name"
                  value={mfSipForm.amcFundHouseName}
                  onChange={(e) => setMfSipForm({ ...mfSipForm, amcFundHouseName: e.target.value })}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Demat Account</InputLabel>
                  <Select
                    value={mfSipForm.dematId}
                    label="Demat Account"
                    onChange={(e) => handleMfSipDematChange(e.target.value)}
                  >
                    <MenuItem value=""><em>Select demat account</em></MenuItem>
                    {demats.map((demat) => (
                      <MenuItem key={demat.id} value={demat.id}>
                        {demat.brokerName} – {demat.clientID}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          {/* ── Section 2: Debit Details ── */}
          <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1 }}>
            <Typography variant="overline" sx={{ color: '#f57f17', fontWeight: 700, fontSize: '0.7rem', letterSpacing: 1 }}>
              Debit Details
            </Typography>
            <Divider sx={{ mb: 2, borderColor: '#ffe0b2' }} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Debit Bank Account</InputLabel>
                  <Select
                    value={mfSipForm.debitBankId}
                    label="Debit Bank Account"
                    onChange={(e) => handleMfSipDebitBankChange(e.target.value)}
                  >
                    <MenuItem value=""><em>Select bank account</em></MenuItem>
                    {bankAccounts.map((bank) => (
                      <MenuItem key={bank.id} value={bank.id}>
                        {bank.accountNickName} – {bank.bankName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Expense Head</InputLabel>
                  <Select
                    value={mfSipForm.expenseHead}
                    label="Expense Head"
                    onChange={(e) => setMfSipForm({ ...mfSipForm, expenseHead: e.target.value })}
                  >
                    <MenuItem value=""><em>Select expense head</em></MenuItem>
                    {expenseHeads.map((head) => (
                      <MenuItem key={head.id} value={head.name}>{head.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Debit Frequency</InputLabel>
                  <Select
                    value={mfSipForm.debitFrequency}
                    label="Debit Frequency"
                    onChange={(e) => handleMfSipFrequencyChange(e.target.value)}
                  >
                    <MenuItem value="">Select Frequency</MenuItem>
                    <MenuItem value="Weekly">Weekly</MenuItem>
                    <MenuItem value="Monthly">Monthly</MenuItem>
                    <MenuItem value="Quarterly">Quarterly</MenuItem>
                    <MenuItem value="Yearly">Yearly</MenuItem>
                    <MenuItem value="Lumpsum">Lumpsum</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                {mfSipForm.debitFrequency === 'Weekly' && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Debit Day</InputLabel>
                    <Select value={mfSipForm.debitDay} label="Debit Day" onChange={(e) => handleMfSipDebitDayChange(e.target.value)}>
                      <MenuItem value="">Select Day</MenuItem>
                      {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                        <MenuItem key={d} value={d}>{d}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {(mfSipForm.debitFrequency === 'Monthly' || mfSipForm.debitFrequency === 'Quarterly') && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Debit Day</InputLabel>
                    <Select value={mfSipForm.debitDay} label="Debit Day" onChange={(e) => handleMfSipDebitDayChange(e.target.value)}>
                      <MenuItem value="">Select Day</MenuItem>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <MenuItem key={day} value={day}>{day}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {mfSipForm.debitFrequency === 'Yearly' && (
                  <TextField fullWidth size="small" label="Debit Day (MM-DD)" value={mfSipForm.debitDay}
                    onChange={(e) => handleMfSipDebitDayChange(e.target.value)}
                    placeholder="e.g., 01-15 for Jan 15" helperText="Format: MM-DD" />
                )}
                {mfSipForm.debitFrequency === 'Lumpsum' && (
                  <TextField fullWidth size="small" label="Debit Day" value="Not Applicable" disabled />
                )}
                {!mfSipForm.debitFrequency && (
                  <TextField fullWidth size="small" label="Debit Day" value="" disabled helperText="Select Debit Frequency first" />
                )}
              </Grid>
            </Grid>
          </Box>

          {/* ── Section 3: Schedule ── */}
          <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 3 }}>
            <Typography variant="overline" sx={{ color: '#f57f17', fontWeight: 700, fontSize: '0.7rem', letterSpacing: 1 }}>
              Payment Schedule
            </Typography>
            <Divider sx={{ mb: 2, borderColor: '#ffe0b2' }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Last Paid Date"
                  type="date"
                  value={mfSipForm.lastPremiumPaidDate}
                  onChange={(e) => handleMfSipLastPremiumDateChange(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Next SIP Date"
                  type="date"
                  value={mfSipForm.nextPremiumDate}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true }}
                  helperText="Auto-calculated"
                  sx={{ '& .MuiInputBase-input': { color: 'success.main', fontWeight: 600 } }}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  bgcolor: mfSipForm.stepUpEnabled ? '#fff8e1' : '#fafafa',
                  border: '1px solid',
                  borderColor: mfSipForm.stepUpEnabled ? '#ffe082' : '#e0e0e0',
                  borderRadius: 1.5,
                  px: 2, py: 1.25,
                  transition: 'all 0.2s'
                }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Step-Up SIP</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically increase SIP amount each year
                    </Typography>
                  </Box>
                  <Switch
                    checked={mfSipForm.stepUpEnabled}
                    onChange={(e) => setMfSipForm({ ...mfSipForm, stepUpEnabled: e.target.checked })}
                    color="warning"
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>

        </DialogContent>

        <DialogActions sx={{
          px: { xs: 2, sm: 3 }, py: 2,
          bgcolor: '#fafafa',
          borderTop: '1px solid #f0f0f0',
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          gap: 1
        }}>
          <Button
            fullWidth={isMobile}
            onClick={() => setMfSipDialogOpen(false)}
            variant="outlined"
            sx={{ borderColor: '#bdbdbd', color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            fullWidth={isMobile}
            onClick={handleSaveMfSip}
            variant="contained"
            sx={{ bgcolor: '#f57f17', '&:hover': { bgcolor: '#ef6c00' }, px: 3 }}
          >
            {editingMfSip ? 'Update SIP' : 'Add SIP'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loan EMI Dialog */}
      <Dialog
        open={loanEmiDialogOpen}
        onClose={() => setLoanEmiDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2, overflow: 'hidden' } }}
      >
        {/* Colored header */}
        <Box sx={{ bgcolor: '#c2185b', px: { xs: 2, sm: 3 }, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ReceiptLongIcon sx={{ color: '#fff', fontSize: 24 }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', flex: 1 }}>
            {editingLoanEmi ? 'Edit Loan EMI' : 'Add Loan EMI'}
          </Typography>
          <IconButton size="small" onClick={() => setLoanEmiDialogOpen(false)} sx={{ color: '#fff', p: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
          <Grid container spacing={1.5}>

            {/* Section 1: Loan Details */}
            <Grid item xs={12}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}>
                Loan Details
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Select Loan</InputLabel>
                <Select
                  value={loanEmiForm.loanId}
                  label="Select Loan"
                  onChange={(e) => handleLoanEmiLoanChange(e.target.value)}
                >
                  <MenuItem value=""><em>Select a loan</em></MenuItem>
                  {loans.map((loan) => (
                    <MenuItem key={loan.id} value={loan.id}>
                      {loan.loanNickName} — {loan.bankName} ({loan.loanType})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Section 2: Payment Details */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}>
                Payment Details
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small"
                label="EMI Amount (₹)"
                type="number"
                value={loanEmiForm.amount}
                onChange={(e) => setLoanEmiForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Expense Head</InputLabel>
                <Select
                  value={loanEmiForm.expenseHead}
                  label="Expense Head"
                  onChange={(e) => setLoanEmiForm(prev => ({ ...prev, expenseHead: e.target.value }))}
                >
                  <MenuItem value="">Select Expense Head</MenuItem>
                  {expenseHeads.map((head) => (
                    <MenuItem key={head.id} value={head.name}>{head.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Debit Bank Account</InputLabel>
                <Select
                  value={loanEmiForm.debitBankId}
                  label="Debit Bank Account"
                  onChange={(e) => handleLoanEmiBankChange(e.target.value)}
                >
                  <MenuItem value=""><em>Select bank account</em></MenuItem>
                  {bankAccounts.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.accountNickName} — {bank.bankName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Section 3: Payment Schedule */}
            <Grid item xs={12} sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.68rem' }}>
                Payment Schedule
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth size="small"
                label="Last EMI Paid"
                type="date"
                value={loanEmiForm.lastEmiPaidDate}
                onChange={(e) => handleLoanEmiLastPaidDateChange(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth size="small"
                label="Next EMI Date"
                type="date"
                value={loanEmiForm.nextEmiDate}
                InputLabelProps={{ shrink: true }}
                disabled
                helperText="Auto-calculated"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth size="small"
                label="Loan End Date"
                type="date"
                value={loanEmiForm.loanEndDate}
                InputLabelProps={{ shrink: true }}
                disabled
                helperText="From loan record"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 3, sm: 2 }, pt: 1, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button
            fullWidth={isMobile}
            variant="outlined"
            onClick={() => setLoanEmiDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            fullWidth={isMobile}
            variant="contained"
            onClick={handleSaveLoanEmi}
            sx={{ bgcolor: '#c2185b', '&:hover': { bgcolor: '#ad1457' } }}
          >
            {editingLoanEmi ? 'Update EMI' : 'Add EMI'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Expense Head Dialog */}
      <Dialog open={expenseHeadDialogOpen} onClose={() => setExpenseHeadDialogOpen(false)} maxWidth="sm" fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 2 } }}>
        <DialogTitle>{editingExpenseHead ? 'Edit Expense Head' : 'Add Expense Head'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Expense Head Name"
                value={expenseHeadForm.name}
                onChange={(e) => setExpenseHeadForm({ ...expenseHeadForm, name: e.target.value })}
                placeholder="e.g., Household, Education, Medical"
                required
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: { xs: 3, sm: 2 }, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button fullWidth={isMobile} variant="outlined" onClick={() => setExpenseHeadDialogOpen(false)}>Cancel</Button>
          <Button fullWidth={isMobile} onClick={handleSaveExpenseHead} variant="contained">
            {editingExpenseHead ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SIP Mark as Paid Confirmation Dialog */}
      <Dialog
        open={sipPayConfirmOpen}
        onClose={() => setSipPayConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { mx: isMobile ? 0 : 2, borderRadius: isMobile ? 0 : 2 } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TaskAltIcon sx={{ color: 'success.main' }} />
          Confirm SIP Payment
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          {sipPayTarget && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Record payment for this SIP? The <strong>Last Paid Date</strong> will be set to today, the <strong>Next SIP Date</strong> advanced, and a <strong>debit transaction</strong> will be logged in the active ledger.
              </Typography>
              <Box sx={{
                bgcolor: '#f1f8e9',
                border: '1px solid #a5d6a7',
                borderRadius: 1.5,
                p: 1.5
              }}>
                <Typography fontWeight="700" sx={{ fontSize: '0.95rem' }}>{sipPayTarget.fundName}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{sipPayTarget.amcFundHouseName}</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip
                    label={`₹${Number(sipPayTarget.amount).toLocaleString('en-IN')}`}
                    color="success"
                    size="small"
                  />
                  <Chip label={sipPayTarget.debitFrequency} size="small" variant="outlined" />
                  <Chip
                    label={`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>
              <Box sx={{ bgcolor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 1.5, p: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Transaction to be logged:</Typography>
                <Typography variant="body2">Bank: <strong>{bankAccounts.find(b => b.id === sipPayTarget.debitBankId)?.accountNickName || sipPayTarget.debitBankName || 'N/A'}</strong></Typography>
                <Typography variant="body2">Expense Head: <strong>{sipPayTarget.expenseHead || 'Investment'}</strong></Typography>
                <Typography variant="body2">Mode: <strong>Bank Transfer</strong></Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 2 }, pb: { xs: 3, sm: 2 }, pt: 1, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button
            fullWidth={isMobile}
            variant="outlined"
            onClick={() => setSipPayConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            fullWidth={isMobile}
            variant="contained"
            color="success"
            startIcon={<TaskAltIcon />}
            onClick={handleConfirmSipPaid}
          >
            Confirm Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loan EMI Mark as Paid Confirmation Dialog */}
      <Dialog
        open={emiPayConfirmOpen}
        onClose={() => setEmiPayConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { mx: isMobile ? 0 : 2, borderRadius: isMobile ? 0 : 2 } }}
      >
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TaskAltIcon sx={{ color: 'success.main' }} />
          Confirm EMI Payment
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          {emiPayTarget && (() => {
            const emiLoan = loans.find(l => l.id === emiPayTarget.loanId);
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  Record payment for this EMI? The <strong>Last Paid Date</strong> will be set to today,
                  the <strong>Next EMI Date</strong> advanced, and a <strong>debit transaction</strong> will be logged in the active ledger.
                </Typography>
                <Box sx={{ bgcolor: '#fce4ec', border: '1px solid #f48fb1', borderRadius: 1.5, p: 1.5 }}>
                  <Typography fontWeight="700" sx={{ fontSize: '0.95rem' }}>
                    {emiLoan?.loanNickName || 'Unknown Loan'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {emiLoan?.bankName} — {emiLoan?.loanType}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    <Chip label={`₹${Number(emiPayTarget.amount).toLocaleString('en-IN')}`} color="error" size="small" />
                    <Chip label={emiLoan?.emiFrequency || ''} size="small" variant="outlined" />
                    <Chip
                      label={`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                      size="small" variant="outlined"
                    />
                  </Box>
                </Box>
                <Box sx={{ bgcolor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 1.5, p: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Transaction to be logged:</Typography>
                  <Typography variant="body2">Bank: <strong>{bankAccounts.find(b => b.id === emiPayTarget.debitBankId)?.accountNickName || emiPayTarget.debitBankName || 'N/A'}</strong></Typography>
                  <Typography variant="body2">Expense Head: <strong>{emiPayTarget.expenseHead || 'Loan Repayment'}</strong></Typography>
                  <Typography variant="body2">Mode: <strong>Bank Transfer</strong></Typography>
                </Box>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, sm: 2 }, pb: { xs: 3, sm: 2 }, pt: 1, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          <Button
            fullWidth={isMobile}
            variant="outlined"
            onClick={() => setEmiPayConfirmOpen(false)}
          >
            Cancel
          </Button>
          <Button
            fullWidth={isMobile}
            variant="contained"
            color="error"
            startIcon={<TaskAltIcon />}
            onClick={handleConfirmEmiPaid}
          >
            Confirm Payment
          </Button>
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

      <Footer />
    </Box>
  );
}

export default MasterRecords;
