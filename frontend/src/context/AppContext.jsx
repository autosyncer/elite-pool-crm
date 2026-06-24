import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';
axios.defaults.baseURL = API_BASE_URL;

// Global 401 interceptor — runs before any component sees the error
let _handle401 = null;
axios.interceptors.response.use(
  res => res,
  err => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      if (_handle401) _handle401();
    }
    return Promise.reject(err);
  }
);

const AppContext = createContext();

export const useAppContext = () => useContext(AppContext);

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [leads, setLeads] = useState([]);
  const [amcLeads, setAmcLeads] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [followupKPI, setFollowupKPI] = useState({ active: 0, today: 0 });
  const [followups, setFollowups] = useState([]);
  const [constructionSites, setConstructionSites] = useState([]);
  const [amcSites, setAmcSites] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [siteAccounts, setSiteAccounts] = useState([]);
  const [officeExpenses, setOfficeExpenses] = useState({ salaries: [], rent: [], petty: [] });
  const [agents, setAgents] = useState([]);
  const [callLog, setCallLog] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [users, setUsers] = useState([
    { name: 'Venkat Reddy', email: 'venkat@elitepool.in', role: 'ceo', status: 'Active', last: 'Today 09:00' },
    { name: 'Rajesh Kumar', email: 'rajesh@elitepool.in', role: 'admin', status: 'Active', last: 'Today 08:45' },
    { name: 'Priya Sharma', email: 'priya@elitepool.in', role: 'partner', status: 'Active', last: 'Today 08:30' },
    { name: 'Ravi Teja', email: 'ravi@elitepool.in', role: 'support', status: 'Active', last: 'Today 10:30' }
  ]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceKpis, setAttendanceKpis] = useState({
    total_present_today: 0,
    total_absent_today: 0,
    total_late_today: 0,
    total_employees: 0
  });
  const [notifications, setNotifications] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const refreshLeads = async () => {
    try {
      const [constructionRes, amcRes] = await Promise.all([
        axios.get('/construction-leads/view'),
        axios.get('/amc-leads/view'),
      ]);

      const mappedConstruction = (constructionRes.data || []).map(l => ({
        id: String(l.lead_code || l.id),
        db_id: l.id,
        name: l.name || 'Unknown',
        phone: l.phone || '',
        loc: l.location || '',
        req: l.requirement || '',
        src: l.source || '',
        date: l.created_at || new Date().toISOString(),
        status: l.status || 'new',
        pri: l.priority || 'Normal',
        leadType: 'construction'
      }));

      const mappedAmc = (amcRes.data || []).map(l => ({
        id: String(l.lead_code || l.id),
        db_id: l.id,
        name: l.name || 'Unknown',
        phone: l.phone || '',
        loc: l.location || '',
        req: l.requirement || '',
        src: l.source || '',
        date: l.created_at || new Date().toISOString(),
        status: l.status || 'new',
        pri: l.priority || 'Normal',
        leadType: 'amc'
      }));

      setLeads([...mappedConstruction, ...mappedAmc]);
      setAmcLeads(mappedAmc);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const refreshDesigns = async () => {
    try {
      const res = await axios.get('/pool-design/all');
      const mapped = res.data.map(d => ({
        id: d.id,
        leadId: d.lead_code,
        db_lead_id: d.lead_id,
        leadType: d.lead_type,
        client: d.client_name,
        req: d.requirement,
        designer: d.assigned_designer,
        style: d.pool_style,
        notes: d.design_notes,
        status: d.status === 'completed' ? 'done' : 'progress',
        uploadedFile: d.files && d.files.length > 0 ? {
          id: d.files[d.files.length - 1].id,
          name: d.files[d.files.length - 1].file_name,
          url: d.files[d.files.length - 1].file_url
        } : null,
        revisionCount: d.files ? Math.max(0, d.files.length - 1) : 0,
        revisions: d.files ? d.files.slice(0, -1).map((f, i) => ({
          revNum: f.version || (i + 1),
          file: { name: f.file_name, url: f.file_url },
          date: 'N/A'
        })) : []
      }));
      setDesigns(mapped);
    } catch (error) {
      console.error("Error fetching designs:", error);
    }
  };

  const refreshQuotes = async () => {
    try {
      const res = await axios.get('/quotation/all_quotation');
      const mapped = res.data.map(q => {
        const ln = q.pool_lenght || 0;
        const w = q.pool_width || 0;
        const total = Math.round(ln * w * 5 * 850);

        return {
          id: `Q${String(q.id).padStart(3, '0')}`,
          db_id: q.id,
          leadId: q.lead_id,
          client: q.client_name || q.lead_id,
          size: `${ln}×${w} ft`,
          amount: '₹' + total.toLocaleString('en-IN'),
          date: q.created_at ? q.created_at.slice(0, 10) : 'N/A',
          status: q.status,
          uploadedFile: q.pdf_url ? { name: 'quotation.pdf', url: q.pdf_url } : null,
          revisionCount: 0,
          revisions: []
        };
      });
      setQuotes(mapped);
    } catch (error) {
      console.error("Error fetching quotes:", error);
    }
  };

  const refreshUsers = async () => {
    try {
      const res = await axios.get('/user/view');
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const refreshAttendance = async () => {
    try {
      const [recsRes, kpiRes, usersRes] = await Promise.all([
        axios.get('/attendence/all_attendence'),
        axios.get('/attendence/kpi'),
        axios.get('/user/view')
      ]);

      const usersMap = {};
      usersRes.data.forEach(u => {
        usersMap[u.id] = u.full_name || u.username;
      });

      const mappedRecs = recsRes.data.map(r => ({
        id: r.id,
        empId: r.employee_id,
        empName: usersMap[r.employee_id] || 'Unknown',
        date: r.date,
        checkIn: r.check_in,
        checkOut: r.check_out,
        status: r.status,
        notes: r.notes
      }));

      setAttendanceRecords(mappedRecs);
      setAttendanceKpis(kpiRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  };

  const refreshOfficeExpenses = async () => {
    try {
      const res = await axios.get('/office-expenses/all_office_expenses');
      const data = res.data;
      
      const salaries = data.filter(e => e.category === "Staffing Salaries").map(e => ({
        id: e.id,
        date: e.expense_date,
        description: e.description,
        amount: parseFloat(e.amount),
        note: e.note,
        payee: e.payee_name
      }));

      const rent = data.filter(e => e.category === "Office Rent / Utilities").map(e => ({
        id: e.id,
        date: e.expense_date,
        description: e.description,
        amount: parseFloat(e.amount),
        note: e.note,
        payee: e.payee_name
      }));
      
      const petty = data.filter(e => e.category === "Petty Office Expenses").map(e => ({
        id: e.id,
        date: e.expense_date,
        description: e.description,
        amount: parseFloat(e.amount),
        note: e.note,
        payee: e.payee_name
      }));

      setOfficeExpenses({ salaries, rent, petty });
    } catch (error) {
      console.error("Error fetching office expenses:", error);
    }
  };

  const refreshFollowups = async () => {
    try {
      // Fetch KPI
      const kpiRes = await axios.get('/followup-calls/kpi');
      setFollowupKPI({ active: kpiRes.data.active_followups, today: kpiRes.data.calls_today });

      const res = await axios.get('/followup-calls/all-followups');
      const data = res.data;
      
      const fullFollowups = data.map(f => {
        const calls = [1, 2, 3, 4, 5].map(num => {
          const log = (f.calls || []).find(c => c.call_number === num);
          return log ? {
            done: true,
            date: log.call_date,
            out: log.outcome,
            notes: log.agent_name + ': ' + (log.duration || ''),
            recordingUrl: log.recording_url
          } : { done: false };
        });
        return {
          id: f.id,
          leadId: String(f.lead_id),
          name: f.client_name,
          phone: f.phone,
          leadType: f.lead_type,
          rating: f.rating,
          calls
        };
      });
      setFollowups(fullFollowups);
    } catch (error) {
      console.error("Error fetching followups:", error);
    }
  };

  const refreshCallTrack = async () => {
    try {
      const [statsRes, logsRes, agentsRes] = await Promise.all([
        axios.get('/call-track/team-stats'),
        axios.get('/call-track/live-logs'),
        axios.get('/followup-calls/agents')
      ]);

      const statsMap = new Map();
      statsRes.data.forEach(s => statsMap.set(s.agent_name, s.calls_today));

      const mappedAgents = agentsRes.data.map(agentName => ({
        id: agentName,
        name: agentName,
        calls: statsMap.get(agentName) || 0,
        target: 20
      }));

      const mappedLogs = logsRes.data.map(l => ({
        id: l.id,
        time: l.call_time ? String(l.call_time).slice(0, 5) : 'N/A',
        agent: l.agent_name,
        client: l.client_name || 'Unknown',
        cn: l.call_number,
        dur: l.duration,
        out: l.outcome
      }));

      setAgents(mappedAgents);
      setCallLog(mappedLogs);
    } catch (error) {
      console.error("Error fetching call tracking:", error);
    }
  };

  const refreshReviews = async () => {
    try {
      const res = await axios.get('/review/all-reviews');
      setReviews(res.data);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  const refreshConstructionSites = async () => {
    try {
      const res = await axios.get('/construction/all-sites');
      setConstructionSites(res.data);
    } catch (error) {
      console.error("Error fetching construction sites:", error);
    }
  };

  const refreshAmcSites = async () => {
    try {
      const res = await axios.get('/amc/all-sites');
      setAmcSites(res.data);
    } catch (error) {
      console.error("Error fetching AMC sites:", error);
    }
  };

  const refreshSiteAccounts = async () => {
    try {
      const [epRes, m2aRes] = await Promise.all([
        axios.get('/elite-pool-accounts/all_ep_accounts'),
        axios.get('/m2a_accouts/all_m2a_accounts')
      ]);

      const epData = epRes.data;
      const m2aData = m2aRes.data;

      const accounts = [];

      epData.forEach(acc => {
        const pType = (acc.project_type || acc.project || '').toLowerCase();
        const type = pType.includes('amc') ? 'amc' : 'construction';
        
        const backendPayments = (acc.payments || []).map(p => ({ id: p.id, amount: parseFloat(p.amount), date: p.payment_date }));
        const backendExpenses = (acc.expenses || []).map(e => ({ id: e.id, amount: parseFloat(e.amount), date: e.payment_date || e.expense_date, description: e.description, category: e.expenses_type || e.expense_type }));

        accounts.push({
          id: 'ep_' + acc.id,
          siteName: acc.site_name,
          location: acc.location,
          projectType: type,
          isElitePool: true,
          isM2A: false,
          lastUpdated: acc.last_update,
          elitePool: {
            construction: type === 'construction' ? { payments: backendPayments, expenditures: backendExpenses } : { payments: [], expenditures: [] },
            amc: type === 'amc' ? { payments: backendPayments, expenditures: backendExpenses } : { payments: [], expenditures: [] }
          },
          m2a: { payments: [], expenditures: [] },
          totalIn: parseFloat(acc.received || acc.total_received || acc.total_recieved || acc.total_payment || 0),
          totalOut: parseFloat(acc.spent || acc.total_spent || acc.total_expense || acc.total_expenditure || 0)
        });
      });

      m2aData.forEach(acc => {
        const backendPayments = (acc.payments || []).map(p => ({ amount: parseFloat(p.amount), date: p.payment_date }));
        const backendExpenses = (acc.expenses || []).map(e => ({ amount: parseFloat(e.amount), date: e.expense_date || e.payment_date, description: e.description, category: e.expense_type }));

        accounts.push({
          id: 'm2a_' + acc.id,
          siteName: acc.site_name,
          location: acc.location,
          isElitePool: false,
          isM2A: true,
          lastUpdated: acc.last_updated,
          elitePool: {
            construction: { payments: [], expenditures: [] },
            amc: { payments: [], expenditures: [] }
          },
          m2a: {
            payments: backendPayments,
            expenditures: backendExpenses
          },
          totalIn: parseFloat(acc.total_recieved || acc.received || 0),
          totalOut: parseFloat(acc.total_expense || acc.spent || 0)
        });
      });

      setSiteAccounts(accounts);
    } catch (error) {
      console.error("Error fetching site accounts:", error);
    }
  };

  const refreshAccountDetails = async (siteName, companyType) => {
    try {
      const endpoint = companyType === 'elitePool'
        ? `/elite-pool-accounts/account_details/${encodeURIComponent(siteName)}`
        : `/m2a_accouts/account_details/${encodeURIComponent(siteName)}`;
      
      const res = await axios.get(endpoint);
      const { payments, expenses } = res.data;

      setSiteAccounts(prev => prev.map(s => {
        // Must match BOTH site name AND the correct company — prevents cross-company ledger contamination
        if (s.siteName !== siteName) return s;
        if (companyType === 'elitePool' && !s.isElitePool) return s;
        if (companyType === 'm2a' && !s.isM2A) return s;

        const updated = { ...s };
        if (companyType === 'elitePool') {
          const target = s.projectType;
          updated.elitePool = {
            ...updated.elitePool,
            [target]: {
              payments: payments.map(p => ({ id: p.id, amount: parseFloat(p.amount), date: p.payment_date })),
              expenditures: expenses.map(e => ({ id: e.id, amount: parseFloat(e.amount), date: e.payment_date || e.expense_date, description: e.description, category: e.expenses_type }))
            }
          };
        } else {
          // M2A: use expense_date (not payment_date) for expenses
          updated.m2a = {
            payments: payments.map(p => ({ amount: parseFloat(p.amount), date: p.payment_date })),
            expenditures: expenses.map(e => ({ amount: parseFloat(e.amount), date: e.expense_date || e.payment_date, description: e.description, category: e.expense_type }))
          };
        }
        return updated;
      }));
    } catch (error) {
      console.error("Error fetching account details:", error);
    }
  };

  const notifIntervalRef = useRef(null);

  const stopPolling = () => {
    if (notifIntervalRef.current) {
      clearInterval(notifIntervalRef.current);
      notifIntervalRef.current = null;
    }
  };

  // Register global 401 handler
  useEffect(() => {
    _handle401 = () => {
      stopPolling();
      setUser(null);
    };
    return () => { _handle401 = null; };
  }, []);

  const refreshNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) { stopPolling(); return; }
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await axios.get('/notifications/');
      const mapped = res.data.map(n => ({
        id: n.id,
        type: n.type,
        module: n.module,
        action: n.action,
        message: n.message,
        entityId: n.entity_id,
        actor: n.actor_name || 'System',
        status: n.status,
        createdAt: n.created_at,
      }));
      setNotifications(mapped);
    } catch (_) {}
  };

  const startPolling = () => {
    stopPolling(); // clear any existing before starting
    notifIntervalRef.current = setInterval(refreshNotifications, 60000);
  };

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      const tasks = [
        refreshLeads, refreshDesigns, refreshQuotes, refreshAttendance,
        refreshOfficeExpenses, refreshSiteAccounts, refreshFollowups,
        refreshConstructionSites, refreshAmcSites, refreshReviews, refreshCallTrack, refreshUsers,
        refreshNotifications
      ];
      for (const task of tasks) {
        try { await task(); } catch (_) {}
      }
    };
    init();
  }, []);

  // Start/stop notification polling based on auth state
  useEffect(() => {
    if (!user) { stopPolling(); return; }
    const token = localStorage.getItem('token');
    if (!token) return;
    startPolling();
    return () => stopPolling();
  }, [user]);

  const employees = (users || []).map(u => ({
    id: u.id,
    name: u.full_name || u.username,
    role: u.role,
    dept: u.role === 'customer_support' ? 'Customer Support' : u.role === 'admin' ? 'Operations' : 'Management'
  }));

  const toast = (msg, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const PERMS = {
    ceo: ['ceo', 'admin', 'dashboard', 'leads', 'pipeline', 'addlead', 'design', 'quotation', 'send', 'followup', 'calltracker', 'feedback', 'construction', 'amc', 'procurements', 'vendors', 'inventory', 'm2aaccounts', 'elitepoolaccounts', 'officeexpenses', 'users', 'attendance', 'backup'],
    admin: ['admin', 'dashboard', 'leads', 'pipeline', 'addlead', 'design', 'quotation', 'send', 'followup', 'calltracker', 'feedback', 'construction', 'amc', 'procurements', 'vendors', 'inventory', 'backup'],
    partner: ['dashboard', 'leads', 'pipeline', 'addlead', 'design', 'quotation', 'send', 'followup', 'calltracker', 'feedback', 'construction', 'amc', 'procurements', 'vendors', 'inventory', 'm2aaccounts'],
    customer_support: ['dashboard', 'leads', 'pipeline', 'addlead', 'followup', 'calltracker', 'feedback']
  };

  const MODULE_PERMISSIONS = {
    'Lead Management': ['leads'], 'Pipeline': ['pipeline'], 'Design': ['design'], 'Quotation': ['quotation'], 'Send to Client': ['send'], 'Follow-up': ['followup'], 'Call Tracker': ['calltracker'], 'Reviews': ['feedback'], 'Construction': ['construction'], 'AMC': ['amc'], 'Procurement': ['procurements'], 'M2A Accounts': ['m2aaccounts'], 'EP Accounts': ['elitepoolaccounts'], 'Office Expenses': ['officeexpenses'], 'Users': ['users'], 'Attendance': ['attendance'], 'General': ['dashboard']
  };

  const addNotification = async ({ type, module, action, message, entityId, actor }) => {
    try {
      const res = await axios.post('/notifications/', {
        type: type || 'create',
        module: module || 'General',
        action: action || 'Action',
        message: message || 'New activity recorded',
        entity_id: entityId ? String(entityId) : null,
        actor_name: actor || null
      });
      const n = res.data;
      const newNotif = {
        id: n.id,
        type: n.type,
        module: n.module,
        action: n.action,
        message: n.message,
        entityId: n.entity_id,
        actor: n.actor_name || 'System',
        status: n.status,
        createdAt: n.created_at,
      };
      setNotifications(prev => [newNotif, ...prev]);
    } catch (error) {
      console.error("Error adding notification:", error);
    }
  };

  const markAsViewed = async (id) => {
    try {
      const notif = notifications.find(n => n.id === id);
      if (notif && notif.status === 'unread') {
        await axios.patch(`/notifications/${id}`, { status: 'viewed' });
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'viewed' } : n));
      }
    } catch (error) {
      console.error("Error marking notification as viewed:", error);
    }
  };

  const markAsDone = async (id) => {
    try {
      await axios.patch(`/notifications/${id}`, { status: 'done' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'done' } : n));
    } catch (error) {
      console.error("Error marking notification as done:", error);
    }
  };

  const clearNotification = async (id) => {
    try {
      await axios.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await Promise.all(notifications.map(n => axios.delete(`/notifications/${n.id}`)));
      setNotifications([]);
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  };

  const addProcurement = (siteId, siteName, client, siteType, requirements, logDate) => {
    const now = new Date();
    const newPro = {
      id: 'PRO' + String(procurements.length + 1).padStart(3, '0'),
      siteId, siteName, client, siteType, requirements,
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 5),
      logDate, status: 'pending'
    };
    setProcurements(prev => [newPro, ...prev]);
    addNotification({ type: 'create', module: 'Procurement', action: 'Requirement Added', message: `New procurement requirement for ${client}`, entityId: newPro.id });
  };

  const checkAccess = (perm) => {
    if (!user) return false;
    const allowed = PERMS[user.role] || [];
    return allowed.includes(perm);
  };

  const value = {
    user, setUser, currentUser: user,
    leads, setLeads, amcLeads, setAmcLeads, quotes, setQuotes, designs, setDesigns, followups, setFollowups,
    agents, setAgents, callLog, setCallLog, constructionSites, setConstructionSites,
    amcSites, setAmcSites, procurements, setProcurements, siteAccounts, setSiteAccounts, refreshSiteAccounts, refreshAccountDetails,
    officeExpenses, setOfficeExpenses, refreshOfficeExpenses, users, setUsers, refreshUsers, employees, attendanceRecords, setAttendanceRecords, attendanceKpis, refreshAttendance,
    toasts, toast, notifications, setNotifications, addNotification, markAsViewed, markAsDone,
    clearNotification, clearAllNotifications, addProcurement, refreshLeads, refreshDesigns, refreshQuotes, checkAccess, isSidebarOpen, setIsSidebarOpen,
    refreshNotifications,
    refreshFollowups, refreshReviews, reviews, setReviews,
    followupKPI, refreshCallTrack, refreshConstructionSites, refreshAmcSites,
    constructionSites, setConstructionSites, followups, setFollowups
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
