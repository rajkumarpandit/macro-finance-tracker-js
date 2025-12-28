import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  TextField,
  Button,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Grid,
  Snackbar,
  Alert,
  IconButton,
  InputAdornment,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import GoogleIcon from '@mui/icons-material/Google';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../Auth/AuthContext';
import { updatePassword } from 'firebase/auth';
import { FIREBASE_COLLECTIONS } from '../../config/constants';
import Footer from '../Common/Footer';

// Linked Accounts Section Component
function LinkedAccountsSection() {
  const { currentUser, linkGoogleAccount } = useAuth();
  const [linkedProviders, setLinkedProviders] = useState([]);
  const [linking, setLinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (currentUser) {
      const providers = currentUser.providerData.map(p => p.providerId);
      setLinkedProviders(providers);
    }
  }, [currentUser]);

  const handleLinkGoogle = async () => {
    try {
      setLinking(true);
      setLinkMessage({ text: '', type: '' });
      await linkGoogleAccount();
      
      // Refresh provider list
      const providers = currentUser.providerData.map(p => p.providerId);
      setLinkedProviders(providers);
      
      setLinkMessage({ 
        text: 'Google account linked successfully! You can now use Google to login.', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Link error:', error);
      setLinkMessage({ 
        text: error.message || 'Failed to link Google account. Please try again.', 
        type: 'error' 
      });
    } finally {
      setLinking(false);
    }
  };

  return (
    <Box>
      {linkMessage.text && (
        <Alert severity={linkMessage.type} sx={{ mb: 2 }} onClose={() => setLinkMessage({ text: '', type: '' })}>
          {linkMessage.text}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {linkedProviders.includes('password') && (
          <Chip 
            icon={<LockIcon />}
            label="Email/Password" 
            color="primary" 
            size="small"
          />
        )}
        
        {linkedProviders.includes('google.com') ? (
          <Chip 
            icon={<GoogleIcon />}
            label="Google" 
            color="success" 
            size="small"
          />
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={handleLinkGoogle}
            disabled={linking}
            sx={{
              borderColor: '#4285f4',
              color: '#4285f4',
              textTransform: 'none',
              '&:hover': {
                borderColor: '#357ae8',
                backgroundColor: 'rgba(66, 133, 244, 0.04)'
              }
            }}
          >
            {linking ? 'Linking...' : 'Link Google Account'}
          </Button>
        )}
      </Box>
      
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Link social accounts to login faster without remembering passwords
      </Typography>
    </Box>
  );
}

function MyProfilePage() {
  const { currentUser, userDetails, deleteAccount } = useAuth();
  const navigate = useNavigate();
  
  // Profile fields
  const [name, setName] = useState('');
  const [sex, setSex] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [age, setAge] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [addressLine3, setAddressLine3] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [addressType, setAddressType] = useState('');
  
  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Delete account dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // UI states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Load user profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, FIREBASE_COLLECTIONS.USERS, currentUser.uid));
        let userName = '';
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          userName = data.name || '';
          setSex(data.sex || '');
          setDateOfBirth(data.dateOfBirth || '');
          setJobTitle(data.jobTitle || '');
          setMonthlySalary(data.monthlySalary || '');
          setAddressLine1(data.addressLine1 || '');
          setAddressLine2(data.addressLine2 || '');
          setAddressLine3(data.addressLine3 || '');
          setCity(data.city || '');
          setState(data.state || '');
          setCountry(data.country || '');
          setPinCode(data.pinCode || '');
          setAddressType(data.addressType || '');
        }
        
        // If name is not in Firestore, try to get it from Auth
        if (!userName) {
          if (userDetails?.displayName) {
            userName = userDetails.displayName;
          } else if (currentUser?.displayName) {
            userName = currentUser.displayName;
          } else if (currentUser?.email) {
            // Fall back to email username as last resort
            const emailName = currentUser.email.split('@')[0];
            userName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
          }
        }
        
        setName(userName);
      } catch (error) {
        console.error('Error fetching profile:', error);
        setMessage({ text: 'Error loading profile', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [currentUser, userDetails]);

  // Calculate age from date of birth
  useEffect(() => {
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      
      setAge(calculatedAge > 0 ? `${calculatedAge} years` : '');
    } else {
      setAge('');
    }
  }, [dateOfBirth]);



  const handleSave = async () => {
    // Validate required fields
    if (!name.trim()) {
      setMessage({ text: 'Name is required', type: 'error' });
      return;
    }

    // Validate monthly salary if provided
    if (monthlySalary) {
      const salary = parseFloat(monthlySalary);
      if (salary < 0) {
        setMessage({ text: 'Monthly salary must be a positive number', type: 'error' });
        return;
      }
    }

    // Validate password fields if entered
    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setMessage({ text: 'Passwords do not match', type: 'error' });
        return;
      }
      if (newPassword.length < 6) {
        setMessage({ text: 'Password must be at least 6 characters', type: 'error' });
        return;
      }
    }

    setSaving(true);
    try {
      // Update profile in Firestore
      const profileData = {
        name: name.trim(),
        sex: sex,
        dateOfBirth: dateOfBirth,
        jobTitle: jobTitle,
        monthlySalary: monthlySalary,
        addressLine1: addressLine1,
        addressLine2: addressLine2,
        addressLine3: addressLine3,
        city: city,
        state: state,
        country: country,
        pinCode: pinCode,
        addressType: addressType,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, FIREBASE_COLLECTIONS.USERS, currentUser.uid), profileData);

      // Update password if provided
      if (newPassword) {
        await updatePassword(currentUser, newPassword);
        setNewPassword('');
        setConfirmPassword('');
        setMessage({ text: 'Profile and password updated successfully!', type: 'success' });
      } else {
        setMessage({ text: 'Profile updated successfully!', type: 'success' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      if (error.code === 'auth/requires-recent-login') {
        setMessage({ text: 'Please log out and log in again to change your password', type: 'error' });
      } else {
        setMessage({ text: 'Error updating profile: ' + error.message, type: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const handleClose = () => {
    navigate('/dashboard');
  };

  const handleDeleteAccount = async () => {
    // Require user to type "DELETE" to confirm
    if (deleteConfirmText !== 'DELETE') {
      setMessage({ text: 'Please type DELETE to confirm', type: 'error' });
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount();
      // User is deleted, navigate to landing page
      navigate('/');
    } catch (error) {
      console.error('Delete account error:', error);
      setDeleting(false);
      setDeleteDialogOpen(false);
      
      if (error.message.includes('recent login')) {
        setMessage({ 
          text: 'For security, please log out and log back in before deleting your account.', 
          type: 'error' 
        });
      } else {
        setMessage({ 
          text: 'Error deleting account: ' + error.message, 
          type: 'error' 
        });
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress sx={{ color: '#ff9a56' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f7fa', pb: 2 }}>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          mb: 2,
          position: 'relative'
        }}>
          <PersonIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
          <Typography variant="h5" component="h1" sx={{ color: 'text.primary', fontWeight: 600, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
            My Profile
          </Typography>
          {/* Close Button */}
          <IconButton
            onClick={handleClose}
            sx={{ position: 'absolute', right: { xs: 8, sm: 16 }, color: 'white' }}
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </Box>

      <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>

        <Grid container spacing={3}>
          {/* Name - Required */}
          <Grid item xs={12}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              error={!name.trim()}
              helperText={!name.trim() ? 'Name is required' : ''}
            />
          </Grid>

          {/* Sex - Optional */}
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: '#ff9a56', fontWeight: 500 }}>Sex (Optional)</FormLabel>
              <RadioGroup
                row
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                sx={{
                  '& .MuiFormControlLabel-label': {
                    fontSize: { xs: '0.85rem', sm: '0.95rem' }
                  },
                  '& .MuiRadio-root.Mui-checked': {
                    color: '#ff9a56'
                  }
                }}
              >
                <FormControlLabel value="male" control={<Radio />} label="Male" />
                <FormControlLabel value="female" control={<Radio />} label="Female" />
                <FormControlLabel value="others" control={<Radio />} label="Others" />
                <FormControlLabel value="prefer-not-to-say" control={<Radio />} label="Don't want to say" />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Date of Birth - Optional */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Date of Birth (Optional)"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Age - Read Only */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Age"
              value={age}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
              disabled
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5
                }
              }}
            />
          </Grid>

          {/* Job Title - Optional */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Job Title (Optional)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Monthly Salary - Optional */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Monthly Salary (₹) (Optional)"
              type="number"
              value={monthlySalary}
              onChange={(e) => setMonthlySalary(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: 1 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Address Line 1 - Optional */}
          <Grid item xs={12}>
            <TextField
              label="Address Line 1 (Optional)"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Address Line 2 - Optional */}
          <Grid item xs={12}>
            <TextField
              label="Address Line 2 (Optional)"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Address Line 3 - Optional */}
          <Grid item xs={12}>
            <TextField
              label="Address Line 3 (Optional)"
              value={addressLine3}
              onChange={(e) => setAddressLine3(e.target.value)}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* City - Optional */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="City (Optional)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* State - Optional */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="State (Optional)"
              value={state}
              onChange={(e) => setState(e.target.value)}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Country - Optional */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Country (Optional)"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              fullWidth
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Pin Code - Optional */}
          <Grid item xs={12} sm={6}>
            <TextField
              label="Pin Code (Optional)"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ maxLength: 6 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                }
              }}
            />
          </Grid>

          {/* Address Type - Optional */}
          <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: '#ff9a56', fontWeight: 500 }}>Address Type (Optional)</FormLabel>
              <RadioGroup
                row
                value={addressType}
                onChange={(e) => setAddressType(e.target.value)}
                sx={{
                  '& .MuiFormControlLabel-label': {
                    fontSize: { xs: '0.85rem', sm: '0.95rem' }
                  },
                  '& .MuiRadio-root.Mui-checked': {
                    color: '#ff9a56'
                  }
                }}
              >
                <FormControlLabel value="owned" control={<Radio />} label="Owned" />
                <FormControlLabel value="rental" control={<Radio />} label="Rental" />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Login Methods Section */}
          <Grid item xs={12}>
            <Typography variant="body2" fontWeight="600" color="#ff9a56" sx={{ mt: 1.5, mb: 0.5, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
              Login Methods
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <LinkedAccountsSection />
          </Grid>

          {/* Change Password Section */}
          <Grid item xs={12}>
            <Typography variant="body2" fontWeight="600" color="#ff9a56" sx={{ mt: 1.5, mb: 0.5, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
              Change Password
            </Typography>
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="New Password"
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      edge="end"
                      size="small"
                    >
                      {showNewPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              helperText="Leave blank to keep current password"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                },
                '& .MuiFormHelperText-root': {
                  fontSize: { xs: '0.65rem', sm: '0.75rem' }
                }
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Confirm New Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
              size="small"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                      size="small"
                    >
                      {showConfirmPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              error={newPassword !== confirmPassword && confirmPassword !== ''}
              helperText={
                newPassword !== confirmPassword && confirmPassword !== ''
                  ? 'Passwords do not match'
                  : ''
              }
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  '&:hover fieldset': { borderColor: '#ff9a56' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9a56' }
                },
                '& .MuiFormHelperText-root': {
                  fontSize: { xs: '0.65rem', sm: '0.75rem' }
                }
              }}
            />
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 1 }}>
              <Button
                onClick={handleCancel}
                variant="outlined"
                disabled={saving}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3,
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  borderColor: '#9e9e9e',
                  color: '#616161',
                  '&:hover': {
                    borderColor: '#757575',
                    bgcolor: 'rgba(0,0,0,0.04)'
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                variant="contained"
                disabled={saving || !name.trim()}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 3,
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #ffc299 0%, #ff9a56 100%)',
                  },
                  '&:disabled': {
                    background: '#e0e0e0'
                  }
                }}
              >
                {saving ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Save'}
              </Button>
            </Box>
          </Grid>

          {/* Danger Zone - Delete Account */}
          <Grid item xs={12}>
            <Typography variant="body2" fontWeight="600" color="error" sx={{ mt: 3, mb: 1, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
              Danger Zone
            </Typography>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                border: '1px solid #ffcdd2',
                bgcolor: '#ffebee'
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Delete your account and all associated data. This action cannot be undone.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                onClick={() => setDeleteDialogOpen(true)}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 2,
                  fontSize: { xs: '0.85rem', sm: '0.95rem' }
                }}
              >
                Delete My Account
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
      </Box>

      {/* Delete Account Confirmation Dialog */}
      <Dialog 
        open={deleteDialogOpen} 
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#d32f2f', fontWeight: 600 }}>
          Delete Account Permanently?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This will permanently delete your account and all associated data including:
          </DialogContentText>
          <Box component="ul" sx={{ pl: 2, mb: 2 }}>
            <li>Food logs and calorie tracking history</li>
            <li>Weight records and progress</li>
            <li>Macro targets and goals</li>
            <li>Custom food items</li>
            <li>Profile information</li>
          </Box>
          <DialogContentText sx={{ mb: 2, fontWeight: 600 }}>
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
            onClick={handleDeleteAccount}
            color="error"
            variant="contained"
            disabled={deleteConfirmText !== 'DELETE' || deleting}
          >
            {deleting ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Delete Forever'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for messages */}
      <Snackbar
        open={message.text !== ''}
        autoHideDuration={6000}
        onClose={() => setMessage({ text: '', type: '' })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setMessage({ text: '', type: '' })}
          severity={message.type}
          sx={{ width: '100%' }}
        >
          {message.text}
        </Alert>
      </Snackbar>
      
      <Footer />
    </Box>
  );
}

export default MyProfilePage;

