import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAppContext } from '../context/AppContext';
import { useLocation } from 'react-router-dom';

const COMPANY = {
  name:    'ELITE POOL BUILDER',
  address: '10-3-277/2, FLAT NO-102, MANPREET ENCLAVE,\nHYDERABAD TS - PIN - 500028',
  gst:     '36AALFE1980A1ZN',
  state:   'Telangana',
  code:    '36',
  phone:   '7799550890',
  email:   'info@elitepoolbuilder.in',
  website: 'https://elitepoolbuilder.in',
  bank:    {
    name:  'Elite Pool Builder',
    acc:   '7788893916',
    bank:  'INDIAN BANK',
    ifsc:  'IDIB000M270',
  },
};

const TERMS = [
  'Prices are subject to change based on the condition and size of the pool.',
  '100% Advance payment before starting the work.',
  'Payment terms and schedules will be discussed and agreed upon before commencement of services.',
  'Clients will be notified in advance of any additional charges for repairs or upgrades.',
];

const emptyItem = () => ({ description: '', hsn: '84212190', qty: 1, unit: '', rate: '', amount: 0 });

const emptyForm = () => ({
  invoice_no: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  gr_no: '',
  order_no: '',
  project: '',
  state: 'Telangana',
  state_code: '36',
  bill_to_name: '',
  bill_to_address: '',
  bill_to_gstin: '',
  ship_to_same: true,
  ship_to_name: '',
  ship_to_address: '',
  ship_to_gstin: '',
  gst_type: 'cgst_sgst',   // or 'igst'
  gst_rate: 9,
  notes: '',
  billed_by: 'CEO',
});

// Number to Indian words
function numToWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n === 0) return 'Zero';
  const convert = (num) => {
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + (num % 10 ? ' ' + a[num % 10] : '');
    if (num < 1000) return a[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 100000) return convert(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + convert(num % 1000) : '');
    if (num < 10000000) return convert(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + convert(num % 100000) : '');
    return convert(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 ? ' ' + convert(num % 10000000) : '');
  };
  const [intPart, decPart] = String(n.toFixed(2)).split('.');
  let words = convert(parseInt(intPart)) + ' Rupees';
  if (parseInt(decPart) > 0) words += ' and ' + convert(parseInt(decPart)) + ' Paise';
  return words + ' Only';
}

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : '-';

