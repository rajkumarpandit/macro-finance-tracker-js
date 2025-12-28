import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Box, Typography, Button, TextField, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Alert, Snackbar } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useIsAdmin } from '../utils/adminUtils';

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const isAdmin = useIsAdmin();

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const adminCollection = collection(db, 'admin_users');
        const adminSnapshot = await getDocs(adminCollection);
        const adminList = adminSnapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          createdAt: doc.data().createdAt?.toDate()
        }));
        setAdmins(adminList);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching admins:', err);
        setError('Failed to load admin users');
        setLoading(false);
      }
    };

    if (isAdmin) {
      fetchAdmins();
    }
  }, [isAdmin]);

  const handleAddAdmin = async () => {
    if (!newAdminEmail || !newAdminEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      
      // Check if admin already exists
      const q = query(collection(db, 'admin_users'), where('email', '==', newAdminEmail.toLowerCase()));
      const existingAdmin = await getDocs(q);
      
      if (!existingAdmin.empty) {
        setError('This email is already registered as an admin');
        setLoading(false);
        return;
      }

      // Using the Cloud Function approach - create a request document
      await addDoc(collection(db, 'admin_requests'), {
        email: newAdminEmail.toLowerCase(),
        requestedBy: JSON.parse(localStorage.getItem('user'))?.email || 'Unknown',
        status: 'pending',
        createdAt: new Date()
      });

      setSuccessMessage(`Admin request for ${newAdminEmail} has been submitted`);
      setNewAdminEmail('');
      setOpenDialog(false);
      
      // Refresh admin list after a slight delay to allow cloud function to process
      setTimeout(async () => {
        const adminCollection = collection(db, 'admin_users');
        const adminSnapshot = await getDocs(adminCollection);
        const adminList = adminSnapshot.docs.map(doc => ({
          id: doc.id,
          email: doc.data().email,
          createdAt: doc.data().createdAt?.toDate()
        }));
        setAdmins(adminList);
        setLoading(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error adding admin:', err);
      setError('Failed to add admin user');
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminId, adminEmail) => {
    if (window.confirm(`Are you sure you want to remove admin access for ${adminEmail}?`)) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'admin_users', adminId));
        
        setAdmins(admins.filter(admin => admin.id !== adminId));
        setSuccessMessage(`Admin access for ${adminEmail} has been removed`);
        setLoading(false);
      } catch (err) {
        console.error('Error removing admin:', err);
        setError('Failed to remove admin user');
        setLoading(false);
      }
    }
  };

  if (!isAdmin) {
    return (
      <Box sx={{ padding: 3 }}>
        <Alert severity="error">
          You don't have permission to access this page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 3, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom>
        Admin Management
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Admin Users</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<PersonAddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Add Admin
          </Button>
        </Box>

        {loading ? (
          <Typography>Loading...</Typography>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <List>
            {admins.length === 0 ? (
              <Typography variant="body2" color="textSecondary">No admin users found</Typography>
            ) : (
              admins.map((admin) => (
                <ListItem key={admin.id} divider>
                  <ListItemText 
                    primary={admin.email} 
                    secondary={admin.createdAt ? `Added on ${admin.createdAt.toLocaleDateString()}` : 'Date unknown'} 
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      aria-label="delete"
                      onClick={() => handleRemoveAdmin(admin.id, admin.email)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))
            )}
          </List>
        )}
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Add New Admin</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleAddAdmin} color="primary" variant="contained">
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={!!successMessage} 
        autoHideDuration={6000} 
        onClose={() => setSuccessMessage('')}
      >
        <Alert onClose={() => setSuccessMessage('')} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminManagement;