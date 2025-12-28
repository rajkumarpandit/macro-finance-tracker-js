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
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <CategoryIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
        <Typography variant="h4" fontWeight="700" sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Expense Heads
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
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', sm: 'row' } }}>
          <TextField
            fullWidth
            label="Expense Head Name"
            value={expenseHeadName}
            onChange={(e) => setExpenseHeadName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., Household, Education, Medical"
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': { borderColor: '#ff9a56' },
                '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
              }
            }}
          />
          
          <Box sx={{ display: 'flex', gap: 2, minWidth: { sm: 'auto', xs: '100%' } }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !expenseHeadName.trim()}
              sx={{
                background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
                py: 1.5,
                px: 4,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                minWidth: '100px',
                '&:hover': {
                  background: 'linear-gradient(135deg, #ff9a56 0%, #ff6f00 100%)',
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
                sx={{
                  py: 1.5,
                  px: 3,
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
        </Box>
      </Paper>

      {/* List of Expense Heads */}
      <Typography variant="h6" fontWeight="600" sx={{ mb: 2 }}>
        Your Expense Heads ({expenseHeads.length})
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : expenseHeads.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No expense heads found. Add your first one above!
          </Typography>
        </Paper>
      ) : (
        <Paper elevation={2}>
          <List sx={{ p: 0 }}>
            {expenseHeads.map((head, index) => (
              <ListItem
                key={head.id}
                sx={{
                  borderBottom: index < expenseHeads.length - 1 ? '1px solid #e0e0e0' : 'none',
                  '&:hover': {
                    bgcolor: '#fff3e0'
                  }
                }}
                secondaryAction={
                  <Box>
                    <IconButton 
                      edge="end" 
                      aria-label="edit"
                      onClick={() => handleEdit(head)}
                      sx={{ 
                        mr: 1,
                        color: '#ff9a56',
                        '&:hover': {
                          bgcolor: '#fff3e0'
                        }
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleDeleteClick(head)}
                      sx={{ 
                        color: '#f44336',
                        '&:hover': {
                          bgcolor: '#ffebee'
                        }
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={head.name}
                  primaryTypographyProps={{
                    fontWeight: editingId === head.id ? 600 : 400,
                    fontSize: '1rem',
                    color: editingId === head.id ? '#ff9a56' : 'text.primary'
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
      >
        <DialogTitle>Delete Expense Head</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{itemToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ 
              textTransform: 'none',
              color: '#666'
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDelete} 
            variant="contained"
            sx={{
              textTransform: 'none',
              bgcolor: '#f44336',
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
