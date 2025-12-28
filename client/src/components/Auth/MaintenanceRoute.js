import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../Auth/AuthContext';
import { CircularProgress, Box } from '@mui/material';

function MaintenanceRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const maintenanceDoc = await getDoc(doc(db, 'app_settings', 'maintenance'));
        
        if (maintenanceDoc.exists()) {
          const data = maintenanceDoc.data();
          setMaintenanceEnabled(data.enabled || false);
        }
      } catch (error) {
        console.error('Error checking maintenance mode:', error);
        // On error, allow access
        setMaintenanceEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkMaintenanceMode();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Super admin (rajkumarpandit@gmail.com) always bypasses maintenance
  const isSuperAdmin = currentUser?.email === 'rajkumarpandit@gmail.com';
  
  // If maintenance is enabled and user is not super admin, redirect to maintenance page
  if (maintenanceEnabled && !isSuperAdmin) {
    return <Navigate to="/maintenance" replace />;
  }

  return children;
}

export default MaintenanceRoute;
