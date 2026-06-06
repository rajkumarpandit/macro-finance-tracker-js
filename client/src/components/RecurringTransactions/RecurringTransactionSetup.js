import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  MenuItem,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  RadioGroup,
  FormControlLabel,
  Radio,
  Tabs,
  Tab
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RepeatIcon from '@mui/icons-material/Repeat';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../Auth/AuthContext';
import { PAYMENT_MODES, RECURRING_FREQUENCIES } from '../../config/constants';
import Footer from '../Common/Footer';

function RecurringTransactionSetup() {
  const { currentUser } = useAuth();
  
  // Form state
  const [formData, setFormData] = useState({
    transactionName: '',
    amount: '',
    currency: 'INR',
    frequency: 'monthly',
    type: 'Others',
    merchant: '',
    dueBy: '1',
    usualPaymentMode: 'UPI',
    category: 'Recurring',
    transactionDesc: '',
    accountId: '',
    accountName: '',
    recurrenceType: 'template',
    expenseHead: ''
  });

  // UI state
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  
  // Account states
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [expenseHeads, setExpenseHeads] = useState([]);

  // Dropdown options
  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
  const types = ['EMI', 'Subscription', 'SIP', 'Premium', 'Bills', 'Others'];
  const dueDays = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

  // Fetch recurring transactions
  const fetchRecurringTransactions = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'recurring_expenses'),
        where('userId', '==', currentUser.uid),
        orderBy('transactionName', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      const transactions = [];
      querySnapshot.forEach((doc) => {
        transactions.push({ id: doc.id, ...doc.data() });
      });
      
      setRecurringTransactions(transactions);
    } catch (err) {
      console.error('Error fetching recurring transactions:', err);
      // Don't show error on initial load, only log to console
    } finally {
      setLoading(false);
    }
  };

  // Fetch bank accounts and credit cards
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

  const fetchExpenseHeads = async () => {
    try {
      const headQuery = query(
        collection(db, 'expense_heads'),
        where('userId', '==', currentUser.uid),
        orderBy('name', 'asc')
      );
      const snapshot = await getDocs(headQuery);
      const heads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenseHeads(heads);
    } catch (error) {
      console.error('Error fetching expense heads:', error);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRecurringTransactions();
      fetchBankAccounts();
      fetchCreditCards();
      fetchExpenseHeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Auto-select default account when accounts are loaded and payment mode is set
  useEffect(() => {
    if ((bankAccounts.length > 0 || creditCards.length > 0) && !formData.accountId && formData.usualPaymentMode !== 'Cash') {
      if (formData.usualPaymentMode === 'Credit Card') {
        const defaultCard = creditCards.find(card => card.isDefault);
        if (defaultCard) {
          setFormData(prev => ({
            ...prev,
            accountId: defaultCard.id,
            accountName: defaultCard.nickName
          }));
        }
      } else if (['UPI', 'Cheque', 'Bank Transfer'].includes(formData.usualPaymentMode)) {
        const defaultBank = bankAccounts.find(bank => bank.isDefault);
        if (defaultBank) {
          setFormData(prev => ({
            ...prev,
            accountId: defaultBank.id,
            accountName: defaultBank.accountNickName
          }));
        }
      }
    }
  }, [bankAccounts, creditCards, formData.usualPaymentMode, formData.accountId]);

  // Handle form input changes
  const handleChange = (field) => (event) => {
    const value = event.target.value;
    const newData = { ...formData, [field]: value };
    
    // Auto-update category based on recurrence type
    if (field === 'recurrenceType') {
      newData.category = value === 'periodic' ? 'Recurring' : 'Sundry';
    }
    
    // Auto-select default account when payment mode changes
    if (field === 'usualPaymentMode') {
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
    }
    
    setFormData(newData);
  };

  // Validate form
  const validateForm = () => {
    if (!formData.transactionName.trim()) {
      setError('Transaction name is required');
      return false;
    }
    // Amount is only required for periodic transactions
    if (formData.recurrenceType === 'periodic') {
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setError('Valid amount is required for periodic transactions');
        return false;
      }
    }
    if (!formData.merchant.trim()) {
      setError('Merchant name is required');
      return false;
    }
    return true;
  };

  // Handle save (create or update)
  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!validateForm()) return;

    setSaving(true);
    try {
      const transactionData = {
        userId: currentUser.uid,
        transactionName: formData.transactionName.trim(),
        amount: formData.recurrenceType === 'template' ? 0 : parseFloat(formData.amount),
        currency: formData.currency,
        frequency: formData.recurrenceType === 'template' ? '' : formData.frequency,
        type: formData.recurrenceType === 'template' ? '' : formData.type,
        merchant: formData.merchant.trim(),
        dueBy: formData.recurrenceType === 'template' ? 0 : parseInt(formData.dueBy),
        usualPaymentMode: formData.usualPaymentMode,
        category: 'Recurring',
        transactionDesc: formData.transactionDesc.trim(),
        accountId: formData.accountId || '',
        accountName: formData.accountName || '',
        recurrenceType: formData.recurrenceType,
        expenseHead: formData.expenseHead,
        updatedAt: new Date()
      };

      // Log transaction data for diagnosis
      console.log('Saving Recurring Transaction:', {
        transactionName: transactionData.transactionName,
        recurrenceType: transactionData.recurrenceType,
        amount: transactionData.amount,
        frequency: transactionData.frequency,
        type: transactionData.type,
        merchant: transactionData.merchant
      });

      if (editingId) {
        // Update existing
        await updateDoc(doc(db, 'recurring_expenses', editingId), transactionData);
        setSuccess('Recurring transaction updated successfully');
      } else {
        // Create new
        transactionData.createdAt = new Date();
        await addDoc(collection(db, 'recurring_expenses'), transactionData);
        setSuccess('Recurring transaction created successfully');
      }

      // Reset form
      setFormData({
        transactionName: '',
        amount: '',
        currency: 'INR',
        frequency: 'monthly',
        type: 'Others',
        accountId: '',
        accountName: '',
        merchant: '',
        dueBy: '1',
        usualPaymentMode: 'UPI',
        category: 'Recurring',
        transactionDesc: '',
        recurrenceType: 'template',
        expenseHead: ''
      });
      setEditingId(null);

      // Refresh list
      fetchRecurringTransactions();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving recurring transaction:', err);
      setError('Failed to save recurring transaction');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit
  const handleEdit = (transaction) => {
    setFormData({
      transactionName: transaction.transactionName,
      amount: transaction.amount.toString(),
      currency: transaction.currency,
      frequency: transaction.frequency,
      type: transaction.type,
      merchant: transaction.merchant,
      dueBy: transaction.dueBy.toString(),
      usualPaymentMode: transaction.usualPaymentMode || 'UPI',
      category: transaction.category || 'Recurring',
      transactionDesc: transaction.transactionDesc || '',
      accountId: transaction.accountId || '',
      accountName: transaction.accountName || '',
      recurrenceType: transaction.recurrenceType || 'template',
      expenseHead: transaction.expenseHead || ''
    });
    setEditingId(transaction.id);
    setError('');
    setSuccess('');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this recurring transaction?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'recurring_expenses', id));
      setSuccess('Recurring transaction deleted successfully');
      fetchRecurringTransactions();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting recurring transaction:', err);
      setError('Failed to delete recurring transaction');
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setFormData({
      transactionName: '',
      amount: '',
      currency: 'INR',
      frequency: 'monthly',
      type: 'Others',
      merchant: '',
      dueBy: '1',
      usualPaymentMode: 'UPI',
      category: 'Recurring',
      transactionDesc: '',
      accountId: '',
      accountName: '',
      recurrenceType: 'template',
      expenseHead: ''
    });
    setEditingId(null);
    setError('');
  };

  // Handle reset form
  const handleReset = () => {
    setFormData({
      transactionName: '',
      amount: '',
      currency: 'INR',
      frequency: 'monthly',
      type: 'Others',
      merchant: '',
      dueBy: '1',
      usualPaymentMode: 'UPI',
      category: 'Recurring',
      transactionDesc: '',
      accountId: '',
      accountName: '',
      recurrenceType: 'template',
      expenseHead: ''
    });
    setError('');
    setSuccess('');
  };

  return (
    <Box sx={{ pb: 10, bgcolor: '#f5f7fa' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <RepeatIcon sx={{ fontSize: 24, color: '#42a5f5' }} />
        <Typography variant="h6" fontWeight="700" sx={{ fontSize: '1.1rem' }}>
          Recurring Transactions
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 1.5, py: 0.5, fontSize: '0.85rem' }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 1.5, py: 0.5, fontSize: '0.85rem' }}>
          {success}
        </Alert>
      )}

      {/* Form */}
      <Paper elevation={2} sx={{ p: 1.5, mb: 2, bgcolor: '#ffffff' }}>
        <Grid container spacing={1.5}>
          {/* Row 1: Recurrence Type and Category */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              {/* Recurrence Type Radio Buttons */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.3 }}>
                  Recurrence Type
                </Typography>
                <RadioGroup
                  row
                  value={formData.recurrenceType}
                  onChange={handleChange('recurrenceType')}
                  sx={{ mt: 0 }}
                >
                  <FormControlLabel 
                    value="periodic" 
                    control={<Radio />} 
                    label="Periodic" 
                  />
                  <FormControlLabel 
                    value="template" 
                    control={<Radio />} 
                    label="Template" 
                  />
                </RadioGroup>
              </Box>

              {/* Category as Text Label */}
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.3 }}>
                  Category
                </Typography>
                <Typography variant="body2" fontWeight={500} sx={{ pt: '7px', fontSize: '0.875rem' }}>
                  {formData.category}
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Row 2: Transaction Name */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Transaction Name"
              value={formData.transactionName}
              onChange={handleChange('transactionName')}
              required
              placeholder="e.g., Netflix Subscription"
            />
          </Grid>

          {/* Row 3: Transaction Description */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Transaction Description"
              value={formData.transactionDesc}
              onChange={handleChange('transactionDesc')}
              placeholder="e.g., Monthly subscription for streaming"
            />
          </Grid>

          {/* Row 4: Amount & Currency */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={handleChange('amount')}
              required={formData.recurrenceType === 'periodic'}
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              select
              label="Currency"
              value={formData.currency}
              onChange={handleChange('currency')}
            >
              {currencies.map((curr) => (
                <MenuItem key={curr} value={curr}>{curr}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Row 5: Frequency & Type */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              select
              label="Frequency"
              value={formData.frequency}
              onChange={handleChange('frequency')}
            >
              {RECURRING_FREQUENCIES.map((freq) => (
                <MenuItem key={freq} value={freq}>
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              select
              label="Type"
              value={formData.type}
              onChange={handleChange('type')}
            >
              {types.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Row 6: Merchant & Due By */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Merchant"
              value={formData.merchant}
              onChange={handleChange('merchant')}
              required
              placeholder="e.g., Netflix India"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              select
              label="Due By (Day of Month)"
              value={formData.dueBy}
              onChange={handleChange('dueBy')}
            >
              {dueDays.map((day) => (
                <MenuItem key={day} value={day}>{day}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Row 7: Usual Payment Mode */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              select
              label="Usual Payment Mode"
              value={formData.usualPaymentMode}
              onChange={handleChange('usualPaymentMode')}
            >
              {PAYMENT_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>{mode}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Bank Account / Credit Card Dropdown */}
          {formData.usualPaymentMode && formData.usualPaymentMode !== 'Cash' && (
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>
                  {formData.usualPaymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                </InputLabel>
                <Select
                  value={formData.accountId}
                  label={formData.usualPaymentMode === 'Credit Card' ? 'Credit Card' : 'Bank Account'}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    let selectedName = '';
                    if (formData.usualPaymentMode === 'Credit Card') {
                      const card = creditCards.find(c => c.id === selectedId);
                      selectedName = card?.nickName || '';
                    } else {
                      const account = bankAccounts.find(a => a.id === selectedId);
                      selectedName = account?.accountNickName || '';
                    }
                    setFormData({
                      ...formData,
                      accountId: selectedId,
                      accountName: selectedName
                    });
                  }}
                >
                  <MenuItem value="">
                    <em>Select...</em>
                  </MenuItem>
                  {formData.usualPaymentMode === 'Credit Card'
                    ? creditCards.map((card) => (
                        <MenuItem key={card.id} value={card.id}>
                          {card.nickName}
                        </MenuItem>
                      ))
                    : bankAccounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          {account.accountNickName}
                        </MenuItem>
                      ))
                  }
                </Select>
              </FormControl>
            </Grid>
          )}

          {/* Row 8: Expense Head */}
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth size="small">
              <InputLabel>Expense Head</InputLabel>
              <Select
                value={formData.expenseHead}
                label="Expense Head"
                onChange={handleChange('expenseHead')}
              >
                <MenuItem value="">
                  <em>Select Expense Head</em>
                </MenuItem>
                {expenseHeads.map(head => (
                  <MenuItem key={head.id} value={head.name}>{head.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 0.5 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                size="small"
                sx={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
                  color: '#ffffff',
                  py: 1,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #616161 0%, #424242 100%)',
                  }
                }}
              >
                {saving ? <CircularProgress size={20} color="inherit" /> : (editingId ? 'Update' : 'Save')}
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
                disabled={saving}
                size="small"
                sx={{
                  minWidth: '80px',
                  py: 1,
                  borderRadius: 1,
                  textTransform: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderColor: '#1976d2',
                  color: '#1976d2',
                  '&:hover': {
                    borderColor: '#1565c0',
                    bgcolor: '#e3f2fd'
                  }
                }}
              >
                Reset
              </Button>
              {editingId && (
                <Button
                  variant="outlined"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  fullWidth
                  size="small"
                  sx={{
                    py: 1,
                    borderRadius: 1,
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    borderColor: '#616161',
                    color: '#616161',
                    '&:hover': {
                      borderColor: '#212121',
                      bgcolor: '#f5f5f5'
                    }
                  }}
                >
                  Cancel
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* List of Recurring Transactions */}
      <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1.5, fontSize: '0.95rem', color: '#333' }}>
        Saved Recurring Transactions
      </Typography>

      {/* Tabs for Periodic vs Template */}
      <Paper elevation={2} sx={{ mb: 1.5, bgcolor: '#ffffff' }}>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: '42px',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              minHeight: '42px',
              py: 1
            }
          }}
        >
          <Tab label="Periodic" />
          <Tab label="Templates" />
        </Tabs>
      </Paper>

      {/* Filtered dropdown for recurring transactions */}
      {/* Example: If you have a dropdown to select a recurring transaction, filter it here */}
      {/*
      <TextField
        select
        label="Recurring Transaction"
        value={selectedRecurringId}
        onChange={handleChangeRecurring}
      >
        {recurringTransactions
          .filter(t => {
            const recurrenceType = t.recurrenceType || 'periodic';
            return tabValue === 0 ? recurrenceType === 'periodic' : recurrenceType === 'template';
          })
          .map(t => (
            <MenuItem key={t.id} value={t.id}>{t.transactionName}</MenuItem>
          ))}
      </TextField>
      */}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={32} />
        </Box>
      ) : (() => {
        // Filter transactions by recurrence type for each tab
        const filteredTransactions = recurringTransactions.filter(t => {
          const recurrenceType = t.recurrenceType || 'periodic';
          if (tabValue === 0) {
            // RCNG tab: only periodic
            return recurrenceType === 'periodic';
          } else {
            // TMPL tab: only template
            return recurrenceType === 'template';
          }
        });
        if (filteredTransactions.length === 0) {
          return (
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffffff' }}>
              <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                No recurring transactions found. Add your first one above!
              </Typography>
            </Paper>
          );
        }
        return (
          <Grid container spacing={2}>
            {filteredTransactions.map((transaction) => (
              <Grid item xs={12} sm={6} md={4} key={transaction.id}>
                <Card elevation={2} sx={{ bgcolor: '#ffffff', borderLeft: editingId === transaction.id ? '3px solid #616161' : 'none' }}>
                  <CardContent sx={{ pb: 0.5, p: 1.5 }}>
                    <Typography variant="h6" fontWeight="600" sx={{ mb: 0.5, fontSize: '0.875rem', color: editingId === transaction.id ? '#616161' : 'inherit' }}>
                      {transaction.transactionName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.7rem' }}>
                      {transaction.transactionDesc || transaction.merchant}
                    </Typography>
                    {(transaction.recurrenceType || 'periodic') === 'periodic' && (
                      <Typography variant="body1" fontWeight="600" color="primary" sx={{ mb: 0.5, fontSize: '0.85rem' }}>
                        {transaction.currency} {transaction.amount.toFixed(2)}
                      </Typography>
                    )}
                    <Grid container spacing={1} sx={{ fontSize: '0.75rem' }}>
                      {(transaction.recurrenceType || 'periodic') === 'periodic' && (
                        <>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Frequency:</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{transaction.frequency}</Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Type:</Typography>
                            <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{transaction.type}</Typography>
                          </Grid>
                        </>
                      )}
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Merchant:</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{transaction.merchant}</Typography>
                      </Grid>
                      {(transaction.recurrenceType || 'periodic') === 'periodic' && (
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Due By:</Typography>
                          <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{transaction.dueBy}{transaction.dueBy === 1 ? 'st' : transaction.dueBy === 2 ? 'nd' : transaction.dueBy === 3 ? 'rd' : 'th'}</Typography>
                        </Grid>
                      )}
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>Payment Mode:</Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{transaction.usualPaymentMode || 'UPI'}</Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => handleEdit(transaction)}
                      title="Edit"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(transaction.id)}
                      title="Delete"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        );
      })()}

      <Footer />
    </Box>
  );
}

export default RecurringTransactionSetup;
