import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Snackbar
} from '@mui/material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import Footer from '../Common/Footer';

function AppMaintenance() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [geminiApiLimitPerUser, setGeminiApiLimitPerUser] = useState(40);
  const [maxNewUsersPerDay, setMaxNewUsersPerDay] = useState(100);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    fetchMaintenanceSettings();
  }, []);

  const fetchMaintenanceSettings = async () => {
    try {
      setLoading(true);
      
      // Fetch maintenance settings
      const maintenanceDoc = await getDoc(doc(db, 'app_settings', 'maintenance'));
      if (maintenanceDoc.exists()) {
        const data = maintenanceDoc.data();
        setMaintenanceEnabled(data.enabled || false);
        setEndDate(data.endDate || '');
        setMessage(data.message || '');
      } else {
        setMaintenanceEnabled(false);
        setEndDate('');
        setMessage('We are currently performing scheduled maintenance. Please check back soon.');
      }

      // Fetch API limits settings
      const apiLimitsDoc = await getDoc(doc(db, 'app_settings', 'api_limits'));
      if (apiLimitsDoc.exists()) {
        const data = apiLimitsDoc.data();
        setGeminiApiLimitPerUser(data.geminiApiLimitPerUser || 40);
        setMaxNewUsersPerDay(data.maxNewUsersPerDay || 100);
      } else {
        setGeminiApiLimitPerUser(40);
        setMaxNewUsersPerDay(100);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setNotification({
        open: true,
        message: 'Error loading settings',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Validate API limits
      const geminiLimit = parseInt(geminiApiLimitPerUser);
      const userLimit = parseInt(maxNewUsersPerDay);
      
      if (isNaN(geminiLimit) || geminiLimit < 0) {
        setNotification({
          open: true,
          message: 'Gemini API limit must be a valid positive number',
          severity: 'error'
        });
        setSaving(false);
        return;
      }
      
      if (isNaN(userLimit) || userLimit < 0) {
        setNotification({
          open: true,
          message: 'Max new users per day must be a valid positive number',
          severity: 'error'
        });
        setSaving(false);
        return;
      }
      
      // Save maintenance settings
      await setDoc(doc(db, 'app_settings', 'maintenance'), {
        enabled: maintenanceEnabled,
        endDate: endDate.trim(),
        message: message.trim() || 'We are currently performing scheduled maintenance. Please check back soon.',
        updatedAt: new Date().toISOString()
      });

      // Save API limits settings
      await setDoc(doc(db, 'app_settings', 'api_limits'), {
        geminiApiLimitPerUser: geminiLimit,
        maxNewUsersPerDay: userLimit,
        updatedAt: new Date().toISOString()
      });

      setNotification({
        open: true,
        message: 'Settings saved successfully!',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      setNotification({
        open: true,
        message: 'Error saving settings: ' + error.message,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress sx={{ color: '#ff9a56' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', pb: 2 }}>
      {maintenanceEnabled && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Maintenance Mode is Active!</strong> Users (except admins) will see the maintenance page.
        </Alert>
      )}

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Typography variant="h6" fontWeight="600" gutterBottom sx={{ mb: 3 }}>
            Maintenance Settings
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={maintenanceEnabled}
                onChange={(e) => setMaintenanceEnabled(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#ff9800',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#ff9800',
                  },
                }}
              />
            }
            label={
              <Box>
                <Typography variant="body1" fontWeight="600">
                  Enable Maintenance Mode
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  When enabled, all non-admin users will be redirected to the maintenance page
                </Typography>
              </Box>
            }
            sx={{ mb: 3, alignItems: 'flex-start' }}
          />

          <TextField
            fullWidth
            label="Expected End Date/Time"
            placeholder="e.g., December 1st, 2025 at 3:00 PM EST"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': { borderColor: '#ff9800' },
                '&.Mui-focused fieldset': { borderColor: '#ff9800' }
              }
            }}
            helperText="This will be displayed to users on the maintenance page"
          />

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Maintenance Message"
            placeholder="We are currently performing scheduled maintenance. Please check back soon."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': { borderColor: '#ff9800' },
                '&.Mui-focused fieldset': { borderColor: '#ff9800' }
              }
            }}
            helperText="Custom message to display to users"
          />

        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mt: 2, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Typography variant="h6" fontWeight="600" gutterBottom sx={{ mb: 3 }}>
            API Usage Limits
          </Typography>

          <TextField
            fullWidth
            type="number"
            label="Gemini API Calls Limit (Per User)"
            value={geminiApiLimitPerUser}
            onChange={(e) => setGeminiApiLimitPerUser(e.target.value)}
            inputProps={{ min: 0, step: 1 }}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': { borderColor: '#ff9a56' },
                '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
              }
            }}
            helperText="Default: 40"
          />
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mt: 2, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Typography variant="h6" fontWeight="600" gutterBottom sx={{ mb: 3 }}>
            Security Settings
          </Typography>

          <TextField
            fullWidth
            type="number"
            label="Max New User Registrations (Per Day)"
            value={maxNewUsersPerDay}
            onChange={(e) => setMaxNewUsersPerDay(e.target.value)}
            inputProps={{ min: 0, step: 1 }}
            sx={{ 
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '&:hover fieldset': { borderColor: '#ff9a56' },
                '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
              }
            }}
            helperText="Default: 100"
          />
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mt: 2, mb: 2, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            fullWidth
            sx={{
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
              },
              '&:disabled': {
                background: '#e0e0e0'
              }
            }}
          >
            {saving ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Save All Settings'}
          </Button>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <Typography variant="h6" fontWeight="600" gutterBottom sx={{ mb: 2 }}>
            Important Notes
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            <li>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>Maintenance Mode:</strong> Admin users can still access the application when maintenance is enabled.
              </Typography>
            </li>
            <li>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>API Limits:</strong> When users reach their Gemini API limit, they'll be prompted to use the dropdown or save food items.
              </Typography>
            </li>
            <li>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>User Registration:</strong> Daily signup limit helps prevent abuse and controls growth.
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Effect:</strong> All changes take effect immediately after saving.
              </Typography>
            </li>
          </Box>
        </Paper>

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
}

export default AppMaintenance;

