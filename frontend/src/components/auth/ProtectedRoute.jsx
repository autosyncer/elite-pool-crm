import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const ProtectedRoute = ({ children, permission }) => {
  const { user, checkAccess, toast } = useAppContext();

  if (!user) {
    return <Navigate to="/" />;
  }

  // Dashboard is accessible to all logged-in users, but we still check the explicit permission if provided
  if (permission && !checkAccess(permission)) {
    toast("You don't have permission to access this page", "error");
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default ProtectedRoute;
