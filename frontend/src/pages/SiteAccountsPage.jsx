import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import SearchBar from '../components/common/SearchBar';
import axios from 'axios';

const SiteAccountsPage = ({ company }) => {
  const { 
    siteAccounts, refreshSiteAccounts, refreshAccountDetails, 
    leads, amcLeads, 
    checkAccess, toast 
  } = useAppContext();

  const [search, setSearch] = useState('');
  const [timeframe, setTimeframe] = useState('all'); // all, monthly, quarterly, yearly
  const [activeTab, setActiveTab] = useState('construction'); // for Elite Pool multi-tab
  const [detailModal, setDetailModal] = useState({ open: false, siteId: null });
  const [transModal, setTransModal] = useState({ open: false, type: 'payment', siteId: null, targetTab: 'construction' });
  const [addClientModal, setAddClientModal] = useState(false);
  
  // Form States
  const [newTrans, setNewTrans] = useState({ amount: '', desc: '', date: new Date().toISOString().split('T')[0], category: 'Materials' });
  
  // New Client States
  const [clientSource, setClientSource] = useState('manual'); // manual, con_lead, amc_lead
  const [newClientSearch, setNewClientSearch] = useState('');
  const [manualClient, setManualClient] = useState({ name: '', location: '', type: '', budget: '', contact: '' });

  const accessKey = company === 'm2a' ? 'm2aaccounts' : 'elitepoolaccounts';
  if (!checkAccess(accessKey)) return <Navigate to="/dashboard" />;

  const getSite = (id) => siteAccounts.find(s => s.id === id);

  const getRowTotals = (s) => {
    let totalIn = 0, totalOut = 0;
    if (company === 'm2a') {
      const payments = s.m2a?.payments || [];
      const expenditures = s.m2a?.expenditures || [];
      
      totalIn = payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) : (s.totalIn || 0);
      totalOut = expenditures.length > 0 ? expenditures.reduce((sum, e) => sum + e.amount, 0) : (s.totalOut || 0);
    } else {
      const data = activeTab === 'construction' ? s.elitePool?.construction : s.elitePool?.amc;
      const payments = data?.payments || [];
      const expenditures = data?.expenditures || [];

      // If we have detailed transactions (fetched via refreshAccountDetails), use them.
      // Otherwise, fallback to the totals fetched in the summary list.
      totalIn = payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) : (s.projectType === activeTab ? (s.totalIn || 0) : 0);
      totalOut = expenditures.length > 0 ? expenditures.reduce((sum, e) => sum + e.amount, 0) : (s.projectType === activeTab ? (s.totalOut || 0) : 0);
    }
    return { totalIn, totalOut, balance: totalIn - totalOut };
  };

  const isDateInTimeframe = (dateStr, tf) => {
    if (!dateStr || tf === 'all') return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;
    const now = new Date();
    if (tf === 'monthly') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (tf === 'quarterly') {
      const qd = Math.floor(d.getMonth() / 3);
      const qnow = Math.floor(now.getMonth() / 3);
      return qd === qnow && d.getFullYear() === now.getFullYear();
    }
    if (tf === 'yearly') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const getGlobalStats = (accounts) => {
    let totalIn = 0, totalOut = 0;
    accounts.forEach(s => {
      let siteIn = 0, siteOut = 0;
      
      if (company === 'm2a') {
        const payments = s.m2a?.payments || [];
        const expenditures = s.m2a?.expenditures || [];
        
        const filteredPayments = payments.filter(p => isDateInTimeframe(p.date, timeframe));
        const filteredExpenditures = expenditures.filter(e => isDateInTimeframe(e.date, timeframe));
        
        siteIn = filteredPayments.length > 0 ? filteredPayments.reduce((sum, p) => sum + p.amount, 0) : (timeframe === 'all' ? (s.totalIn || 0) : 0);
        siteOut = filteredExpenditures.length > 0 ? filteredExpenditures.reduce((sum, e) => sum + e.amount, 0) : (timeframe === 'all' ? (s.totalOut || 0) : 0);
      } else {
        const data = activeTab === 'construction' ? s.elitePool?.construction : s.elitePool?.amc;
        const payments = data?.payments || [];
        const expenditures = data?.expenditures || [];
        
        const filteredPayments = payments.filter(p => isDateInTimeframe(p.date, timeframe));
        const filteredExpenditures = expenditures.filter(e => isDateInTimeframe(e.date, timeframe));
        
        siteIn = filteredPayments.length > 0 ? filteredPayments.reduce((sum, p) => sum + p.amount, 0) : (timeframe === 'all' ? (s.projectType === activeTab ? (s.totalIn || 0) : 0) : 0);
        siteOut = filteredExpenditures.length > 0 ? filteredExpenditures.reduce((sum, e) => sum + e.amount, 0) : (timeframe === 'all' ? (s.projectType === activeTab ? (s.totalOut || 0) : 0) : 0);
      }
      
      totalIn += siteIn;
      totalOut += siteOut;
    });
    return { totalIn, totalOut, balance: totalIn - totalOut };
  };

  const handleAddTrans = async () => {
    const amt = parseFloat(newTrans.amount);
    if (!amt || !newTrans.desc) { toast('Required fields missing', 'error'); return; }
    
    const site = getSite(transModal.siteId);
    if (!site) return;

    try {
      if (company === 'm2a') {
        if (transModal.type === 'payment') {
          await axios.put(`/m2a_accouts/update_account/${site.siteName}`, `amount=${amt}&payment_date=${newTrans.date}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        } else {
          await axios.put(`/m2a_accouts/add_expenses/${site.siteName}`, `amount=${amt}&expense_type=${newTrans.category.toLowerCase()}&expense_date=${newTrans.date}&description=${newTrans.desc}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        }
      } else {
        if (transModal.type === 'payment') {
          await axios.put(`/elite-pool-accounts/add_payment/${site.siteName}`, `amount=${amt}&payment_date=${newTrans.date}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        } else {
          const catMap = { 'Materials': 'materials', 'Labour': 'labour', 'Transport': 'transport', 'Equipment': 'equipment', 'Other': 'miscellaneous', 'Petty Cash': 'miscellaneous' };
          const backendCat = catMap[newTrans.category] || 'miscellaneous';
          await axios.put(`/elite-pool-accounts/add_expenses/${site.siteName}`, `amount=${amt}&expense_type=${backendCat}&expense_date=${newTrans.date}&description=${newTrans.desc}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        }
      }

      toast(`✅ ${transModal.type === 'payment' ? 'Payment' : 'Expense'} recorded`, 'success');
      setTransModal({ open: false });
      setNewTrans({ amount: '', desc: '', date: new Date().toISOString().split('T')[0], category: 'Materials' });
      
      // Refresh details and summary
      await refreshAccountDetails(site.siteName, company);
      refreshSiteAccounts();
    } catch (err) {
      console.error(err);
      toast('Failed to record transaction', 'error');
    }
  };

  const handleAddClient = async (data, source) => {
    const siteName = data.client || data.name;
    const existing = siteAccounts.find(s => s.siteName === siteName && (company === 'm2a' ? s.isM2A : s.isElitePool));
    if (existing) { toast('Client already in ledger', 'warn'); return; }

    try {
      if (company === 'm2a') {
        const formData = new FormData();
        formData.append('site_name', siteName);
        formData.append('location', data.location || data.loc || '');
        formData.append('initial_advance_payment', data.budget || 0);
        formData.append('payment_date', new Date().toISOString().split('T')[0]);
        await axios.post('/m2a_accouts/new_accout_from_admin', formData);
      } else {
        if (source === 'manual') {
          const formData = new FormData();
          formData.append('site_name', siteName);
          formData.append('location', data.location || data.loc || '');
          formData.append('project_type', data.type?.toLowerCase().includes('amc') ? 'pool_amc' : 'pool_construction');
          formData.append('initial_advance_payment', data.budget || 0);
          formData.append('payment_date', new Date().toISOString().split('T')[0]);
          await axios.post('/elite-pool-accounts/new_accout_from_admin', formData);
        } else {
          const endpoint = source === 'con_lead' 
            ? `/elite-pool-accounts/adding_leads_from_construction/${data.id}`
            : `/elite-pool-accounts/adding_leads_from_amc/${data.id}`;
          
          const formData = new FormData();
          formData.append('location', data.location || data.loc || '');
          formData.append('initial_advance_payment', 0);
          formData.append('payment_date', new Date().toISOString().split('T')[0]);
          await axios.post(endpoint, formData);
        }
      }

      toast(`✅ ${siteName} added to Ledger`, 'success');
      setAddClientModal(false);
      setManualClient({ name: '', location: '', type: '', budget: '', contact: '' });
      refreshSiteAccounts();
    } catch (err) {
      console.error(err);
      toast('Failed to add client to ledger', 'error');
    }
  };

  const filtered = siteAccounts.filter(s => {
    const matchesSearch = (s.siteName || '').toLowerCase().includes((search || '').toLowerCase());
    if (company === 'elitePool') {
      return matchesSearch && s.isElitePool && s.projectType === activeTab;
    }
    if (company === 'm2a') {
      return matchesSearch && s.isM2A;
    }
    return matchesSearch;
  });
  
  const stats = getGlobalStats(filtered);

  const openLedger = (s) => {
    refreshAccountDetails(s.siteName, company);
    setDetailModal({ open: true, siteId: s.id });
  };

  const renderLeadSource = () => {
    const source = clientSource;
    // Filter the master leads list by leadType to avoid cross-contamination
    const targetType = source === 'con_lead' ? 'construction' : 'amc';
    const leadsList = leads.filter(l => l.leadType === targetType);
    
    const filteredLeads = leadsList.filter(l => 
      l.name?.toLowerCase().includes(newClientSearch.toLowerCase()) || 
      l.id?.toLowerCase().includes(newClientSearch.toLowerCase())
    );

    return (
      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Search {source === 'con_lead' ? 'Construction' : 'AMC'} Database
          </label>
          <input 
            type="text"
            className="fi"
            placeholder="🔍 Search by name or ID..." 
            value={newClientSearch} 
            onChange={e => setNewClientSearch(e.target.value)} 
          />
        </div>
        
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg2)' }}>
          {filteredLeads.map(l => (
            <div key={l.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{l.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{l.id} • {l.loc || 'No location'}</div>
              </div>
              <button 
                className="btn btn-sky btn-sm" 
                onClick={() => handleAddClient(l, source)}
              >
                Select Client
              </button>
            </div>
          ))}
          {filteredLeads.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>No matching leads found</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page active" id="page_accounts">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <div className="ph-title" style={{ fontSize: '24px', fontWeight: 800 }}>{company === 'm2a' ? 'M2A Ledger' : 'Elite Pool Accounts'}</div>
          <div className="ph-sub" style={{ fontSize: '13px', color: 'var(--text2)' }}>Financial project tracking and site expenditure management</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select 
            className="fs" 
            style={{ width: '150px', margin: 0, height: '38px', padding: '0 12px', fontSize: '13px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} 
            value={timeframe} 
            onChange={e => setTimeframe(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="monthly">This Month</option>
            <option value="quarterly">This Quarter</option>
            <option value="yearly">This Year</option>
          </select>
          <button className="btn btn-sky" onClick={() => { setClientSource('manual'); setAddClientModal(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Global Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card stat" style={{ borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Inflow</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green)' }}>₹{stats.totalIn.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Cumulative payments received</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--red)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Expenses</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--red)' }}>₹{stats.totalOut.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Project related expenditures</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--sky)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Net Balance</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>₹{stats.balance.toLocaleString('en-IN')}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Current liquid project capital</div>
        </div>
      </div>

      {company === 'elitePool' && (
        <div className="tabs" style={{ marginBottom: '20px', display: 'flex', gap: '8px' }}>
          <button className={`btn ${activeTab === 'construction' ? 'btn-sky' : 'btn-ghost'}`} onClick={() => setActiveTab('construction')}>Construction Sites</button>
          <button className={`btn ${activeTab === 'amc' ? 'btn-sky' : 'btn-ghost'}`} onClick={() => setActiveTab('amc')}>AMC Sites</button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchBar value={search} onChange={setSearch} placeholder="Search site account..." />
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Site Name</th><th>Total Received</th><th>Total Spent</th><th>Net Balance</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const { totalIn, totalOut, balance } = getRowTotals(s);
                return (
                  <tr key={s.id}>
                    <td>
                       <div style={{ fontWeight: 700 }}>{s.siteName}</div>
                       <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{s.location}</div>
                    </td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>₹{totalIn.toLocaleString('en-IN')}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 600 }}>₹{totalOut.toLocaleString('en-IN')}</td>
                    <td style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>₹{balance.toLocaleString('en-IN')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openLedger(s)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                          View Ledger
                        </button>
                        <button className="btn btn-sky btn-sm" onClick={() => setTransModal({ open: true, type: 'payment', siteId: s.id, targetTab: activeTab })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Pay
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setTransModal({ open: true, type: 'expense', siteId: s.id, targetTab: activeTab })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Exp
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px' }}>No site accounts matches your search</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      <Modal open={addClientModal} onClose={() => setAddClientModal(false)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
          <span>Add New Client to Ledger</span>
        </div>
      } wide>
        {company !== 'm2a' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'var(--bg3)', padding: '4px', borderRadius: '8px' }}>
            <button className={`btn ${clientSource === 'manual' ? 'btn-sky' : 'btn-ghost'} btn-sm`} style={{ flex: 1 }} onClick={() => setClientSource('manual')}>Manual Entry</button>
            <button className={`btn ${clientSource === 'con_lead' ? 'btn-sky' : 'btn-ghost'} btn-sm`} style={{ flex: 1 }} onClick={() => setClientSource('con_lead')}>Construction Leads</button>
            {company !== 'm2a' && (
              <button className={`btn ${clientSource === 'amc_lead' ? 'btn-sky' : 'btn-ghost'} btn-sm`} style={{ flex: 1 }} onClick={() => setClientSource('amc_lead')}>AMC Leads</button>
            )}
          </div>
        )}

        {clientSource === 'manual' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="fg"><label className="fl">Client Name</label><input className="fi" placeholder="Full name" value={manualClient.name} onChange={e => setManualClient({...manualClient, name: e.target.value})} /></div>
            <div className="fg"><label className="fl">Project Location</label><input className="fi" placeholder="Area / City" value={manualClient.location} onChange={e => setManualClient({...manualClient, location: e.target.value})} /></div>
            <div className="fg"><label className="fl">Project Type</label><input className="fi" placeholder="e.g. Infinity Pool" value={manualClient.type} onChange={e => setManualClient({...manualClient, type: e.target.value})} /></div>
            <div className="fg"><label className="fl">Initial Budget (₹)</label><input className="fi" placeholder="Approx project value" value={manualClient.budget} onChange={e => setManualClient({...manualClient, budget: e.target.value})} /></div>
            <div className="fg" style={{ gridColumn: 'span 2' }}><label className="fl">Contact Details</label><input className="fi" placeholder="Phone or Email" value={manualClient.contact} onChange={e => setManualClient({...manualClient, contact: e.target.value})} /></div>
            <div style={{ gridColumn: 'span 2', textAlign: 'right', marginTop: '12px' }}>
               <button className="btn btn-sky" onClick={() => handleAddClient(manualClient, 'manual')}>Create Client Entry</button>
            </div>
          </div>
        ) : renderLeadSource()}
      </Modal>

      <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false })} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <span>Comprehensive Site Ledger</span>
        </div>
      } wide>
        {detailModal.siteId && getSite(detailModal.siteId) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)' }}>{getSite(detailModal.siteId).siteName}</div>
                <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '4px' }}>📍 {getSite(detailModal.siteId).location} • Project Ledger</div>
              </div>
              <div style={{ textAlign: 'right', background: 'var(--bg3)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '4px' }}>Running Balance</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: getRowTotals(getSite(detailModal.siteId)).balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  ₹{getRowTotals(getSite(detailModal.siteId)).balance.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
               <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text3)' }}>TRANSACTION HISTORY</span>
                  <div style={{ display: 'flex', gap: '20px' }}>
                     <span style={{ fontSize: '12px', color: 'var(--green)' }}>● Inflow: <strong>₹{(company === 'm2a' ? getSite(detailModal.siteId).m2a?.payments : (activeTab === 'construction' ? getSite(detailModal.siteId).elitePool?.construction : getSite(detailModal.siteId).elitePool?.amc)?.payments).reduce((a,b)=>a+b.amount,0).toLocaleString('en-IN')}</strong></span>
                     <span style={{ fontSize: '12px', color: 'var(--red)' }}>● Outflow: <strong>₹{(company === 'm2a' ? getSite(detailModal.siteId).m2a?.expenditures : (activeTab === 'construction' ? getSite(detailModal.siteId).elitePool?.construction : getSite(detailModal.siteId).elitePool?.amc)?.expenditures).reduce((a,b)=>a+b.amount,0).toLocaleString('en-IN')}</strong></span>
                  </div>
               </div>
               <div className="tw" style={{ border: 'none', maxHeight: '450px', overflowY: 'auto' }}>
                  <table style={{ width: '100%' }}>
                     <thead>
                        <tr>
                           <th>Date</th>
                           <th>Type</th>
                           <th>Description / Category</th>
                           <th style={{ textAlign: 'right' }}>Amount</th>
                           <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                     </thead>
                     <tbody>
                        {(() => {
                           const site = getSite(detailModal.siteId);
                           const data = company === 'm2a' ? site.m2a : (activeTab === 'construction' ? site.elitePool?.construction : site.elitePool?.amc);
                           const all = [
                              ...(data?.payments || []).map(p => ({ ...p, type: 'INFLOW', color: 'var(--green)' })),
                              ...(data?.expenditures || []).map(e => ({ ...e, type: 'EXPENSE', color: 'var(--red)' }))
                           ].sort((a,b) => new Date(a.date) - new Date(b.date));
                           
                           let running = 0;
                           return all.map((t, idx) => {
                              running += (t.type === 'INFLOW' ? t.amount : -t.amount);
                              return (
                                 <tr key={idx}>
                                    <td className="mono" style={{ fontSize: '12px' }}>{t.date}</td>
                                    <td><span style={{ fontSize: '10px', fontWeight: 800, color: t.color, background: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>{t.type}</span></td>
                                    <td>
                                       <div style={{ fontWeight: 600, fontSize: '13px' }}>{t.description || 'Project Payment'}</div>
                                       <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{t.category || 'Revenue'}</div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: t.color }}>{t.type === 'INFLOW' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 800, color: running >= 0 ? 'var(--green)' : 'var(--red)' }}>₹{running.toLocaleString('en-IN')}</td>
                                 </tr>
                              );
                           });
                        })()}
                        {((company === 'm2a' ? getSite(detailModal.siteId).m2a?.payments : (activeTab === 'construction' ? getSite(detailModal.siteId).elitePool?.construction : getSite(detailModal.siteId).elitePool?.amc)?.payments).length === 0 && (company === 'm2a' ? getSite(detailModal.siteId).m2a?.expenditures : (activeTab === 'construction' ? getSite(detailModal.siteId).elitePool?.construction : getSite(detailModal.siteId).elitePool?.amc)?.expenditures).length === 0) && (
                           <tr><td colSpan="5" style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>No transactions found for this ledger</td></tr>
                        )}
                     </tbody>
                  </table>
               </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Transaction Modal */}
      <Modal open={transModal.open} onClose={() => setTransModal({ open: false })} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {transModal.type === 'payment' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
          )}
          <span>{transModal.type === 'payment' ? 'Record Inward Payment' : 'Record Site Expense'}</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setTransModal({ open: false })}>Cancel</button>
          <button className={`btn ${transModal.type === 'payment' ? 'btn-sky' : 'btn-red'}`} onClick={handleAddTrans}>Save Transaction</button>
        </>
      }>
        <div className="fg"><label className="fl">Amount (₹)</label><input className="fi" type="number" placeholder="0.00" value={newTrans.amount} onChange={e => setNewTrans({...newTrans, amount: e.target.value})} /></div>
        <div className="fg"><label className="fl">Description / Source</label><input className="fi" placeholder={transModal.type === 'payment' ? 'e.g. Client Installment' : 'e.g. Cement Purchase'} value={newTrans.desc} onChange={e => setNewTrans({...newTrans, desc: e.target.value})} /></div>
        <div className="fr" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg"><label className="fl">Transaction Date</label><input className="fi" type="date" value={newTrans.date} onChange={e => setNewTrans({...newTrans, date: e.target.value})} /></div>
          {transModal.type === 'expense' && (
            <div className="fg"><label className="fl">Category</label>
              <select className="fs" value={newTrans.category} onChange={e => setNewTrans({...newTrans, category: e.target.value})}>
                <option>Materials</option><option>Labour</option><option>Equipment</option><option>Transport</option><option>Petty Cash</option><option>Other</option>
              </select>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SiteAccountsPage;
