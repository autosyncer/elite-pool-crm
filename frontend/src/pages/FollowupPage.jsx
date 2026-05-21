import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/common/Modal';
import SearchBar from '../components/common/SearchBar';

const FollowupPage = () => {
  const { followups, setFollowups, agents, callLog, setCallLog, checkAccess, toast, user, setAgents, refreshFollowups, refreshCallTrack, followupKPI } = useAppContext();

  const [search, setSearch] = useState('');
  const [detailModal, setDetailModal] = useState({ open: false, leadId: null, leadType: null });
  const [logCallModal, setLogCallModal] = useState({ open: false, leadId: null, leadType: null, callIdx: null });
  
  const [logOut, setLogOut] = useState('Interested');
  const [logDur, setLogDur] = useState('3-5 min');
  const [logNotes, setLogNotes] = useState('');
  const [logRecording, setLogRecording] = useState(null);
  
  const [importModal, setImportModal] = useState({ open: false, leads: [], loading: false });
  const [importSearch, setImportSearch] = useState('');

  if (!checkAccess('followup')) return <Navigate to="/dashboard" />;

  const fetchAvailableLeads = async () => {
    setImportModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await axios.get('/followup-calls/available-leads');
      setImportModal({ open: true, leads: res.data, loading: false });
    } catch (error) {
      console.error("Error fetching available leads:", error);
      toast('❌ Failed to fetch available leads', 'error');
      setImportModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleImportLead = async (lead) => {
    try {
      const formData = new FormData();
      formData.append('client_name', lead.name);
      formData.append('lead_type', lead.type);
      
      await axios.post('/followup-calls/add-followup-client', formData);
      toast(`✅ Added ${lead.name} to follow-ups`, 'success');
      setImportModal({ open: false, leads: [], loading: false });
      refreshFollowups();
    } catch (error) {
      console.error("Error importing lead:", error);
      toast(error.response?.data?.detail || '❌ Failed to import lead', 'error');
    }
  };

  const filtered = followups.filter(f => {
    const q = search.toLowerCase();
    return f.name.toLowerCase().includes(q) || (f.phone && f.phone.includes(q)) || String(f.leadId).toLowerCase().includes(q);
  });

  const getFollowup = (id, type) => followups.find(f => f.leadId === id && f.leadType === type);

  const handleLogCall = async () => {
    const { leadId, leadType, callIdx } = logCallModal;
    const followup = getFollowup(leadId, leadType);
    if (!followup) return;

    try {
      const formData = new FormData();
      formData.append('client_name', followup.name);
      formData.append('call_number', (callIdx + 1));
      formData.append('outcome', logOut);
      formData.append('duration', logDur);
      formData.append('agent_name', user?.full_name || user?.username || 'Agent');
      
      if (logRecording) {
        formData.append('recording', logRecording);
      }

      await axios.post('/followup-calls/log-call', formData);

      toast(`📞 Call logged for ${followup.name}`, 'success');
      setLogCallModal({ open: false, leadId: null, callIdx: null });
      setLogNotes('');
      setLogRecording(null);
      refreshFollowups();
      refreshCallTrack();
    } catch (error) {
      console.error("Error logging call:", error);
      const detail = error.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : (JSON.stringify(detail) || '❌ Failed to log call');
      toast(msg, 'error');
    }
  };

  const handleRemoveFollowup = async (leadId, leadType) => {
    const followup = getFollowup(leadId, leadType);
    if (!followup) return;
    if (!window.confirm(`Are you sure you want to remove ${followup.name} from follow-ups?`)) return;

    try {
      await axios.delete(`/followup-calls/remove-followup/${followup.name}`);
      toast('🗑️ Follow-up removed', 'success');
      refreshFollowups();
    } catch (error) {
      console.error("Error removing followup:", error);
      toast('❌ Failed to remove follow-up', 'error');
    }
  };

  const handleUpdateRating = async (leadId, leadType, rating) => {
    const followup = getFollowup(leadId, leadType);
    if (!followup) return;

    try {
      const formData = new FormData();
      formData.append('client_name', followup.name);
      formData.append('rating', rating);
      await axios.post('/followup-calls/update-rating', formData);
      refreshFollowups();
    } catch (error) {
      console.error("Error updating rating:", error);
    }
  };

  const handleUndoCall = async (leadId, leadType, callIdx) => {
    const followup = getFollowup(leadId, leadType);
    if (!followup) return;

    try {
      await axios.delete(`/followup-calls/delete-call/${followup.name}/${callIdx + 1}`);
      toast('↩️ Call undone', 'warn');
      refreshFollowups();
      refreshCallTrack();
    } catch (error) {
      console.error("Error undoing call:", error);
      toast('❌ Failed to undo call', 'error');
    }
  };

  const selectedFollowup = detailModal.leadId ? getFollowup(detailModal.leadId, detailModal.leadType) : null;

  return (
    <div className="page" id="page_followup">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Centralized Follow-ups</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Manage client interactions and touchpoint history</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-sky" onClick={fetchAvailableLeads}>
            <span style={{ marginRight: '8px' }}>+</span> Add Client
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card stat">
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Active Follow-ups</div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{followupKPI.active}</div>
        </div>
        <div className="card stat">
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>Calls Today</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--sky)' }}>{followupKPI.today}</div>
        </div>
      </div>

      <div className="table-toolbar" style={{ borderRadius: '12px 12px 0 0' }}>
        <div className="table-toolbar-left">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name, phone or ID..." />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', borderTop: 'none', borderRadius: '0 0 12px 12px' }}>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Phone</th>
                <th>Priority</th>
                <th>Touchpoints</th>
                <th>Progress</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(f => {
                const doneCount = f.calls.filter(c => c.done).length;
                const nextIdx = f.calls.findIndex(c => !c.done);
                return (
                  <tr key={`${f.leadType}-${f.leadId}`} style={{ cursor: 'pointer' }} onClick={() => setDetailModal({ open: true, leadId: f.leadId, leadType: f.leadType })}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text)' }}>{f.name}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--sky)' }}>{f.leadId}</div>
                    </td>
                    <td className="mono" style={{ fontSize: '13px' }}>{f.phone}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <span 
                            key={n} 
                            style={{ 
                              cursor: 'pointer', 
                              color: n <= f.rating ? 'var(--gold)' : 'var(--bg3)', 
                              fontSize: '14px',
                              transition: '0.2s'
                            }}
                            onClick={(e) => { e.stopPropagation(); handleUpdateRating(f.leadId, f.leadType, n); }}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {f.calls.map((c, i) => (
                          <div 
                            key={i} 
                            style={{ 
                              width: '18px', height: '18px', borderRadius: '50%', 
                              background: c.done ? 'var(--green)' : i === nextIdx ? 'var(--sky)' : 'var(--bg3)',
                              border: i === nextIdx ? '2px solid var(--sky)' : 'none',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '9px', fontWeight: 800, color: c.done ? '#000' : '#fff',
                              cursor: 'pointer'
                            }}
                            onClick={(e) => { e.stopPropagation(); setDetailModal({ open: true, leadId: f.leadId, leadType: f.leadType }); }}
                          >
                            {c.done ? '✓' : i + 1}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ width: '100px', height: '6px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(doneCount / 5) * 100}%`, background: 'var(--sky)' }}></div>
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDetailModal({ open: true, leadId: f.leadId, leadType: f.leadType })}>View Details</button>
                        <button 
                          className="btn btn-sky btn-sm" 
                          disabled={nextIdx === -1}
                          onClick={() => setLogCallModal({ open: true, leadId: f.leadId, leadType: f.leadType, callIdx: nextIdx })}
                        >
                          Log Call
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleRemoveFollowup(f.leadId, f.leadType)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>No matching clients found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interaction Panel / Detail Modal */}
      <Modal open={detailModal.open} onClose={() => setDetailModal({ open: false, leadId: null })} title="Interaction History" wide>
        {selectedFollowup && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '32px' }}>
            <div style={{ borderRight: '1px solid var(--border)', paddingRight: '32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>{selectedFollowup.name}</div>
                <div className="mono" style={{ color: 'var(--sky)', fontSize: '13px' }}>{selectedFollowup.leadId}</div>
              </div>
              
              <div className="fg">
                <label className="fl">Contact Information</label>
                <div style={{ fontSize: '14px', background: 'var(--bg3)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '8px' }}>📞 {selectedFollowup.phone}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text3)' }}>Priority: {selectedFollowup.rating}/5 Stars</div>
                </div>
              </div>

              <div className="fg">
                <label className="fl">Overall Progress</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, height: '8px', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(selectedFollowup.calls.filter(c => c.done).length / 5) * 100}%`, background: 'var(--green)' }}></div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700 }}>{selectedFollowup.calls.filter(c => c.done).length}/5</div>
                </div>
              </div>

              <button 
                className="btn btn-sky" 
                style={{ width: '100%', marginTop: '12px' }}
                disabled={selectedFollowup.calls.findIndex(c => !c.done) === -1}
                onClick={() => setLogCallModal({ 
                  open: true, 
                  leadId: selectedFollowup.leadId, 
                  leadType: selectedFollowup.leadType,
                  callIdx: selectedFollowup.calls.findIndex(c => !c.done) 
                })}
              >
                + Add New Log
              </button>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '10px' }}>
              <label className="fl">Follow-up Timeline</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedFollowup.calls.map((c, i) => (
                  <div key={i} style={{ 
                    padding: '16px', borderRadius: '12px', border: '1px solid var(--border)',
                    background: c.done ? 'rgba(16,185,129,0.03)' : 'transparent',
                    opacity: c.done || selectedFollowup.calls.findIndex(x => !x.done) === i ? 1 : 0.5
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '12px', color: c.done ? 'var(--green)' : 'var(--text3)' }}>TOUCHPOINT #{i+1}</span>
                      {c.done && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{c.date}</span>
                          <button 
                            onClick={() => handleUndoCall(selectedFollowup.leadId, selectedFollowup.leadType, i)}
                            style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: '10px', cursor: 'pointer' }}
                          >Undo</button>
                        </div>
                      )}
                    </div>
                    {c.done ? (
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Outcome: {c.out}</div>
                        {c.notes && <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '8px', fontStyle: 'italic' }}>"{c.notes}"</div>}
                        
                        {c.recordingUrl ? (
                          <div style={{ 
                            marginTop: '16px', 
                            padding: '12px', 
                            background: 'rgba(255,255,255,0.02)', 
                            borderRadius: '8px', 
                            border: '1px solid var(--border)' 
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--sky)', fontWeight: 600, marginBottom: '8px' }}>
                              <span>📞 Voice Recording Playback</span>
                            </div>
                            <audio 
                              src={c.recordingUrl} 
                              controls 
                              style={{ 
                                width: '100%', 
                                height: '36px', 
                                outline: 'none'
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text3)' }}>
                            No voice recording uploaded for this call.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
                        {selectedFollowup.calls.findIndex(x => !x.done) === i ? 'Pending call... Click "Add New Log" to update.' : 'Locked until previous steps complete.'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Log Call Modal */}
      <Modal open={logCallModal.open} onClose={() => { setLogCallModal({ open: false, leadId: null, leadType: null, callIdx: null }); setLogRecording(null); }} title="📞 Log Client Interaction">
        <div className="fg">
          <label className="fl">Call Outcome</label>
          <select className="fs" value={logOut} onChange={e => setLogOut(e.target.value)}>
            <option>Interested</option>
            <option>Very Interested</option>
            <option>Converted!</option>
            <option>Callback Requested</option>
            <option>Needs Time</option>
            <option>No Answer</option>
            <option>Not Interested</option>
          </select>
        </div>
        <div className="fg">
          <label className="fl">Duration</label>
          <select className="fs" value={logDur} onChange={e => setLogDur(e.target.value)}>
            <option>1-3 min</option>
            <option>3-5 min</option>
            <option>5-10 min</option>
            <option>{'>10 min'}</option>
          </select>
        </div>
        <div className="fg">
          <label className="fl">Call Notes (Optional)</label>
          <textarea className="ft" placeholder="Summary of the conversation..." value={logNotes} onChange={e => setLogNotes(e.target.value)} />
        </div>
        
        <div className="fg" style={{ marginTop: '16px' }}>
          <label className="fl">Voice Call Recording (.wav or .mp3)</label>
          <div style={{
            border: '2px dashed var(--border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'border-color 0.2s, background 0.2s',
            borderColor: logRecording ? 'var(--sky)' : 'var(--border)'
          }}>
            <input 
              type="file" 
              accept=".wav,.mp3" 
              onChange={e => setLogRecording(e.target.files[0])} 
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0, cursor: 'pointer'
              }}
            />
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎙️</div>
            {logRecording ? (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sky)' }}>{logRecording.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>{(logRecording.size / 1024 / 1024).toFixed(2)} MB</div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setLogRecording(null); }} 
                  style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--red)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Remove File
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Click to upload audio recording</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Accepts .wav or .mp3 only</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <button className="btn btn-ghost" onClick={() => { setLogCallModal({ open: false, leadId: null, callIdx: null }); setLogRecording(null); }}>Cancel</button>
          <button className="btn btn-sky" onClick={handleLogCall}>Save Interaction</button>
        </div>
      </Modal>
      {/* Import Modal */}
      <Modal 
        open={importModal.open} 
        onClose={() => { setImportModal({ open: false, leads: [], loading: false }); setImportSearch(''); }}
        title="Add New Client to Ledger"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Select an existing lead from Construction or AMC to start follow-up tracking.</p>
          
          <input 
            type="text" 
            className="ft" 
            placeholder="Search leads..." 
            style={{ marginBottom: '10px' }}
            value={importSearch}
            onChange={(e) => setImportSearch(e.target.value)}
          />

          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {importModal.loading ? (
              <p style={{ textAlign: 'center', padding: '20px' }}>Loading leads...</p>
            ) : importModal.leads.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text3)' }}>No new leads available to import.</p>
            ) : importModal.leads
                .filter(l => l.name.toLowerCase().includes(importSearch.toLowerCase()) || l.phone.includes(importSearch))
                .map(l => (
              <div key={l.type + l.id} className="card import-item" style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--bg3)' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{l.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{l.phone} • <span style={{ color: 'var(--sky)', textTransform: 'uppercase' }}>{l.type}</span></div>
                </div>
                <button className="btn btn-sky btn-sm" onClick={() => handleImportLead(l)}>Add Client</button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FollowupPage;
