import React, { useState } from 'react';
import { useAppContext, API_BASE_URL } from '../context/AppContext';
import { Navigate } from 'react-router-dom';

const SendToClientPage = () => {
  const { leads, setLeads, quotes, setQuotes, designs, followups, setFollowups, checkAccess, addNotification, toast } = useAppContext();
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  if (!checkAccess('send')) return <Navigate to="/dashboard" />;

  const filteredLeads = leads.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedLead  = leads.find(l => l.id === selectedLeadId);
  const leadQuote     = quotes.find(q => q.leadId === selectedLeadId);
  const leadDesign    = designs.find(d => d.leadId === selectedLeadId);
  const isQuotePending = !leadQuote || leadQuote.status === 'pending';
  const isDesignPending = !leadDesign || leadDesign.status === 'progress';
  const canSend       = !(isQuotePending && isDesignPending);

  const handleSend = (via) => {
    if (!selectedLead) return;

    // Mark quote as sent
    if (leadQuote) {
      setQuotes(prev => prev.map(q => q.id === leadQuote.id ? { ...q, status: 'sent' } : q));
    }

    // Update lead status to followup
    setLeads(prev => prev.map(l => l.id === selectedLeadId ? { ...l, status: 'followup' } : l));

    // Add to followups if not already there
    if (!followups.find(f => f.leadId === selectedLeadId)) {
      setFollowups(prev => [...prev, {
        leadId: selectedLeadId,
        name:   selectedLead.name,
        phone:  selectedLead.phone,
        calls:  [{ done: false }, { done: false }, { done: false }, { done: false }, { done: false }],
        rating: 0,
      }]);
    }

    // Handle WhatsApp redirection
    const cleanPhone = selectedLead.phone.replace(/\D/g, '');
    let docLinks = '';
    if (leadQuote) docLinks += `\nQuotation: ${API_BASE_URL}/quotation/file/${leadQuote.db_id}/quotation.pdf`;
    if (leadDesign && leadDesign.uploadedFile) docLinks += `\nDesign Plan: ${API_BASE_URL}/pool-design/file/${leadDesign.uploadedFile.id}/design_plan.pdf`;

    const message = encodeURIComponent(`Hello ${selectedLead.name}, this is from Elite Pool Builders. Please find your project documents below:${docLinks}`);
    const waUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    window.open(waUrl, '_blank');

    const msg = `Redirected to WhatsApp for ${selectedLead.name}`;
    
    addNotification({
      type: 'update',
      module: 'Client Dispatch',
      action: 'Document Sent',
      message: `${msg}`,
      entityId: selectedLeadId
    });

    toast(msg, 'success');
  };

  return (
    <div className="page active" id="page_send">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">SEND TO CLIENT</div>
          <div className="ph-sub">Finalize and dispatch quotations & designs</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        <div className="card-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '20px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          <span className="card-title" style={{ fontSize: '20px', fontWeight: 800 }}>Client Dispatch Center</span>
        </div>
        
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', flex: 1 }}>
          {/* Left Pane: Selection */}
          <div style={{ borderRight: '1px solid var(--border)', paddingRight: '48px' }}>
            <div className="fg" style={{ position: 'relative' }}>
              <label className="fl" style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 700 }}>1. Search & Select Client</label>
              <input
                className="fi"
                style={{ height: '48px', fontSize: '14px' }}
                placeholder="Type client name or lead ID..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              />
              {showDropdown && searchQuery && filteredLeads.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', marginTop: '8px', maxHeight: '250px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  {filteredLeads.map(l => (
                    <div
                      key={l.id}
                      style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                      className="row-hover"
                      onMouseDown={() => { setSelectedLeadId(l.id); setSearchQuery(`${l.name} (${l.id})`); setShowDropdown(false); }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '14px' }}>{l.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{l.id} • {l.loc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: '32px', padding: '24px', background: 'var(--bg3)', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', fontStyle: 'italic', lineHeight: '1.6' }}>
                Select a client from the search above to preview their documents. Once selected, you can dispatch the quotation and design plan directly via WhatsApp.
              </div>
            </div>
          </div>

          {/* Right Pane: Preview & Actions */}
          <div>
            <label className="fl" style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 700 }}>2. Document Preview & Dispatch</label>
            
            {selectedLead ? (
              <div style={{ padding: '24px', background: 'var(--bg2)', borderRadius: '16px', border: '1px solid var(--border)', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ borderBottom: '1px dashed var(--border)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '16px', fontWeight: 800 }}>{selectedLead.name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{selectedLead.id}</span>
                  </div>
                  <span className={`s s-${selectedLead.status}`} style={{ padding: '4px 12px', borderRadius: '20px' }}>{selectedLead.status}</span>
                </div>

                <div style={{ flex: 1 }}>
                  {[
                    ['Phone Contact', selectedLead.phone],
                    ['Site Location', selectedLead.loc],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '14px' }}>
                      <span style={{ color: 'var(--text3)' }}>{label}</span>
                      <span style={{ fontWeight: 600 }}>{val}</span>
                    </div>
                  ))}

                  <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0' }}></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text3)' }}>Quotation Status</span>
                    <span style={{ color: leadQuote && leadQuote.status !== 'pending' ? 'var(--green)' : 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {leadQuote ? (
                        leadQuote.status === 'pending' ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            Pending
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            {leadQuote.id}
                          </>
                        )
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                          Missing
                        </>
                      )}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', fontSize: '14px' }}>
                    <span style={{ color: 'var(--text3)' }}>Design Plan</span>
                    <span style={{ color: leadDesign && leadDesign.status === 'done' ? 'var(--green)' : 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {leadDesign ? (
                        leadDesign.status === 'progress' ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            Design
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Ready
                          </>
                        )
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                          Missing
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '32px' }}>
                  <button
                    className="btn btn-sky"
                    style={{ width: '100%', padding: '16px', height: '54px', fontSize: '15px', fontWeight: 800 }}
                    onClick={handleSend}
                    disabled={!canSend}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    Dispatch via WhatsApp
                  </button>
                </div>

                {!canSend && (
                  <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--red)', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', padding: '10px', borderRadius: '8px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Requirements not met: Cannot dispatch while Quotation is Pending and Design is in progress.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)', borderRadius: '16px', color: 'var(--text3)', fontSize: '14px', textAlign: 'center', padding: '40px' }}>
                Search and select a client on the left to start the dispatch process.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendToClientPage;
