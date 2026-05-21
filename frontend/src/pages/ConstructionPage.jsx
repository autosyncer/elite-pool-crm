import React, { useState, useRef, useEffect } from 'react';
import { useAppContext, API_BASE_URL } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import SearchBar from '../components/common/SearchBar';

const ConstructionPage = () => {
  const { constructionSites, setConstructionSites, leads, refreshLeads, refreshConstructionSites, addProcurement, checkAccess, toast } = useAppContext();

  const [addSiteModal, setAddSiteModal] = useState(false);
  const [logModal, setLogModal] = useState({ open: false, siteId: null });
  const [plansModal, setPlansModal] = useState({ open: false, siteId: null });
  const [viewLogsModal, setViewLogsModal] = useState({ open: false, siteId: null });
  const [stagedPlans, setStagedPlans] = useState({}); // Staging area for plan uploads
  const [localSites, setLocalSites] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchSites = async () => {
      try {
        const res = await axios.get('/construction/all-sites');
        setLocalSites(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSites();
  }, []);
  const [siteLogs, setSiteLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Site Creation States
  const [leadSearch, setLeadSearch] = useState('');
  const [leadDdOpen, setLeadDdOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const [siteDate, setSiteDate] = useState(new Date().toISOString().split('T')[0]);

  // Log Form States
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logReport, setLogReport] = useState('');
  const [logLabor, setLogLabor] = useState('');
  const [logMaterials, setLogMaterials] = useState('');
  const [logReqs, setLogReqs] = useState('');
  const [logFiles, setLogFiles] = useState([]); // Multiple image uploads
  const logFileRef = useRef(null);

  // Filter States
  const [logFilter, setLogFilter] = useState('all'); // all, today, week, month

  const fetchSites = async () => {
    try {
      const res = await axios.get('/construction/all-sites');
      setLocalSites(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  if (!checkAccess('construction')) return <Navigate to="/dashboard" />;

  const getSite = (id) => localSites.find(s => s.id === id);

  const saveLog = async () => {
    const site = getSite(logModal.siteId);
    if (!logReport) { toast('Report is required', 'error'); return; }
    
    try {
      const formData = new FormData();
      formData.append('site_code', site.site_code);
      formData.append('labor_strength', logLabor);
      formData.append('work_report', logReport);
      formData.append('materials_used', logMaterials);
      if (logReqs) formData.append('procurement_req', logReqs);
      logFiles.forEach(file => formData.append('upload_images', file));

      await axios.post('/construction/add-construction-logs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast('✅ Daily log saved!', 'success');
      setLogModal({ open: false });
      resetLogForm();
      fetchSites(); // Refresh local list
      refreshConstructionSites();
    } catch (error) {
      console.error("Error saving log:", error);
      toast('❌ Failed to save log', 'error');
    }
  };

  const resetLogForm = () => {
    setLogDate(new Date().toISOString().split('T')[0]);
    setLogReport(''); setLogLabor(''); setLogMaterials(''); setLogReqs('');
    setLogFiles([]);
  };

  const saveSite = async () => {
    if (!selectedLead) { toast('Please select a lead', 'error'); return; }
    
    try {
      const formData = new FormData();
      formData.append('name', selectedLead.name);
      formData.append('start_date', siteDate);

      await axios.post('/construction/add-construction-site', formData);
      toast('🏗️ Construction Site created!', 'success');
      setAddSiteModal(false);
      setSelectedLead(null);
      setLeadSearch('');
      fetchSites(); // Refresh local list
      refreshConstructionSites();
      refreshLeads();
    } catch (error) {
      console.error("Error creating site:", error);
      toast('❌ Failed to create site', 'error');
    }
  };

  const fetchSiteLogs = async (siteId) => {
    const site = getSite(siteId);
    if (!site) return;
    setLogsLoading(true);
    setViewLogsModal({ open: true, siteId });
    try {
      const res = await axios.get(`/construction/view-construction-logs/${site.site_code}`);
      setSiteLogs(res.data);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast('❌ Failed to load logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  const updatePlan = async (siteId, type, file) => {
    if (!file) return;
    const site = getSite(siteId);

    try {
      const formData = new FormData();
      formData.append('site_code', site.site_code);
      formData.append('upload_plan_type', type);
      formData.append('upload_plans', file);

      await axios.post('/construction/uploading_plans', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast(`📄 ${type.charAt(0).toUpperCase() + type.slice(1)} plan updated!`, 'success');
      setStagedPlans(prev => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      fetchSites();
      refreshConstructionSites();
    } catch (error) {
      console.error("Error updating plan:", error);
      toast('❌ Upload failed', 'error');
    }
  };

  const deletePlan = async (planId) => {
    if (!window.confirm("Are you sure you want to remove this plan?")) return;
    try {
      await axios.delete(`/construction/delete-plan/${planId}`);
      toast('🗑️ Plan removed successfully', 'success');
      fetchSites();
      refreshConstructionSites();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast('❌ Failed to remove plan', 'error');
    }
  };

  const deleteSite = async (siteCode) => {
    if (!window.confirm(`Are you sure you want to delete site ${siteCode}?`)) return;
    try {
      await axios.delete(`/construction/delete-site/${siteCode}`);
      toast('🗑️ Site deleted successfully', 'success');
      fetchSites();
      refreshConstructionSites();
    } catch (error) {
      console.error("Error deleting site:", error);
      toast('❌ Failed to delete site', 'error');
    }
  };

  const filteredLeads = leadSearch 
    ? (leads || []).filter(l => (l.leadType === 'construction' || !l.leadType) && (l.name.toLowerCase().includes(leadSearch.toLowerCase()) || l.id.toLowerCase().includes(leadSearch.toLowerCase())))
    : (leads || []).filter(l => l.leadType === 'construction' || !l.leadType);

  const filterLogs = () => {
    return siteLogs.filter(l => {
      if (logFilter === 'all') return true;
      const d = new Date(l.log_date);
      const now = new Date();
      if (logFilter === 'today') return d.toDateString() === now.toDateString();
      // Simple filters for demo, can be more robust
      return true;
    });
  };

  return (
    <div className="page" id="page_construction">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Construction Sites</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Manage active builds, technical plans, and daily progress</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-sky" onClick={() => setAddSiteModal(true)}>+ Add Construction Site</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div className="table-toolbar-left">
             <SearchBar value={search} onChange={setSearch} placeholder="Search sites..." />
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Site ID</th><th>Client</th><th>Location</th><th>Start Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {(() => {
                const filteredSites = localSites.filter(s => {
                  const q = search.toLowerCase();
                  return s.id.toLowerCase().includes(q) || s.client.toLowerCase().includes(q) || (s.location && s.location.toLowerCase().includes(q)) || (s.status && s.status.toLowerCase().includes(q));
                });
                return filteredSites.length > 0 ? filteredSites.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontSize: '12px', color: 'var(--sky)', fontWeight: 600 }}>{s.id}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{s.client}</div>
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--text3)' }}>LEAD: {s.leadId}</div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{s.location}</td>
                    <td style={{ fontSize: '13px' }}>{s.startDate}</td>
                    <td><StatusBadge status={s.status === 'active' ? 'design' : 'closed'} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setPlansModal({ open: true, siteId: s.id })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                          Plans
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => fetchSiteLogs(s.id)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          View Logs
                        </button>
                        <button className="btn btn-sky btn-sm" onClick={() => setLogModal({ open: true, siteId: s.id })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Add Log
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteSite(s.site_code)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No construction sites listed</td></tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Site Modal */}
      <Modal open={addSiteModal} onClose={() => setAddSiteModal(false)} title="🏗️ New Construction Site" footer={
        <>
          <button className="btn btn-ghost" onClick={() => setAddSiteModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveSite}>Initialize Site</button>
        </>
      }>
        <div className="fg" style={{ position: 'relative' }}>
          <label className="fl">Import from Construction Lead</label>
          <input 
            className="fi" 
            placeholder="🔍 Search leads..." 
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
          <div className="card2" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(56,189,248,0.05)', border: '1px dashed var(--sky)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--sky)', marginBottom: '8px' }}>CLIENT PRE-FILL</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div><label className="fl">Location</label><div style={{ fontSize: '13px' }}>{selectedLead.loc}</div></div>
              <div><label className="fl">Contact</label><div style={{ fontSize: '13px' }}>{selectedLead.phone}</div></div>
            </div>
          </div>
        )}
        <div className="fg"><label className="fl">Project Start Date</label><input className="fi" type="date" value={siteDate} onChange={e => setSiteDate(e.target.value)} /></div>
      </Modal>

      {/* Add Log Modal */}
      <Modal open={logModal.open} onClose={() => setLogModal({ open: false })} title="📝 Add Daily Progress Log">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg"><label className="fl">Log Date</label><input className="fi" type="date" value={logDate} onChange={e => setLogDate(e.target.value)} /></div>
          <div className="fg"><label className="fl">Labor Strength</label><input className="fi" placeholder="e.g. 4M, 6H" value={logLabor} onChange={e => setLogLabor(e.target.value)} /></div>
        </div>
        <div className="fg"><label className="fl">Work Completed Today</label><textarea className="ft" style={{ height: '80px' }} placeholder="Detail today's activities..." value={logReport} onChange={e => setLogReport(e.target.value)} /></div>
        <div className="fg"><label className="fl">Materials Used</label><input className="fi" placeholder="e.g. 50 bags cement, 2T steel" value={logMaterials} onChange={e => setLogMaterials(e.target.value)} /></div>
        <div className="fg"><label className="fl">Procurement Requirements</label><textarea className="ft" style={{ height: '60px' }} placeholder="Items needed for next phase..." value={logReqs} onChange={e => setLogReqs(e.target.value)} /></div>
        
        <div className="fg">
          <label className="fl">Site Photos (Multiple)</label>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <label className="btn btn-ghost" style={{ cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Upload Images
              <input type="file" multiple accept="image/*" hidden onChange={e => setLogFiles([...logFiles, ...Array.from(e.target.files)])} />
            </label>
            {logFiles.length > 0 && <button className="btn btn-red btn-sm" onClick={() => setLogFiles([])}>Clear ({logFiles.length})</button>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button className="btn btn-ghost" onClick={() => setLogModal({ open: false })}>Cancel</button>
          <button className="btn btn-sky" onClick={saveLog}>Save Daily Log</button>
        </div>
      </Modal>

      {/* Plans Modal */}
      <Modal open={plansModal.open} onClose={() => setPlansModal({ open: false })} title="📐 Technical Drawings & Plans" wide>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {['schematic', 'plumbing', 'electrical', 'sectional', 'pumpRoom', 'cad'].map(type => {
            const site = getSite(plansModal.siteId);
            const plan = site?.plans?.[type];
            return (
              <div key={type} className="card" style={{ padding: '16px', background: 'var(--bg2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                   <div style={{ fontWeight: 800, fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase' }}>{type}</div>
                   {plan && <StatusBadge status="closed" text="UPLOADED" />}
                </div>
                {plan ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 600 }}>{plan.name || 'Drawing Attached'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Updated: {plan.date || 'N/A'}</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <a href={`${API_BASE_URL}/construction/plan/${plan.id}/view`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>View Document</a>
                      <button onClick={() => deletePlan(plan.id)} className="btn btn-red btn-sm" style={{ padding: '8px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', fontStyle: 'italic' }}>No plan uploaded yet</div>
                    <label className="btn btn-sky btn-sm" style={{ cursor: 'pointer', justifyContent: 'center' }}>
                       Upload {type}
                       <input type="file" hidden onChange={e => {
                         const file = e.target.files[0];
                         if (file) updatePlan(plansModal.siteId, type, file);
                       }} />
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Modal>

      {/* View Logs Modal */}
      <Modal open={viewLogsModal.open} onClose={() => setViewLogsModal({ open: false })} title="🗓️ Progress Log Viewer" wide>
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
              {logsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>Loading logs...</div>
              ) : filterLogs().length > 0 ? filterLogs().map((l, i) => (
                <div key={i} className="card" style={{ background: 'var(--bg2)', padding: '20px', borderLeft: '4px solid var(--sky)', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--sky)' }}>{l.log_date}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '4px' }}>👷 {l.labor_strength}</div>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '16px', lineHeight: '1.6' }}>{l.work_report}</div>
                  {l.materials_used && <div style={{ fontSize: '12px', color: 'var(--text2)', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', marginBottom: '16px' }}><strong>🧱 Materials:</strong> {l.materials_used}</div>}
                  
                  {l.upload_images?.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', marginBottom: '8px' }}>SITE PHOTOS</div>
                      <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {l.upload_images.map((p, pi) => (
                          <div key={pi} style={{ position: 'relative', width: '120px', height: '90px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                             <img src={`${API_BASE_URL}/construction/log-photo/${p.id}/view`} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                             <a href={`${API_BASE_URL}/construction/log-photo/${p.id}/view`} target="_blank" rel="noreferrer" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', opacity: 0, transition: '0.2s', color: '#fff', fontSize: '10px', textDecoration: 'none' }} onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = 0}>VIEW FULL</a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )) : <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>No logs found for selected period.</div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ConstructionPage;
