import React, { useState, useEffect } from 'react';
import { useAppContext, API_BASE_URL } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import SearchBar from '../components/common/SearchBar';

const AMCPage = () => {
  const { amcSites, setAmcSites, leads, addProcurement, checkAccess, toast, refreshAmcSites } = useAppContext();

  const [localSites, setLocalSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [addSiteModal, setAddSiteModal] = useState(false);
  const [logModal, setLogModal] = useState({ open: false, siteId: null });
  const [viewLogsModal, setViewLogsModal] = useState({ open: false, siteId: null });

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const res = await axios.get('/amc/all-sites');
      setLocalSites(res.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching AMC sites:", error);
      setLoading(false);
    }
  };

  // Site Creation States
  const [leadSearch, setLeadSearch] = useState('');
  const [leadDdOpen, setLeadDdOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [siteDate, setSiteDate] = useState(new Date().toISOString().split('T')[0]);

  // Visit Log States
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logPH, setLogPH] = useState('7.2');
  const [logCL, setLogCL] = useState('1.5');
  const [logReport, setLogReport] = useState('');
  const [logMaterials, setLogMaterials] = useState('');
  const [logReqs, setLogReqs] = useState('');
  const [logFiles, setLogFiles] = useState([]);

  // Filter States
  const [logFilter, setLogFilter] = useState('all');

  if (!checkAccess('amc')) return <Navigate to="/dashboard" />;

  const getSite = (id) => localSites.find(s => s.id === id);

  const saveLog = async () => {
    const site = getSite(logModal.siteId);
    if (!logReport) { toast('Service report is required', 'error'); return; }
    
    // Close the modal immediately so the user sees the card close instantly
    setLogModal({ open: false, siteId: null });

    try {
      const formData = new FormData();
      formData.append('site_code', site.site_code);
      formData.append('visit_date', logDate);
      formData.append('ph_level', logPH);
      formData.append('cl_level', logCL);
      formData.append('service_report', logReport);
      formData.append('materials_used', logMaterials);
      formData.append('procurement_req', logReqs);
      logFiles.forEach(file => formData.append('upload_images', file));

      await axios.post('/amc/add-amc-visit', formData);
      toast('✅ AMC visit log saved!', 'success');
      fetchSites();
      refreshAmcSites();
      resetLogForm();
    } catch (error) {
      console.error("Error saving log:", error);
      toast('❌ Failed to save log', 'error');
      resetLogForm();
    }
  };

  const resetLogForm = () => {
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogPH('7.2'); setLogCL('1.5'); setLogReport(''); setLogMaterials(''); setLogReqs('');
    setLogFiles([]);
  };

  const saveSite = async () => {
    if (!selectedLead) { toast('Please select an AMC lead', 'error'); return; }
    
    try {
      const formData = new FormData();
      formData.append('name', selectedLead.name);
      formData.append('start_date', siteDate);

      await axios.post('/amc/add-amc-site', formData);
      toast('🔧 AMC Site initialized!', 'success');
      fetchSites();
      refreshAmcSites();
      setAddSiteModal(false);
      setSelectedLead(null);
      setLeadSearch('');
    } catch (error) {
      console.error("Error saving site:", error);
      toast('❌ Failed to initialize site', 'error');
    }
  };

  const deleteSite = async (siteCode) => {
    if (!window.confirm(`Are you sure you want to delete site ${siteCode}?`)) return;
    try {
      await axios.delete(`/amc/delete-site/${siteCode}`);
      toast('🗑️ Site deleted successfully', 'success');
      fetchSites();
      refreshAmcSites();
    } catch (error) {
      console.error("Error deleting site:", error);
      toast('❌ Failed to delete site', 'error');
    }
  };

  const deleteVisit = async (visitId, siteId) => {
    if (!window.confirm("Are you sure you want to delete this visit log?")) return;
    try {
      await axios.delete(`/amc/delete-visit/${visitId}`);
      toast('🗑️ Visit log deleted', 'success');
      // Re-fetch visits for this site to update the modal
      const site = getSite(siteId);
      const res = await axios.get(`/amc/view-amc-visits/${site.site_code}`);
      setLocalSites(prev => prev.map(ps => ps.id === siteId ? { ...ps, entries: res.data } : ps));
    } catch (error) {
      console.error("Error deleting visit:", error);
      toast('❌ Failed to delete visit', 'error');
    }
  };

  const filteredLeads = leadSearch 
    ? (leads || []).filter(l => l.leadType === 'amc' && (l.name.toLowerCase().includes(leadSearch.toLowerCase()) || l.id.toLowerCase().includes(leadSearch.toLowerCase())))
    : (leads || []).filter(l => l.leadType === 'amc');

  const filterLogs = (logs) => {
    if (!logs) return [];
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    return logs.filter(l => {
      if (logFilter === 'today') return l.date === today;
      if (logFilter === 'week') {
        const d = new Date(l.date);
        const diff = (now - d) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }
      if (logFilter === 'month') {
        const d = new Date(l.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  };

  return (
    <div className="page" id="page_amc">
      <div className="ph">
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>AMC Sites</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>Recurring maintenance monitoring and water quality tracking</p>
        </div>
      </div>

      <div>
        <button className="btn btn-sky" onClick={() => setAddSiteModal(true)}>+ Add AMC Site</button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
             <SearchBar value={search} onChange={setSearch} placeholder="Search AMC sites..." />
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Site ID</th><th>Client</th><th>Location</th><th>Contract Start</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {(() => {
                const filteredSites = localSites.filter(s => {
                  const q = search.toLowerCase();
                  return s.site_code.toLowerCase().includes(q) || s.client.toLowerCase().includes(q) || (s.location && s.location.toLowerCase().includes(q)) || (s.status && s.status.toLowerCase().includes(q));
                });
                return filteredSites.length > 0 ? filteredSites.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontSize: '12px', color: 'var(--sky)', fontWeight: 600 }}>{s.site_code}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{s.client}</div>
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--text3)' }}>LEAD: {s.leadId}</div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{s.location}</td>
                    <td style={{ fontSize: '13px' }}>{s.startDate}</td>
                    <td><StatusBadge status={s.status === 'active' ? 'new' : 'closed'} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={async () => {
                          const res = await axios.get(`/amc/view-amc-visits/${s.site_code}`);
                          setLocalSites(prev => prev.map(ps => ps.id === s.id ? { ...ps, entries: res.data } : ps));
                          setViewLogsModal({ open: true, siteId: s.id });
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          View Logs
                        </button>
                        <button className="btn btn-sky btn-sm" onClick={() => setLogModal({ open: true, siteId: s.id })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Log Visit
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteSite(s.site_code)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No AMC sites listed</td></tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add AMC Site Modal */}
      <Modal open={addSiteModal} onClose={() => setAddSiteModal(false)} title="🔧 New AMC Contract" footer={
        <>
          <button className="btn btn-ghost" onClick={() => setAddSiteModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveSite}>Activate Contract</button>
        </>
      }>
        <div className="fg" style={{ position: 'relative' }}>
          <label className="fl">Import from AMC Lead</label>
          <input 
            className="fi" 
            placeholder="🔍 Search AMC leads..." 
            value={leadSearch} 
            onChange={e => { setLeadSearch(e.target.value); setLeadDdOpen(true); }}
            onFocus={() => setLeadDdOpen(true)}
          />
          {leadDdOpen && (
            <div style={{ position: 'absolute', zIndex: 10, width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', top: '100%', maxHeight: '160px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
              {filteredLeads.map(l => (
                <div key={l.id} style={{ padding: '12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onMouseDown={() => { setSelectedLead(l); setLeadSearch(`${l.name} (${l.id})`); setLeadDdOpen(false); }}>
                   <div style={{ fontWeight: 700, fontSize: '13px' }}>{l.name}</div>
                   <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{l.loc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedLead && (
          <div className="card2" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(45,212,191,0.05)', border: '1px dashed var(--teal)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--teal)', marginBottom: '8px' }}>CLIENT PRE-FILL</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div><label className="fl">Location</label><div style={{ fontSize: '13px' }}>{selectedLead.loc}</div></div>
              <div><label className="fl">Contact</label><div style={{ fontSize: '13px' }}>{selectedLead.phone}</div></div>
            </div>
          </div>
        )}
        <div className="fg"><label className="fl">Contract Start Date</label><input className="fi" type="date" value={siteDate} onChange={e => setSiteDate(e.target.value)} /></div>
      </Modal>

      {/* Log Visit Modal */}
      <Modal open={logModal.open} onClose={() => setLogModal({ open: false })} title="📋 Daily Maintenance Entry">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div className="fg"><label className="fl">Visit Date</label><input className="fi" type="date" value={logDate} onChange={e => setLogDate(e.target.value)} /></div>
          <div className="fg"><label className="fl">pH Level</label><input className="fi" placeholder="e.g. 7.2" value={logPH} onChange={e => setLogPH(e.target.value)} /></div>
          <div className="fg"><label className="fl">CL Level (ppm)</label><input className="fi" placeholder="e.g. 1.5" value={logCL} onChange={e => setLogCL(e.target.value)} /></div>
        </div>
        <div className="fg"><label className="fl">Service Report</label><textarea className="ft" style={{ height: '80px' }} placeholder="Detail maintenance activities (Backwash, Vacuum, etc.)" value={logReport} onChange={e => setLogReport(e.target.value)} /></div>
        <div className="fg"><label className="fl">Chemicals / Materials Used</label><input className="fi" placeholder="e.g. 2kg Chlorine, 1L Algaecide" value={logMaterials} onChange={e => setLogMaterials(e.target.value)} /></div>
        <div className="fg"><label className="fl">Procurement Needs</label><textarea className="ft" style={{ height: '60px' }} placeholder="Parts or chemicals to be ordered..." value={logReqs} onChange={e => setLogReqs(e.target.value)} /></div>
        
        <div className="fg">
          <label className="fl">Service Photos (Multiple)</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label className="btn btn-ghost" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Images
              <input type="file" multiple accept="image/*" hidden onChange={e => setLogFiles([...logFiles, ...Array.from(e.target.files)])} />
            </label>
            {logFiles.length > 0 && <button className="btn btn-red btn-sm" onClick={() => setLogFiles([])}>Clear ({logFiles.length})</button>}
          </div>
          {logFiles.length > 0 && (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
                {logFiles.map((f, i) => <div key={i} style={{ aspectRatio: '1', background: 'var(--bg3)', borderRadius: '4px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>🖼️</div>)}
             </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="btn btn-ghost" onClick={() => setLogModal({ open: false })}>Cancel</button>
          <button className="btn btn-sky" onClick={saveLog}>Save Visit Log</button>
        </div>
      </Modal>

      {/* View Logs Modal */}
      <Modal open={viewLogsModal.open} onClose={() => setViewLogsModal({ open: false })} title="🗓️ Service History Viewer" wide>
        {viewLogsModal.siteId && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
              {['all', 'today', 'week', 'month'].map(f => (
                <button key={f} className={`btn ${logFilter === f ? 'btn-sky' : 'btn-ghost'} btn-sm`} onClick={() => setLogFilter(f)}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '12px' }}>
              {filterLogs(getSite(viewLogsModal.siteId).entries).length > 0 ? filterLogs(getSite(viewLogsModal.siteId).entries).map((l, i) => (
                <div key={i} className="card" style={{ background: 'var(--bg2)', padding: '20px', borderLeft: '4px solid var(--teal)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--teal)' }}>{l.date}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ fontSize: '11px', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '4px' }}>🧪 pH: {l.ph}</div>
                      <div style={{ fontSize: '11px', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '4px' }}>💧 CL: {l.cl} ppm</div>
                      <button onClick={() => deleteVisit(l.id, viewLogsModal.siteId)} className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', padding: '4px' }}>
                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px', lineHeight: '1.6' }}>{l.report}</div>
                  {l.materials && <div style={{ fontSize: '12px', color: 'var(--text2)', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}><strong>🧱 Chemicals:</strong> {l.materials}</div>}
                  
                  {l.photos?.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', marginBottom: '8px' }}>VISIT PHOTOS</div>
                      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {l.photos.map((p, pi) => (
                          <div key={pi} style={{ position: 'relative', width: '120px', height: '90px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                             <img src={`${API_BASE_URL}/amc/visit-photo/${p.id}/view`} alt="Service" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             <a href={`${API_BASE_URL}/amc/visit-photo/${p.id}/view`} target="_blank" rel="noreferrer" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', opacity: 0, transition: '0.2s', color: '#fff', fontSize: '10px', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>VIEW</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )) : <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>No visit logs found for selected period.</div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AMCPage;
