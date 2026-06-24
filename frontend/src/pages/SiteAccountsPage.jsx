import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Modal from '../components/common/Modal';
import SearchBar from '../components/common/SearchBar';
import axios from 'axios';
import InvoiceGeneratorPage from './InvoiceGeneratorPage';

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Cloudinary raw URLs can't use <a download> cross-origin — open in new tab instead
const openPdf = (fileUrl) => {
  if (!fileUrl) return;
  const url = fileUrl.replace('/image/upload/', '/raw/upload/');
  window.open(url, '_blank', 'noreferrer');
};

function InvoiceLogModal({ open, siteName, uploaded, generated, onClose, onUpload, onDeleteUploaded, fmt }) {
  const defaultTab = uploaded.length === 0 && generated.length > 0 ? 'generated' : 'uploaded';
  const [tab, setTab] = useState(defaultTab);
  if (!open) return null;

  const totalUploaded = uploaded.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalGenerated = generated.reduce((s, i) => s + Number(i.total || 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#ffffff', borderRadius: '12px', width: '780px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a' }}>Invoice Log — {siteName}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              {uploaded.length} uploaded · {generated.length} generated
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '18px', lineHeight: 1 }}>✕</button>
        </div>

        {/* Tabs + Upload button */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            {[['uploaded', `📎 Uploaded (${uploaded.length})`], ['generated', `🧾 Generated (${generated.length})`]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                style={{ padding: '6px 16px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                  background: tab === key ? '#0ea5e9' : '#f1f5f9',
                  color: tab === key ? '#fff' : '#64748b' }}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={onUpload} className="btn btn-sky btn-sm">+ Upload Invoice</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#ffffff' }}>
          {tab === 'uploaded' && (
            uploaded.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📄</div>
                No invoices uploaded yet
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Invoice #</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Amount</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Description</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {uploaded.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{inv.invoice_number || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{inv.invoice_date || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#16a34a', fontWeight: 700 }}>{inv.amount ? fmt(inv.amount) : '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b' }}>{inv.description || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => openPdf(inv.file_url)}>View / Download</button>
                          <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => onDeleteUploaded(inv.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {tab === 'generated' && (
            generated.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>🧾</div>
                No invoices generated for this site yet
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Invoice No</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Bill To</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Total</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Billed By</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontSize: '11px', fontWeight: 700 }}>Generated By</th>
                  </tr>
                </thead>
                <tbody>
                  {generated.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: '#0ea5e9' }}>{inv.invoice_no}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{inv.invoice_date || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#334155' }}>{inv.bill_to_name || '—'}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>₹{Number(inv.total || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {inv.billed_by ? (
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
                            background: inv.billed_by === 'CEO' ? 'rgba(124,58,237,0.12)' : 'rgba(3,105,161,0.12)',
                            color: inv.billed_by === 'CEO' ? '#7c3aed' : '#0369a1' }}>
                            {inv.billed_by}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b' }}>{inv.created_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Footer totals */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: '#f8fafc' }}>
          <span style={{ color: '#64748b' }}>
            Uploaded total: <b style={{ color: '#16a34a' }}>{fmt(totalUploaded)}</b>
            &nbsp;&nbsp;·&nbsp;&nbsp;
            Generated total: <b style={{ color: '#16a34a' }}>{fmt(totalGenerated)}</b>
          </span>
          <span style={{ color: '#334155', fontWeight: 700 }}>
            Combined: <b style={{ color: '#16a34a' }}>{fmt(totalUploaded + totalGenerated)}</b>
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonExpenseLog({ person, siteAccounts, fmt }) {
  const [selectedSite, setSelectedSite] = useState('All');
  const personLower = person.toLowerCase();
  const color = person === 'CEO' ? '#7c3aed' : '#0369a1';
  const bg = person === 'CEO' ? 'rgba(124,58,237,0.08)' : 'rgba(3,105,161,0.08)';

  // Collect all expenses matching this person across all EP sites
  const allRows = [];
  (siteAccounts || []).filter(s => s.isElitePool).forEach(site => {
    const allExp = [
      ...(site.elitePool?.construction?.expenditures || []),
      ...(site.elitePool?.amc?.expenditures || []),
    ];
    allExp.forEach(e => {
      const desc = (e.description || '').toLowerCase();
      if (desc.includes(personLower) || desc.includes('| ' + personLower) || desc.includes('by ' + personLower)) {
        allRows.push({ ...e, siteName: site.siteName });
      }
    });
  });
  allRows.sort((a, b) => new Date(b.date) - new Date(a.date));

  const sites = ['All', ...[...new Set(allRows.map(r => r.siteName))].sort()];
  const rows = selectedSite === 'All' ? allRows : allRows.filter(r => r.siteName === selectedSite);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const grandTotal = allRows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: bg }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '15px', color }}>{person} — Expense Log</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
            {rows.length} transaction{rows.length !== 1 ? 's' : ''}
            {selectedSite !== 'All' ? ` · ${selectedSite}` : ' across all EP sites'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Site filter dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Filter by site:</span>
            <select value={selectedSite} onChange={e => setSelectedSite(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${color}`, fontSize: '13px', fontWeight: 600,
                color, background: '#fff', cursor: 'pointer', outline: 'none', minWidth: '160px' }}>
              {sites.map(s => (
                <option key={s} value={s}>
                  {s === 'All' ? `All Sites (${allRows.length})` : `${s} (${allRows.filter(r => r.siteName === s).length})`}
                </option>
              ))}
            </select>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>
              {selectedSite === 'All' ? 'Grand Total' : 'Site Total'}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#ef4444' }}>{fmt(total)}</div>
            {selectedSite !== 'All' && (
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>Grand: {fmt(grandTotal)}</div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="tw" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              {selectedSite === 'All' && <th>Site / Project</th>}
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={selectedSite === 'All' ? 4 : 3} style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>
                No expenses logged for {person}{selectedSite !== 'All' ? ` on ${selectedSite}` : ''} yet
              </td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{r.date || '—'}</td>
                {selectedSite === 'All' && (
                  <td><span style={{ fontWeight: 700, color }}>{r.siteName}</span></td>
                )}
                <td style={{ fontSize: '13px', color: 'var(--text3)' }}>{r.description || '—'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>-{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', fontSize: '13px' }}>
          <span style={{ color: 'var(--text3)' }}>{rows.length} entries</span>
          <span style={{ fontWeight: 800 }}>Total: <span style={{ color: '#ef4444' }}>{fmt(total)}</span></span>
        </div>
      )}
    </div>
  );
}

const SiteAccountsPage = ({ company }) => {
  const {
    siteAccounts, refreshSiteAccounts, refreshAccountDetails,
    leads, amcLeads,
    checkAccess, toast
  } = useAppContext();

  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [timeframe, setTimeframe] = useState('all');
  const [activeTab, setActiveTab] = useState('construction');
  const [showSummary, setShowSummary] = useState(true);
  const [transModal, setTransModal] = useState({ open: false, type: 'payment', siteId: null });
  const [addClientModal, setAddClientModal] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState({ open: false, siteName: null, invoices: [], generated: [] });
  const [invoiceUploadModal, setInvoiceUploadModal] = useState({ open: false, siteName: null });
  const [balEdit, setBalEdit] = useState(null); // { siteId, siteName, currentBalance }
  const [balValue, setBalValue] = useState('');

  const [newTrans, setNewTrans] = useState({ amount: '', desc: '', date: new Date().toISOString().split('T')[0], category: 'Materials', payMode: 'cash', paidTo: '', purchasedFrom: '' });
  const [clientSource, setClientSource] = useState('manual');
  const [newClientSearch, setNewClientSearch] = useState('');
  const [manualClient, setManualClient] = useState({ name: '', location: '', type: '', budget: '', contact: '' });
  const [invoiceForm, setInvoiceForm] = useState({ number: '', amount: '', date: new Date().toISOString().split('T')[0], description: '', file: null });

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
    if (tf === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (tf === 'quarterly') return Math.floor(d.getMonth() / 3) === Math.floor(now.getMonth() / 3) && d.getFullYear() === now.getFullYear();
    if (tf === 'yearly') return d.getFullYear() === now.getFullYear();
    return true;
  };

  const getGlobalStats = (accounts) => {
    let totalIn = 0, totalOut = 0;
    accounts.forEach(s => {
      let siteIn = 0, siteOut = 0;
      if (company === 'm2a') {
        const payments = (s.m2a?.payments || []).filter(p => isDateInTimeframe(p.date, timeframe));
        const expenditures = (s.m2a?.expenditures || []).filter(e => isDateInTimeframe(e.date, timeframe));
        siteIn = payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) : (timeframe === 'all' ? (s.totalIn || 0) : 0);
        siteOut = expenditures.length > 0 ? expenditures.reduce((sum, e) => sum + e.amount, 0) : (timeframe === 'all' ? (s.totalOut || 0) : 0);
      } else {
        const data = activeTab === 'construction' ? s.elitePool?.construction : s.elitePool?.amc;
        const payments = (data?.payments || []).filter(p => isDateInTimeframe(p.date, timeframe));
        const expenditures = (data?.expenditures || []).filter(e => isDateInTimeframe(e.date, timeframe));
        siteIn = payments.length > 0 ? payments.reduce((sum, p) => sum + p.amount, 0) : (timeframe === 'all' ? (s.projectType === activeTab ? (s.totalIn || 0) : 0) : 0);
        siteOut = expenditures.length > 0 ? expenditures.reduce((sum, e) => sum + e.amount, 0) : (timeframe === 'all' ? (s.projectType === activeTab ? (s.totalOut || 0) : 0) : 0);
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
          await axios.put(`/m2a_accouts/update_account/${encodeURIComponent(site.siteName)}`, `amount=${amt}&payment_date=${newTrans.date}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        } else {
          const m2aMap = { 'Materials': 'material', 'Labour': 'labour', 'Transport': 'transport', 'Equipment': 'equipment', 'Petty Cash': 'miscellaneous', 'Other': 'miscellaneous' };
          await axios.put(`/m2a_accouts/add_expenses/${encodeURIComponent(site.siteName)}`, `amount=${amt}&expense_type=${m2aMap[newTrans.category] || 'miscellaneous'}&expense_date=${newTrans.date}&description=${newTrans.desc}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        }
      } else {
        if (transModal.type === 'payment') {
          await axios.put(`/elite-pool-accounts/add_payment/${encodeURIComponent(site.siteName)}`, `amount=${amt}&payment_date=${newTrans.date}&pay_mode=${newTrans.payMode}`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        } else {
          const catMap = { 'Materials': 'materials', 'Labour': 'labour', 'Transport': 'transport', 'Equipment': 'equipment', 'Other': 'miscellaneous', 'Petty Cash': 'miscellaneous' };
          const expParams = new URLSearchParams({ amount: amt, expense_type: catMap[newTrans.category] || 'miscellaneous', expense_date: newTrans.date, description: newTrans.desc, pay_mode: newTrans.payMode, paid_to: newTrans.paidTo, purchased_from: newTrans.purchasedFrom });
          await axios.put(`/elite-pool-accounts/add_expenses/${encodeURIComponent(site.siteName)}`, expParams.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        }
      }
      toast(`✅ ${transModal.type === 'payment' ? 'Payment' : 'Expense'} recorded`, 'success');
      setTransModal({ open: false });
      setNewTrans({ amount: '', desc: '', date: new Date().toISOString().split('T')[0], category: 'Materials', payMode: 'cash', paidTo: '', purchasedFrom: '' });
      await refreshAccountDetails(site.siteName, company);
      refreshSiteAccounts();
    } catch (err) {
      console.error(err);
      toast('Failed to record transaction', 'error');
    }
  };

  const handleAdjustBalance = async () => {
    if (!balEdit) return;
    const target = parseFloat(balValue);
    if (isNaN(target)) { toast('Enter a valid amount', 'error'); return; }
    const diff = target - balEdit.currentBalance;
    if (diff === 0) { setBalEdit(null); setBalValue(''); return; }
    const today = new Date().toISOString().split('T')[0];
    try {
      if (diff > 0) {
        const fd = new URLSearchParams({ amount: diff, payment_date: today, pay_mode: 'cash' });
        await axios.put(`/elite-pool-accounts/add_payment/${encodeURIComponent(balEdit.siteName)}`, fd.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      } else {
        const fd = new URLSearchParams({ amount: Math.abs(diff), expense_type: 'miscellaneous', expense_date: today, description: 'Balance Adjustment' });
        await axios.put(`/elite-pool-accounts/add_expenses/${encodeURIComponent(balEdit.siteName)}`, fd.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      }
      toast('Balance updated', 'success');
      setBalEdit(null); setBalValue('');
      await refreshAccountDetails(balEdit.siteName, company);
      refreshSiteAccounts();
    } catch (err) {
      toast(err?.response?.data?.detail || 'Adjustment failed', 'error');
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

  const handleViewInvoices = async (siteName) => {
    let uploaded = [], generated = [];
    try { const r = await axios.get(`/elite-pool-accounts/invoices/${encodeURIComponent(siteName)}`); uploaded = r.data || []; } catch (_) {}
    try { const r = await axios.get(`/invoices/by-project/${encodeURIComponent(siteName)}`); generated = r.data || []; } catch (_) {}
    setInvoiceModal({ open: true, siteName, invoices: uploaded, generated });
  };

  const handleUploadInvoice = async () => {
    if (!invoiceForm.file) { toast('Please select a file', 'error'); return; }
    const formData = new FormData();
    formData.append('file', invoiceForm.file);
    if (invoiceForm.number) formData.append('invoice_number', invoiceForm.number);
    if (invoiceForm.amount) formData.append('amount', invoiceForm.amount);
    if (invoiceForm.date) formData.append('invoice_date', invoiceForm.date);
    if (invoiceForm.description) formData.append('description', invoiceForm.description);
    try {
      await axios.post(`/elite-pool-accounts/upload-invoice/${encodeURIComponent(invoiceUploadModal.siteName)}`, formData);
      toast('Invoice uploaded', 'success');
      setInvoiceUploadModal({ open: false, siteName: null });
      setInvoiceForm({ number: '', amount: '', date: new Date().toISOString().split('T')[0], description: '', file: null });
      refreshSiteAccounts();
      handleViewInvoices(invoiceUploadModal.siteName);
    } catch (err) {
      toast('Upload failed', 'error');
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      await axios.delete(`/elite-pool-accounts/invoice/${invoiceId}`);
      toast('Invoice deleted', 'warn');
      setInvoiceModal(prev => ({ ...prev, invoices: prev.invoices.filter(i => i.id !== invoiceId) }));
    } catch (err) {
      toast('Delete failed', 'error');
    }
  };

  const filtered = siteAccounts.filter(s => {
    const matchesSearch = (s.siteName || '').toLowerCase().includes((search || '').toLowerCase());
    if (company === 'elitePool') return matchesSearch && s.isElitePool && s.projectType === activeTab;
    if (company === 'm2a') return matchesSearch && s.isM2A;
    return matchesSearch;
  });

  const stats = getGlobalStats(filtered);

  const renderLeadSource = () => {
    const source = clientSource;
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
          <input type="text" className="fi" placeholder="🔍 Search by name or ID..." value={newClientSearch} onChange={e => setNewClientSearch(e.target.value)} />
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg2)' }}>
          {filteredLeads.map(l => (
            <div key={l.id} style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14px' }}>{l.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{l.id} • {l.loc || 'No location'}</div>
              </div>
              <button className="btn btn-sky btn-sm" onClick={() => handleAddClient(l, source)}>Select Client</button>
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
      {/* Header */}
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <div className="ph-title" style={{ fontSize: '24px', fontWeight: 800 }}>{company === 'm2a' ? 'M2A Ledger' : 'Elite Pool Accounts'}</div>
          <div className="ph-sub" style={{ fontSize: '13px', color: 'var(--text2)' }}>Financial project tracking and site expenditure management</div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="fs" style={{ width: '150px', margin: 0, height: '38px', padding: '0 12px', fontSize: '13px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)' }} value={timeframe} onChange={e => setTimeframe(e.target.value)}>
            <option value="all">All Time</option>
            <option value="monthly">This Month</option>
            <option value="quarterly">This Quarter</option>
            <option value="yearly">This Year</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSummary(v => !v)} style={{ minWidth: '130px' }}>
            {showSummary ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Hide Summary</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Show Summary</>
            )}
          </button>
          <button className="btn btn-sky" onClick={() => { setClientSource('manual'); setAddClientModal(true); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
            Add Client
          </button>
        </div>
      </div>

      {/* Global Stats Cards */}
      {showSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          <div className="card stat" style={{ borderLeft: '4px solid var(--green)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Inflow</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green)' }}>{fmt(stats.totalIn)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Cumulative payments received</div>
          </div>
          <div className="card stat" style={{ borderLeft: '4px solid var(--red)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Expenses</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--red)' }}>{fmt(stats.totalOut)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Project related expenditures</div>
          </div>
          <div className="card stat" style={{ borderLeft: '4px solid var(--sky)' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Net Balance</div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: stats.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(stats.balance)}</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Current liquid project capital</div>
          </div>
        </div>
      )}

      {company === 'elitePool' && (
        <div className="tabs" style={{ marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'construction' ? 'btn-sky' : 'btn-ghost'}`} onClick={() => setActiveTab('construction')}>Construction Sites</button>
          <button className={`btn ${activeTab === 'amc' ? 'btn-sky' : 'btn-ghost'}`} onClick={() => setActiveTab('amc')}>AMC Sites</button>
          <button className="btn btn-ghost" onClick={() => setActiveTab('invoices')}
            style={{ background: activeTab === 'invoices' ? '#7c3aed' : '', color: activeTab === 'invoices' ? '#fff' : '', border: activeTab === 'invoices' ? '1px solid #7c3aed' : '' }}>
            🧾 Invoice Generator
          </button>
          <button className="btn btn-ghost" onClick={() => setActiveTab('ceo_log')}
            style={{ background: activeTab === 'ceo_log' ? '#7c3aed' : '', color: activeTab === 'ceo_log' ? '#fff' : '', border: activeTab === 'ceo_log' ? '1px solid #7c3aed' : '' }}>
            👤 CEO Log
          </button>
          <button className="btn btn-ghost" onClick={() => setActiveTab('admin_log')}
            style={{ background: activeTab === 'admin_log' ? '#0369a1' : '', color: activeTab === 'admin_log' ? '#fff' : '', border: activeTab === 'admin_log' ? '1px solid #0369a1' : '' }}>
            👤 Admin Log
          </button>
        </div>
      )}

      {company === 'elitePool' && activeTab === 'invoices' && (
        <InvoiceGeneratorPage />
      )}

      {company === 'elitePool' && (activeTab === 'ceo_log' || activeTab === 'admin_log') && (
        <PersonExpenseLog person={activeTab === 'ceo_log' ? 'CEO' : 'Admin'} siteAccounts={siteAccounts} fmt={fmt} />
      )}

      {(company !== 'elitePool' || (activeTab !== 'invoices' && activeTab !== 'ceo_log' && activeTab !== 'admin_log')) && <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <SearchBar value={search} onChange={setSearch} placeholder="Search site account..." />
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Total Received</th>
                <th>Total Spent</th>
                <th>Net Balance</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const { totalIn, totalOut, balance } = getRowTotals(s);
                return (
                  <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/accounts/${company === 'm2a' ? 'm2a' : 'elitepool'}/${encodeURIComponent(s.siteName)}`)}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {s.siteName}
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{s.location}</div>
                    </td>
                    <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmt(totalIn)}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 600 }}>{fmt(totalOut)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>{fmt(balance)}</span>
                        {company === 'elitePool' && (
                          <button onClick={() => { setBalEdit({ siteId: s.id, siteName: s.siteName, currentBalance: balance }); setBalValue(String(balance)); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: '2px', display: 'flex', opacity: 0.6 }} title="Adjust balance">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {company === 'elitePool' && (
                          <>
                            <button className="btn btn-ghost btn-sm" title="View uploaded invoices" onClick={() => handleViewInvoices(s.siteName)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                              Invoice
                            </button>
                            <button
                              title="Generate GST Invoice for this site"
                              onClick={() => navigate('/invoice-generator', { state: { project: s.siteName } })}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '5px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>
                              Gen Invoice
                            </button>
                          </>
                        )}
                        <button className="btn btn-sky btn-sm" onClick={() => setTransModal({ open: true, type: 'payment', siteId: s.id })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Pay
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => setTransModal({ open: true, type: 'expense', siteId: s.id })}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Exp
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text3)', padding: '60px' }}>No site accounts match your search</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Add Client Modal */}
      <Modal open={addClientModal} onClose={() => setAddClientModal(false)} title={<span>Add New Client to Ledger</span>} wide>
        {company !== 'm2a' && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: 'var(--bg3)', padding: '4px', borderRadius: '8px' }}>
            <button className={`btn ${clientSource === 'manual' ? 'btn-sky' : 'btn-ghost'} btn-sm`} style={{ flex: 1 }} onClick={() => setClientSource('manual')}>Manual Entry</button>
            <button className={`btn ${clientSource === 'con_lead' ? 'btn-sky' : 'btn-ghost'} btn-sm`} style={{ flex: 1 }} onClick={() => setClientSource('con_lead')}>Construction Leads</button>
            <button className={`btn ${clientSource === 'amc_lead' ? 'btn-sky' : 'btn-ghost'} btn-sm`} style={{ flex: 1 }} onClick={() => setClientSource('amc_lead')}>AMC Leads</button>
          </div>
        )}
        {clientSource === 'manual' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="fg"><label className="fl">Client Name</label><input className="fi" placeholder="Full name" value={manualClient.name} onChange={e => setManualClient({ ...manualClient, name: e.target.value })} /></div>
            <div className="fg"><label className="fl">Project Location</label><input className="fi" placeholder="Area / City" value={manualClient.location} onChange={e => setManualClient({ ...manualClient, location: e.target.value })} /></div>
            <div className="fg"><label className="fl">Project Type</label><input className="fi" placeholder="e.g. Infinity Pool" value={manualClient.type} onChange={e => setManualClient({ ...manualClient, type: e.target.value })} /></div>
            <div className="fg"><label className="fl">Initial Budget (₹)</label><input className="fi" placeholder="Approx project value" value={manualClient.budget} onChange={e => setManualClient({ ...manualClient, budget: e.target.value })} /></div>
            <div className="fg" style={{ gridColumn: 'span 2' }}><label className="fl">Contact Details</label><input className="fi" placeholder="Phone or Email" value={manualClient.contact} onChange={e => setManualClient({ ...manualClient, contact: e.target.value })} /></div>
            <div style={{ gridColumn: 'span 2', textAlign: 'right', marginTop: '12px' }}>
              <button className="btn btn-sky" onClick={() => handleAddClient(manualClient, 'manual')}>Create Client Entry</button>
            </div>
          </div>
        ) : renderLeadSource()}
      </Modal>

      {/* Transaction Modal */}
      <Modal open={transModal.open} onClose={() => setTransModal({ open: false })} title={<span>{transModal.type === 'payment' ? 'Record Inward Payment' : 'Record Site Expense'}</span>} footer={
        <>
          <button className="btn btn-ghost" onClick={() => setTransModal({ open: false })}>Cancel</button>
          <button className={`btn ${transModal.type === 'payment' ? 'btn-sky' : 'btn-red'}`} onClick={handleAddTrans}>Save Transaction</button>
        </>
      }>
        <div className="fg"><label className="fl">Amount (₹)</label><input className="fi" type="number" placeholder="0.00" value={newTrans.amount} onChange={e => setNewTrans({ ...newTrans, amount: e.target.value })} /></div>
        <div className="fg"><label className="fl">Description / Source</label><input className="fi" placeholder={transModal.type === 'payment' ? 'e.g. Client Installment' : 'e.g. Cement Purchase'} value={newTrans.desc} onChange={e => setNewTrans({ ...newTrans, desc: e.target.value })} /></div>
        <div className="fr" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg"><label className="fl">Transaction Date</label><input className="fi" type="date" value={newTrans.date} onChange={e => setNewTrans({ ...newTrans, date: e.target.value })} /></div>
          {transModal.type === 'payment' && (
            <div className="fg"><label className="fl">Pay Mode</label>
              <select className="fs" value={newTrans.payMode} onChange={e => setNewTrans({ ...newTrans, payMode: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="net_banking">Net Banking</option>
              </select>
            </div>
          )}
          {transModal.type === 'expense' && (
            <div className="fg"><label className="fl">Category</label>
              <select className="fs" value={newTrans.category} onChange={e => setNewTrans({ ...newTrans, category: e.target.value })}>
                <option>Materials</option><option>Labour</option><option>Equipment</option><option>Transport</option><option>Petty Cash</option><option>Other</option>
              </select>
            </div>
          )}
        </div>
        {transModal.type === 'expense' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="fg"><label className="fl">Pay Mode</label>
              <select className="fs" value={newTrans.payMode} onChange={e => setNewTrans({ ...newTrans, payMode: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="net_banking">Net Banking</option>
              </select>
            </div>
            <div className="fg"><label className="fl">To Whom Paid</label>
              <input className="fi" placeholder="e.g. Raju Contractor" value={newTrans.paidTo} onChange={e => setNewTrans({ ...newTrans, paidTo: e.target.value })} />
            </div>
            {newTrans.category === 'Equipment' && (
              <div className="fg" style={{ gridColumn: 'span 2' }}><label className="fl">Purchased From (Vendor / Shop)</label>
                <input className="fi" placeholder="e.g. Hyderabad Tools Mart" value={newTrans.purchasedFrom} onChange={e => setNewTrans({ ...newTrans, purchasedFrom: e.target.value })} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Invoice List Modal (EP only) */}
      <InvoiceLogModal
        open={invoiceModal.open}
        siteName={invoiceModal.siteName}
        uploaded={invoiceModal.invoices}
        generated={invoiceModal.generated}
        onClose={() => setInvoiceModal({ open: false, siteName: null, invoices: [], generated: [] })}
        onUpload={async () => { setInvoiceModal(prev => ({ ...prev, open: false })); setInvoiceUploadModal({ open: true, siteName: invoiceModal.siteName }); try { const { data } = await axios.get('/invoices/next-number'); setInvoiceForm(prev => ({ ...prev, number: data.invoice_no })); } catch {} }}
        onDeleteUploaded={handleDeleteInvoice}
        fmt={fmt}
      />

      {/* Invoice Upload Modal */}
      <Modal open={invoiceUploadModal.open} onClose={() => setInvoiceUploadModal({ open: false, siteName: null })} title={<span>Upload Invoice — {invoiceUploadModal.siteName}</span>} footer={
        <>
          <button className="btn btn-ghost" onClick={() => setInvoiceUploadModal({ open: false, siteName: null })}>Cancel</button>
          <button className="btn btn-sky" onClick={handleUploadInvoice}>Upload Invoice</button>
        </>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg"><label className="fl">Invoice Number</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input className="fi" placeholder="EPB-001" value={invoiceForm.number} onChange={e => setInvoiceForm({ ...invoiceForm, number: e.target.value })} style={{ flex: 1 }} />
              <button type="button" onClick={async () => { try { const { data } = await axios.get('/invoices/next-number'); setInvoiceForm(prev => ({ ...prev, number: data.invoice_no })); } catch {} }} style={{ padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>Auto</button>
            </div>
          </div>
          <div className="fg"><label className="fl">Amount (₹)</label><input className="fi" type="number" placeholder="0.00" value={invoiceForm.amount} onChange={e => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} /></div>
          <div className="fg"><label className="fl">Invoice Date</label><input className="fi" type="date" value={invoiceForm.date} onChange={e => setInvoiceForm({ ...invoiceForm, date: e.target.value })} /></div>
          <div className="fg"><label className="fl">Description</label><input className="fi" placeholder="Invoice notes" value={invoiceForm.description} onChange={e => setInvoiceForm({ ...invoiceForm, description: e.target.value })} /></div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="fl">Invoice File (PDF / Image)</label>
            <input className="fi" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setInvoiceForm({ ...invoiceForm, file: e.target.files[0] })} />
          </div>
        </div>
      </Modal>

      {/* Adjust Net Balance Modal */}
      <Modal
        open={!!balEdit}
        onClose={() => { setBalEdit(null); setBalValue(''); }}
        title={<span>Adjust Net Balance — {balEdit?.siteName}</span>}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => { setBalEdit(null); setBalValue(''); }}>Cancel</button>
            <button className="btn btn-sky" onClick={handleAdjustBalance}>Apply</button>
          </>
        }
      >
        {balEdit && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg3)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
              <span style={{ color: 'var(--text3)' }}>Current Balance</span>
              <span style={{ fontWeight: 700, color: balEdit.currentBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(balEdit.currentBalance)}</span>
            </div>
            <div className="fg">
              <label className="fl">Set New Net Balance (₹)</label>
              <input className="fi" type="number" value={balValue} onChange={e => setBalValue(e.target.value)} autoFocus />
            </div>
            {balValue !== '' && parseFloat(balValue) !== balEdit.currentBalance && (
              <div style={{ marginTop: '10px', padding: '8px 14px', borderRadius: '8px', background: parseFloat(balValue) > balEdit.currentBalance ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', fontSize: '12px', fontWeight: 700, color: parseFloat(balValue) > balEdit.currentBalance ? 'var(--green)' : 'var(--red)' }}>
                Adjustment: {parseFloat(balValue) > balEdit.currentBalance ? '+' : ''}{fmt(parseFloat(balValue) - balEdit.currentBalance)}
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default SiteAccountsPage;
