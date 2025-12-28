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
  Select
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
    accountName: ''
  });

  // UI state
  const [recurringTransactions, setRecurringTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Account states
  const [bankAccounts, setBankAccounts] = useState([]);
  const [creditCards, setCreditCards] = useState([]);

  // Dropdown options
  const currencies = ['INR', 'USD', 'EUR', 'GBP', 'AED'];
  const types = ['EMI', 'Subscription', 'SIP', 'Premium', 'Others'];
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

  useEffect(() => {
    if (currentUser) {
      fetchRecurringTransactions();
      fetchBankAccounts();
      fetchCreditCards();
    }
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
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError('Valid amount is required');
      return false;
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
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        frequency: formData.frequency,
        type: formData.type,
        merchant: formData.merchant.trim(),
        dueBy: parseInt(formData.dueBy),
        usualPaymentMode: formData.usualPaymentMode,
        category: 'Recurring',
        transactionDesc: formData.transactionDesc.trim(),
        accountId: formData.accountId || '',
        accountName: formData.accountName || '',
        updatedAt: new Date()
      };

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
        transactionDesc: ''
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
      transactionDesc: transaction.transactionDesc || ''
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
      forDescription: '',
      amount: '',
      currency: 'INR',
      frequency: 'monthly',
      type: 'Others',
      merchant: '',
      dueBy: '1',
      usualPaymentMode: 'UPI'
    });
    setEditingId(null);
    setError('');
  };

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <RepeatIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="700" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Recurring Transactions
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Form */}
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={2}>
          {/* Row 1: Transaction Name */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Transaction Name"
              value={formData.transactionName}
              onChange={handleChange('transactionName')}
              required
              placeholder="e.g., Netflix Subscription"
            />
          </Grid>

          {/* Row 1.5: Category (Fixed) */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Category"
              value={formData.category}
              disabled
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#f5f5f5'
                }
              }}
            />
          </Grid>

          {/* Row 1.6: Transaction Description */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Transaction Description"
              value={formData.transactionDesc}
              onChange={handleChange('transactionDesc')}
              placeholder="e.g., Monthly subscription for streaming"
            />
          </Grid>

          {/* Row 2: Amount & Currency */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={formData.amount}
              onChange={handleChange('amount')}
              required
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
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

          {/* Row 3: Frequency & Type */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
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

          {/* Row 4: Merchant & Due By */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
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

          {/* Row 5: Usual Payment Mode */}
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
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
              <FormControl fullWidth>
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

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
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
                {saving ? <CircularProgress size={24} color="inherit" /> : (editingId ? 'Update' : 'Save')}
              </Button>
              {editingId && (
                <Button
                  variant="outlined"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  fullWidth
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 600,
                    borderColor: '#ff9a56',
                    color: '#ff9a56',
                    '&:hover': {
                      borderColor: '#ff6f00',
                      bgcolor: '#fff3e0'
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
      <Typography variant="h6" fontWeight="600" sx={{ mb: 2 }}>
        Saved Recurring Transactions
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : recurringTransactions.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No recurring transactions found. Add your first one above!
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {recurringTransactions.map((transaction) => (
            <Grid item xs={12} sm={6} md={4} key={transaction.id}>
              <Card elevation={2}>
                <CardContent sx={{ pb: 1 }}>
                  <Typography variant="h6" fontWeight="600" sx={{ mb: 1, fontSize: '1rem' }}>
                    {transaction.transactionName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {transaction.transactionDesc || transaction.merchant}
                  </Typography>
                  <Typography variant="body1" fontWeight="600" color="primary" sx={{ mb: 1 }}>
                    {transaction.currency} {transaction.amount.toFixed(2)}
                  </Typography>
                  <Grid container spacing={1} sx={{ fontSize: '0.85rem' }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Frequency:</Typography>
                      <Typography variant="body2">{transaction.frequency}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Type:</Typography>
                      <Typography variant="body2">{transaction.type}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Merchant:</Typography>
                      <Typography variant="body2">{transaction.merchant}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Due By:</Typography>
                      <Typography variant="body2">{transaction.dueBy}{transaction.dueBy === 1 ? 'st' : transaction.dueBy === 2 ? 'nd' : transaction.dueBy === 3 ? 'rd' : 'th'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Payment Mode:</Typography>
                      <Typography variant="body2">{transaction.usualPaymentMode || 'UPI'}</Typography>
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
      )}

      <Footer />
    </Box>
  );
}

export default RecurringTransactionSetup;
