import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import ThemeToggle from '../common/ThemeToggle';

const Icons = {
  Search: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Bell: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  LogOut: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Menu: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

const Header = () => {
  const { setUser, notifications, markAsViewed, markAsDone, clearNotification, clearAllNotifications, isSidebarOpen, setIsSidebarOpen } = useAppContext();
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return 'Dashboard';
    if (path.includes('/leads')) return 'Lead Management';
    if (path === '/pipeline') return 'Sales Pipeline';
    if (path === '/addlead') return 'Create Lead';
    if (path === '/design') return 'Architectural Design';
    if (path === '/quotation') return 'Financial Quotes';
    if (path === '/followup') return 'Call Schedule';
    if (path === '/calltracker') return 'Agent Performance';
    if (path === '/feedback') return 'Reviews & Feedback';
    if (path === '/construction') return 'Construction Ops';
    if (path === '/amc') return 'AMC Service';
    if (path === '/procurements') return 'Inventory Needs';
    if (path.includes('/accounts')) return 'Site Ledgers';
    if (path === '/officeexpenses') return 'Office Overheads';
    if (path === '/users') return 'Team Directory';
    if (path === '/attendance') return 'Attendance Logs';
    return 'Elite Pool CRM';
  };

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          className="mobile-only" 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          <Icons.Menu />
        </button>
        <div className="mobile-hide" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform /</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{getPageTitle()}</span>
        </div>
        <span className="mobile-only" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>{getPageTitle()}</span>
      </div>
      
      <div style={{ flex: 1 }}></div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button onClick={() => setShowNotif(!showNotif)} style={{ width: '40px', height: '40px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text2)', position: 'relative' }}>
            <Icons.Bell />
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', background: 'var(--red)', color: 'white', borderRadius: '50%', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg)' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="notif-dropdown" style={{ position: 'absolute', top: '50px', right: '0', width: 'min(360px, calc(100vw - 24px))', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', zIndex: 1000, animation: 'fadeIn 0.2s ease', overflow: 'hidden' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg3)' }}>
                <span style={{ fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', color: 'var(--text2)' }}>Activity Center</span>
                <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clearAllNotifications(); }} style={{ fontSize: '11px', color: 'var(--red)', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer' }}>Clear All</button>
              </div>
              <div style={{ maxHeight: '450px', overflowY: 'auto' }}>
                {notifications.length > 0 ? notifications.map(n => (
                  <div 
                    key={n.id} 
                    onMouseEnter={() => markAsViewed(n.id)}
                    style={{ 
                      padding: '16px', 
                      borderBottom: '1px solid var(--border)', 
                      background: n.status === 'unread' ? 'rgba(56,189,248,0.05)' : (n.status === 'done' ? 'rgba(255,255,255,0.01)' : 'transparent'),
                      opacity: n.status === 'done' ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ 
                        width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg3)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        color: n.type === 'create' ? 'var(--green)' : (n.type === 'delete' ? 'var(--red)' : 'var(--sky)')
                      }}>
                        {n.type === 'create' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                        ) : n.type === 'delete' ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"/><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"/></svg>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>{n.module}</span>
                          <span style={{ fontSize: '9px', color: 'var(--text3)' }}>{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600, marginTop: '2px', lineHeight: '1.4' }}>{n.message}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>by {n.actor}</div>
                        
                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                          {n.status !== 'done' && (
                            <button 
                              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); markAsDone(n.id); }}
                              style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: '11px', fontWeight: 700, padding: 0, cursor: 'pointer' }}
                            >
                              Mark Done
                            </button>
                          )}
                          <button 
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); clearNotification(n.id); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: '11px', fontWeight: 700, padding: 0, cursor: 'pointer' }}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', marginBottom: '16px' }}>📭</div>
                    <div style={{ fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>All caught up!</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>No new activities to report</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={() => { setUser(null); navigate('/'); }} 
          style={{ 
            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', 
            padding: '8px 12px', borderRadius: '8px', color: 'var(--red)', 
            fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
          }}
        >
          <Icons.LogOut />
          <span className="mobile-hide">Sign Out</span>
        </button>

        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>
    </header>
  );
};

export default Header;
