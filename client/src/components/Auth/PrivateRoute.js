import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useIsAdmin } from '../../utils/adminUtils';
import { Box, CircularProgress, Typography } from '@mui/material';

function PrivateRoute({ children, requireAdmin = false }) {
  const { currentUser, userDetails } = useAuth();
  const location = useLocation();
  const { isAdmin: userIsAdmin, loading: adminCheckLoading } = useIsAdmin(currentUser);
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    if (!adminCheckLoading) {
      setChecking(false);
    }
  }, [adminCheckLoading]);
  
  // Check if user account is disabled
  const userDisabled = userDetails && userDetails.isEnabled === false;
  
  // Show loading while checking admin status
  if (checking) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Checking permissions...
        </Typography>
      </Box>
    );
  }
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }
  
  if (userDisabled) {
    return <Navigate to="/login" />;
  }
  
  // Check for admin access if required
  if (requireAdmin && !userIsAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return children;
}

export default PrivateRoute;