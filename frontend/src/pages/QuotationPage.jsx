import React, { useState } from 'react';
import { useAppContext, API_BASE_URL } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import SearchBar from '../components/common/SearchBar';

import axios from 'axios';

const QuotationPage = () => {
  const { quotes, setQuotes, leads, setLeads, checkAccess, addNotification, toast, refreshQuotes } = useAppContext();
  const [search, setSearch] = useState('');

  // ── Modal states ─────────────────────────────────────────────────────────
  const [newModal,     setNewModal]     = useState(false);
  const [detailModal,  setDetailModal]  = useState({ open: false, id: null });
  const [revModal,     setRevModal]     = useState({ open: false, id: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', body: '', onConfirm: null, type: 'danger' });

  // ── New Quotation form state ──────────────────────────────────────────────
  const [nqSearch,   setNqSearch]   = useState('');
  const [nqClientId, setNqClientId] = useState('');
  const [nqLabel,    setNqLabel]    = useState('');
  const [nqDdOpen,   setNqDdOpen]   = useState(false);
  const [nqL,        setNqL]        = useState('30');
  const [nqW,        setNqW]        = useState('15');
  const [nqFile,     setNqFile]     = useState(null);

  // ── Revision form state ───────────────────────────────────────────────────
  const [revL,     setRevL]     = useState('30');
  const [revW,     setRevW]     = useState('15');
  const [revNotes, setRevNotes] = useState('');
  const [revQFile, setRevQFile] = useState(null);

  if (!checkAccess('quotation')) return <Navigate to="/dashboard" />;

  const getQuote = (id) => quotes.find(q => q.id === id);

  const openNewModal = () => {
    setNqSearch(''); setNqClientId(''); setNqLabel(''); setNqDdOpen(false);
    setNqL('30'); setNqW('15');
    setNewModal(true);
  };

  const selectClient = (id, name) => {
    setNqClientId(id);
    setNqSearch(name + ' (' + id + ')');
    setNqLabel('✅ Selected: ' + name);
    setNqDdOpen(false);
  };

  const saveQuote = async () => {
    const lead = (leads || []).find(l => l.id === nqClientId);
    if (!lead) { toast('Select a client', 'error'); return; }
    const ln = parseInt(nqL) || 0;
    const w  = parseInt(nqW) || 0;
    if (!ln || !w) { toast('Enter dimensions', 'error'); return; }
    if (!nqFile) { toast('Upload a quotation PDF', 'error'); return; }

    const formData = new FormData();
    formData.append('lead_id', lead.id);
    formData.append('pool_lenght', ln);
    formData.append('pool_width', w);
    formData.append('quotation_pdf', nqFile);

    try {
      const res = await axios.post('/quotation/new_quotation', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      toast(res.data.message, 'success');
      refreshQuotes();
      setNewModal(false);
      setNqFile(null);

      addNotification({
        type: 'create',
        module: 'Financial Quotes',
        action: 'Quote Generated',
        message: `New Quotation for "${lead.name}" generated`,
        entityId: res.data.quotation.id
      });

    } catch (err) {
      console.error(err);
      toast(err.response?.data?.detail || 'Failed to save quote', 'error');
    }
  };

  const openRevision = (id) => {
    const q = getQuote(id);
    if (!q) return;
    const sizeMatch = q.size ? q.size.match(/([\d.]+)×([\d.]+)/) : null;
    setRevL(sizeMatch ? sizeMatch[1] : '30');
    setRevW(sizeMatch ? (sizeMatch[2] || '').replace(' ft', '').trim() : '15');
    setRevNotes(q.revisionNotes || '');
    setRevQFile(null);
    setRevModal({ open: true, id });
  };

  const saveRevision = async () => {
    const q = getQuote(revModal.id);
    if (!q) return;

    const ln = parseInt(revL) || 0;
    const w  = parseInt(revW) || 0;
    
    const formData = new FormData();
    formData.append('pool_lenght', ln);
    formData.append('pool_width', w);
    if (revQFile) formData.append('quotation_pdf', revQFile);

    try {
      const res = await axios.put(`/quotation/revision_quotation/${q.leadId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast(res.data.message, 'success');
      refreshQuotes();
      setRevModal({ open: false, id: null });
      setRevQFile(null);

      addNotification({
        type: 'update',
        module: 'Financial Quotes',
        action: 'Revision Submitted',
        message: `Revision for Quotation ${q.id} (${q.client}) submitted`,
        entityId: q.id
      });

    } catch (err) {
      console.error(err);
      toast(err.response?.data?.detail || 'Failed to save revision', 'error');
    }
  };

  const approveQuote = (id) => {
    setQuotes(prev => prev.map(q => {
      if (q.id === id) {
        addNotification({
          type: 'update',
          module: 'Financial Quotes',
          action: 'Quote Approved',
          message: `Quotation ${q.id} for "${q.client}" approved for dispatch`,
          entityId: q.id
        });
        return { ...q, status: 'sent' };
      }
      return q;
    }));
    toast('Quote approved!', 'success');
  };

  const confirmDone = (id) => {
    const q = getQuote(id);
    setConfirmModal({
      open: true, title: '✅ Mark Sent', type: 'sky',
      body: `Mark quotation for "${q.client}" as sent?`,
      onConfirm: async () => {
        try {
          await axios.patch(`/quotation/${q.db_id}/done`);
          await refreshQuotes();
          toast('Quotation marked as sent!', 'success');
          
          addNotification({
            type: 'update',
            module: 'Financial Quotes',
            action: 'Quote Sent',
            message: `Quotation ${id} for "${q.client}" status updated to sent`,
            entityId: id
          });
        } catch (error) {
          console.error("Error marking done:", error);
          toast('Failed to update quotation status', 'error');
        }
        setConfirmModal({ open: false });
      }
    });
  };

  const filteredLeadOptions = nqSearch
    ? (leads || []).filter(l => l.name.toLowerCase().includes(nqSearch.toLowerCase()) || l.id.toLowerCase().includes(nqSearch.toLowerCase()))
    : (leads || []);

  const detailQuote = detailModal.id ? getQuote(detailModal.id) : null;

  return (
    <div className="page" id="page_quotation">
      <div className="ph">
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Quotations</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>Manage client cost estimations and billing</p>
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <button className="btn btn-sky" onClick={openNewModal}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
          Create Quotation
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchBar value={search} onChange={setSearch} placeholder="Search quotations..." />
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>ID</th><th>Client</th><th>Size</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {(() => {
                const filteredQuotes = quotes.filter(q => {
                  const qLower = search.toLowerCase();
                  return q.id.toLowerCase().includes(qLower) || q.client.toLowerCase().includes(qLower) || (q.size && q.size.toLowerCase().includes(qLower)) || (q.status && q.status.toLowerCase().includes(qLower));
                });
                return filteredQuotes.length > 0 ? filteredQuotes.map(q => (
                  <tr key={q.id}>
                    <td className="mono" style={{ color: 'var(--sky)', fontWeight: 700 }}>{q.id}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{q.client}</td>
                    <td style={{ fontSize: '13px' }}>{q.size}</td>
                    <td><StatusBadge status={q.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetailModal({ open: true, id: q.id })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </button>
                        {q.status !== 'sent' && (
                          <button className="btn btn-sky btn-sm" onClick={() => confirmDone(q.id)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={async () => {
                          if (!window.confirm(`Delete quotation for ${q.client}?`)) return;
                          try {
                            await axios.delete(`/quotation/delete_quotation/${q.leadId}`);
                            toast('Quotation deleted', 'success');
                            refreshQuotes();
                          } catch (err) {
                            toast('Failed to delete', 'error');
                          }
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No quotations generated</td></tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Quote Modal */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <span>Create Quotation</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setNewModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveQuote}>Generate Quote</button>
        </>
      }>
        <div className="fg" style={{ position: 'relative' }}>
          <label className="fl">Select Client</label>
          <input className="fi" placeholder="🔍 Search client..." value={nqSearch} onChange={(e) => { setNqSearch(e.target.value); setNqDdOpen(true); }} onFocus={() => setNqDdOpen(true)} />
          {nqDdOpen && filteredLeadOptions.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', top: '100%', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
              {filteredLeadOptions.map(l => (
                <div key={l.id} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid var(--border)' }} onMouseDown={() => selectClient(l.id, l.name)}>{l.name} ({l.id})</div>
              ))}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--sky)', marginTop: '4px' }}>{nqLabel}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg"><label className="fl">Pool Length (ft)</label><input className="fi" type="number" value={nqL} onChange={(e) => setNqL(e.target.value)} /></div>
          <div className="fg"><label className="fl">Pool Width (ft)</label><input className="fi" type="number" value={nqW} onChange={(e) => setNqW(e.target.value)} /></div>
        </div>

        <div className="fg">
          <label className="fl">Upload Quotation File (PDF)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              id="nq-file-upload"
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={e => setNqFile(e.target.files[0] || null)}
            />
            <label htmlFor="nq-file-upload" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {nqFile ? 'Change File' : 'Choose File'}
            </label>
            {nqFile && <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>📎 {nqFile.name}</div>}
          </div>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false })} title="Quotation Details">
        {detailQuote && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div><label className="fl">Quote ID</label><div className="mono" style={{ fontSize: '16px', color: 'var(--sky)', fontWeight: 700 }}>{detailQuote.id}</div></div>
              <div><label className="fl">Status</label><StatusBadge status={detailQuote.status} /></div>
              <div><label className="fl">Client</label><div style={{ fontWeight: 700 }}>{detailQuote.client}</div></div>
              <div><label className="fl">Pool Size</label><div>{detailQuote.size}</div></div>
            </div>



            {/* Uploaded file */}
            <div>
              <label className="fl">Quotation File</label>
              {detailQuote.uploadedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--sky)' }}>{detailQuote.uploadedFile.name}</span>
                  {detailQuote.uploadedFile && (
                    <>
                      <a href={`${API_BASE_URL}/quotation/file/${detailQuote.db_id}/view`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">👁 View</a>
                      <a href={`${API_BASE_URL}/quotation/file/${detailQuote.db_id}/view`} download={`quotation_${detailQuote.leadId}.pdf`} className="btn btn-sky btn-sm">⬇ Download</a>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text3)', fontStyle: 'italic', padding: '12px', background: 'var(--bg3)', borderRadius: '8px' }}>
                  📎 No quotation file uploaded yet
                </div>
              )}
            </div>

            {/* Revision History */}
            {(detailQuote.revisions || []).length > 0 && (
              <div>
                <label className="fl">Revision History</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {[...(detailQuote.revisions || [])].reverse().map((r, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg3)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--gold)' }}>Revision #{r.revNum}</span>
                        <span style={{ color: 'var(--text3)' }}>{r.date}</span>
                      </div>
                      <div style={{ color: 'var(--text2)' }}>Size: {r.size} • Amount: {r.amount}</div>
                      {r.notes && <div style={{ color: 'var(--text3)', marginTop: '4px' }}>Note: {r.notes}</div>}
                      {r.file && r.file.url && (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                          <a href={r.file.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>👁 View File</a>
                          <a href={r.file.url} download={r.file.name} className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>⬇ Download</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* NO Send to Client button */}
          </div>
        )}
      </Modal>

      {/* Revision Modal */}
      <Modal open={revModal.open} onClose={() => setRevModal({ open: false })} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          <span>Quote Revision</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setRevModal({ open: false })}>Cancel</button>
          <button className="btn btn-sky" onClick={saveRevision}>Save Revision</button>
        </>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg"><label className="fl">New Length (ft)</label><input className="fi" type="number" value={revL} onChange={(e) => setRevL(e.target.value)} /></div>
          <div className="fg"><label className="fl">New Width (ft)</label><input className="fi" type="number" value={revW} onChange={(e) => setRevW(e.target.value)} /></div>
        </div>
        <div className="fg"><label className="fl">Revision Notes</label><textarea className="ft" placeholder="Reason for change..." value={revNotes} onChange={(e) => setRevNotes(e.target.value)} /></div>
        <div className="fg">
          <label className="fl">Upload Revised Quote (Optional)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input 
              id="rev-file-upload"
              type="file" 
              accept=".pdf" 
              style={{ display: 'none' }} 
              onChange={e => setRevQFile(e.target.files[0] || null)} 
            />
            <label htmlFor="rev-file-upload" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              {revQFile ? 'Change File' : 'Choose File'}
            </label>
            {revQFile && <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>📎 {revQFile.name}</div>}
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

export default QuotationPage;
