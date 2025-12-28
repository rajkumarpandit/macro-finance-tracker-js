import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper,
  Alert,
  CircularProgress,
  Snackbar,
  Checkbox,
  FormControlLabel,
  Button,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TablePagination
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import { useIsAdmin, addAdmin, removeAdmin } from '../../utils/adminUtils';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebase/firebase';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import Footer from '../Common/Footer';

const AdminManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [userChanges, setUserChanges] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { isAdmin: userIsAdmin } = useIsAdmin(currentUser);
  
  useEffect(() => {
    // Load all users from Firestore
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const usersCollection = collection(db, 'users');
        
        try {
          const usersSnapshot = await getDocs(usersCollection);
          
          if (usersSnapshot.empty) {
            setUsers([]);
            setLoading(false);
            return;
          }
          
          const usersList = await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
            const userData = userDoc.data();
            
            // Make sure email exists
            if (!userData.email) {
              console.warn(`User ${userDoc.id} has no email field`);
              return {
                id: userDoc.id,
                email: "unknown@example.com",
                displayName: "Unknown User",
                isAdmin: false,
                isEnabled: false,
                createdAt: userData.createdAt || null
              };
            }
            
            // Check if user is admin
            let isAdmin = false;
            try {
              const adminRef = doc(db, 'admin_users', userData.email.toLowerCase());
              const adminDoc = await getDoc(adminRef);
              isAdmin = adminDoc.exists();
            } catch (err) {
              console.error("Error checking admin status:", err);
            }
            
            return {
              id: userDoc.id,
              email: userData.email,
              displayName: userData.displayName || userData.email.split('@')[0],
              isAdmin: isAdmin,
              isEnabled: userData.isEnabled !== false,
              createdAt: userData.createdAt || null,
              lastLogin: userData.lastLogin || null
            };
          }));
          
          const filteredUsers = usersList.filter(user => user !== null);
          setUsers(filteredUsers);
          setLoading(false);
        } catch (fetchError) {
          console.error("Error in getDocs:", fetchError);
          if (fetchError.message.includes("permission-denied") || 
              fetchError.message.includes("Missing or insufficient permissions")) {
            setError("Permission denied when accessing user data. Please update Firestore rules and redeploy.");
          } else {
            setError(`Failed to load users: ${fetchError.message}`);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Error in fetchUsers:", err);
        setError(`Failed to load users. Please try again. Error: ${err.message}`);
        setLoading(false);
      }
    };
    if (userIsAdmin) {
      fetchUsers();
    } else {
      setLoading(false);
    }
  }, [userIsAdmin]);

  // Filter and sort users based on search term
  useEffect(() => {
    let result = users;
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = users.filter(user => 
        user.email.toLowerCase().includes(term) || 
        user.displayName.toLowerCase().includes(term)
      );
    }
    
    // Sort: Super admin (rajkumarpandit@gmail.com) first, then alphabetically by displayName
    result = [...result].sort((a, b) => {
      // Super admin always first
      if (a.email === 'rajkumarpandit@gmail.com') return -1;
      if (b.email === 'rajkumarpandit@gmail.com') return 1;
      
      // Sort others alphabetically by display name
      return a.displayName.localeCompare(b.displayName);
    });
    
    setFilteredUsers(result);
    setPage(0);
  }, [searchTerm, users]);

  // Handle checkbox changes
  const handleCheckboxChange = (userId, field, value) => {
    // If delete is checked, it overrides other options
    if (field === 'delete' && value) {
      setUserChanges(prev => ({
        ...prev,
        [userId]: {
          delete: true
        }
      }));
    } else if (field === 'delete' && !value) {
      // If delete is unchecked, remove all changes
      setUserChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[userId];
        return newChanges;
      });
    } else if (!userChanges[userId]?.delete) {
      // Only allow other changes if delete is not checked
      setUserChanges(prev => ({
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          [field]: value
        }
      }));
    }
  };

  // Save user changes
  const handleSaveUser = async (user) => {
    try {
      if (user.email === currentUser.email) {
        setNotification({
          open: true,
          message: "You cannot modify your own account!",
          severity: "error"
        });
        return;
      }

      const changes = userChanges[user.id] || {};
      
      // Check if delete is requested
      if (changes.delete) {
        setUserToDelete(user);
        setDeleteDialogOpen(true);
        return;
      }

      const newIsAdmin = changes.hasOwnProperty('isAdmin') ? changes.isAdmin : user.isAdmin;
      const newIsEnabled = changes.hasOwnProperty('isEnabled') ? changes.isEnabled : user.isEnabled;

      // Update admin status if changed
      if (newIsAdmin !== user.isAdmin) {
        let success = false;
        if (newIsAdmin) {
          success = await addAdmin(user.email);
        } else {
          success = await removeAdmin(user.email);
        }
        if (!success) {
          throw new Error("Failed to update admin status");
        }
      }

      // Update enabled status if changed
      if (newIsEnabled !== user.isEnabled) {
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          isEnabled: newIsEnabled
        });
      }

      // Update state
      setUsers(users.map(u => 
        u.id === user.id ? { ...u, isAdmin: newIsAdmin, isEnabled: newIsEnabled } : u
      ));

      // Clear changes for this user
      setUserChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[user.id];
        return newChanges;
      });

      setNotification({
        open: true,
        message: `Changes saved for ${user.displayName || user.email}`,
        severity: "success"
      });
    } catch (err) {
      console.error("Error saving user changes:", err);
      setNotification({
        open: true,
        message: "Failed to save changes. Please try again.",
        severity: "error"
      });
    }
  };

  // Delete user function
  const handleDeleteUser = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setNotification({
        open: true,
        message: 'Please type DELETE to confirm',
        severity: 'error'
      });
      return;
    }

    setDeleting(true);
    try {
      const userId = userToDelete.id;
      const email = userToDelete.email;

      // Delete all user data from collections
      const collectionsToDelete = [
        'daily_expenses',
        'budgets',
        'categories',
        'savings_goals',
        'investments'
      ];

      // Delete documents from each collection
      for (const collectionName of collectionsToDelete) {
        try {
          const q = query(collection(db, collectionName), where('userId', '==', userId));
          const querySnapshot = await getDocs(q);
          
          const batch = writeBatch(db);
          querySnapshot.forEach((docSnapshot) => {
            batch.delete(docSnapshot.ref);
          });
          
          if (querySnapshot.size > 0) {
            await batch.commit();
          }
        } catch (error) {
          console.error(`Error deleting from ${collectionName}:`, error);
        }
      }

      // Remove from admin_users if admin
      if (userToDelete.isAdmin) {
        await deleteDoc(doc(db, 'admin_users', email.toLowerCase()));
      }

      // Delete user document
      await deleteDoc(doc(db, 'users', userId));

      // Update UI
      setUsers(users.filter(u => u.id !== userId));
      
      // Clear changes
      setUserChanges(prev => {
        const newChanges = { ...prev };
        delete newChanges[userId];
        return newChanges;
      });

      setNotification({
        open: true,
        message: `User ${userToDelete.displayName || userToDelete.email} deleted successfully`,
        severity: "success"
      });

      setDeleteDialogOpen(false);
      setDeleteConfirmText('');
      setUserToDelete(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      setNotification({
        open: true,
        message: 'Failed to delete user: ' + error.message,
        severity: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };

  // Handle notification close
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get paginated users
  const paginatedUsers = filteredUsers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (!userIsAdmin) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', p: { xs: 2, sm: 3 } }}>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          You don't have permission to access this page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', pb: 2 }}>
      {/* Search Bar */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <TextField
            fullWidth
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#ff9a56' }} />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': { borderColor: '#ff9a56' },
                '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
              }
            }}
          />
        </Paper>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress sx={{ color: '#4caf50' }} />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>
      ) : (
        <>
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          
          {filteredUsers.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 1.5 }}>
              {searchTerm ? `No users found matching "${searchTerm}"` : 'No users found in the system.'}
            </Alert>
          ) : (
            <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {paginatedUsers.map((user) => {
                const changes = userChanges[user.id] || {};
                const currentIsAdmin = changes.hasOwnProperty('isAdmin') ? changes.isAdmin : user.isAdmin;
                const currentIsEnabled = changes.hasOwnProperty('isEnabled') ? changes.isEnabled : user.isEnabled;
                const currentDelete = changes.delete || false;
                const hasChanges = Object.keys(changes).length > 0;
                
                return (
                  <Paper 
                    key={user.id}
                    elevation={0}
                    sx={{ 
                      p: { xs: 1.5, sm: 2 },
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: currentDelete ? '#d32f2f' : (hasChanges ? '#ff9a56' : '#e0e0e0'),
                      backgroundColor: currentDelete ? '#ffebee' : (currentIsEnabled ? 'white' : 'rgba(0, 0, 0, 0.04)'),
                      opacity: currentIsEnabled ? 1 : 0.7,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        boxShadow: currentDelete ? '0 2px 8px rgba(211, 47, 47, 0.25)' : '0 2px 8px rgba(102, 126, 234, 0.15)'
                      }
                    }}
                  >
                    {/* User Info */}
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle2" fontWeight="600" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
                        {user.displayName}
                        {user.email === currentUser.email && (
                          <Chip label="You" size="small" sx={{ ml: 1, bgcolor: '#ff9a56', color: 'white', fontSize: '0.7rem' }} />
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
                        {user.email}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.8rem' }, display: 'block', mt: 0.5 }}>
                        Last Login: {user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric', 
                          hour: '2-digit', 
                          minute: '2-digit'
                        }) : 'Never'}
                      </Typography>
                    </Box>
                    
                    {/* Checkboxes */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
                      <FormControlLabel
                        control={
                          <Checkbox 
                            checked={currentIsAdmin}
                            onChange={(e) => handleCheckboxChange(user.id, 'isAdmin', e.target.checked)}
                            disabled={user.email === currentUser.email || currentDelete}
                            size="small"
                            sx={{
                              color: '#ff9a56',
                              '&.Mui-checked': { color: '#ff9a56' }
                            }}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 0.5, fontSize: { xs: '1rem', sm: '1.25rem' } }} />
                            <Typography variant="body2" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>Admin Role</Typography>
                          </Box>
                        }
                      />
                      
                      <FormControlLabel
                        control={
                          <Checkbox 
                            checked={currentIsEnabled}
                            onChange={(e) => handleCheckboxChange(user.id, 'isEnabled', e.target.checked)}
                            disabled={user.email === currentUser.email || currentDelete}
                            size="small"
                            sx={{
                              color: '#ff9a56',
                              '&.Mui-checked': { color: '#ff9a56' }
                            }}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonIcon fontSize="small" sx={{ mr: 0.5, fontSize: { xs: '1rem', sm: '1.25rem' } }} />
                            <Typography variant="body2" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>Account Enabled</Typography>
                          </Box>
                        }
                      />

                      <FormControlLabel
                        control={
                          <Checkbox 
                            checked={currentDelete}
                            onChange={(e) => handleCheckboxChange(user.id, 'delete', e.target.checked)}
                            disabled={user.email === currentUser.email}
                            size="small"
                            sx={{
                              color: '#d32f2f',
                              '&.Mui-checked': { color: '#d32f2f' }
                            }}
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <DeleteForeverIcon fontSize="small" sx={{ mr: 0.5, fontSize: { xs: '1rem', sm: '1.25rem' } }} />
                            <Typography variant="body2" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' }, color: '#d32f2f' }}>
                              Delete User
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                    
                    {/* Save Button */}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleSaveUser(user)}
                      disabled={!hasChanges || user.email === currentUser.email}
                      fullWidth
                      sx={{
                        textTransform: 'none',
                        borderRadius: 1.5,
                        py: 1,
                        fontSize: { xs: '0.85rem', sm: '0.95rem' },
                        fontWeight: 600,
                        background: currentDelete 
                          ? 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)'
                          : (hasChanges ? 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)' : undefined),
                        '&:hover': {
                          background: currentDelete
                            ? 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)'
                            : (hasChanges ? 'linear-gradient(135deg, #ff9a56 0%, #ff6f00 100%)' : undefined),
                        },
                        '&:disabled': {
                          background: '#e0e0e0',
                          color: '#9e9e9e'
                        }
                      }}
                    >
                      {currentDelete ? 'Delete User' : 'Save Changes'}
                    </Button>
                  </Paper>
                );
              })}
            </Box>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={filteredUsers.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50, 100]}
              sx={{ mt: 2, borderTop: '1px solid #e0e0e0' }}
            />
            </>
          )}
        </Paper>
        </>
      )}
      
      <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <Typography variant="body2" fontWeight="600" color="#4caf50" gutterBottom sx={{ fontSize: { xs: '0.95rem', sm: '1.1rem' }, mb: 1.5 }}>
          User Management Help
        </Typography>
        <Typography variant="body2" paragraph sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' }, mb: 1 }}>
          <strong>Admin Access:</strong> Users with admin access can manage other users and access special features.
        </Typography>
        <Typography variant="body2" paragraph sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' }, mb: 1 }}>
          <strong>Disable User:</strong> Disabled users cannot log in to the application.
        </Typography>
        <Typography variant="body2" paragraph sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' }, mb: 1 }}>
          <strong>Delete User:</strong> Permanently deletes the user and all their data. This action cannot be undone.
        </Typography>
        <Typography variant="body2" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
          <strong>Note:</strong> You cannot modify or delete your own account.
        </Typography>
      </Paper>
      
      {error && error.includes("permission") && (
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, bgcolor: '#ffebee', borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Typography variant="body2" fontWeight="600" color="error" gutterBottom sx={{ fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
            Permission Error
          </Typography>
          <Typography variant="body2" paragraph sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' } }}>
            There was an error accessing the admin_users collection. This is likely because the Firebase security rules need to be updated.
          </Typography>
          <Typography variant="body2" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' }, mb: 1 }}>
            To fix this issue:
          </Typography>
          <Box component="ol" sx={{ fontSize: { xs: '0.85rem', sm: '0.95rem' }, pl: 2.5 }}>
            <li>Run the <strong>deploy-firestore-rules.bat</strong> file in your project root</li>
            <li>Or manually deploy using: <code>firebase deploy --only firestore:rules</code></li>
            <li>After deployment, refresh this page</li>
          </Box>
          
          <Typography variant="caption" sx={{ mt: 1.5, fontStyle: 'italic', display: 'block', fontSize: { xs: '0.75rem', sm: '0.85rem' } }}>
            You can visit <RouterLink to="/admin/initialize" style={{ color: '#4caf50' }}>Initialize Admin Collection</RouterLink> for more information.
          </Typography>
        </Paper>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#d32f2f', fontWeight: 600 }}>
          Delete User Permanently?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            You are about to permanently delete <strong>{userToDelete?.displayName || userToDelete?.email}</strong> and all their data including:
          </DialogContentText>
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <li>Daily expense records and transaction history</li>
            <li>Budget plans and financial goals</li>
            <li>Custom expense categories</li>
            <li>Savings and investment records</li>
            <li>Profile information</li>
            {userToDelete?.isAdmin && <li>Admin privileges</li>}
          </Box>
          <DialogContentText sx={{ mb: 2, fontWeight: 600, color: '#d32f2f' }}>
            This action cannot be undone!
          </DialogContentText>
          <TextField
            fullWidth
            label='Type "DELETE" to confirm'
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            disabled={deleting}
            autoComplete="off"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setDeleteConfirmText('');
            }}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteUser}
            color="error"
            variant="contained"
            disabled={deleteConfirmText !== 'DELETE' || deleting}
          >
            {deleting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Delete Forever'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notification snackbar */}
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity} 
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
      <Footer />
    </Box>
  );
};

export default AdminManagement;

