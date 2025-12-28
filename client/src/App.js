import React, { useState, lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { useIsAdmin } from './utils/adminUtils';
import { 
  CssBaseline, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  CircularProgress,
  Menu,
  MenuItem,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemButton,
  ListItemText,
  Divider
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptIcon from '@mui/icons-material/Receipt';
import BarChartIcon from '@mui/icons-material/BarChart';
import HomeIcon from '@mui/icons-material/Home';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import CategoryIcon from '@mui/icons-material/Category';
import MenuIcon from '@mui/icons-material/Menu';
import BookIcon from '@mui/icons-material/Book';
import RepeatIcon from '@mui/icons-material/Repeat';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import FolderSharedIcon from '@mui/icons-material/FolderShared';

// Import authentication components
import { AuthProvider, useAuth } from './components/Auth/AuthContext';
import PrivateRoute from './components/Auth/PrivateRoute';
import MaintenanceRoute from './components/Auth/MaintenanceRoute';
import { cleanupLegacyData } from './firebase/cleanupUtils';

// Lazy load components to improve initial load time
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const ReportPage = lazy(() => import('./components/Report/ReportPage'));
const Login = lazy(() => import('./components/Auth/Login'));
const Signup = lazy(() => import('./components/Auth/Signup'));
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'));
const LandingPage = lazy(() => import('./components/LandingPage/LandingPage'));
const AdminPage = lazy(() => import('./components/Admin/AdminPage'));
const InitializeAdminCollection = lazy(() => import('./components/InitializeAdminCollection'));
const TestFirestorePermissions = lazy(() => import('./components/TestFirestorePermissions'));
const DataDebugger = lazy(() => import('./components/DataDebugger'));
const MyProfilePage = lazy(() => import('./components/Profile/MyProfilePage'));
const MaintenancePage = lazy(() => import('./components/Maintenance/MaintenancePage'));
const DailyExpenseLogPage = lazy(() => import('./components/DailyExpenseLog/DailyExpenseLogPage'));
const LedgerPage = lazy(() => import('./components/Ledger/LedgerPage'));
const RecurringTransactionSetup = lazy(() => import('./components/RecurringTransactions/RecurringTransactionSetup'));
const ExpenseHeadManagement = lazy(() => import('./components/ExpenseHead/ExpenseHeadManagement'));
const CurrencyManager = lazy(() => import('./components/Currency/CurrencyManager'));
const MasterRecords = lazy(() => import('./components/MasterRecords/MasterRecords'));

// TODO: Create these finance-specific components
// const ExpensesPage = lazy(() => import('./components/Expenses/ExpensesPage'));
// const BudgetPage = lazy(() => import('./components/Budget/BudgetPage'));
// const CategoriesPage = lazy(() => import('./components/Categories/CategoriesPage'));

// Create a theme optimized for faster rendering
const theme = createTheme({
  palette: {
    primary: {
      main: '#ff9a56',
      light: '#ffb380',
      dark: '#ff8533',
      // Custom gradient colors
      gradient: {
        start: '#ffb380',
        end: '#ff8533'
      }
    },
    secondary: {
      main: '#ff9800',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
  // Optimize animations for mobile
  transitions: {
    create: () => 'none', // Disable transitions for better performance
  },
  components: {
    // Reduce shadow depth for better rendering performance
    MuiPaper: {
      defaultProps: {
        elevation: 1,
      },
    },
    // Apply gradient to buttons
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #ffc299 0%, #ff9a56 100%)',
          },
        },
      },
    },
    // Apply gradient to AppBar
    MuiAppBar: {
      styleOverrides: {
        colorPrimary: {
          background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
        },
      },
    },
  },
});

// Loading component
const LoadingFallback = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
    <CircularProgress />
  </Box>
);

