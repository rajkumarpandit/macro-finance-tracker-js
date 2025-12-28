import React, { useState } from 'react';
import { Box, Button, Typography, Alert, Paper, CircularProgress, List, ListItem, ListItemText } from '@mui/material';
import { db } from '../firebase/firebase';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

const TestFirestorePermissions = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  
  const auth = getAuth();
  const currentUser = auth.currentUser;
  
  const runTests = async () => {
    if (!currentUser) {
      setError("You must be logged in to run the tests");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResults([]);
    
    const testResults = [];
    
    try {
      // Test 1: Read users collection
      try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        testResults.push({
          name: "Read users collection",
          status: "success",
          message: `Success! Found ${usersSnapshot.docs.length} users`
        });
      } catch (err) {
        testResults.push({
          name: "Read users collection",
          status: "error",
          message: `Failed: ${err.message}`
        });
      }
      
      // Test 2: Read admin_users collection
      try {
        const adminUsersCollection = collection(db, 'admin_users');
        const adminUsersSnapshot = await getDocs(adminUsersCollection);
        testResults.push({
          name: "Read admin_users collection",
          status: "success",
          message: `Success! Found ${adminUsersSnapshot.docs.length} admin entries`
        });
      } catch (err) {
        testResults.push({
          name: "Read admin_users collection",
          status: "error",
          message: `Failed: ${err.message}`
        });
      }
      
      // Test 3: Read current user's document
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        testResults.push({
          name: "Read current user's document",
          status: userDoc.exists() ? "success" : "warning",
          message: userDoc.exists() 
            ? `Success! Found user document for ${currentUser.email}`
            : `User document not found for ${currentUser.email}`
        });
      } catch (err) {
        testResults.push({
          name: "Read current user's document",
          status: "error",
          message: `Failed: ${err.message}`
        });
      }
      
      // Test 4: Check admin status
      try {
        const adminDoc = await getDoc(doc(db, 'admin_users', currentUser.email.toLowerCase()));
        testResults.push({
          name: "Check admin status",
          status: "success",
          message: adminDoc.exists() 
            ? `User ${currentUser.email} is an admin` 
            : `User ${currentUser.email} is not an admin`
        });
      } catch (err) {
        testResults.push({
          name: "Check admin status",
          status: "error",
          message: `Failed: ${err.message}`
        });
      }
      
      setResults(testResults);
    } catch (err) {
      setError(`Error running tests: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>Test Firestore Permissions</Typography>
        
        <Typography variant="body1" paragraph>
          This tool will help you diagnose permission issues with Firestore.
        </Typography>
        
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        
        <Button
          variant="contained"
          color="primary"
          onClick={runTests}
          disabled={loading || !currentUser}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? "Running Tests..." : "Run Permission Tests"}
        </Button>
        
        {results.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>Test Results:</Typography>
            <List>
              {results.map((result, index) => (
                <ListItem key={index} divider>
                  <ListItemText
                    primary={result.name}
                    secondary={result.message}
                    primaryTypographyProps={{
                      color: 
                        result.status === "success" ? "success.main" :
                        result.status === "warning" ? "warning.main" :
                        "error.main"
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        
        <Box sx={{ mt: 3, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="subtitle2">Current Firestore Rules</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Users Collection: Only your own document unless you're an admin<br />
            Admin_Users Collection: Read by any authenticated user, write by admins only
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default TestFirestorePermissions;