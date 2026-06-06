import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  DialogActions,
  Card,
  CardContent
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import PersonIcon from '@mui/icons-material/Person';
import GoogleIcon from '@mui/icons-material/Google';
import LockIcon from '@mui/icons-material/Lock';
import AssessmentIcon from '@mui/icons-material/Assessment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import KeyIcon from '@mui/icons-material/Key';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../Auth/AuthContext';
import { updatePassword } from 'firebase/auth';
import { FIREBASE_COLLECTIONS } from '../../config/constants';
import Footer from '../Common/Footer';

// Risk Profile History Section Component
function RiskProfileHistory() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [riskProfiles, setRiskProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchRiskProfiles = useCallback(async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      console.log('Fetching risk profiles for user:', currentUser.uid);
      const q = query(
        collection(db, 'risk_profiles'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const profiles = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Found risk profile:', doc.id, data);
        profiles.push({ id: doc.id, ...data });
      });
      
      console.log('Total profiles found:', profiles.length);
      setRiskProfiles(profiles);
    } catch (error) {
      console.error('Error fetching risk profiles:', error);
      console.error('Error details:', error.message, error.code);
      setMessage({ text: 'Error loading risk profiles: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchRiskProfiles();
  }, [fetchRiskProfiles]);

  const handleDelete = async (profileId) => {
    if (!window.confirm('Are you sure you want to delete this risk profile?')) {
      return;
    }

    setDeleting(profileId);
    try {
      await deleteDoc(doc(db, 'risk_profiles', profileId));
      setMessage({ text: 'Risk profile deleted successfully', type: 'success' });
      // Refresh the list
      await fetchRiskProfiles();
    } catch (error) {
      console.error('Error deleting risk profile:', error);
      setMessage({ text: 'Error deleting risk profile: ' + error.message, type: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const getRiskColor = (type) => {
    switch (type) {
      case 'Conservative': return '#4caf50';
      case 'Moderately Conservative': return '#2196f3';
      case 'Moderate': return '#ff9800';
      case 'Aggressive': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  if (loading) {
    return (
      <Card sx={{ bgcolor: '#e3f2fd', mb: 3 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress size={30} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ bgcolor: '#e3f2fd', mb: 3 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {message.text && (
          <Alert 
            severity={message.type} 
            sx={{ mb: 1.5, py: 0.5 }} 
            onClose={() => setMessage({ text: '', type: '' })}
          >
            {message.text}
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <AssessmentIcon sx={{ color: '#1976d2', fontSize: 20 }} />
            <Typography variant="body1" fontWeight="600">
              Risk Profile History
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TrendingUpIcon fontSize="small" />}
            onClick={() => navigate('/risk-profile')}
            sx={{
              textTransform: 'none',
              borderColor: '#1976d2',
              color: '#1976d2',
              py: 0.5,
              px: 1.5,
              fontSize: '0.8rem',
              '&:hover': {
                borderColor: '#1565c0',
                bgcolor: '#bbdefb'
              }
            }}
          >
            {riskProfiles.length > 0 ? 'Retake' : 'Build Profile'}
          </Button>
        </Box>

        {riskProfiles.length === 0 ? (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              textAlign: 'center',
              bgcolor: '#ffffff',
              borderRadius: 2
            }}
          >
            <AssessmentIcon sx={{ fontSize: 36, color: '#bdbdbd', mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No risk profile yet
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
              Build your investment risk profile to get personalized recommendations
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/risk-profile')}
              sx={{
                textTransform: 'none',
                background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)'
                }
              }}
            >
              Build Risk Profile
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {riskProfiles.map((profile, index) => (
              <Paper
                key={profile.id}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  border: `1.5px solid ${index === 0 ? getRiskColor(profile.type) : '#e0e0e0'}`,
                  bgcolor: index === 0 ? `${getRiskColor(profile.type)}08` : '#ffffff',
                  position: 'relative'
                }}
              >
                {index === 0 && (
                  <Chip
                    label="Current"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      bgcolor: getRiskColor(profile.type),
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.65rem',
                      height: 20
                    }}
                  />
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, pr: index === 0 ? 7 : 0 }}>  
                  <Box>
                    <Typography variant="body1" fontWeight="600" sx={{ color: getRiskColor(profile.type) }}>
                      {profile.type}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      {profile.timestamp ? new Date(profile.timestamp).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'Date not available'}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" fontWeight="600" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Score
                    </Typography>
                    <Typography variant="body1" fontWeight="700" sx={{ lineHeight: 1.2 }}>
                      {profile.score}/{profile.maxScore}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      ({profile.percentage}%)
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(profile.id)}
                    disabled={deleting === profile.id}
                    sx={{
                      '&:hover': {
                        bgcolor: '#ffebee'
                      }
                    }}
                  >
                    {deleting === profile.id ? (
                      <CircularProgress size={20} color="error" />
                    ) : (
                      <DeleteIcon fontSize="small" />
                    )}
                  </IconButton>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

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
  const changePasswordRef = useRef(null);
  
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
  const [isEditing, setIsEditing] = useState(false);
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
      
      setIsEditing(false);
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
    setIsEditing(false);
    // Optionally reload profile data if user made changes but didn't save
  };

  const scrollToChangePassword = () => {
    changePasswordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <CircularProgress sx={{ color: '#616161' }} />
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
          justifyContent: 'space-between',
          mb: 2,
          flexWrap: 'wrap',
          gap: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PersonIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'primary.main' }} />
            <Typography variant="h5" component="h1" sx={{ color: 'text.primary', fontWeight: 600, fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
              My Profile
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isEditing && (
              <IconButton
                onClick={() => setIsEditing(true)}
                sx={{
                  bgcolor: '#424242',
                  color: '#ffffff',
                  '&:hover': {
                    bgcolor: '#616161'
                  }
                }}
                title="Edit Profile"
              >
                <EditIcon />
              </IconButton>
            )}
            <IconButton
              onClick={scrollToChangePassword}
              sx={{
                borderRadius: 1,
                border: '1px solid #9e9e9e',
                color: '#616161',
                '&:hover': {
                  borderColor: '#757575',
                  bgcolor: 'rgba(0,0,0,0.04)'
                }
              }}
              title="Change Password"
            >
              <KeyIcon />
            </IconButton>
            <IconButton
              onClick={handleClose}
              sx={{ color: '#616161' }}
              aria-label="close"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

      <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>

        <Grid container spacing={3}>
          {/* Name - Display only */}
          <Grid item xs={12}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Name
              </Typography>
              <Typography variant="h6" fontWeight="600" color="text.primary">
                {name || 'Not available'}
              </Typography>
            </Box>
          </Grid>

          {/* Sex - Optional */}
          <Grid item xs={12}>
            <FormControl component="fieldset" disabled={!isEditing}>
              <FormLabel component="legend" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: '#616161', fontWeight: 500 }}>Sex (Optional)</FormLabel>
              <RadioGroup
                row
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                sx={{
                  '& .MuiFormControlLabel-label': {
                    fontSize: { xs: '0.85rem', sm: '0.95rem' }
                  },
                  '& .MuiRadio-root.Mui-checked': {
                    color: '#616161'
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
              InputProps={{ readOnly: !isEditing }}
              InputLabelProps={{ shrink: true }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              inputProps={{ min: 0, step: 1 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
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
              InputProps={{ readOnly: !isEditing }}
              inputProps={{ maxLength: 6 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 1.5,
                  bgcolor: !isEditing ? '#f5f5f5' : 'transparent',
                  '&:hover fieldset': { borderColor: '#616161' },
                  '&.Mui-focused fieldset': { borderColor: '#616161' }
                },
                '& .MuiInputBase-input': {
                  color: !isEditing ? 'text.secondary' : 'text.primary'
                }
              }}
            />
          </Grid>

          {/* Address Type - Optional */}
          <Grid item xs={12}>
            <FormControl component="fieldset" disabled={!isEditing}>
              <FormLabel component="legend" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, color: '#616161', fontWeight: 500 }}>Address Type (Optional)</FormLabel>
              <RadioGroup
                row
                value={addressType}
                onChange={(e) => setAddressType(e.target.value)}
                sx={{
                  '& .MuiFormControlLabel-label': {
                    fontSize: { xs: '0.85rem', sm: '0.95rem' }
                  },
                  '& .MuiRadio-root.Mui-checked': {
                    color: '#616161'
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
            <Typography variant="body2" fontWeight="600" color="#616161" sx={{ mt: 1.5, mb: 0.5, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
              Login Methods
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <LinkedAccountsSection />
          </Grid>

          {/* Action Buttons */}
          {isEditing && (
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
                    background: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
                    color: '#ffffff',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #616161 0%, #424242 100%)',
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
          )}
        </Grid>
      </Paper>
      </Box>

      {/* Risk Profile History Section */}
      <Box sx={{ mt: 3, px: { xs: 2, sm: 3 } }}>
        <RiskProfileHistory />
      </Box>

      {/* Change Password Section */}
      <Card 
        ref={changePasswordRef}
        sx={{ 
          mt: 3, 
          mx: { xs: 2, sm: 3 },
          borderRadius: 2,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <LockIcon sx={{ color: '#616161' }} />
            <Typography variant="h6" fontWeight="600" color="#616161">
              Change Password
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
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
                    '&:hover fieldset': { borderColor: '#616161' },
                    '&.Mui-focused fieldset': { borderColor: '#616161' }
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
                    '&:hover fieldset': { borderColor: '#616161' },
                    '&.Mui-focused fieldset': { borderColor: '#616161' }
                  },
                  '& .MuiFormHelperText-root': {
                    fontSize: { xs: '0.65rem', sm: '0.75rem' }
                  }
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  onClick={handleSave}
                  variant="contained"
                  disabled={saving || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 3,
                    fontSize: { xs: '0.85rem', sm: '0.95rem' },
                    background: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
                    color: '#ffffff',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #616161 0%, #424242 100%)',
                    },
                    '&:disabled': {
                      background: '#e0e0e0'
                    }
                  }}
                >
                  {saving ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Update Password'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Danger Zone - Delete Account */}
      <Box sx={{ px: { xs: 2, sm: 3 }, mt: 3, pb: 2 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            borderRadius: 2, 
            border: '1px solid #ffcdd2',
            bgcolor: '#ffebee'
          }}
        >
          <Typography variant="body2" fontWeight="600" color="error" sx={{ mb: 1, fontSize: { xs: '0.95rem', sm: '1.1rem' } }}>
            Danger Zone
          </Typography>
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

