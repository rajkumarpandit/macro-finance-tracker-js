import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Alert,
  CircularProgress,
  Snackbar,
  Chip,
  Checkbox,
  FormControlLabel,
  Button
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useIsAdmin, addAdmin, removeAdmin } from '../utils/adminUtils';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

const AdminManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  const [userChanges, setUserChanges] = useState({});
  
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const { isAdmin: userIsAdmin } = useIsAdmin(currentUser);
  
  useEffect(() => {
    // Load all users from Firestore
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        
        const usersList = await Promise.all(usersSnapshot.docs.map(async (userDoc) => {
          const userData = userDoc.data();
          
          // Check if user is admin using our admin utils
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
            isEnabled: userData.isEnabled !== false, // Default to enabled if not specified
            createdAt: userData.createdAt || null
          };
        }));
        
        setUsers(usersList);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Failed to load users. Please try again.");
        setLoading(false);
      }
    };

    if (userIsAdmin) {
      fetchUsers();
    }
  }, [userIsAdmin]);

  // Handle checkbox changes
  const handleCheckboxChange = (userId, field, value) => {
    setUserChanges(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [field]: value
      }
    }));
  };

  // Function to save user changes
  const handleSaveUser = async (user) => {
    try {
      if (user.email === currentUser.email) {
        setNotification({
          open: true,
          message: "You cannot modify your own permissions!",
          severity: "error"
        });
        return;
      }

      const changes = userChanges[user.id] || {};
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

  // Handle notification close
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (!userIsAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You don't have permission to access this page.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      ) : (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Manage Users and Permissions
          </Typography>
          
          {users.length === 0 ? (
            <Alert severity="info">No users found in the system.</Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {users.map((user) => {
                const changes = userChanges[user.id] || {};
                const currentIsAdmin = changes.hasOwnProperty('isAdmin') ? changes.isAdmin : user.isAdmin;
                const currentIsEnabled = changes.hasOwnProperty('isEnabled') ? changes.isEnabled : user.isEnabled;
                const hasChanges = Object.keys(changes).length > 0;
                
                return (
                  <Paper 
                    key={user.id}
                    elevation={2}
                    sx={{ 
                      p: 2,
                      backgroundColor: currentIsEnabled ? 'inherit' : 'rgba(0, 0, 0, 0.04)',
                      opacity: currentIsEnabled ? 1 : 0.7
                    }}
                  >
                    {/* User Info - One Line */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {user.displayName} - {user.email}
                        {user.email === currentUser.email && (
                          <Chip label="You" size="small" color="primary" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                    </Box>
                    
                    {/* Checkboxes - Stacked vertically on mobile */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox 
                            checked={currentIsAdmin}
                            onChange={(e) => handleCheckboxChange(user.id, 'isAdmin', e.target.checked)}
                            disabled={user.email === currentUser.email}
                            color="primary"
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AdminPanelSettingsIcon fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2">Admin Role</Typography>
                          </Box>
                        }
                      />
                      
                      <FormControlLabel
                        control={
                          <Checkbox 
                            checked={currentIsEnabled}
                            onChange={(e) => handleCheckboxChange(user.id, 'isEnabled', e.target.checked)}
                            disabled={user.email === currentUser.email}
                            color="success"
                          />
                        }
                        label={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PersonIcon fontSize="small" sx={{ mr: 0.5 }} />
                            <Typography variant="body2">Account Enabled</Typography>
                          </Box>
                        }
                      />
                    </Box>
                    
                    {/* Save Button */}
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={() => handleSaveUser(user)}
                      disabled={!hasChanges || user.email === currentUser.email}
                      fullWidth
                    >
                      Save Changes
                    </Button>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Paper>
      )}
      
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          User Management Help
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Admin Access:</strong> Users with admin access can manage other users and access special features.
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Disable User:</strong> Disabled users cannot log in to the application.
        </Typography>
        <Typography variant="body1">
          <strong>Note:</strong> You cannot remove your own admin access or disable your own account.
        </Typography>
      </Paper>
      
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
    </Box>
  );
};

export default AdminManagement;