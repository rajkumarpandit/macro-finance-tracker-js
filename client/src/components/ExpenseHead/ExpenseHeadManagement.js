import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CategoryIcon from '@mui/icons-material/Category';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../Auth/AuthContext';
import Footer from '../Common/Footer';

function ExpenseHeadManagement() {
  const { currentUser } = useAuth();
  
  // Form state
  const [expenseHeadName, setExpenseHeadName] = useState('');
  
  // UI state
  const [expenseHeads, setExpenseHeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Fetch expense heads
  const fetchExpenseHeads = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'expense_heads'),
        where('userId', '==', currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const heads = [];
      querySnapshot.forEach((doc) => {
        heads.push({ id: doc.id, ...doc.data() });
      });
      
      // Sort client-side to avoid composite index requirement
      heads.sort((a, b) => a.name.localeCompare(b.name));
      
      setExpenseHeads(heads);
    } catch (err) {
      console.error('Error fetching expense heads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenseHeads();
  }, [currentUser]);

  // Validate form
  const validateForm = () => {
    if (!expenseHeadName.trim()) {
      setError('Expense head name is required');
      return false;
    }
    
    // Check for duplicates
    const duplicate = expenseHeads.find(
      head => head.name.toLowerCase() === expenseHeadName.trim().toLowerCase() && 
      head.id !== editingId
    );
    
    if (duplicate) {
      setError('This expense head already exists');
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
      const expenseHeadData = {
        userId: currentUser.uid,
        name: expenseHeadName.trim(),
        updatedAt: new Date()
      };

      if (editingId) {
        // Update existing
        await updateDoc(doc(db, 'expense_heads', editingId), expenseHeadData);
        setSuccess('Expense head updated successfully');
      } else {
        // Create new
        expenseHeadData.createdAt = new Date();
        await addDoc(collection(db, 'expense_heads'), expenseHeadData);
        setSuccess('Expense head created successfully');
      }

      // Reset form
      setExpenseHeadName('');
      setEditingId(null);

      // Refresh list
      fetchExpenseHeads();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving expense head:', err);
      setError('Failed to save expense head');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit
  const handleEdit = (head) => {
    setExpenseHeadName(head.name);
    setEditingId(head.id);
    setError('');
    setSuccess('');
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle delete confirmation
  const handleDeleteClick = (head) => {
    setItemToDelete(head);
    setDeleteDialogOpen(true);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteDoc(doc(db, 'expense_heads', itemToDelete.id));
      setSuccess('Expense head deleted successfully');
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      fetchExpenseHeads();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting expense head:', err);
      setError('Failed to delete expense head');
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setExpenseHeadName('');
    setEditingId(null);
    setError('');
  };

  // Handle key press (Enter to save)
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && expenseHeadName.trim()) {
      handleSave();
    }
  };

  return (
    <Box sx={{ pb: 10, bgcolor: '#f5f7fa' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <CategoryIcon sx={{ fontSize: 24, color: '#42a5f5' }} />
        <Typography variant="h6" fontWeight="700" sx={{ fontSize: '1.1rem' }}>
          Expense Heads
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
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            fullWidth
            label="Expense Head Name"
            value={expenseHeadName}
            onChange={(e) => setExpenseHeadName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Household, Education, Medical"
            size="small"
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
                bgcolor: '#ffffff',
                '&:hover fieldset': { borderColor: '#616161' },
                '&.Mui-focused fieldset': { borderColor: '#616161' }
              }
            }}
          />
          
          <Box sx={{ display: 'flex', gap: 1.5, minWidth: { sm: 'auto', xs: '100%' } }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !expenseHeadName.trim()}
              size="small"
              sx={{
                background: 'linear-gradient(135deg, #424242 0%, #212121 100%) !important',
                color: '#ffffff !important',
                py: 1,
                px: 3,
                borderRadius: 1,
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 600,
                minWidth: '90px',
                '&:hover': {
                  background: 'linear-gradient(135deg, #616161 0%, #424242 100%)',
                }
              }}
            >
              {saving ? <CircularProgress size={24} color="inherit" /> : (editingId ? 'Update' : 'Add')}
            </Button>
            
            {editingId && (
              <Button
                variant="outlined"
                onClick={handleCancelEdit}
                disabled={saving}
                size="small"
                sx={{
                  py: 1,
                  px: 2.5,
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
        </Box>
      </Paper>

      {/* List of Expense Heads */}
      <Typography variant="subtitle1" fontWeight="600" sx={{ mb: 1.5, fontSize: '0.95rem', color: '#333' }}>
        Your Expense Heads ({expenseHeads.length})
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={32} />
        </Box>
      ) : expenseHeads.length === 0 ? (
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#ffffff' }}>
          <Typography color="text.secondary" sx={{ fontSize: '0.875rem' }}>
            No expense heads found. Add your first one above!
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={2} sx={{ bgcolor: '#ffffff' }}>
          <List sx={{ p: 0 }}>
            {expenseHeads.map((head, index) => (
              <ListItem
                key={head.id}
                sx={{
                  py: 1.5,
                  px: 2,
                  borderBottom: index < expenseHeads.length - 1 ? '1px solid #f0f0f0' : 'none',
                  borderLeft: editingId === head.id ? '3px solid #616161' : 'none',
                  '&:hover': {
                    bgcolor: '#f5f5f5'
                  }
                }}
                secondaryAction={
                  <Box>
                    <IconButton 
                      edge="end" 
                      aria-label="edit"
                      onClick={() => handleEdit(head)}
                      size="small"
                      sx={{ 
                        mr: 0.5,
                        color: '#616161',
                        '&:hover': {
                          bgcolor: '#f5f5f5'
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleDeleteClick(head)}
                      size="small"
                      sx={{ 
                        color: '#f44336',
                        '&:hover': {
                          bgcolor: '#ffebee'
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={head.name}
                  primaryTypographyProps={{
                    fontWeight: editingId === head.id ? 600 : 400,
                    fontSize: '0.9rem',
                    color: editingId === head.id ? '#616161' : 'text.primary'
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: '1.1rem', fontWeight: 600, pb: 1 }}>Delete Expense Head</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem' }}>
            Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 1.5 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{ 
              textTransform: 'none',
              color: '#666',
              fontSize: '0.875rem'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="contained"
            size="small"
            sx={{
              textTransform: 'none',
              bgcolor: '#f44336',
              fontSize: '0.875rem',
              '&:hover': {
                bgcolor: '#d32f2f'
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Footer />
    </Box>
  );
}

export default ExpenseHeadManagement;
