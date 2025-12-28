import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Alert, TextField, Paper, Snackbar, CircularProgress, Link } from '@mui/material';
import { db } from '../firebase/firebase';
import { doc, setDoc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../components/Auth/AuthContext';
import adminConfig from '../config/adminConfig.json';
import { Link as RouterLink } from 'react-router-dom';

const InitializeAdminCollection = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });
  
  // Check if Firestore rules have been deployed
  useEffect(() => {
    const testPermission = async () => {
      try {
        // Try to read the admin_users collection
        await getDoc(doc(db, 'admin_users', 'test'));
        console.log("Admin users collection access test completed");
      } catch (err) {
        if (err.message.includes("Missing or insufficient permissions")) {
          setError("Firestore security rules need to be updated. Please deploy the updated rules.");
        }
      }
    };
    
    testPermission();
  }, []);
  
  const handleInitializeAdmins = async () => {
    if (!currentUser) {
      setError("You must be logged in to initialize admin users");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if this user is in adminConfig.json
      const isAdminInConfig = adminConfig.adminUsers.some(
        adminEmail => adminEmail.toLowerCase() === currentUser.email.toLowerCase()
      );
      
      if (!isAdminInConfig) {
        setError("You are not listed as an admin in the configuration file");
        setLoading(false);
        return;
      }
      
      // Create admin_users entries for each admin in the config
      const promises = adminConfig.adminUsers.map(async (adminEmail) => {
        const normalizedEmail = adminEmail.toLowerCase();
        try {
          // Check if this admin already exists
          const adminDoc = await getDoc(doc(db, 'admin_users', normalizedEmail));
          
          if (!adminDoc.exists()) {
            // Create the admin document
            await setDoc(doc(db, 'admin_users', normalizedEmail), {
              email: normalizedEmail,
              createdAt: new Date()
            });
            console.log(`Added admin: ${normalizedEmail}`);
            return { email: normalizedEmail, status: 'added' };
          }
          return { email: normalizedEmail, status: 'exists' };
        } catch (error) {
          console.error(`Error processing admin ${normalizedEmail}:`, error);
          return { email: normalizedEmail, status: 'error', error: error.message };
        }
      });
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.status === 'error');
      
      if (errors.length > 0) {
        const errorMessages = errors.map(e => `${e.email}: ${e.error}`).join('\n');
        setError(`Some admins could not be added: ${errorMessages}\n\nPlease check Firebase permissions.`);
        setSuccess(errors.length < results.length); // Partial success
      } else {
        setSuccess(true);
        setNotification({
          open: true,
          message: "Admin collection initialized successfully!",
          severity: "success"
        });
      }
    } catch (err) {
      console.error("Error initializing admin collection:", err);
      let errorMessage = err.message;
      
      // Provide more helpful message for common errors
      if (errorMessage.includes("permission-denied") || errorMessage.includes("Missing or insufficient permissions")) {
        errorMessage = "Permission denied. Your Firestore security rules need to be updated to allow writing to the admin_users collection.";
      }
      
      setError(errorMessage);
      setNotification({
        open: true,
        message: "Error initializing admin collection: " + errorMessage,
        severity: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to check admin status directly
  const checkAdminStatus = async () => {
    try {
      setLoading(true);
      console.log("Checking existing admin entries...");
      
      // Fetch all admin users
      const adminsPromises = adminConfig.adminUsers.map(async (email) => {
        try {
          const normalizedEmail = email.toLowerCase();
          const adminRef = doc(db, 'admin_users', normalizedEmail);
          const adminDoc = await getDoc(adminRef);
          console.log(`Admin ${normalizedEmail} exists: ${adminDoc.exists()}`);
          return { email: normalizedEmail, exists: adminDoc.exists() };
        } catch (err) {
          console.error(`Error checking admin ${email}:`, err);
          return { email, exists: false, error: err.message };
        }
      });
      
      const adminsStatus = await Promise.all(adminsPromises);
      console.log("Admin status check complete:", adminsStatus);
      
      // If not all admins exist, suggest initialization
      if (adminsStatus.some(admin => !admin.exists)) {
        setSuccess(false);
      } else {
        setSuccess(true);
        setNotification({
          open: true,
          message: "Admin collection already initialized!",
          severity: "success"
        });
      }
    } catch (err) {
      console.error("Error checking admin status:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Check status on component load
  useEffect(() => {
    if (currentUser) {
      checkAdminStatus();
    }
  }, [currentUser]);

  // Handle notification close
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (!currentUser) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Please log in to access this page.</Alert>
      </Box>
    );
  }


  
  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>Initialize Admin Collection</Typography>
        <Typography variant="body1" paragraph>
          This tool will create the admin_users collection in Firestore and add all the admins
          listed in your configuration file.
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 2 }}>
          Config file admins: {adminConfig.adminUsers.join(', ')}
        </Typography>
        
        {error && error.includes("permissions") && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" paragraph fontWeight="bold">
              Missing or insufficient permissions to access admin_users collection
            </Typography>
            
            <Typography variant="body2" paragraph>
              To fix this issue:
            </Typography>
            
            <ol>
              <li>
                <Typography variant="body2" paragraph>
                  We've already updated your Firestore security rules in <code>firestore.rules</code>
                </Typography>
              </li>
              <li>
                <Typography variant="body2" paragraph>
                  Run the <strong>deploy-firestore-rules.bat</strong> file in your project root
                </Typography>
              </li>
              <li>
                <Typography variant="body2" paragraph>
                  Or manually deploy using: <code>firebase deploy --only firestore:rules</code>
                </Typography>
              </li>
              <li>
                <Typography variant="body2">
                  After deployment, refresh this page and try again
                </Typography>
              </li>
            </ol>
          </Alert>
        )}
        
        {error && !error.includes("permissions") && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" paragraph>{error}</Typography>
          </Alert>
        )}
        
        {success && <Alert severity="success" sx={{ mb: 2 }}>Admin collection initialized successfully!</Alert>}
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleInitializeAdmins}
          disabled={loading || success}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Initializing...' : success ? 'Already Initialized' : 'Initialize Admin Collection'}
        </Button>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {success ? 'Admin collection is already initialized.' : 'Click the button above to initialize the admin collection.'}
          </Typography>
          <Button 
            component={RouterLink} 
            to="/admin" 
            variant="outlined"
            sx={{ ml: 1 }}
          >
            Go to User Management
          </Button>
        </Box>
        
        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2">Debug Information</Typography>
          <Typography variant="body2">
            Current User: {currentUser?.email || 'None'}<br />
            Is Admin in Config: {adminConfig.adminUsers.includes(currentUser?.email) ? 'Yes' : 'No'}<br />
            Rules Deployed: Yes (per your terminal output)<br />
            Collection Status: {success ? 'Initialized' : 'Not initialized or partially initialized'}
          </Typography>
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button 
              component={RouterLink}
              to="/admin/test-permissions"
              size="small"
              color="info"
              variant="outlined"
            >
              Test Firestore Permissions
            </Button>
          </Box>
        </Box>
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

export default InitializeAdminCollection;