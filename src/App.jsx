import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Storefront from './Storefront';
import Login from './Login';
import Dashboard from './Dashboard';
import CourierLogin from './CourierLogin';
import CourierDashboard from './CourierDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Storefront />} />
        <Route path="/login" element={<Login />} />
        <Route path="/kurir" element={<CourierLogin />} />
        <Route path="/kurir/dashboard" element={<CourierDashboard />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

// Komponen untuk mengunci halaman Dashboard
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('garneta_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default App;
