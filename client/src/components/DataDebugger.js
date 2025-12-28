import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Paper,
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Divider
} from '@mui/material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from './Auth/AuthContext';

// Simple component to display raw data for debugging
function DataDebugger() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const { currentUser } = useAuth();

  // Use useCallback to prevent recreating this function on every render
  const fetchAllUserLogs = useCallback(async () => {
    if (!currentUser) {
      setError("You must be logged in");
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Simple query - just get all logs for this user
      const q = query(
        collection(db, 'daily_food_log'),
        where('userId', '==', currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        setError("No logs found for your user. Try adding some food in the Daily Log page first.");
        setLogs([]);
      } else {
        const fetchedLogs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setLogs(fetchedLogs);
      }
    } catch (err) {
      console.error("Error fetching logs:", err);
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // Automatically fetch on component mount
  useEffect(() => {
    fetchAllUserLogs();
  }, [fetchAllUserLogs]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Data Debugger</Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="body1" paragraph>
          This page shows your raw food log data from Firestore.
          Use it to check if data is being saved correctly.
        </Typography>
        
        <Button 
          variant="contained" 
          onClick={fetchAllUserLogs}
          disabled={loading}
          sx={{ mb: 2 }}
        >
          {loading ? 'Loading...' : 'Refresh Data'}
        </Button>
        
        {error && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light' }}>
            <Typography color="error">{error}</Typography>
          </Box>
        )}
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Typography variant="subtitle1">
              Found {logs.length} log entries for your user
            </Typography>
            
            <List sx={{ mt: 2, bgcolor: 'background.paper' }}>
              {logs.map(log => (
                <React.Fragment key={log.id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={`${log.food_name} (${log.date_eaten})`}
                      secondary={
                        <>
                          <Typography component="span" variant="body2">
                            ID: {log.id}<br />
                            Date: {log.date_eaten}<br />
                            User ID: {log.userId}<br />
                            Calories: {log.calories} ({typeof log.calories})<br />
                            Protein: {log.protein}g ({typeof log.protein})<br />
                            Carbs: {log.carbs}g ({typeof log.carbs})<br />
                            Fat: {log.fat}g ({typeof log.fat})
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                  <Divider />
                </React.Fragment>
              ))}
              
              {logs.length === 0 && (
                <ListItem>
                  <ListItemText primary="No data found" />
                </ListItem>
              )}
            </List>
          </>
        )}
      </Paper>
    </Box>
  );
}

export default DataDebugger;