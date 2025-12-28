// Example Route Configuration in App.js
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AdminManagement from './components/AdminManagement';
import FoodMaster from './components/FoodMaster';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import Register from './components/Register';
import LandingPage from './components/LandingPage';
import { useIsAdmin } from './utils/adminUtils';
import { useAuthState } from './hooks/useAuthState';

function App() {
  const { user, loading } = useAuthState();
  const isAdmin = useIsAdmin();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        
        {/* Protected Routes for All Users */}
        <Route 
          path="/dashboard" 
          element={!user ? <Navigate to="/login" /> : <Dashboard />} 
        />
        
        {/* Admin Only Routes */}
        <Route 
          path="/admin" 
          element={
            !user ? <Navigate to="/login" /> : 
            !isAdmin ? <AccessDenied /> : <AdminManagement />
          }
        />
        
        <Route 
          path="/food-master" 
          element={
            !user ? <Navigate to="/login" /> : 
            !isAdmin ? <AccessDenied /> : <FoodMaster />
          }
        />
      </Routes>
      
      {/* Bottom Navigation */}
      {user && (
        <BottomNavigation>
          <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} />
          <BottomNavigationAction label="Meals" icon={<RestaurantIcon />} />
          
          {/* Conditional Admin Link */}
          {isAdmin && (
            <BottomNavigationAction 
              label="Food Master" 
              icon={<AdminPanelSettingsIcon />} 
            />
          )}
        </BottomNavigation>
      )}
    </Router>
  );
}

// Simple access denied component
const AccessDenied = () => (
  <Box sx={{ padding: 3, textAlign: 'center' }}>
    <Typography variant="h5" color="error">
      Access Denied
    </Typography>
    <Typography variant="body1">
      You don't have permission to access this page.
    </Typography>
  </Box>
);

export default App;