export default function InvoiceGeneratorPage() {
  const { user, siteAccounts, refreshSiteAccounts } = useAppContext();
  const location = useLocation();
  const [form, setForm]         = useState(() => {
    const f = emptyForm();
    if (location.state?.project) f.project = location.state.project;
    return f;
  });
  const [items, setItems]       = useState([emptyItem()]);
  const [showPreview, setShowPreview] = useState(false);
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [tab, setTab]           = useState('new'); // 'new' | 'saved'
  const [savedFilter, setSavedFilter] = useState('All');
  const [epSites, setEpSites]   = useState([]);
  const previewRef              = useRef(null);

  const fetchSaved = useCallback(async () => {
    try { const { data } = await axios.get('/invoices/all'); setSavedInvoices(data); }
    catch { setSavedInvoices([]); }
  }, []);

  useEffect(() => { fetchSaved(); }, [fetchSaved]);

  useEffect(() => {
    // Merge sites from context (already loaded) + API to get every EP site
    const fromContext = (siteAccounts || [])
      .filter(s => s.isElitePool)
      .map(s => s.siteName)
      .filter(Boolean);

    axios.get('/elite-pool-accounts/all_ep_accounts').then(r => {
      const fromApi = (r.data || []).map(s => s.site_name).filter(Boolean);
      const merged = [...new Set([...fromContext, ...fromApi])].sort((a, b) => a.localeCompare(b));
      setEpSites(merged);
    }).catch(() => {
      const fallback = [...new Set(fromContext)].sort((a, b) => a.localeCompare(b));
      setEpSites(fallback);
    });
  }, [siteAccounts]);

  // ── calculations ──
  const subTotal  = items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const gstAmt    = +(subTotal * Number(form.gst_rate) / 100).toFixed(2);
  const cgst      = form.gst_type === 'cgst_sgst' ? gstAmt : 0;
  const sgst      = form.gst_type === 'cgst_sgst' ? gstAmt : 0;
  const igst      = form.gst_type === 'igst'      ? gstAmt * 2 : 0;
  const rawTotal  = subTotal + cgst + sgst + igst;
  const roundOff  = +(Math.round(rawTotal) - rawTotal).toFixed(2);
  const total     = +(rawTotal + roundOff).toFixed(2);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const updateItem = (i, k, v) => {
    setItems(prev => {
      const arr = [...prev];
      arr[i] = { ...arr[i], [k]: v };
      if (k === 'qty' || k === 'rate') {
        arr[i].amount = +(Number(arr[i].qty || 0) * Number(arr[i].rate || 0)).toFixed(2);
      }
      return arr;
    });
  };

  const addItem    = () => setItems(p => [...p, emptyItem()]);
  const removeItem = (i) => setItems(p => p.filter((_, idx) => idx !== i));

  const autoInvoiceNo = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const next = String(savedInvoices.length + 1).padStart(2, '0');
    setF('invoice_no', `INV${yy}-${yy + 1}EP-${next}`);
  };

  const handleSave = async () => {
    if (!form.invoice_no || !form.bill_to_name) {
      alert('Invoice No and Bill To Name are required'); return;
    }
    setSaving(true);
    try {
      const bill = form.ship_to_same;
      await axios.post('/invoices/create', {
        ...form,
        ship_to_name:    bill ? form.bill_to_name    : form.ship_to_name,
        ship_to_address: bill ? form.bill_to_address : form.ship_to_address,
        ship_to_gstin:   bill ? form.bill_to_gstin   : form.ship_to_gstin,
        items, sub_total: subTotal, cgst, sgst, igst, round_off: roundOff, total,
        created_by: user?.name || user?.username || 'Unknown',
        billed_by: form.billed_by || 'CEO',
      });
      alert('Invoice saved!');
      fetchSaved();
      refreshSiteAccounts?.();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg).join(', ')
        : detail || e.message || 'Save failed';
      alert(msg);
    } finally { setSaving(false); }
  };

  const handleDownload = async () => {
    const { default: html2pdf } = await import('html2pdf.js');
    html2pdf().set({
      margin: 0,
      filename: `${form.invoice_no || 'Invoice'}.pdf`,
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(previewRef.current).save();
  };

  const handlePrint = () => {
    const el = previewRef.current;
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${form.invoice_no}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;}@media print{body{margin:0;}}</style>
      </head><body>${el.outerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const handleDirectPrint = async () => {
    if (!form.invoice_no || !form.bill_to_name) {
      alert('Invoice No and Bill To Name are required to print'); return;
    }
    setSaving(true);
    try {
      const bill = form.ship_to_same;
      try {
        await axios.post('/invoices/create', {
          ...form,
          ship_to_name:    bill ? form.bill_to_name    : form.ship_to_name,
          ship_to_address: bill ? form.bill_to_address : form.ship_to_address,
          ship_to_gstin:   bill ? form.bill_to_gstin   : form.ship_to_gstin,
          items, sub_total: subTotal, cgst, sgst, igst, round_off: roundOff, total,
          created_by: user?.name || user?.username || 'Unknown',
          billed_by: form.billed_by || 'CEO',
        });
        fetchSaved();
        refreshSiteAccounts?.();
      } catch (e) {
        // if duplicate invoice_no, still allow print
        const detail = e?.response?.data?.detail || '';
        if (!String(detail).includes('already exists')) {
          alert(String(detail) || 'Save failed'); setSaving(false); return;
        }
      }
    } finally { setSaving(false); }

    setShowPreview(true);
    setTimeout(() => {
      if (!previewRef.current) return;
      const w = window.open('', '_blank');
      w.document.write(`<html><head><title>${form.invoice_no || 'Invoice'}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Arial,sans-serif;}@media print{body{margin:0;}}</style>
        </head><body>${previewRef.current.outerHTML}</body></html>`);
      w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 500);
    }, 350);
  };

  const loadSaved = (inv) => {
    setForm({
      invoice_no: inv.invoice_no, invoice_date: inv.invoice_date,
      due_date: inv.due_date || '', gr_no: inv.gr_no || '',
      order_no: inv.order_no || '', project: inv.project || '',
      state: inv.state || 'Telangana', state_code: inv.state_code || '36',
      bill_to_name: inv.bill_to_name, bill_to_address: inv.bill_to_address || '',
      bill_to_gstin: inv.bill_to_gstin || '',
      ship_to_same: inv.bill_to_name === inv.ship_to_name,
      ship_to_name: inv.ship_to_name || '', ship_to_address: inv.ship_to_address || '',
      ship_to_gstin: inv.ship_to_gstin || '',
      gst_type: inv.igst > 0 ? 'igst' : 'cgst_sgst',
      gst_rate: inv.gst_rate || 9, notes: inv.notes || '',
    });
    setItems(inv.items || [emptyItem()]);
    setTab('new');
    setShowPreview(true);
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    await axios.delete(`/invoices/delete/${id}`);
    fetchSaved();
  };

  const shipName    = form.ship_to_same ? form.bill_to_name    : form.ship_to_name;
  const shipAddress = form.ship_to_same ? form.bill_to_address : form.ship_to_address;
  const shipGstin   = form.ship_to_same ? form.bill_to_gstin   : form.ship_to_gstin;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text1)' }}>🧾 Invoice Generator</h1>
          <p style={{ fontSize: '13px', color: 'var(--text3)' }}>Generate GST Tax Invoices matching Elite Pool Builder format</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setTab('new')} style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid var(--border)', background: tab === 'new' ? '#3b82f6' : 'var(--bg2)', color: tab === 'new' ? '#fff' : 'var(--text2)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            + New Invoice
          </button>
          <button onClick={() => { setTab('saved'); fetchSaved(); }} style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid var(--border)', background: tab === 'saved' ? '#3b82f6' : 'var(--bg2)', color: tab === 'saved' ? '#fff' : 'var(--text2)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
            Saved Invoices ({savedInvoices.length})
          </button>
        </div>
      </div>

      {/* ── SAVED TAB ── */}
      {tab === 'saved' && (
        <div className="card" style={{ padding: '24px' }}>
          {/* CEO / Admin filter tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
            {['All', 'CEO', 'Admin'].map(role => {
              const count = role === 'All' ? savedInvoices.length : savedInvoices.filter(i => i.billed_by === role).length;
              const active = (savedFilter || 'All') === role;
              return (
                <button key={role} onClick={() => setSavedFilter(role)}
                  style={{ padding: '6px 18px', borderRadius: '20px', border: '1px solid var(--border)', fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                    background: active ? (role === 'CEO' ? '#7c3aed' : role === 'Admin' ? '#0369a1' : '#3b82f6') : 'var(--bg2)',
                    color: active ? '#fff' : 'var(--text3)' }}>
                  {role} ({count})
                </button>
              );
            })}
            <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text3)', alignSelf: 'center' }}>
              Total: ₹{fmt(savedInvoices.filter(i => savedFilter === 'All' || !savedFilter || i.billed_by === savedFilter).reduce((s, i) => s + Number(i.total || 0), 0))}
            </div>
          </div>

          {(() => {
            const filtered = savedInvoices.filter(i => !savedFilter || savedFilter === 'All' || i.billed_by === savedFilter);
            return filtered.length === 0 ? (
              <p style={{ color: 'var(--text3)', fontSize: '13px' }}>No invoices found.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    {['Invoice No', 'Date', 'Bill To', 'Project', 'Total', 'Billed By', 'Generated By', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text3)', fontSize: '12px', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px', fontWeight: 600, color: 'var(--text1)' }}>{inv.invoice_no}</td>
                      <td style={{ padding: '10px', color: 'var(--text2)' }}>{inv.invoice_date}</td>
                      <td style={{ padding: '10px', color: 'var(--text2)' }}>{inv.bill_to_name}</td>
                      <td style={{ padding: '10px', color: 'var(--text3)', fontSize: '12px' }}>{inv.project || '—'}</td>
                      <td style={{ padding: '10px', color: 'var(--text1)', fontWeight: 600 }}>₹{fmt(inv.total)}</td>
                      <td style={{ padding: '10px' }}>
                        {inv.billed_by ? (
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                            background: inv.billed_by === 'CEO' ? 'rgba(124,58,237,0.12)' : 'rgba(3,105,161,0.12)',
                            color: inv.billed_by === 'CEO' ? '#7c3aed' : '#0369a1' }}>
                            {inv.billed_by}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        {inv.created_by ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text2)' }}>
                            <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>
                              {inv.created_by.charAt(0).toUpperCase()}
                            </span>
                            {inv.created_by}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button onClick={() => loadSaved(inv)} style={{ marginRight: '6px', padding: '4px 12px', borderRadius: '4px', border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: '12px' }}>Open</button>
                        <button onClick={() => deleteInvoice(inv.id)} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {/* ── NEW INVOICE TAB ── */}
      {tab === 'new' && !showPreview && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '20px' }}>

          {/* Left — Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Invoice Details */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', color: 'var(--text1)' }}>Invoice Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={lbl}>Invoice No *</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input style={inp} value={form.invoice_no} onChange={e => setF('invoice_no', e.target.value)} placeholder="INV26-27EP-01" />
                    <button onClick={autoInvoiceNo} title="Auto-generate" style={{ padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>Auto</button>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Invoice Date</label>
                  <input style={inp} type="date" value={form.invoice_date} onChange={e => setF('invoice_date', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Due Date</label>
                  <input style={inp} type="date" value={form.due_date} onChange={e => setF('due_date', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Project (Site)</label>
                  <select style={inp} value={form.project} onChange={e => setF('project', e.target.value)}>
                    <option value="">-- Select Site --</option>
                    {epSites.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Billed By</label>
                  <select style={{ ...inp, fontWeight: 700, color: form.billed_by === 'CEO' ? '#7c3aed' : '#0369a1' }} value={form.billed_by} onChange={e => setF('billed_by', e.target.value)}>
                    <option value="CEO">CEO</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>G.R. No</label>
                  <input style={inp} value={form.gr_no} onChange={e => setF('gr_no', e.target.value)} placeholder="-" />
                </div>
                <div>
                  <label style={lbl}>Order No</label>
                  <input style={inp} value={form.order_no} onChange={e => setF('order_no', e.target.value)} placeholder="-" />
                </div>
                <div>
                  <label style={lbl}>State</label>
                  <input style={inp} value={form.state} onChange={e => setF('state', e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>State Code</label>
                  <input style={inp} value={form.state_code} onChange={e => setF('state_code', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Bill To / Ship To */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', color: 'var(--text1)' }}>Client Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Bill To — Name *</label>
                  <input style={inp} value={form.bill_to_name} onChange={e => setF('bill_to_name', e.target.value)} placeholder="Client / Company Name" />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Bill To — Address</label>
                  <textarea style={{ ...inp, height: '64px', resize: 'vertical' }} value={form.bill_to_address} onChange={e => setF('bill_to_address', e.target.value)} placeholder="Full address..." />
                </div>
                <div>
                  <label style={lbl}>GSTIN / UIN</label>
                  <input style={inp} value={form.bill_to_gstin} onChange={e => setF('bill_to_gstin', e.target.value)} placeholder="36XXXXX..." />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '18px' }}>
                  <input type="checkbox" id="same" checked={form.ship_to_same} onChange={e => setF('ship_to_same', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                  <label htmlFor="same" style={{ fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>Ship To same as Bill To</label>
                </div>
                {!form.ship_to_same && (<>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Ship To — Name</label>
                    <input style={inp} value={form.ship_to_name} onChange={e => setF('ship_to_name', e.target.value)} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={lbl}>Ship To — Address</label>
                    <textarea style={{ ...inp, height: '64px', resize: 'vertical' }} value={form.ship_to_address} onChange={e => setF('ship_to_address', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Ship To GSTIN</label>
                    <input style={inp} value={form.ship_to_gstin} onChange={e => setF('ship_to_gstin', e.target.value)} />
                  </div>
                </>)}
              </div>
            </div>

            {/* Line Items */}
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text1)' }}>Line Items</h3>
                <button onClick={addItem} style={{ padding: '5px 14px', borderRadius: '6px', border: '1px solid #3b82f6', background: 'rgba(59,130,246,.08)', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>+ Add Row</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {['#', 'Description of Services', 'HSN/SAC', 'Qty', 'Unit', 'Rate (₹)', 'Amount (₹)', ''].map(h => (
                        <th key={h} style={{ padding: '8px 8px', textAlign: 'left', color: 'var(--text3)', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', border: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i}>
                        <td style={td}>{i + 1}</td>
                        <td style={td}><textarea style={{ ...inp, height: '52px', width: '200px', resize: 'vertical', fontSize: '12px' }} value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} /></td>
                        <td style={td}><input style={{ ...inp, width: '90px', fontSize: '12px' }} value={it.hsn} onChange={e => updateItem(i, 'hsn', e.target.value)} /></td>
                        <td style={td}><input style={{ ...inp, width: '60px', fontSize: '12px' }} type="number" value={it.qty} onChange={e => updateItem(i, 'qty', e.target.value)} /></td>
                        <td style={td}><input style={{ ...inp, width: '60px', fontSize: '12px' }} value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} placeholder="SET" /></td>
                        <td style={td}><input style={{ ...inp, width: '90px', fontSize: '12px' }} type="number" value={it.rate} onChange={e => updateItem(i, 'rate', e.target.value)} /></td>
                        <td style={{ ...td, fontWeight: 600, color: 'var(--text1)' }}>₹{fmt(it.amount)}</td>
                        <td style={td}>
                          {items.length > 1 && <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }}>×</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right — Summary + GST */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', color: 'var(--text1)' }}>GST Settings</h3>
              <div style={{ marginBottom: '12px' }}>
                <label style={lbl}>GST Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[['cgst_sgst', 'CGST + SGST (Intra-state)'], ['igst', 'IGST (Inter-state)']].map(([v, l]) => (
                    <button key={v} onClick={() => setF('gst_type', v)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid', borderColor: form.gst_type === v ? '#3b82f6' : 'var(--border)', background: form.gst_type === v ? 'rgba(59,130,246,.1)' : 'var(--bg2)', color: form.gst_type === v ? '#3b82f6' : 'var(--text3)', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={lbl}>GST Rate per slab (%)</label>
                <input style={inp} type="number" value={form.gst_rate} onChange={e => setF('gst_rate', e.target.value)} placeholder="9" />
                <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
                  {form.gst_type === 'cgst_sgst' ? `CGST ${form.gst_rate}% + SGST ${form.gst_rate}% = ${form.gst_rate * 2}% total` : `IGST ${form.gst_rate * 2}% total`}
                </p>
              </div>
            </div>

            {/* Totals summary */}
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '14px', color: 'var(--text1)' }}>Summary</h3>
              {[
                ['Sub Total', subTotal],
                ...(form.gst_type === 'cgst_sgst' ? [['CGST @' + form.gst_rate + '%', cgst], ['SGST @' + form.gst_rate + '%', sgst]] : [['IGST @' + form.gst_rate * 2 + '%', igst]]),
                ['Round Off', roundOff],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text2)' }}>{label}</span>
                  <span style={{ color: 'var(--text1)', fontWeight: 500 }}>₹{fmt(val)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 4px', fontSize: '15px', fontWeight: 700 }}>
                <span style={{ color: 'var(--text1)' }}>Total Invoice Value</span>
                <span style={{ color: '#3b82f6' }}>₹{fmt(total)}</span>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', fontStyle: 'italic' }}>
                {numToWords(total)}
              </p>
            </div>

            <div className="card" style={{ padding: '20px' }}>
              <label style={lbl}>Additional Notes</label>
              <textarea style={{ ...inp, height: '80px', resize: 'vertical' }} value={form.notes} onChange={e => setF('notes', e.target.value)} placeholder="Any extra information..." />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => setShowPreview(true)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
                👁 Preview Invoice
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #10b981', background: 'rgba(16,185,129,.08)', color: '#10b981', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  {saving ? 'Saving…' : '💾 Save'}
                </button>
                <button onClick={handleDirectPrint} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #8b5cf6', background: 'rgba(139,92,246,.08)', color: '#8b5cf6', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                  🖨 Print
                </button>
              </div>
              <button onClick={() => { setForm(emptyForm()); setItems([emptyItem()]); }} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text3)', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                🔄 Reset Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW MODE ── */}
      {tab === 'new' && showPreview && (
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <button onClick={() => setShowPreview(false)} style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              ← Edit
            </button>
            <button onClick={handleDownload} style={{ padding: '9px 18px', borderRadius: '6px', border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              ⬇ Download PDF
            </button>
            <button onClick={handlePrint} style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #10b981', background: 'rgba(16,185,129,.08)', color: '#10b981', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              🖨 Print
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #f59e0b', background: 'rgba(245,158,11,.08)', color: '#f59e0b', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
              {saving ? 'Saving…' : '💾 Save'}
            </button>
          </div>

          {/* Invoice Preview — A4 size */}
          <div style={{ background: '#f0f2f5', padding: '30px', borderRadius: '8px', display: 'flex', justifyContent: 'center' }}>
            <div ref={previewRef} style={pvWrap}>
            <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '10.5px', lineHeight: '1.45', color: '#111', background: '#fff', width: '100%' }}>

              {/* ── HEADER ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
                <tbody><tr>
                  <td style={{ padding: '6px 0 4px', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src="/favicon.png" alt="Logo" style={{ height: '54px', width: '54px', objectFit: 'contain', borderRadius: '4px' }} onError={e => e.target.style.display='none'} />
                      <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a3c5e', fontStyle: 'italic', letterSpacing: '0.5px' }}>Elite pool Builder</div>
                        <div style={{ fontSize: '9px', color: '#666', marginTop: '1px' }}>{COMPANY.address.replace('\n', ', ')}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '6px' }}>
                    <div style={{ background: '#1a3c5e', color: '#fff', display: 'inline-block', padding: '8px 24px', fontSize: '14px', fontWeight: 800, letterSpacing: '2px', borderRadius: '2px' }}>TAX INVOICE</div>
                    <div style={{ marginTop: '6px', fontSize: '9.5px', color: '#555', textAlign: 'right', lineHeight: '1.6' }}>
                      <div><b>GST No:</b> {COMPANY.gst}</div>
                      <div><b>State:</b> {COMPANY.state} &nbsp; <b>Code:</b> {COMPANY.code}</div>
                    </div>
                  </td>
                </tr></tbody>
              </table>
              <div style={{ height: '3px', background: 'linear-gradient(90deg,#1a3c5e 0%,#2d7dd2 100%)', margin: '4px 0 0' }} />

              {/* ── INVOICE META + CONSIGNEE ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', tableLayout: 'fixed', marginTop: '0' }}>
                <colgroup>
                  <col style={{ width: '19%' }} /><col style={{ width: '14%' }} />
                  <col style={{ width: '33.5%' }} /><col style={{ width: '33.5%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td colSpan={2} style={{ border: '1px solid #c8d4e0', padding: '5px 7px', background: '#f0f4f8', fontSize: '9px', color: '#888', fontWeight: 700, letterSpacing: '0.5px' }}>INVOICE DETAILS</td>
                    <td style={{ border: '1px solid #c8d4e0', padding: '5px 7px', background: '#1a3c5e', color: '#fff', fontWeight: 700, fontSize: '10px' }}>Consignee (Bill to)</td>
                    <td style={{ border: '1px solid #c8d4e0', padding: '5px 7px', background: '#1a3c5e', color: '#fff', fontWeight: 700, fontSize: '10px' }}>Consignee (Ship to)</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #c8d4e0', padding: '4px 7px', color: '#666' }}>Invoice No:</td>
                    <td style={{ border: '1px solid #c8d4e0', padding: '4px 7px', fontWeight: 700, color: '#1a3c5e' }}>{form.invoice_no}</td>
                    <td rowSpan={8} style={{ border: '1px solid #c8d4e0', padding: '8px 10px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '4px', color: '#1a3c5e' }}>{form.bill_to_name}</div>
                      <div style={{ color: '#444', lineHeight: '1.6' }}>{(form.bill_to_address || '').split('\n').map((l, i) => <div key={i}>{l}</div>)}</div>
                      {form.bill_to_gstin && <div style={{ marginTop: '5px', paddingTop: '4px', borderTop: '1px dashed #ddd' }}><b>GSTIN/UIN:</b> {form.bill_to_gstin}</div>}
                    </td>
                    <td rowSpan={8} style={{ border: '1px solid #c8d4e0', padding: '8px 10px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 700, fontSize: '11px', marginBottom: '4px', color: '#1a3c5e' }}>{shipName}</div>
                      <div style={{ color: '#444', lineHeight: '1.6' }}>{(shipAddress || '').split('\n').map((l, i) => <div key={i}>{l}</div>)}</div>
                      {shipGstin && <div style={{ marginTop: '5px', paddingTop: '4px', borderTop: '1px dashed #ddd' }}><b>GSTIN/UIN:</b> {shipGstin}</div>}
                    </td>
                  </tr>
                  {[
                    ['Invoice Date:', fmtDate(form.invoice_date)],
                    ['Due Date:', fmtDate(form.due_date) || '-'],
                    ['G.R. No.:', form.gr_no || '-'],
                    ['Order No.:', form.order_no || '-'],
                    ['Project:', form.project || '-'],
                    ['State:', form.state],
                    ['State Code:', form.state_code],
                  ].map(([k, v]) => (
                    <tr key={k}>
                      <td style={{ border: '1px solid #c8d4e0', padding: '4px 7px', color: '#666' }}>{k}</td>
                      <td style={{ border: '1px solid #c8d4e0', padding: '4px 7px', fontWeight: 600, color: '#111' }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ── LINE ITEMS ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', tableLayout: 'fixed', marginTop: '10px' }}>
                <colgroup>
                  <col style={{ width: '5%' }} /><col style={{ width: '41%' }} />
                  <col style={{ width: '15%' }} /><col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} /><col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#1a3c5e', color: '#fff' }}>
                    {[['SL.\nNO','center'],['DESCRIPTION OF SERVICES','left'],['HSN/SAC CODE','center'],['QTY','center'],['RATE','right'],['AMOUNT (RS.)','right']].map(([h,a]) => (
                      <th key={h} style={{ padding: '7px 6px', textAlign: a, border: '1px solid #2d5a8a', fontWeight: 700, fontSize: '9.5px', letterSpacing: '0.3px', whiteSpace: 'pre-line' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.filter(it => it.description || it.amount).map((it, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f5f8fb' }}>
                      <td style={{ padding: '7px 5px', border: '1px solid #d0d8e4', textAlign: 'center', color: '#555' }}>{i + 1}</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #d0d8e4', wordBreak: 'break-word', fontWeight: 500 }}>
                        {(it.description || '').split('\n').map((l, j) => <div key={j}>{l}</div>)}
                      </td>
                      <td style={{ padding: '7px 5px', border: '1px solid #d0d8e4', textAlign: 'center', color: '#555' }}>{it.hsn}</td>
                      <td style={{ padding: '7px 5px', border: '1px solid #d0d8e4', textAlign: 'center' }}>{it.qty}{it.unit ? ' ' + it.unit : ''}</td>
                      <td style={{ padding: '7px 7px', border: '1px solid #d0d8e4', textAlign: 'right' }}>{Number(it.rate || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '7px 8px', border: '1px solid #d0d8e4', textAlign: 'right', fontWeight: 700 }}>{fmt(it.amount)}</td>
                    </tr>
                  ))}
                  {/* Spacer row for short lists */}
                  {items.filter(it => it.description || it.amount).length < 5 && (
                    <tr style={{ height: `${(5 - items.filter(it => it.description || it.amount).length) * 26}px` }}>
                      {[1,2,3,4,5,6].map(c => <td key={c} style={{ border: '1px solid #d0d8e4' }} />)}
                    </tr>
                  )}

                  {/* ── TOTALS ── */}
                  <tr style={{ background: '#f0f4f8' }}>
                    <td colSpan={5} style={{ padding: '6px 10px', border: '1px solid #c8d4e0', textAlign: 'right', fontWeight: 600, color: '#444' }}>Sub Total</td>
                    <td style={{ padding: '6px 8px', border: '1px solid #c8d4e0', textAlign: 'right', fontWeight: 700 }}>{fmt(subTotal)}</td>
                  </tr>
                  {form.gst_type === 'cgst_sgst' ? <>
                    <tr style={{ background: '#f7f9fb' }}>
                      <td colSpan={5} style={{ padding: '5px 10px', border: '1px solid #c8d4e0', textAlign: 'right', color: '#555' }}>CGST @ {form.gst_rate}%</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #c8d4e0', textAlign: 'right', fontWeight: 600 }}>{fmt(cgst)}</td>
                    </tr>
                    <tr style={{ background: '#f7f9fb' }}>
                      <td colSpan={5} style={{ padding: '5px 10px', border: '1px solid #c8d4e0', textAlign: 'right', color: '#555' }}>SGST @ {form.gst_rate}%</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #c8d4e0', textAlign: 'right', fontWeight: 600 }}>{fmt(sgst)}</td>
                    </tr>
                  </> : <tr style={{ background: '#f7f9fb' }}>
                    <td colSpan={5} style={{ padding: '5px 10px', border: '1px solid #c8d4e0', textAlign: 'right', color: '#555' }}>IGST @ {form.gst_rate * 2}%</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #c8d4e0', textAlign: 'right', fontWeight: 600 }}>{fmt(igst)}</td>
                  </tr>}
                  <tr style={{ background: '#f0f4f8' }}>
                    <td colSpan={5} style={{ padding: '5px 10px', border: '1px solid #c8d4e0', textAlign: 'right', color: '#555' }}>Round Off</td>
                    <td style={{ padding: '5px 8px', border: '1px solid #c8d4e0', textAlign: 'right', fontWeight: 600 }}>{roundOff >= 0 ? '+' : ''}{fmt(roundOff)}</td>
                  </tr>
                  <tr style={{ background: '#1a3c5e', color: '#fff' }}>
                    <td colSpan={5} style={{ padding: '8px 10px', border: '2px solid #1a3c5e', textAlign: 'right', fontWeight: 800, fontSize: '11.5px', letterSpacing: '0.3px' }}>TOTAL INVOICE VALUE</td>
                    <td style={{ padding: '8px 10px', border: '2px solid #1a3c5e', textAlign: 'right', fontWeight: 800, fontSize: '12px' }}>₹ {fmt(total)}</td>
                  </tr>
                </tbody>
              </table>

              {/* ── IN WORDS ── */}
              <div style={{ border: '1px solid #c8d4e0', borderTop: 'none', padding: '6px 10px', fontSize: '10px', background: '#fafbfc', display: 'flex', gap: '6px' }}>
                <span style={{ fontWeight: 700, color: '#1a3c5e', whiteSpace: 'nowrap' }}>Amount in Words:</span>
                <span style={{ color: '#333', fontStyle: 'italic' }}>{numToWords(total)} Only</span>
              </div>

              {/* ── TERMS + BANK ── */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '10px', tableLayout: 'fixed' }}>
                <colgroup><col style={{ width: '54%' }} /><col style={{ width: '46%' }} /></colgroup>
                <tbody><tr>
                  <td style={{ border: '1px solid #c8d4e0', padding: '8px 10px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, color: '#1a3c5e', marginBottom: '6px', fontSize: '10.5px', borderBottom: '1px solid #e0e7ef', paddingBottom: '4px' }}>Terms &amp; Conditions</div>
                    <ul style={{ paddingLeft: '14px', margin: 0, color: '#444', lineHeight: '1.7' }}>
                      {TERMS.map((t, i) => <li key={i}>{t}</li>)}
                      {form.notes && <li style={{ marginTop: '4px', color: '#333', fontWeight: 500 }}>{form.notes}</li>}
                    </ul>
                  </td>
                  <td style={{ border: '1px solid #c8d4e0', padding: '8px 10px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700, color: '#1a3c5e', marginBottom: '6px', fontSize: '10.5px', borderBottom: '1px solid #e0e7ef', paddingBottom: '4px' }}>PLEASE MAKE A PAYMENT TO</div>
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '10px' }}>
                      <tbody>
                        {[
                          ['Beneficiary Name', COMPANY.bank.name],
                          ['Account Number', COMPANY.bank.acc],
                          ['Bank Name', COMPANY.bank.bank],
                          ['IFSC Code', COMPANY.bank.ifsc],
                        ].map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ padding: '2px 0', color: '#666', width: '42%' }}>{k}</td>
                            <td style={{ padding: '2px 0', fontWeight: 700, color: '#111' }}>: {v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: '24px', textAlign: 'right', color: '#555', fontSize: '10px' }}>
                      <div style={{ marginBottom: '30px', fontStyle: 'italic' }}>For Elite Pool Builder</div>
                      <div style={{ borderTop: '1px solid #999', display: 'inline-block', paddingTop: '3px', minWidth: '110px', textAlign: 'center', color: '#444' }}>Authorised Signatory</div>
                    </div>
                  </td>
                </tr></tbody>
              </table>

              {/* ── THANK YOU BANNER ── */}
              <div style={{ background: 'linear-gradient(90deg,#1a3c5e 0%,#2d7dd2 100%)', color: '#fff', textAlign: 'center', padding: '7px', fontSize: '10.5px', fontWeight: 700, marginTop: '10px', letterSpacing: '0.5px' }}>
                ✦ Thank you for choosing Elite Pool Builder ✦
              </div>

              {/* ── FOOTER ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', fontSize: '8.5px', color: '#888', borderTop: '1px solid #e0e7ef', marginTop: '4px' }}>
                <span>🌐 {COMPANY.website}</span>
                <span>✉ {COMPANY.email}</span>
                <span>📞 {COMPANY.phone}</span>
              </div>

            </div>{/* end inner font-reset div */}
            </div>{/* end pvWrap */}
          </div>
        </div>
      )}
    </div>
  );
}

// Style helpers
const lbl = { display: 'block', fontSize: '11px', color: 'var(--text3)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' };
const inp = { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text1)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };
const td  = { padding: '6px 8px', border: '1px solid var(--border)', verticalAlign: 'middle' };
// A4 = 210mm × 297mm. At 96dpi screen: 794px × 1123px
const pvWrap = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '10.5px',
  lineHeight: '1.4',
  color: '#111111',
  background: '#ffffff',
  width: '794px',
  minHeight: '1123px',
  padding: '28px 32px',
  boxSizing: 'border-box',
  boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
  // reset all inherited CRM styles
  all: 'initial',
  display: 'block',
};
