import React, { useEffect, useState } from 'react';
import { Box, Container, Typography, Paper, CircularProgress, AppBar, Toolbar, IconButton, Menu, MenuItem } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../Auth/AuthContext';
import { useNavigate } from 'react-router-dom';

function MaintenancePage() {
  const [maintenanceData, setMaintenanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMaintenanceInfo = async () => {
      try {
        const maintenanceDoc = await getDoc(doc(db, 'app_settings', 'maintenance'));
        if (maintenanceDoc.exists()) {
          setMaintenanceData(maintenanceDoc.data());
        }
      } catch (error) {
        console.error('Error fetching maintenance info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenanceInfo();
  }, []);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const endDate = maintenanceData?.endDate || 'soon';
  const message = maintenanceData?.message || 'We are currently performing scheduled maintenance.';

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" sx={{ background: '#ff9a56' }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Macro Tracker
          </Typography>
          <IconButton size="large" edge="end" color="inherit" onClick={handleMenuOpen}>
            <AccountCircleIcon />
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box sx={{ flexGrow: 1, background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 } }}>
        <Container maxWidth="sm">
          <Paper elevation={8} sx={{ p: { xs: 3, sm: 4, md: 6 }, borderRadius: 3, textAlign: 'center', background: 'linear-gradient(to bottom, #ffffff, #f5f7fa)' }}>
            <BuildIcon sx={{ fontSize: { xs: 60, sm: 80 }, color: '#ff9a56', mb: { xs: 2, sm: 3 }, animation: 'spin 3s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
            <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom sx={{ mb: 2, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>Under Maintenance</Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, fontSize: { xs: '1rem', sm: '1.1rem' }, lineHeight: 1.6 }}>{message}</Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 2, fontSize: { xs: '1rem', sm: '1.25rem' } }}>Expected to be back by:</Typography>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#ff9a56', mb: 3, fontSize: { xs: '1.25rem', sm: '1.5rem' }, wordBreak: 'break-word' }}>{endDate}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Thank you for your patience!</Typography>
          </Paper>
        </Container>
      </Box>
    </Box>
  );
}

export default MaintenancePage;
