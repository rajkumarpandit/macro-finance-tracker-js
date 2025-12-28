import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Box, 
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Divider
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import GoogleIcon from '@mui/icons-material/Google';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { useAuth } from './AuthContext';
import { auth } from '../../firebase/firebase';
import { checkDailySignupLimit } from '../../utils/apiLimits';

function Signup() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState('Checking...');
  
  // Form validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  
  // Check Firebase Auth status when component mounts
  useEffect(() => {
    const checkAuthStatus = () => {
      if (auth) {
        console.log("Firebase Auth object exists");
        setAuthStatus("Firebase Auth is initialized");
      } else {
        console.error("Firebase Auth is null or undefined");
        setAuthStatus("Firebase Auth is NOT initialized");
        setError("Firebase authentication is not available. Please try again later.");
      }
    };
    
    checkAuthStatus();
  }, []);

  const validateEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };
  
  const validatePassword = (password) => {
    // Minimum 6 characters and at least 1 special character
    if (password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!specialCharRegex.test(password)) {
      return 'Password must contain at least one special character';
    }
    return '';
  };
  
  const validateForm = () => {
    let isValid = true;
    
    // Validate name
    if (!displayName.trim()) {
      setNameError('Name is required');
      isValid = false;
    } else {
      setNameError('');
    }
    
    // Validate email
    if (!email) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    } else {
      setEmailError('');
    }
    
    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else {
      const passwordValidation = validatePassword(password);
      if (passwordValidation) {
        setPasswordError(passwordValidation);
        isValid = false;
      } else {
        setPasswordError('');
      }
    }
    
    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      isValid = false;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      isValid = false;
    } else {
      setConfirmPasswordError('');
    }
    
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset messages
    setError('');
    setSuccess('');
    
    // Validate form inputs
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if signup limit has been reached by querying actual users created today
      const signupCheck = await checkDailySignupLimit();
      if (!signupCheck.allowed) {
        setError(signupCheck.message);
        setLoading(false);
        return;
      }
      
      // Create the account
      await signup(email, password, displayName);
      
      setSuccess('Account created successfully! Redirecting to dashboard...');
      
      // Redirect to dashboard after successful signup
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
      
    } catch (error) {
      console.error('Signup error:', error);
      
      // Handle specific Firebase auth errors with user-friendly messages
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please use a different email or login.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (error.code === 'auth/weak-password') {
        setError('Your password is too weak. Please use a stronger password.');
      } else if (error.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection and try again.');
      } else if (error.code === 'auth/configuration-not-found') {
        setError('Authentication configuration issue. Please contact support.');
      } else {
        setError(error.message || 'Failed to create an account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Check if signup limit has been reached by querying actual users created today
      const signupCheck = await checkDailySignupLimit();
      if (!signupCheck.allowed) {
        setError(signupCheck.message);
        setLoading(false);
        return;
      }
      
      // Sign in with Google
      await loginWithGoogle();
      
      setSuccess('Signed in with Google! Redirecting...');
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Google signup error:', error);
      setError(error.message || 'Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box 
        sx={{ 
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          pt: 2,
          pb: 2
        }}
      >
        <Paper 
          elevation={8} 
          sx={{ 
            p: { xs: 2, sm: 3 }, 
            width: '100%',
            borderRadius: 2,
            background: 'linear-gradient(to bottom, #ffffff, #f5f7fa)'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <PersonAddIcon 
              sx={{ 
                fontSize: 40, 
                color: '#ff9a56', 
                mb: 0.5 
              }} 
            />
            <Typography variant="h5" component="h1" fontWeight="bold" gutterBottom>
              Create Account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign up to get started
            </Typography>
          </Box>
          
          {error && <Alert severity="error" sx={{ mb: 1.5, borderRadius: 2, py: 0.5 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, py: 0.5 }}>{success}</Alert>}
          
          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleSignup}
            disabled={loading}
            sx={{
              py: 1.2,
              mb: 2,
              borderRadius: 2,
              textTransform: 'none',
              fontSize: '0.95rem',
              borderColor: '#4285f4',
              color: '#4285f4',
              '&:hover': {
                borderColor: '#357ae8',
                backgroundColor: 'rgba(66, 133, 244, 0.04)'
              }
            }}
          >
            Sign up with Google
          </Button>
          
          <Divider sx={{ my: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, fontSize: '0.85rem' }}>
              OR
            </Typography>
          </Divider>
          
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              margin="dense"
              required
              fullWidth
              id="displayName"
              label="Full Name"
              name="displayName"
              autoComplete="name"
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              error={!!nameError}
              helperText={nameError}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: '#ff9a56',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff9a56',
                  }
                }
              }}
            />
            <TextField
              margin="dense"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!emailError}
              helperText={emailError}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: '#ff9a56',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff9a56',
                  }
                }
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!passwordError}
              helperText={passwordError || 'Minimum 6 characters with at least 1 special character'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: '#ff9a56',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff9a56',
                  }
                }
              }}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={!!confirmPasswordError}
              helperText={confirmPasswordError}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&:hover fieldset': {
                    borderColor: '#ff9a56',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#ff9a56',
                  }
                }
              }}
            />
            <Box sx={{ display: 'flex', gap: 2, mt: 3, mb: 2 }}>
              <Button
                variant="outlined"
                component={Link}
                to="/"
                disabled={loading}
                sx={{
                  flex: 1,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  borderColor: '#ff9a56',
                  color: '#ff9a56',
                  '&:hover': {
                    borderColor: '#ff8533',
                    backgroundColor: 'rgba(255, 154, 86, 0.08)'
                  }
                }}
              >
                Cancel
              </Button>
              
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  flex: 1,
                  py: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #ffc299 0%, #ff9a56 100%)',
                  },
                  '&:disabled': {
                    background: '#e0e0e0'
                  }
                }}
              >
                {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : "Sign Up"}
              </Button>
            </Box>
            
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link 
                  to="/login" 
                  style={{ 
                    color: '#ff9a56', 
                    textDecoration: 'none',
                    fontWeight: 600
                  }}
                >
                  Log In
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default Signup;