import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { useIsAdmin } from '../utils/adminUtils';
import { getAuth } from 'firebase/auth';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * ProtectedRoute component to restrict access based on authentication and role
 * @param {Object} props - Component props
 * @param {string} props.requiredRole - Role required to access this route ('admin' or 'user')
 * @param {Component} props.component - Component to render if allowed
 * @param {string} props.redirectTo - Path to redirect to if access is denied
 * @param {Object} rest - All other props to pass to the Route
 */
const ProtectedRoute = ({
  requiredRole,
  component: Component,
  redirectTo = '/login',
  ...rest
}) => {
  const auth = getAuth();
  const user = auth.currentUser;
  const isAdmin = useIsAdmin();
  const loading = user === undefined; // Still initializing auth

  // Helper function to render the appropriate component based on auth state
  const renderRoute = (props) => {
    // Show loading while checking auth state
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      );
    }

    // Not logged in - redirect to login
    if (!user) {
      return <Navigate to={redirectTo} state={{ from: props.location }} />;
    }

    // For admin routes, check if the user is an admin
    if (requiredRole === 'admin' && !isAdmin) {
      return (
        <Box sx={{ padding: 3, textAlign: 'center' }}>
          <Typography variant="h5" color="error">
            Access Denied
          </Typography>
          <Typography variant="body1">
            You don't have permission to access this page.
          </Typography>
        </Box>
      );
    }

    // User is authenticated and has proper role, render the component
    return <Component {...props} />;
  };

  return <Route {...rest} element={renderRoute(rest)} />;
};

export default ProtectedRoute;