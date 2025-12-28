import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
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
  Checkbox
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SecurityIcon from '@mui/icons-material/Security';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from '../Auth/AuthContext';
import { db } from '../../firebase/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import Footer from '../Common/Footer';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function MasterRecords() {
  const { currentUser } = useAuth();
  const [tabValue, setTabValue] = useState(0);
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
    loanAccount: '',
    loanType: '',
    loanAmount: '',
    tenure: '',
    interestRate: ''
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
    maturityAmount: ''
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
        fetchInsurances()
      ]);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
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
      loanAccount: '',
      loanType: '',
      loanAmount: '',
      tenure: '',
      interestRate: ''
    });
    setEditingLoan(null);
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
      maturityAmount: ''
    });
    setEditingInsurance(null);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <AccountBalanceWalletIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="700" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Master Records
        </Typography>
      </Box>

      <Paper elevation={2} sx={{ borderRadius: 2 }}>
        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              '& .MuiTab-root': {
                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                minWidth: { xs: 'auto', sm: 120 }
              }
            }}
          >
            <Tab label="BANK" />
            <Tab label="CC" />
            <Tab label="DEMAT" />
            <Tab label="LOAN" />
            <Tab label="INSURANCE" />
          </Tabs>
        </Box>

        {/* Bank Accounts Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="600">Bank Accounts</Typography>
              <Button
                variant="contained"
                onClick={() => {
                  resetBankForm();
                  setBankDialogOpen(true);
                }}
              >
                <AddIcon />
              </Button>
            </Box>

            {bankAccounts.length === 0 ? (
              <Alert severity="info">No bank accounts added yet. Click "Add Bank Account" to get started.</Alert>
            ) : (
              <List>
                {bankAccounts.map((account) => (
                  <React.Fragment key={account.id}>
                    <ListItem
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            onClick={() => {
                              setEditingBank(account);
                              setBankForm(account);
                              setBankDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" onClick={() => handleDeleteBankAccount(account.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography fontWeight="600">{account.accountNickName}</Typography>
                            <Chip label={account.bankName} size="small" color="primary" />
                            {account.isDefault && <Chip label="Default" size="small" color="success" />}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">
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
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <Typography variant="body2">IFSC: {account.ifscCode}</Typography>
                            {account.upiIDs && account.upiIDs.length > 0 && (
                              <Typography variant="body2">UPI: {account.upiIDs.filter(u => u).join(', ')}</Typography>
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
        </TabPanel>

        {/* Credit Cards Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="600">Credit Cards</Typography>
              <Button
                variant="contained"
                onClick={() => {
                  resetCardForm();
                  setCardDialogOpen(true);
                }}
              >
                <AddIcon />
              </Button>
            </Box>

            {creditCards.length === 0 ? (
              <Alert severity="info">No credit cards added yet. Click "Add Credit Card" to get started.</Alert>
            ) : (
              <List>
                {creditCards.map((card) => (
                  <React.Fragment key={card.id}>
                    <ListItem
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            onClick={() => {
                              setEditingCard(card);
                              setCardForm(card);
                              setCardDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" onClick={() => handleDeleteCreditCard(card.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography fontWeight="600">{card.nickName}</Typography>
                            {card.isDefault && <Chip label="Default" size="small" color="success" />}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">
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
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <Typography variant="body2">Expiry: {card.expiryDate}</Typography>
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
        </TabPanel>

        {/* Demats Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="600">Demat Accounts</Typography>
              <Button
                variant="contained"
                onClick={() => {
                  resetDematForm();
                  setDematDialogOpen(true);
                }}
              >
                <AddIcon />
              </Button>
            </Box>

            {demats.length === 0 ? (
              <Alert severity="info">No demat accounts added yet. Click "Add Demat Account" to get started.</Alert>
            ) : (
              <List>
                {demats.map((demat) => (
                  <React.Fragment key={demat.id}>
                    <ListItem
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            onClick={() => {
                              setEditingDemat(demat);
                              setDematForm(demat);
                              setDematDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" onClick={() => handleDeleteDemat(demat.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={<Typography fontWeight="600">{demat.brokerName}</Typography>}
                        secondary={
                          <Box>
                            <Typography variant="body2">Client ID: {demat.clientID}</Typography>
                            <Typography variant="body2">Start Date: {demat.startDate}</Typography>
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
        </TabPanel>

        {/* Loans Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="600">Loans</Typography>
              <Button
                variant="contained"
                onClick={() => {
                  resetLoanForm();
                  setLoanDialogOpen(true);
                }}
              >
                <AddIcon />
              </Button>
            </Box>

            {loans.length === 0 ? (
              <Alert severity="info">No loans added yet. Click "Add Loan" to get started.</Alert>
            ) : (
              <List>
                {loans.map((loan) => (
                  <React.Fragment key={loan.id}>
                    <ListItem
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            onClick={() => {
                              setEditingLoan(loan);
                              setLoanForm(loan);
                              setLoanDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" onClick={() => handleDeleteLoan(loan.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography fontWeight="600">{loan.bankName}</Typography>
                            <Chip label={loan.loanType} size="small" color="secondary" />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">Account: {loan.loanAccount}</Typography>
                            <Typography variant="body2">Amount: ₹{loan.loanAmount} | Rate: {loan.interestRate}% | Tenure: {loan.tenure} months</Typography>
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
        </TabPanel>

        {/* Insurances Tab */}
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" fontWeight="600">Insurances</Typography>
              <Button
                variant="contained"
                onClick={() => {
                  resetInsuranceForm();
                  setInsuranceDialogOpen(true);
                }}
              >
                <AddIcon />
              </Button>
            </Box>

            {insurances.length === 0 ? (
              <Alert severity="info">No insurances added yet. Click "Add Insurance" to get started.</Alert>
            ) : (
              <List>
                {insurances.map((insurance) => (
                  <React.Fragment key={insurance.id}>
                    <ListItem
                      secondaryAction={
                        <Box>
                          <IconButton
                            edge="end"
                            onClick={() => {
                              setEditingInsurance(insurance);
                              setInsuranceForm(insurance);
                              setInsuranceDialogOpen(true);
                            }}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton edge="end" onClick={() => handleDeleteInsurance(insurance.id)}>
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography fontWeight="600">{insurance.nickName}</Typography>
                            <Chip label={insurance.insuranceType} size="small" color="info" />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">Provider: {insurance.insuranceProvider}</Typography>
                            <Typography variant="body2">Period: {insurance.startDate} to {insurance.endDate}</Typography>
                            <Typography variant="body2">Premium: ₹{insurance.premiumAmount} | Maturity: ₹{insurance.maturityAmount}</Typography>
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
        </TabPanel>
      </Paper>

      {/* Bank Account Dialog */}
      <Dialog open={bankDialogOpen} onClose={() => setBankDialogOpen(false)} maxWidth="md" fullWidth>
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
        <DialogActions>
          <Button onClick={() => setBankDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveBankAccount} variant="contained">
            {editingBank ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Credit Card Dialog */}
      <Dialog open={cardDialogOpen} onClose={() => setCardDialogOpen(false)} maxWidth="sm" fullWidth>
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
        <DialogActions>
          <Button onClick={() => setCardDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveCreditCard} variant="contained">
            {editingCard ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Demat Dialog */}
      <Dialog open={dematDialogOpen} onClose={() => setDematDialogOpen(false)} maxWidth="sm" fullWidth>
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
        <DialogActions>
          <Button onClick={() => setDematDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveDemat} variant="contained">
            {editingDemat ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Loan Dialog */}
      <Dialog open={loanDialogOpen} onClose={() => setLoanDialogOpen(false)} maxWidth="md" fullWidth>
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
                label="Loan Account"
                value={loanForm.loanAccount}
                onChange={(e) => setLoanForm({ ...loanForm, loanAccount: e.target.value })}
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveLoan} variant="contained">
            {editingLoan ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Insurance Dialog */}
      <Dialog open={insuranceDialogOpen} onClose={() => setInsuranceDialogOpen(false)} maxWidth="md" fullWidth>
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
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Maturity Amount"
                type="number"
                value={insuranceForm.maturityAmount}
                onChange={(e) => setInsuranceForm({ ...insuranceForm, maturityAmount: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInsuranceDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveInsurance} variant="contained">
            {editingInsurance ? 'Update' : 'Add'}
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
