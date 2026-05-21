import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from './context/AppContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Toasts from './components/common/Toasts';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import LeadDetailPage from './pages/LeadDetailPage';
import EditLeadPage from './pages/EditLeadPage';
import AddLeadPage from './pages/AddLeadPage';
import PipelinePage from './pages/PipelinePage';
import DesignPage from './pages/DesignPage';
import QuotationPage from './pages/QuotationPage';
import FollowupPage from './pages/FollowupPage';
import CallTrackerPage from './pages/CallTrackerPage';
import ReviewsPage from './pages/ReviewsPage';
import ConstructionPage from './pages/ConstructionPage';
import AMCPage from './pages/AMCPage';
import ProcurementPage from './pages/ProcurementPage';
import SiteAccountsPage from './pages/SiteAccountsPage';
import OfficeExpensesPage from './pages/OfficeExpensesPage';
import UsersPage from './pages/UsersPage';
import AttendancePage from './pages/AttendancePage';
import SendToClientPage from './pages/SendToClientPage';

import './index.css';

const AppRoutes = () => {
  const { user } = useAppContext();

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      
      <Route path="/dashboard" element={<MainLayout><DashboardPage /></MainLayout>} />
      
      {/* Lead Management */}
      <Route path="/leads-construction" element={<ProtectedRoute permission="leads"><MainLayout><LeadsPage type="construction" /></MainLayout></ProtectedRoute>} />
      <Route path="/leads-amc" element={<ProtectedRoute permission="leads"><MainLayout><LeadsPage type="amc" /></MainLayout></ProtectedRoute>} />
      <Route path="/leads/:id" element={<ProtectedRoute permission="leads"><MainLayout><LeadDetailPage /></MainLayout></ProtectedRoute>} />
      <Route path="/leads/edit/:id" element={<ProtectedRoute permission="leads"><MainLayout><EditLeadPage /></MainLayout></ProtectedRoute>} />
      <Route path="/addlead" element={<ProtectedRoute permission="leads"><MainLayout><AddLeadPage /></MainLayout></ProtectedRoute>} />
      <Route path="/pipeline" element={<ProtectedRoute permission="pipeline"><MainLayout><PipelinePage /></MainLayout></ProtectedRoute>} />
      
      {/* Operations */}
      <Route path="/design" element={<ProtectedRoute permission="design"><MainLayout><DesignPage /></MainLayout></ProtectedRoute>} />
      <Route path="/quotation" element={<ProtectedRoute permission="quotation"><MainLayout><QuotationPage /></MainLayout></ProtectedRoute>} />
      <Route path="/send" element={<ProtectedRoute permission="send"><MainLayout><SendToClientPage /></MainLayout></ProtectedRoute>} />
      
      {/* Customer Support */}
      <Route path="/followup" element={<ProtectedRoute permission="followup"><MainLayout><FollowupPage /></MainLayout></ProtectedRoute>} />
      <Route path="/calltracker" element={<ProtectedRoute permission="calltracker"><MainLayout><CallTrackerPage /></MainLayout></ProtectedRoute>} />
      <Route path="/feedback" element={<ProtectedRoute permission="feedback"><MainLayout><ReviewsPage /></MainLayout></ProtectedRoute>} />
      
      {/* Technical */}
      <Route path="/construction" element={<ProtectedRoute permission="construction"><MainLayout><ConstructionPage /></MainLayout></ProtectedRoute>} />
      <Route path="/amc" element={<ProtectedRoute permission="amc"><MainLayout><AMCPage /></MainLayout></ProtectedRoute>} />
      <Route path="/procurements" element={<ProtectedRoute permission="procurements"><MainLayout><ProcurementPage /></MainLayout></ProtectedRoute>} />
      
      {/* Accounts */}
      <Route path="/accounts/m2a" element={<ProtectedRoute permission="m2aaccounts"><MainLayout><SiteAccountsPage company="m2a" /></MainLayout></ProtectedRoute>} />
      <Route path="/accounts/elitepool" element={<ProtectedRoute permission="elitepoolaccounts"><MainLayout><SiteAccountsPage company="elitePool" /></MainLayout></ProtectedRoute>} />
      <Route path="/officeexpenses" element={<ProtectedRoute permission="officeexpenses"><MainLayout><OfficeExpensesPage /></MainLayout></ProtectedRoute>} />
      
      {/* Admin */}
      <Route path="/users" element={<ProtectedRoute permission="users"><MainLayout><UsersPage /></MainLayout></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute permission="attendance"><MainLayout><AttendancePage /></MainLayout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

const App = () => {
  return (
    <AppProvider>
      <AppRoutes />
      <Toasts />
    </AppProvider>
  );
};

export default App;
