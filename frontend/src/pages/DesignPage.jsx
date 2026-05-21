import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useAppContext, API_BASE_URL } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import SearchBar from '../components/common/SearchBar';

const STYLES = ['Rectangular','L-Shaped','Kidney','Freeform','Infinity Edge','Plunge Pool','Beach Style','Pipeless'];
const DESIGNER_ROLES = ['ceo','admin','designer'];

const DesignPage = () => {
  const { designs, setDesigns, leads, setLeads, users, checkAccess, addNotification, toast, refreshDesigns } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');

  // ── Modal states ─────────────────────────────────────────────────────────
  const [newModal,     setNewModal]     = useState(false);
  const [detailModal,  setDetailModal]  = useState({ open: false, leadId: null });
  const [revModal,     setRevModal]     = useState({ open: false, leadId: null, clientName: '' });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', body: '', onConfirm: null, type: 'danger' });

  // ── New Design Plan form state ────────────────────────────────────────────
  const [ndLeadSearch,   setNdLeadSearch]   = useState('');
  const [ndLeadId,       setNdLeadId]       = useState('');
  const [ndLeadLabel,    setNdLeadLabel]    = useState('');
  const [ndStyle,        setNdStyle]        = useState('Rectangular');
  const [ndDesigner,     setNdDesigner]     = useState('');
  const [ndNotes,        setNdNotes]        = useState('');
  const [ndFile,         setNdFile]         = useState(null);
  const [ndDdOpen,       setNdDdOpen]       = useState(false);
  const ndFileRef = useRef(null);

  // ── Revision form state ───────────────────────────────────────────────────
  const [revStyle,    setRevStyle]    = useState('Rectangular');
  const [revDesigner, setRevDesigner] = useState('');
  const [revFile,     setRevFile]     = useState(null);
  const revFileRef = useRef(null);

  if (!checkAccess('design')) return <Navigate to="/dashboard" />;

  const designers = (users || []).filter(u => DESIGNER_ROLES.includes(u.role));

  const openNewModal = () => {
    setNdLeadSearch(''); setNdLeadId(''); setNdLeadLabel('');
    setNdStyle('Rectangular');
    setNdDesigner((designers[0]?.full_name || designers[0]?.username) || '');
    setNdNotes(''); setNdFile(null); setNdDdOpen(false);
    setNewModal(true);
  };

  const selectLead = (id, name) => {
    setNdLeadId(id);
    setNdLeadSearch(name + ' (' + id + ')');
    setNdLeadLabel('✅ Selected: ' + name);
    setNdDdOpen(false);
  };
  const saveDesign = async () => {
    const lead = (leads || []).find(l => l.id === ndLeadId);
    if (!lead) { toast('Select a client', 'error'); return; }
    if (!ndFile) { toast('Please upload a design file', 'error'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('lead_code', ndLeadId);
      formData.append('pool_style', ndStyle.replace(/[\s-]/g, '_').toLowerCase());
      formData.append('assigned_designer', ndDesigner);
      formData.append('design_notes', ndNotes);
      formData.append('file', ndFile);

      toast('Sending request to server...', 'info');
      await axios.post('/pool-design/new-design', formData);
      
      await refreshDesigns();
      toast('Design plan created!', 'success');
      setNewModal(false);
    } catch (error) {
      console.error("Error saving design:", error);
      const errMsg = error.response?.data?.detail || 'Failed to create design plan';
      toast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDesign = (lid) => designs.find(d => d.leadId === lid);

  const openRevision = (leadId) => {
    const d = getDesign(leadId);
    if (!d) {
      toast('Design record not found for this lead', 'error');
      return;
    }
    setRevStyle(d.style || 'Rectangular');
    setRevDesigner(d.designer || (designers[0]?.full_name || designers[0]?.username) || '');
    setRevFile(null);
    setRevModal({ open: true, leadId, clientName: d.client });
  };

  const saveRevision = async () => {
    if (!revFile) { toast('Please upload a revised file', 'error'); return; }
    
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', revFile);
      formData.append('pool_style', revStyle);
      formData.append('assigned_designer', revDesigner);
      
      toast('Submitting revision...', 'info');
      console.log("Submitting revision for lead:", revModal.leadId);
      await axios.patch(`/pool-design/revision/${revModal.leadId}`, formData);
      
      await refreshDesigns();
      toast('Revision submitted!', 'success');
      setRevModal({ open: false, leadId: null });
      setRevFile(null);
    } catch (error) {
      console.error("Error saving revision:", error);
      const errMsg = error.response?.data?.detail || 'Failed to submit revision';
      toast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDone = (leadId) => {
    const d = getDesign(leadId);
    setConfirmModal({
      open: true, title: '✅ Mark Complete', type: 'sky',
      body: `Mark design for "${d.client}" as completed?`,
      onConfirm: async () => {
        try {
          await axios.patch(`/pool-design/${d.id}/done`);
          await refreshDesigns();
          toast('Design marked complete!', 'success');
        } catch (error) {
          console.error("Error marking done:", error);
          toast('Failed to complete design', 'error');
        }
        setConfirmModal({ open: false });
      }
    });
  };

  const deleteDesign = (id, client) => {
    setConfirmModal({
      open: true, title: '🗑️ Delete Design', type: 'danger',
      body: `Permanently delete design for "${client}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`/pool-design/${id}`);
          await refreshDesigns();
          toast('Design deleted', 'success');
        } catch (error) {
          console.error("Error deleting design:", error);
          toast('Failed to delete design', 'error');
        }
        setConfirmModal({ open: false });
      }
    });
  };

  const filteredLeadOptions = (leads || []).filter(l => l.leadType === 'construction')
    .filter(l => !ndLeadSearch || l.name.toLowerCase().includes(ndLeadSearch.toLowerCase()) || l.id.toLowerCase().includes(ndLeadSearch.toLowerCase()));

  const openDetailModal = async (clientName) => {
    setDetailModal({ open: true, leadId: clientName });
    setDetailLoading(true);
    try {
      const res = await axios.get(`/pool-design/details/${clientName}`);
      setDetailData(res.data);
    } catch (err) {
      console.error('Failed to fetch design details:', err);
      toast('Failed to load design details', 'error');
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="page" id="page_design">
      <div className="ph">
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Pool Design</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>Manage custom pool blueprints and styles</p>
        </div>
      </div>

      <div>
        <button className="btn btn-sky" onClick={openNewModal}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m13.5 10.5 5 5"></path><path d="m3.5 18.5 5-5"></path><circle cx="11.5" cy="8.5" r="5.5"></circle></svg>
          New Design Plan
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchBar value={search} onChange={setSearch} placeholder="Search designs..." />
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Lead ID</th><th>Client</th><th>Style</th><th>Designer</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const filteredDesigns = designs.filter(d => d.leadType !== 'amc').filter(d => {
                  const q = search.toLowerCase();
                  return d.leadId.toLowerCase().includes(q) || d.client.toLowerCase().includes(q) || (d.style && d.style.toLowerCase().includes(q)) || (d.designer && d.designer.toLowerCase().includes(q));
                });
                return filteredDesigns.length > 0 ? filteredDesigns.map(d => (
                  <tr key={d.leadId}>
                    <td className="mono" style={{ fontSize: '11px', color: 'var(--sky)' }}>{d.leadId}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{d.client}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.req}</div>
                    </td>
                    <td><span style={{ fontSize: '12px', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '4px' }}>{d.style}</span></td>
                    <td style={{ fontSize: '13px' }}>{d.designer}</td>
                    <td><StatusBadge status={d.status === 'done' ? 'closed' : 'design'} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openDetailModal(d.leadId)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => openRevision(d.leadId)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        </button>
                        {d.status !== 'done' && (
                          <button className="btn btn-sky btn-sm" onClick={() => confirmDone(d.leadId)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteDesign(d.id, d.client)} style={{ color: 'var(--red)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No design queue items</td></tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Design Modal */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m13.5 10.5 5 5"></path><path d="m3.5 18.5 5-5"></path><circle cx="11.5" cy="8.5" r="5.5"></circle></svg>
          <span>Create Design Plan</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setNewModal(false)} disabled={loading}>Cancel</button>
          <button className="btn btn-sky" onClick={saveDesign} disabled={loading}>{loading ? 'Creating...' : 'Create Plan'}</button>
        </>
      }>
        <div className="fg" style={{ position: 'relative' }}>
          <label className="fl">Select Lead</label>
          <input className="fi" placeholder="🔍 Search lead..." value={ndLeadSearch} onChange={(e) => { setNdLeadSearch(e.target.value); setNdDdOpen(true); }} onFocus={() => setNdDdOpen(true)} />
          {ndDdOpen && filteredLeadOptions.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', top: '100%', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
              {filteredLeadOptions.map(l => (
                <div key={l.id} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)' }} onMouseDown={() => selectLead(l.id, l.name)}>{l.name} ({l.id})</div>
              ))}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--sky)', marginTop: '4px' }}>{ndLeadLabel}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg">
            <label className="fl">Pool Style</label>
            <select className="fs" value={ndStyle} onChange={(e) => setNdStyle(e.target.value)}>
              {STYLES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="fg">
            <label className="fl">Designer</label>
            <select className="fs" value={ndDesigner} onChange={(e) => setNdDesigner(e.target.value)}>
              {designers.map(u => <option key={u.email} value={u.full_name || u.username}>{u.full_name || u.username}</option>)}
            </select>
          </div>
        </div>
        <div className="fg">
          <label className="fl">Design Notes</label>
          <textarea className="ft" placeholder="Special requirements..." value={ndNotes} onChange={(e) => setNdNotes(e.target.value)} />
        </div>
        <div className="fg">
          <label className="fl">Upload Design File (PDF/DWG)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              id="nd-file-upload"
              type="file"
              accept=".pdf,.dwg,.dxf"
              style={{ display: 'none' }}
              onChange={e => setNdFile(e.target.files[0] || null)}
            />
            <label htmlFor="nd-file-upload" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {ndFile ? 'Change File' : 'Choose File'}
            </label>
            {ndFile && <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>📎 {ndFile.name}</div>}
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailModal.open} onClose={() => { setDetailModal({ open: false }); setDetailData(null); }} title="Design Details">
        {detailLoading && <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>Loading...</div>}
        {!detailLoading && detailData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Basic info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div><label className="fl">Client</label><div style={{ fontSize: '15px', fontWeight: 700 }}>{detailData.client_name}</div></div>
              <div><label className="fl">Lead Code</label><div className="mono" style={{ color: 'var(--sky)', fontWeight: 700 }}>{detailData.lead_code}</div></div>
              <div><label className="fl">Designer</label><div>{detailData.assigned_designer || '—'}</div></div>
              <div><label className="fl">Style</label><div><span style={{ fontSize: '12px', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '4px' }}>{detailData.pool_style}</span></div></div>
              <div><label className="fl">Status</label><StatusBadge status={detailData.status === 'completed' || detailData.status === 'done' ? 'closed' : 'design'} /></div>
              <div><label className="fl">Created</label><div style={{ fontSize: '13px', color: 'var(--text2)' }}>{detailData.created_at}</div></div>
            </div>

            {/* Requirements */}
            {detailData.requirement && (
              <div>
                <label className="fl">Requirements</label>
                <div style={{ fontSize: '13px', color: 'var(--text2)', background: 'var(--bg3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>{detailData.requirement}</div>
              </div>
            )}

            {/* Design Notes */}
            {detailData.design_notes && (
              <div>
                <label className="fl">Design Notes</label>
                <div style={{ fontSize: '13px', color: 'var(--text2)', background: 'var(--bg3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>{detailData.design_notes}</div>
              </div>
            )}

            {/* All Design Files */}
            <div>
              <label className="fl">Design Files ({(detailData.files || []).length})</label>
              {(detailData.files || []).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                  {(detailData.files || []).map(f => (
                    <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sky)' }}>{f.file_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Version {f.version}</div>
                      </div>
                      {f.file_url && (
                        <>
                          <a href={`${API_BASE_URL}/pool-design/file/${f.id}/view`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">👁 View</a>
                          <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff', border: 'none' }} onClick={async () => {
                            if (!window.confirm(`Delete "${f.file_name}"?`)) return;
                            try {
                              await axios.delete(`/pool-design/file/${f.id}`);
                              toast(`${f.file_name} deleted`, 'success');
                              // Refresh the detail data
                              setDetailData(prev => ({ ...prev, files: prev.files.filter(x => x.id !== f.id) }));
                            } catch (err) {
                              console.error(err);
                              toast('Failed to delete file', 'error');
                            }
                          }}>🗑 Remove</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text3)', fontStyle: 'italic', padding: '12px', background: 'var(--bg3)', borderRadius: '8px' }}>
                  📎 No design files uploaded yet
                </div>
              )}
            </div>
          </div>
        )}
        {!detailLoading && !detailData && detailModal.open && (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text3)' }}>No design data found</div>
        )}
      </Modal>

      {/* Revision Modal */}
      <Modal open={revModal.open} onClose={() => setRevModal({ open: false })} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          <span>Design Revision</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setRevModal({ open: false })} disabled={loading}>Cancel</button>
          <button className="btn btn-sky" onClick={saveRevision} disabled={loading}>{loading ? 'Submitting...' : 'Submit Revision'}</button>
        </>
      }>
        <div className="fg"><label className="fl">Client</label><div style={{ fontSize: '14px', fontWeight: 600 }}>{getDesign(revModal.leadId)?.client}</div></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg"><label className="fl">New Style</label><select className="fs" value={revStyle} onChange={(e) => setRevStyle(e.target.value)}>{STYLES.map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="fg"><label className="fl">Designer</label><select className="fs" value={revDesigner} onChange={(e) => setRevDesigner(e.target.value)}>{designers.map(u => <option key={u.email} value={u.full_name || u.username}>{u.full_name || u.username}</option>)}</select></div>
        </div>
        <div className="fg">
          <label className="fl">Upload Revised File (Optional)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              id="rev-design-upload"
              type="file"
              accept=".pdf,.dwg,.dxf"
              style={{ display: 'none' }}
              onChange={e => setRevFile(e.target.files[0] || null)}
            />
            <label htmlFor="rev-design-upload" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {revFile ? 'Change File' : 'Choose File'}
            </label>
            {revFile && <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>📎 {revFile.name}</div>}
          </div>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal open={confirmModal.open} onClose={() => setConfirmModal({ open: false })} title={confirmModal.title} footer={
        <>
          <button className="btn btn-ghost" onClick={() => setConfirmModal({ open: false })}>Cancel</button>
          <button className={`btn btn-${confirmModal.type}`} onClick={confirmModal.onConfirm}>Confirm</button>
        </>
      }>
        <div style={{ fontSize: '14px', color: 'var(--text2)' }}>{confirmModal.body}</div>
      </Modal>
    </div>
  );
};

export default DesignPage;