// User menu component
function UserMenu() {
  const { currentUser, userDetails, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  
  // Get the display name with proper fallbacks
  const getUserName = () => {
    if (userDetails?.displayName) return userDetails.displayName;
    if (currentUser?.displayName) return currentUser.displayName;
    if (currentUser?.email) {
      // Only fall back to email if no name is available
      const emailName = currentUser.email.split('@')[0];
      // Capitalize first letter
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return "User"; // Final fallback
  };
  
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleMyProfile = () => {
    handleMenuClose();
    navigate('/my-profile');
  };

  const handleLogout = async () => {
    try {
      await logout();
      handleMenuClose();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
        Welcome, {getUserName()}
      </Typography>
      <IconButton
        color="inherit"
        aria-label="user menu"
        aria-controls="user-menu"
        aria-haspopup="true"
        onClick={handleMenuOpen}
        size="small"
      >
        <AccountCircleIcon />
      </IconButton>
      <Menu
        id="user-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleMyProfile}>
          <PersonIcon fontSize="small" sx={{ mr: 1 }} />
          My Profile
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}

// Create a navigation component that syncs with routes
function NavigationBar() {
  const location = useLocation();
  const [value, setValue] = useState(0);
  const { currentUser } = useAuth();
  const { isAdmin: userIsAdmin } = useIsAdmin(currentUser);
  
  // Debug logging
  useEffect(() => {
    console.log('NavigationBar - currentUser:', currentUser?.email);
    console.log('NavigationBar - userIsAdmin:', userIsAdmin);
  }, [currentUser, userIsAdmin]);
  
  // Update navigation value when location changes
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      setValue(0);
    } else if (location.pathname === '/expenses') {
      setValue(1);
    } else if (location.pathname === '/recurring-transactions') {
      setValue(2);
    } else if (location.pathname === '/reports') {
      setValue(3);
    } else if (location.pathname === '/expense-heads') {
      setValue(4);
    } else if (location.pathname === '/currency-manager') {
      setValue(5);
    } else if (location.pathname === '/ledger') {
      setValue(6);
    } else if (location.pathname === '/admin') {
      setValue(7);
    } else {
      setValue(-1); // Not in bottom nav, don't highlight anything
    }
  }, [location]);
  
  // Hide navigation on My Profile page and Maintenance page
  if (location.pathname === '/my-profile' || location.pathname === '/maintenance') {
    return null;
  }
  
  return (
    <Paper 
      sx={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0,
        zIndex: 1100 
      }} 
      elevation={3}
    >
      <BottomNavigation
        value={value}
        onChange={(event, newValue) => {
          setValue(newValue);
        }}
        showLabels={false}
      >
        <BottomNavigationAction 
          icon={<HomeIcon />} 
          component={Link} 
          to="/dashboard"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        <BottomNavigationAction 
          icon={<ReceiptIcon />} 
          component={Link} 
          to="/expenses"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        <BottomNavigationAction 
          icon={<RepeatIcon />} 
          component={Link} 
          to="/recurring-transactions"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        <BottomNavigationAction 
          icon={<BarChartIcon />} 
          component={Link} 
          to="/reports"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        <BottomNavigationAction 
          icon={<CategoryIcon />} 
          component={Link} 
          to="/expense-heads"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        <BottomNavigationAction 
          icon={<CurrencyExchangeIcon />} 
          component={Link} 
          to="/currency-manager"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        <BottomNavigationAction 
          icon={<BookIcon />} 
          component={Link} 
          to="/ledger"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        <BottomNavigationAction 
          icon={<FolderSharedIcon />} 
          component={Link} 
          to="/master-records"
          sx={{ minWidth: userIsAdmin ? '11.11%' : '12.5%' }}
        />
        {userIsAdmin && (
          <BottomNavigationAction 
            icon={<SupervisorAccountIcon />} 
            component={Link} 
            to="/admin"
            sx={{ minWidth: '11.11%' }}
          />
        )}
      </BottomNavigation>
    </Paper>
  );
}

