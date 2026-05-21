import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useAppContext } from '../../context/AppContext';
import { Navigate } from 'react-router-dom';

const MainLayout = ({ children }) => {
  const { user, isSidebarOpen, setIsSidebarOpen } = useAppContext();

  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="app-container">
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`} 
        onClick={() => setIsSidebarOpen(false)}
      ></div>
      <Sidebar />
      <div className="main-content">
        <Header />
        <div className="page-container">
          <main>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;
