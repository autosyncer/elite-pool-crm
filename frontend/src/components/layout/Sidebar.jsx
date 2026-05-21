import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const logo = "/favicon.png";

// Professional SVG Icons
const Icons = {
  Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Construction: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Wrench: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Zap: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Plus: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Ruler: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.3 15.3l-5.3-5.3 1.5-1.5 1.4 1.4 1.4-1.4-1.4-1.4 1.4-1.4 1.4 1.4 1.4-1.4-1.4-1.4 1.4-1.4-8.5-8.5-12.7 12.7 12.7 12.7 1.4-1.4z"/></svg>,
  CreditCard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  Phone: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  BarChart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  Star: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Briefcase: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
  RotateCw: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
  Package: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.28"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22.08" x2="12" y2="12"/><polyline points="20.85 18.23 12 23.33 3.15 18.23"/><polyline points="3.27 6.96 12 1.86 20.73 6.96"/><line x1="20.73" y1="6.96" x2="20.73" y2="18.28"/><line x1="3.27" y1="6.96" x2="3.27" y2="18.28"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Clock: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  LogOut: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Send: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

const navSections = [
  {
    title: 'OVERVIEW',
    items: [
      { label: 'Dashboard', icon: Icons.Dashboard, path: '/dashboard', permission: 'dashboard' }
    ]
  },
  {
    title: 'LEAD MANAGEMENT',
    items: [
      { label: 'Construction Leads', icon: Icons.Construction, path: '/leads-construction', permission: 'leads' },
      { label: 'AMC Leads', icon: Icons.Wrench, path: '/leads-amc', permission: 'leads' },
      { label: 'Pipeline', icon: Icons.Zap, path: '/pipeline', permission: 'pipeline' },
      { label: 'Add Lead', icon: Icons.Plus, path: '/addlead', permission: 'leads' }
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Design', icon: Icons.Ruler, path: '/design', permission: 'design' },
      { label: 'Quotation', icon: Icons.CreditCard, path: '/quotation', permission: 'quotation' },
      { label: 'Send to Client', icon: Icons.Send, path: '/send', permission: 'send' }
    ]
  },
  {
    title: 'CUSTOMER SUPPORT',
    items: [
      { label: 'Follow-ups', icon: Icons.Phone, path: '/followup', permission: 'followup' },
      { label: 'Call Tracker', icon: Icons.BarChart, path: '/calltracker', permission: 'calltracker' },
      { label: 'Reviews', icon: Icons.Star, path: '/feedback', permission: 'feedback' }
    ]
  },
  {
    title: 'TECHNICAL',
    items: [
      { label: 'Construction Sites', icon: Icons.Briefcase, path: '/construction', permission: 'construction' },
      { label: 'AMC Sites', icon: Icons.RotateCw, path: '/amc', permission: 'amc' },
      { label: 'Procurements', icon: Icons.Package, path: '/procurements', permission: 'procurements' }
    ]
  },
  {
    title: 'ACCOUNTS',
    items: [
      { label: 'M2A Accounts', icon: Icons.Briefcase, path: '/accounts/m2a', permission: 'm2aaccounts' },
      { label: 'EP Accounts', icon: Icons.CreditCard, path: '/accounts/elitepool', permission: 'elitepoolaccounts' },
      { label: 'Office Expenses', icon: Icons.CreditCard, path: '/officeexpenses', permission: 'officeexpenses' }
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Users', icon: Icons.Users, path: '/users', permission: 'users' },
      { label: 'Attendance', icon: Icons.Clock, path: '/attendance', permission: 'attendance' }
    ]
  }
];

const Sidebar = () => {
  const { user, setUser, checkAccess, leads, followups, isSidebarOpen, setIsSidebarOpen } = useAppContext();
  const navigate = useNavigate();

  const leadsConCount = leads.filter(l => l.leadType === 'construction' || !l.leadType).length;
  const leadsAmcCount = leads.filter(l => l.leadType === 'amc').length;
  const fuCount = followups.length;

  const NavItem = ({ to, icon: Icon, label, badge, colorClass }) => (
    <NavLink 
      to={to} 
      className={({ isActive }) => `nav-btn ${isActive ? 'active' : ''}`}
      onClick={() => { if (window.innerWidth <= 768) setIsSidebarOpen(false); }}
    >
      <span className="ni"><Icon /></span>
      <span className="nl">{label}</span>
      {badge > 0 && <span className={`nb ${colorClass || ''}`}>{badge}</span>}
    </NavLink>
  );

  // Filter sections and items based on role permissions
  const filteredSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(item => checkAccess(item.permission))
    }))
    .filter(section => section.items.length > 0);

  return (
    <aside className={`sidebar ${isSidebarOpen ? 'active' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon" style={{ overflow: 'hidden', background: 'none' }}>
          <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div className="logo-text">
          <div className="logo-main">ELITE POOL</div>
          <div className="logo-sub">BUILDERS CRM</div>
        </div>
        {/* Close button for mobile */}
        <button 
          className="mobile-only" 
          onClick={() => setIsSidebarOpen(false)}
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="sidebar-nav">
        {filteredSections.map(section => (
          <React.Fragment key={section.title}>
            <div className="sb-section">{section.title}</div>
            {section.items.map(item => (
              <NavItem 
                key={item.path}
                to={item.path} 
                icon={item.icon} 
                label={item.label} 
                badge={
                  item.path === '/leads-construction' ? leadsConCount :
                  item.path === '/leads-amc' ? leadsAmcCount :
                  item.path === '/followup' ? fuCount : 0
                }
                colorClass={item.path === '/followup' ? 'danger' : ''}
              />
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="user-pill" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="user-avatar">{user?.name?.charAt(0)}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role" style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 800, color: 'var(--sky)' }}>{user?.role}</div>
            </div>
          </div>
          <button 
            onClick={() => { setUser(null); navigate('/'); }}
            style={{ 
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', 
              borderRadius: '8px', padding: '6px', color: 'var(--red)', cursor: 'pointer', transition: '0.2s'
            }}
            title="Sign Out"
          >
            <Icons.LogOut />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
