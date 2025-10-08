import React from 'react';
import { Navigate } from 'react-router-dom'; // <- Make sure this is imported

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token'); // JWT token

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
