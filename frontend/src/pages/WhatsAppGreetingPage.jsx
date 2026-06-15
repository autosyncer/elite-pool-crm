import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

const DEFAULT_MSG = `Hello {name}! 👋

Greetings from *Elite Pool Builders*! 🏊

We hope you're doing well. As a valued client, we want to stay connected and ensure your pool experience is exceptional.

Feel free to reach out for any queries, maintenance needs, or new project enquiries.

Thank you for choosing us! 😊

— *Elite Pool Builders Team*`;

const WhatsAppGreetingPage = () => {
  const { leads, checkAccess } = useAppContext();
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [sent, setSent] = useState(new Set());

  const allLeads = leads.filter(l => l.phone);

  const filtered = allLeads.filter(l => {
    const matchSearch = l.name?.toLowerCase().includes(search.toLowerCase()) || l.phone?.includes(search);
    const matchType = filterType === 'all' || l.leadType === filterType;
    return matchSearch && matchType;
  });

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(l => l.id)));
    }
  };

  const buildMsg = (name) => message.replace(/{name}/g, name || 'Valued Client');

  const sendToOne = (lead) => {
    const phone = lead.phone.replace(/\D/g, '');
    const intlPhone = phone.startsWith('91') ? phone : `91${phone}`;
    const text = encodeURIComponent(buildMsg(lead.name));
    window.open(`https://wa.me/${intlPhone}?text=${text}`, '_blank');
    setSent(prev => new Set([...prev, lead.id]));
  };

  const sendToAll = () => {
    const targets = filtered.filter(l => selected.has(l.id));
    if (targets.length === 0) { alert('Select at least one client.'); return; }
    targets.forEach((lead, i) => {
      setTimeout(() => sendToOne(lead), i * 800);
    });
  };

  return (
    <div className="page active">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <div className="ph-title" style={{ fontSize: '24px', fontWeight: 800 }}>WhatsApp Greeting</div>
          <div className="ph-sub" style={{ fontSize: '13px', color: 'var(--text2)' }}>Send personalised greeting messages to clients via WhatsApp</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text3)' }}>{selected.size} selected</span>
          <button className="btn btn-sky" onClick={sendToAll} disabled={selected.size === 0} style={{ opacity: selected.size === 0 ? 0.5 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send to Selected ({selected.size})
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', alignItems: 'start' }}>
        {/* Client List */}
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="fi" style={{ flex: 1, minWidth: '200px' }} placeholder="🔍 Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="fs" style={{ width: '160px', margin: 0 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Clients</option>
              <option value="construction">Construction</option>
              <option value="amc">AMC</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>
              {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '12px', fontWeight: 700, color: 'var(--text3)' }}>
              {filtered.length} CLIENT{filtered.length !== 1 ? 'S' : ''} FOUND
            </div>
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>No clients found</div>
              )}
              {filtered.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: '1px solid var(--border)', background: selected.has(l.id) ? 'rgba(56,189,248,0.06)' : 'transparent', cursor: 'pointer', transition: '0.15s' }} onClick={() => toggleSelect(l.id)}>
                  <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} onClick={e => e.stopPropagation()} style={{ width: '16px', height: '16px', accentColor: 'var(--sky)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{l.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>📞 {l.phone} • {l.leadType === 'amc' ? 'AMC' : 'Construction'} • {l.loc || 'No location'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {sent.has(l.id) && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--green)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '4px' }}>✓ Sent</span>
                    )}
                    <button className="btn btn-ghost btn-sm" style={{ color: '#25D366' }} onClick={e => { e.stopPropagation(); sendToOne(l); }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                      Send
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Message Composer */}
        <div>
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text3)', marginBottom: '12px', textTransform: 'uppercase' }}>Message Template</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '12px' }}>Use <code style={{ background: 'var(--bg3)', padding: '1px 4px', borderRadius: '3px' }}>{'{name}'}</code> to personalise for each client.</div>
            <textarea
              className="fi"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={16}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.6 }}
            />
            <button className="btn btn-ghost btn-sm" style={{ marginTop: '12px', width: '100%' }} onClick={() => setMessage(DEFAULT_MSG)}>
              Reset to Default
            </button>
          </div>

          {/* Preview */}
          <div className="card" style={{ padding: '20px', marginTop: '16px' }}>
            <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text3)', marginBottom: '12px', textTransform: 'uppercase' }}>Preview</div>
            <div style={{ background: 'var(--bg3)', borderRadius: '12px', padding: '16px', fontSize: '13px', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text)', borderLeft: '3px solid #25D366' }}>
              {buildMsg('Ravi Kumar')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppGreetingPage;