// Sidebar Drawer component
function SidebarDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isAdmin: userIsAdmin } = useIsAdmin(currentUser);
  
  // Debug logging
  useEffect(() => {
    console.log('SidebarDrawer - currentUser:', currentUser?.email);
    console.log('SidebarDrawer - userIsAdmin:', userIsAdmin);
  }, [currentUser, userIsAdmin]);
  
  const handleNavigation = (path) => {
    navigate(path);
    onClose();
  };
  
  const menuItems = [
    { text: 'Dashboard', icon: <HomeIcon />, path: '/dashboard' },
    { text: 'Expenses', icon: <ReceiptIcon />, path: '/expenses' },
    { text: 'Recurring Transactions', icon: <RepeatIcon />, path: '/recurring-transactions' },
    { text: 'Budget', icon: <AccountBalanceWalletIcon />, path: '/budget', disabled: true },
    { text: 'Categories', icon: <CategoryIcon />, path: '/categories', disabled: true },
    { text: 'Reports', icon: <BarChartIcon />, path: '/reports' },
    { text: 'Expense Heads', icon: <CategoryIcon />, path: '/expense-heads' },
    { text: 'Currency Manager', icon: <CurrencyExchangeIcon />, path: '/currency-manager' },
    { text: 'My Ledgers', icon: <BookIcon />, path: '/ledger' },
    { text: 'Master Records', icon: <FolderSharedIcon />, path: '/master-records' },
  ];
  
  if (userIsAdmin) {
    menuItems.push({ text: 'Admin', icon: <SupervisorAccountIcon />, path: '/admin' });
  }
  
  return (
    <Drawer
      anchor="left"
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          background: 'linear-gradient(135deg, #ffb380 0%, #ff8533 100%)',
          color: 'white',
        },
      }}
    >
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" fontWeight="600">
          Finance Tracker
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
      <List sx={{ pt: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton 
              onClick={() => !item.disabled && handleNavigation(item.path)}
              disabled={item.disabled}
              sx={{
                '&:hover': {
                  backgroundColor: item.disabled ? 'transparent' : 'rgba(255,255,255,0.1)',
                },
                opacity: item.disabled ? 0.5 : 1,
              }}
            >
              <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.text} 
                secondary={item.disabled ? 'Coming soon' : ''}
                secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem' } }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}

// Conditional AppBar component
function ConditionalAppBar() {
  const location = useLocation();
  const { currentUser } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const toggleDrawer = (open) => (event) => {
    if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };
  
  // Hide AppBar on maintenance page (it has its own)
  if (location.pathname === '/maintenance') {
    return null;
  }
  
  return (
    <>
      <SidebarDrawer open={drawerOpen} onClose={toggleDrawer(false)} />
      <AppBar position="static" color="primary">
        <Toolbar>
          {currentUser && (
            <IconButton
              color="inherit"
              aria-label="open menu"
              onClick={toggleDrawer(true)}
              edge="start"
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ 
            flexGrow: 1,
            fontSize: { xs: '1rem', sm: '1.25rem' } // Responsive font size
          }}>
            Finance Tracker
          </Typography>
          
          {currentUser && <UserMenu />}
        </Toolbar>
      </AppBar>
    </>
  );
}

// AppContent component with routes
function AppContent() {
  const { currentUser } = useAuth();
  const [dataCleanedUp, setDataCleanedUp] = useState(false);
  
  // Run data cleanup once on app initialization
  useEffect(() => {
    const runCleanup = async () => {
      try {
        if (!dataCleanedUp) {
          await cleanupLegacyData();
          setDataCleanedUp(true);
        }
      } catch (error) {
        console.error('Error during data cleanup:', error);
      }
    };
    
    runCleanup();
  }, [dataCleanedUp]);

  return (
    <Router>
      <AppRoutes currentUser={currentUser} />
    </Router>
  );
}

// AppRoutes component to handle route-specific layouts
function AppRoutes({ currentUser }) {
  const location = useLocation();
  const isMaintenancePage = location.pathname === '/maintenance';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <ConditionalAppBar />
      
      <Container 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          py: isMaintenancePage ? 0 : { xs: 2, sm: 3 }, 
          px: isMaintenancePage ? 0 : { xs: 1, sm: 3 },
          mb: currentUser && !isMaintenancePage ? 7 : 0,
          maxWidth: isMaintenancePage ? false : undefined
        }}
        disableGutters={isMaintenancePage}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
              {/* Public routes */}
              <Route path="/login" element={currentUser ? <Navigate to="/dashboard" /> : <Login />} />
              <Route path="/signup" element={currentUser ? <Navigate to="/dashboard" /> : <Signup />} />
              <Route path="/forgot-password" element={currentUser ? <Navigate to="/dashboard" /> : <ForgotPassword />} />
              <Route path="/" element={currentUser ? <Navigate to="/dashboard" /> : <LandingPage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <Dashboard />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              <Route path="/expenses" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <DailyExpenseLogPage />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              <Route path="/ledger" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <LedgerPage />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              <Route path="/recurring-transactions" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <RecurringTransactionSetup />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              {/* TODO: Uncomment when components are created
              <Route path="/budget" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <BudgetPage />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              <Route path="/categories" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <CategoriesPage />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              */}
              <Route path="/reports" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <ReportPage />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              <Route path="/expense-heads" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <ExpenseHeadManagement />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              <Route path="/my-profile" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <MyProfilePage />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              <Route path="/admin" element={
                <PrivateRoute requireAdmin={true}>
                  <AdminPage />
                </PrivateRoute>
              } />
              
              <Route path="/currency-manager" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <CurrencyManager />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              
              <Route path="/master-records" element={
                <PrivateRoute>
                  <MaintenanceRoute>
                    <MasterRecords />
                  </MaintenanceRoute>
                </PrivateRoute>
              } />
              
              <Route path="/admin/initialize" element={
                <PrivateRoute>
                  <InitializeAdminCollection />
                </PrivateRoute>
              } />
              
              <Route path="/admin/test-permissions" element={
                <PrivateRoute>
                  <TestFirestorePermissions />
                </PrivateRoute>
              } />
              
              <Route path="/debug-data" element={
                <PrivateRoute>
                  <DataDebugger />
                </PrivateRoute>
              } />
              
              {/* Redirect any other routes */}
              <Route path="*" element={<Navigate to={currentUser ? "/dashboard" : "/"} />} />
            </Routes>
          </Suspense>
        </Container>
        
        {currentUser && <NavigationBar />}
      </Box>
  );
}

function App() {
  // Wrap the entire app with the AuthProvider
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
