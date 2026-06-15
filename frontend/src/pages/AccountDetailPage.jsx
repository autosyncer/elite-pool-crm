import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import axios from 'axios';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const AccountDetailPage = () => {
  const { company, siteName } = useParams();
  const navigate = useNavigate();
  const { siteAccounts, refreshSiteAccounts, refreshAccountDetails } = useAppContext();

  const decodedName = decodeURIComponent(siteName);
  const companyType = company === 'm2a' ? 'm2a' : 'elitePool';

  const initialTab = (() => {
    if (companyType === 'm2a') return 'construction';
    const found = siteAccounts.find(s => s.siteName === decodeURIComponent(siteName) && s.isElitePool);
    return found?.projectType === 'amc' ? 'amc' : 'construction';
  })();
  const [tab, setTab] = useState(initialTab);
  const [invTab, setInvTab] = useState('uploaded'); // 'uploaded' | 'generated'
  const [invoices, setInvoices] = useState([]);
  const [generatedInvoices, setGeneratedInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [personFilter, setPersonFilter] = useState('All');
  const [uploadForm, setUploadForm] = useState({ invoice_number: '', amount: '', invoice_date: new Date().toISOString().slice(0, 10), description: '' });
  const [uploadFile, setUploadFile] = useState(null);

  const loadInvoices = async () => {
    try { const r = await axios.get(`/elite-pool-accounts/invoices/${decodedName}`); setInvoices(r.data || []); } catch (_) {}
    try { const gi = await axios.get(`/invoices/by-project/${encodeURIComponent(decodedName)}`); setGeneratedInvoices(gi.data || []); } catch (_) {}
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // If siteAccounts already loaded, skip full refresh — just update this site's detail
      if (siteAccounts.length === 0) {
        try { await refreshSiteAccounts(); } catch (_) {}
      }
      try { await refreshAccountDetails(decodedName, companyType); } catch (_) {}
      if (company === 'elitepool') { try { await loadInvoices(); } catch (_) {} }
      setLoading(false);
    };
    // Safety: always stop loading after 5s max
    const timeout = setTimeout(() => setLoading(false), 5000);
    load().finally(() => clearTimeout(timeout));
  }, [decodedName, companyType]);

  const handleUpload = async () => {
    if (!uploadFile) { alert('Please select a file'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      if (uploadForm.invoice_number) fd.append('invoice_number', uploadForm.invoice_number);
      if (uploadForm.amount) fd.append('amount', uploadForm.amount);
      if (uploadForm.invoice_date) fd.append('invoice_date', uploadForm.invoice_date);
      if (uploadForm.description) fd.append('description', uploadForm.description);
      await axios.post(`/elite-pool-accounts/upload-invoice/${decodedName}`, fd);
      setShowUpload(false);
      setUploadFile(null);
      setUploadForm({ invoice_number: '', amount: '', invoice_date: new Date().toISOString().slice(0, 10), description: '' });
      await loadInvoices();
    } catch (e) {
      alert(e?.response?.data?.detail || 'Upload failed');
    } finally { setUploading(false); }
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try { await axios.delete(`/elite-pool-accounts/invoice/${id}`); await loadInvoices(); } catch (_) {}
  };

  const handleDownloadAll = async () => {
    const all = [...invoices, ...generatedInvoices.map(gi => ({ ...gi, invoice_number: gi.invoice_no, file_url: null, _generated: true }))];
    const urls = invoices.filter(i => i.file_url).map(i => i.file_url);
    if (urls.length === 0) { alert('No uploaded files to download'); return; }
    urls.forEach((url, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.download = '';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }, idx * 400);
    });
  };

  const site = siteAccounts.find(s =>
    s.siteName === decodedName &&
    (companyType === 'm2a' ? s.isM2A : s.isElitePool)
  );

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '14px', color: 'var(--text3)' }}>Loading account details...</div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>Site not found</div>
        <div style={{ fontSize: '13px', color: 'var(--text3)' }}>"{decodedName}" does not exist in this ledger.</div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Go Back</button>
      </div>
    );
  }

  const getData = () => {
    if (companyType === 'm2a') return site.m2a;
    return tab === 'construction' ? site.elitePool?.construction : site.elitePool?.amc;
  };

  const data = getData() || { payments: [], expenditures: [] };
  const payments = data.payments || [];
  const expenditures = data.expenditures || [];
  const totalIn = payments.reduce((s, p) => s + p.amount, 0);
  const totalOut = expenditures.reduce((s, e) => s + e.amount, 0);
  const balance = totalIn - totalOut;

  // Clean up raw enum strings and extract person from description
  const cleanCategory = (cat) => {
    if (!cat) return '—';
    return String(cat)
      .replace('ElitePoolExpenseType.', '')
      .replace('ElitePoolExpenseTypeEnum.', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  const extractPerson = (desc) => {
    if (!desc) return null;
    // Match "| CEO", "by CEO", or just "CEO"/"Admin" anywhere in description
    const m = desc.match(/(?:\||by)\s*(CEO|Admin|Manager)\b/i) || desc.match(/\b(CEO|Admin|Manager)\b/i);
    if (m) return m[1].toUpperCase() === 'CEO' ? 'CEO' : m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    return null;
  };

  const allTxns = [
    ...payments.map(p => ({ ...p, kind: 'INFLOW', color: 'var(--green)', person: null })),
    ...expenditures.map(e => ({ ...e, kind: 'EXPENSE', color: 'var(--red)', person: extractPerson(e.description) }))
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Unique persons who have expense entries
  const persons = [...new Set(allTxns.map(t => t.person).filter(Boolean))];

  const filteredTxns = personFilter === 'All' ? allTxns : allTxns.filter(t => t.kind === 'INFLOW' || t.person === personFilter);

  let running = 0;

  return (
    <div className="page active">
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>{decodedName}</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)' }}>{site.location} • {company === 'm2a' ? 'M2A Ledger' : 'Elite Pool Accounts'}</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        <div className="card stat" style={{ borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Inflow</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--green)' }}>{fmt(totalIn)}</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--red)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Expenses</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--red)' }}>{fmt(totalOut)}</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--sky)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Net Balance</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(balance)}</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--orange, #f97316)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Transactions</div>
          <div style={{ fontSize: '26px', fontWeight: 800 }}>{allTxns.length}</div>
        </div>
      </div>

      {/* EP tab switcher */}
      {companyType === 'elitePool' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          <button className={`btn ${tab === 'construction' ? 'btn-sky' : 'btn-ghost'}`} onClick={() => setTab('construction')}>Construction</button>
          <button className={`btn ${tab === 'amc' ? 'btn-sky' : 'btn-ghost'}`} onClick={() => setTab('amc')}>AMC</button>
        </div>
      )}

      {/* Transaction History */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontWeight: 800, fontSize: '13px', color: 'var(--text3)' }}>FULL TRANSACTION LOG</span>
          {persons.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['All', ...persons].map(p => {
                const isActive = personFilter === p;
                const color = p === 'CEO' ? '#7c3aed' : p === 'Admin' ? '#0369a1' : '#0ea5e9';
                const total = p === 'All'
                  ? null
                  : allTxns.filter(t => t.person === p).reduce((s, t) => s + t.amount, 0);
                return (
                  <button key={p} onClick={() => setPersonFilter(p)} style={{
                    padding: '4px 12px', borderRadius: '20px', border: `1.5px solid ${isActive ? color : 'var(--border)'}`,
                    background: isActive ? color : 'transparent',
                    color: isActive ? '#fff' : 'var(--text3)',
                    fontWeight: 700, fontSize: '11px', cursor: 'pointer'
                  }}>
                    {p}{total != null ? ` · ${fmt(total)}` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>By</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredTxns.length === 0 && (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>No transactions recorded yet</td></tr>
              )}
              {filteredTxns.map((t, idx) => {
                running += t.kind === 'INFLOW' ? t.amount : -t.amount;
                const personColor = t.person === 'CEO' ? '#7c3aed' : t.person === 'Admin' ? '#0369a1' : '#64748b';
                return (
                  <tr key={idx}>
                    <td className="mono" style={{ fontSize: '12px' }}>{t.date}</td>
                    <td>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: t.color, padding: '2px 8px', borderRadius: '4px', border: `1px solid ${t.color}40` }}>
                        {t.kind}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '13px' }}>{t.description || 'Project Payment'}</td>
                    <td>
                      {t.person ? (
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                          background: t.person === 'CEO' ? 'rgba(124,58,237,0.1)' : 'rgba(3,105,161,0.1)',
                          color: personColor }}>
                          {t.person}
                        </span>
                      ) : <span style={{ color: 'var(--text3)', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text3)' }}>
                      {t.kind === 'INFLOW' ? 'Revenue' : cleanCategory(t.category)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: t.color }}>
                      {t.kind === 'INFLOW' ? '+' : '-'}{fmt(t.amount)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: running >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {fmt(running)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── INVOICES SECTION (EP only) ── */}
      {company === 'elitepool' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: '24px' }}>

          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              {[['uploaded', `Uploaded (${invoices.length})`], ['generated', `Generated (${generatedInvoices.length})`]].map(([key, label]) => (
                <button key={key} onClick={() => setInvTab(key)}
                  style={{ padding: '6px 16px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                    background: invTab === key ? 'var(--sky, #0ea5e9)' : 'var(--bg2)',
                    color: invTab === key ? '#fff' : 'var(--text3)' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleDownloadAll} className="btn btn-ghost btn-sm" title="Download all uploaded files">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download All
              </button>
              <button onClick={() => setShowUpload(v => !v)} className="btn btn-sky btn-sm">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Invoice
              </button>
              <button
                onClick={() => navigate('/invoice-generator', { state: { project: decodedName } })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '6px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>
                Generate Invoice
              </button>
            </div>
          </div>

          {/* Upload Form */}
          {showUpload && (
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text3)', marginBottom: '12px', textTransform: 'uppercase' }}>Upload Invoice File</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>Invoice #</label>
                  <input className="input" value={uploadForm.invoice_number} onChange={e => setUploadForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="INV-001" style={{ fontSize: '12px', padding: '7px 10px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>Amount (₹)</label>
                  <input className="input" type="number" value={uploadForm.amount} onChange={e => setUploadForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={{ fontSize: '12px', padding: '7px 10px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>Invoice Date</label>
                  <input className="input" type="date" value={uploadForm.invoice_date} onChange={e => setUploadForm(p => ({ ...p, invoice_date: e.target.value }))} style={{ fontSize: '12px', padding: '7px 10px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>Description</label>
                  <input className="input" value={uploadForm.description} onChange={e => setUploadForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional note" style={{ fontSize: '12px', padding: '7px 10px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '6px', border: '1.5px dashed var(--border)', cursor: 'pointer', fontSize: '12px', color: 'var(--text2)', background: 'var(--bg1)', flex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  {uploadFile ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>{uploadFile.name}</span> : 'Choose PDF / Image file'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0] || null)} />
                </label>
                <button onClick={handleUpload} disabled={uploading} className="btn btn-sky" style={{ whiteSpace: 'nowrap' }}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button onClick={() => setShowUpload(false)} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          )}

          {/* ── Uploaded Invoices Tab ── */}
          {invTab === 'uploaded' && (
            <div className="tw" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th><th>Date</th><th>Amount</th><th>Description</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                      No invoices uploaded yet — click <b>Upload Invoice</b> to add one
                    </td></tr>
                  )}
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="mono" style={{ fontSize: '12px', fontWeight: 700 }}>{inv.invoice_number || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{inv.invoice_date || '—'}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 700 }}>{inv.amount ? fmt(inv.amount) : '—'}</td>
                      <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{inv.description || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => {
                            const url = (inv.file_url || '').replace('/image/upload/', '/raw/upload/');
                            window.open(url, '_blank', 'noreferrer');
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            View / Download
                          </button>
                          <button onClick={() => handleDeleteInvoice(inv.id)} className="btn btn-sm" style={{ border: '1px solid var(--red)', color: 'var(--red)', background: 'transparent', cursor: 'pointer' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {invoices.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text3)' }}>
                  <span>{invoices.length} file{invoices.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                    Total: {fmt(invoices.reduce((s, i) => s + Number(i.amount || 0), 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Generated Invoices Tab ── */}
          {invTab === 'generated' && (
            <div className="tw" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Invoice No</th><th>Date</th><th>Bill To</th>
                    <th style={{ textAlign: 'right' }}>Total</th><th>Billed By</th><th>Generated By</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedInvoices.length === 0 && (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧾</div>
                      No invoices generated for this site yet
                    </td></tr>
                  )}
                  {generatedInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--sky, #0ea5e9)' }}>{inv.invoice_no}</td>
                      <td style={{ fontSize: '12px' }}>{inv.invoice_date || '—'}</td>
                      <td style={{ fontSize: '12px' }}>{inv.bill_to_name || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                        ₹{Number(inv.total || 0).toLocaleString('en-IN')}
                      </td>
                      <td>
                        {inv.billed_by ? (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                            background: inv.billed_by === 'CEO' ? 'rgba(124,58,237,0.12)' : 'rgba(3,105,161,0.12)',
                            color: inv.billed_by === 'CEO' ? '#7c3aed' : '#0369a1' }}>
                            {inv.billed_by}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{inv.created_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {generatedInvoices.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text3)' }}>
                  <span>{generatedInvoices.length} invoice{generatedInvoices.length !== 1 ? 's' : ''}</span>
                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                    Total: {fmt(generatedInvoices.reduce((s, i) => s + Number(i.total || 0), 0))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountDetailPage;
