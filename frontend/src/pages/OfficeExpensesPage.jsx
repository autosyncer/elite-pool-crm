import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/common/Modal';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const EXPENSE_TYPES = [
  { id: 'salaries', label: 'Staff Salaries', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
  { id: 'rent',     label: 'Rent & Utilities', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> },
  { id: 'petty',    label: 'Petty Cash',      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg> }
];

const fmt  = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmt2 = (n) => Number(n || 0).toLocaleString('en-IN');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const emptySlip = {
  month: MONTHS[new Date().getMonth()],
  year: String(new Date().getFullYear()),
  empName: '', empId: '', accountNo: '', bankName: '', designation: '', doj: '',
  grossWages: '', totalDays: '31', lopDays: '0', cl: '', leaves: '',
  balanceDeduction: '0', professionalTax: '0', salaryAdvance: '0',
};

const calcSlip = (s) => {
  const gross    = parseFloat(s.grossWages) || 0;
  const total    = parseInt(s.totalDays)    || 31;
  const lop      = parseInt(s.lopDays)      || 0;
  const paidDays = total - lop;
  const earned   = gross * (paidDays / total);

  const basic   = Math.round(earned * 0.40);
  const hra     = Math.round(basic  * 0.50);
  const conv    = Math.round(basic  * 0.25);
  const medical = Math.round(basic  * 0.25);
  const other   = earned - basic - hra - conv - medical;
  const totalEarnings = Math.round(earned);

  const balDed  = parseFloat(s.balanceDeduction) || 0;
  const profTax = parseFloat(s.professionalTax)  || 0;
  const salAdv  = parseFloat(s.salaryAdvance)     || 0;
  const totalDed = balDed + profTax + salAdv;
  const netSalary = totalEarnings - totalDed;

  return { paidDays, basic, hra, conv, medical, other: Math.round(other), totalEarnings, balDed, profTax, salAdv, totalDed, netSalary };
};

const OfficeExpensesPage = () => {
  const { officeExpenses, refreshOfficeExpenses, users, checkAccess, addNotification, toast } = useAppContext();

  const [activeType,   setActiveType]   = useState('salaries');
  const [addModal,     setAddModal]     = useState(false);
  const [empSearch,    setEmpSearch]    = useState('');
  const [empDdOpen,    setEmpDdOpen]    = useState(false);
  const [showSummary,  setShowSummary]  = useState(true);
  const [slipModal,    setSlipModal]    = useState(false);   // 'form' | 'preview' | false
  const [slip,         setSlip]         = useState(emptySlip);
  const [staffModal,   setStaffModal]   = useState(false);
  const [staffList,    setStaffList]    = useState([]);
  const [staffSearch,  setStaffSearch]  = useState('');
  const [staffForm,    setStaffForm]    = useState({ name:'', employee_id:'', designation:'', account_no:'', bank_name:'', doj:'', phone:'' });
  const [editStaff,    setEditStaff]    = useState(null);
  const [staffPhoto,   setStaffPhoto]   = useState(null);
  const [staffAadhar,  setStaffAadhar]  = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [slipStaffDD,  setSlipStaffDD]  = useState('');
  const [staffDdOpen,  setStaffDdOpen]  = useState(false);
  const [manualEarnings, setManualEarnings] = useState(false);
  const [earnings, setEarnings] = useState({ basic: '', hra: '', conv: '', medical: '', other: '' });
  const [salaryHistory, setSalaryHistory] = useState([]);
  const slipRef = useRef(null);

  const fetchStaff = async () => {
    try { const r = await axios.get('/staff-profiles/all'); setStaffList(r.data || []); } catch (_) {}
  };

  const fetchSalaryHistory = async () => {
    try { const r = await axios.get('/salary-history/all'); setSalaryHistory(r.data || []); } catch (_) {}
  };

  useEffect(() => { fetchStaff(); fetchSalaryHistory(); }, []);

  const resetStaffForm = () => {
    setStaffForm({ name:'', employee_id:'', designation:'', account_no:'', bank_name:'', doj:'', phone:'' });
    setStaffPhoto(null); setStaffAadhar(null); setPhotoPreview(null); setEditStaff(null);
  };

  const saveStaff = async () => {
    if (!staffForm.name) { toast('Name required', 'error'); return; }
    const fd = new FormData();
    Object.entries(staffForm).forEach(([k,v]) => { if (v) fd.append(k, v); });
    if (staffPhoto)  fd.append('photo',  staffPhoto);
    if (staffAadhar) fd.append('aadhar', staffAadhar);
    try {
      if (editStaff) { await axios.put(`/staff-profiles/update/${editStaff.id}`, fd); toast('Staff updated', 'success'); }
      else           { await axios.post('/staff-profiles/create', fd);               toast('Staff added',   'success'); }
      resetStaffForm();
      fetchStaff();
    } catch (_) { toast('Failed to save', 'error'); }
  };

  const deleteStaff = async (id, name) => {
    if (!window.confirm(`Delete profile for "${name}"?`)) return;
    try { await axios.delete(`/staff-profiles/delete/${id}`); toast('Deleted', 'warn'); fetchStaff(); }
    catch (_) { toast('Delete failed', 'error'); }
  };

  const selectStaffForSlip = (p) => {
    setSlip(prev => ({ ...prev, empName: p.name, empId: p.employee_id || '', designation: p.designation || '', accountNo: p.account_no || '', bankName: p.bank_name || '', doj: p.doj || '' }));
    setSlipStaffDD('');
    setStaffDdOpen(false);
  };

  const [form, setForm] = useState({ description: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] });

  if (!checkAccess('officeexpenses')) return <Navigate to="/dashboard" />;

  const totalSalary = salaryHistory.reduce((s, e) => s + (e.net_salary || 0), 0);
  const totalRent   = (officeExpenses.rent     || []).reduce((s, e) => s + e.amount, 0);
  const totalPetty  = (officeExpenses.petty    || []).reduce((s, e) => s + e.amount, 0);

  const autoCalc = calcSlip(slip);
  const calc = manualEarnings ? {
    ...autoCalc,
    basic:         parseFloat(earnings.basic)   || 0,
    hra:           parseFloat(earnings.hra)     || 0,
    conv:          parseFloat(earnings.conv)    || 0,
    medical:       parseFloat(earnings.medical) || 0,
    other:         parseFloat(earnings.other)   || 0,
    totalEarnings: (parseFloat(earnings.basic) || 0) + (parseFloat(earnings.hra) || 0) + (parseFloat(earnings.conv) || 0) + (parseFloat(earnings.medical) || 0) + (parseFloat(earnings.other) || 0),
    netSalary:     (parseFloat(earnings.basic) || 0) + (parseFloat(earnings.hra) || 0) + (parseFloat(earnings.conv) || 0) + (parseFloat(earnings.medical) || 0) + (parseFloat(earnings.other) || 0) - autoCalc.totalDed,
  } : autoCalc;

  const syncAutoToManual = () => {
    setEarnings({ basic: String(autoCalc.basic), hra: String(autoCalc.hra), conv: String(autoCalc.conv), medical: String(autoCalc.medical), other: String(autoCalc.other) });
  };

  const saveExpense = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || !form.description) { toast('Required fields missing', 'error'); return; }
    const categoryMap = { salaries: 'Staffing Salaries', rent: 'Office Rent / Utilities', petty: 'Petty Office Expenses' };
    const formData = new FormData();
    formData.append('category',     categoryMap[activeType]);
    formData.append('payee_name',   activeType === 'salaries' ? form.description : 'Office');
    formData.append('description',  form.description);
    formData.append('amount',       amt);
    formData.append('expense_date', form.date);
    if (form.note) formData.append('note', form.note);
    try {
      await axios.post('/office-expenses/add_office_expense/', formData);
      addNotification({ type: 'create', module: 'Office Overheads', action: 'Expense Added', message: `New ${EXPENSE_TYPES.find(t => t.id === activeType).label} of ${fmt(amt)} added`, entityId: activeType });
      toast('Expense recorded', 'success');
      setAddModal(false);
      setForm({ description: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] });
      setEmpSearch('');
      refreshOfficeExpenses();
    } catch (err) { toast('Failed to save expense', 'error'); }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Delete record for "${expense.description}"?`)) return;
    const categoryMap = { salaries: 'Staffing Salaries', rent: 'Office Rent / Utilities', petty: 'Petty Office Expenses' };
    try {
      const delCatMap = { salaries: 'Staffing Salaries', rent: 'Office Rent / Utilities', petty: 'Petty Office Expenses' };
      await axios.delete(`/office-expenses/delete_expense/${delCatMap[activeType]}/${expense.payee}`);
      addNotification({ type: 'delete', module: 'Office Overheads', action: 'Expense Deleted', message: `${EXPENSE_TYPES.find(t => t.id === activeType).label} record removed`, entityId: activeType });
      toast('Record deleted', 'warn');
      refreshOfficeExpenses();
    } catch (err) { toast('Failed to delete record', 'error'); }
  };

  const slipFileName = () => `PaySlip_${(slip.empName || 'Employee').replace(/\s+/g, '_')}_${slip.month}_${slip.year}`;

  const slipHtml = () => {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Pay Slip</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:11px;color:#111;background:#fff;padding:16px;}table{width:100%;border-collapse:collapse;}img{display:block;}@media print{body{padding:8px;}}</style>
    </head><body><div style="max-width:700px;margin:0 auto;border:1px solid #aaa;">${buildSlipBody()}</div></body></html>`;
  };

  const previewSlip = () => {
    const blob = new Blob([slipHtml()], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const buildSlipBody = () => {
    const rs  = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN')}`;
    const num = (n) => Number(n || 0).toLocaleString('en-IN');
    const logoUrl = `${window.location.origin}/favicon.png`;

    // All styles are fully inline — html2canvas ignores <style> blocks
    const TD  = 'border:1px solid #ccc;padding:5px 10px;font-size:11px;vertical-align:middle;';
    const TDG = `${TD}color:#555;`;
    const TDB = `${TD}font-weight:700;`;
    const TDR = `${TD}text-align:right;`;

    // Single colgroup used by ALL 4-column tables — ensures vertical borders align perfectly
    const COL4 = `<colgroup><col width="28%"/><col width="22%"/><col width="28%"/><col width="22%"/></colgroup>`;
    const TBL  = `width:100%;border-collapse:collapse;table-layout:fixed;`;

    return `
<table style="${TBL}border-bottom:2px solid #4a8dbf;">
  <colgroup><col width="13%"/><col width="87%"/></colgroup>
  <tbody><tr>
    <td style="padding:12px 10px;vertical-align:middle;border:none;">
      <img src="${logoUrl}" style="width:72px;height:72px;object-fit:contain;display:block;"/>
    </td>
    <td style="padding:10px 12px;vertical-align:middle;border:none;">
      <div style="font-size:23px;font-weight:900;color:#1a7ec4;text-transform:uppercase;letter-spacing:2px;line-height:1.1;">ELITE POOL BUILDER</div>
      <div style="font-size:9px;color:#555;margin-top:6px;line-height:1.75;">
        <b>Pillar No: 184 ATTAPUR, RAJENDRA NAGAR MANDAL</b><br/>
        Flat No:3 Second Floor 2-4-74/1 SAYEED MANZIL COMPLEX, Hyderabad, Telangana 500030,<br/>
        E-MAIL: info@elitepoolbuilder.in &nbsp;&nbsp;&nbsp; www.elitepoolbuilder.in
      </div>
    </td>
  </tr></tbody>
</table>

<div style="background:#4a8dbf;color:#fff;text-align:center;font-weight:bold;font-size:14px;padding:10px 0;letter-spacing:0.5px;">
  Pay Slip for ${slip.month} ${slip.year}
</div>

<table style="${TBL}">${COL4}
  <tbody>
    <tr><td style="${TDG}">Employee Name</td><td colspan="3" style="${TDB}">${slip.empName||''}</td></tr>
    <tr><td style="${TDG}">Employee ID</td><td style="${TD}">${slip.empId||''}</td><td style="${TDG}">Designation</td><td style="${TDB}">${slip.designation||''}</td></tr>
    <tr><td style="${TDG}">Account No.</td><td style="${TD}">${slip.accountNo||''}</td><td style="${TDG}">Bank Name</td><td style="${TD}">${slip.bankName||''}</td></tr>
    <tr><td style="${TDG}">Date of Joining</td><td colspan="3" style="${TD}">${slip.doj||''}</td></tr>
  </tbody>
</table>

<table style="${TBL}">${COL4}
  <tbody>
    <tr><td style="${TDG}">Gross Wages</td><td style="${TDR}">${rs(slip.grossWages)}</td><td style="${TDG}">CL</td><td style="${TD}color:#111;">${slip.cl||'—'}</td></tr>
    <tr><td style="${TDG}">Total Working Days</td><td style="${TDR}">${num(slip.totalDays)}</td><td style="${TDG}">Leaves</td><td style="${TD}color:#111;">${slip.leaves||'—'}</td></tr>
    <tr><td style="${TDG}">LOP Days</td><td style="${TDR}">${num(slip.lopDays)}</td><td style="${TDG}">Paid Days</td><td style="${TD}color:#111;font-weight:700;">${num(calc.paidDays)}</td></tr>
  </tbody>
</table>

<table style="${TBL}">${COL4}
  <tbody>
    <tr>
      <td colspan="2" style="${TD}background:#d0e4f5;font-weight:700;text-align:center;font-size:12px;color:#1a4f6e;">Earnings</td>
      <td colspan="2" style="${TD}background:#d0e4f5;font-weight:700;text-align:center;font-size:12px;color:#1a4f6e;">Deductions</td>
    </tr>
    <tr><td style="${TDG}">Basic</td><td style="${TDR}">${rs(calc.basic)}</td><td style="${TDG}">Balance Deduction</td><td style="${TDR}color:#111;">${calc.balDed>0?rs(calc.balDed):'—'}</td></tr>
    <tr><td style="${TDG}">HRA</td><td style="${TDR}">${rs(calc.hra)}</td><td style="${TDG}">Professional Tax</td><td style="${TDR}color:#111;">${calc.profTax>0?rs(calc.profTax):'—'}</td></tr>
    <tr><td style="${TDG}">Conveyance Allowance</td><td style="${TDR}">${rs(calc.conv)}</td><td style="${TDG}">Salary Advance</td><td style="${TDR}color:#111;">${calc.salAdv>0?rs(calc.salAdv):'—'}</td></tr>
    <tr><td style="${TDG}">Medical Allowance</td><td style="${TDR}">${rs(calc.medical)}</td><td colspan="2" style="${TD}"></td></tr>
    <tr><td style="${TDG}">Other Allowances</td><td style="${TDR}">${rs(calc.other)}</td><td colspan="2" style="${TD}"></td></tr>
    <tr>
      <td style="${TD}background:#f0f0f0;font-weight:700;color:#111;">Total Earnings</td>
      <td style="${TDR}background:#f0f0f0;font-weight:700;color:#111;">${rs(calc.totalEarnings)}</td>
      <td style="${TD}background:#f0f0f0;font-weight:700;color:#111;">Total Deductions</td>
      <td style="${TDR}background:#f0f0f0;font-weight:700;color:#111;">${rs(calc.totalDed)}</td>
    </tr>
    <tr>
      <td colspan="3" style="${TD}background:#4a8dbf;color:#fff;font-weight:700;font-size:13px;text-align:right;border-color:#3a7daf;">Net Salary</td>
      <td style="${TD}background:#4a8dbf;color:#fff;font-weight:700;font-size:13px;text-align:right;border-color:#3a7daf;">${rs(calc.netSalary)}</td>
    </tr>
  </tbody>
</table>

<table style="${TBL}margin-top:0;"><colgroup><col width="50%"/><col width="50%"/></colgroup>
  <tbody>
    <tr>
      <td style="${TD}padding:50px 16px 12px;vertical-align:bottom;font-weight:700;font-size:10px;letter-spacing:0.5px;">RECEIVED SIGNATURE</td>
      <td style="${TD}padding:12px 16px;text-align:center;vertical-align:bottom;">
        <img src="${logoUrl}" style="width:56px;height:56px;object-fit:contain;display:block;margin:0 auto 8px;"/>
        <div style="font-size:10px;font-weight:700;letter-spacing:0.5px;">Authorised Signatory</div>
      </td>
    </tr>
  </tbody>
</table>`;
  };

  const downloadPDF = async () => {
    if (!slipRef.current) { toast('Pay slip not ready', 'error'); return; }
    toast('Generating PDF…', 'success');

    // Clone the exact bordered slip element
    const clone = slipRef.current.cloneNode(true);
    clone.style.cssText = 'width:700px;background:#fff;font-family:Arial,sans-serif;font-size:11px;color:#111;border:1px solid #aaa;';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:700px;z-index:999999;background:#fff;padding:0;margin:0;';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Wait for images to load
    await Promise.all(Array.from(wrapper.querySelectorAll('img')).map(img =>
      new Promise(res => { if (img.complete && img.naturalWidth > 0) res(); else { img.onload = res; img.onerror = res; } })
    ));

    try {
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: 700,
        windowWidth: 700,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const usableW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * usableW;

      // Split across pages if taller than one A4 page
      let yPos = 0;
      let pdfY  = margin;
      const pxPerMm = canvas.width / usableW;
      while (yPos < canvas.height) {
        if (yPos > 0) { pdf.addPage(); pdfY = margin; }
        const sliceH = Math.min((pageH - margin * 2) * pxPerMm, canvas.height - yPos);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width  = canvas.width;
        sliceCanvas.height = sliceH;
        sliceCanvas.getContext('2d').drawImage(canvas, 0, yPos, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.98), 'JPEG', margin, pdfY, usableW, sliceH / pxPerMm);
        yPos += sliceH;
      }
      pdf.save(`${slipFileName()}.pdf`);
      toast('PDF downloaded!', 'success');
    } catch (err) {
      console.error('PDF error:', err);
      toast('PDF generation failed', 'error');
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  const printSlip = () => {
    const win = window.open('', '_blank');
    win.document.write(slipHtml());
    win.document.close();
    setTimeout(() => { win.print(); }, 300);
  };

  const filteredUsers = users.filter(u => {
    const name = u.full_name || u.username || u.name || '';
    return name.toLowerCase().includes(empSearch.toLowerCase());
  });

  const setS = (k, v) => setSlip(prev => ({ ...prev, [k]: v }));

  return (
    <div className="page" id="page_office">
      {/* Header */}
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Office Overheads</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Manage monthly expenses, rent, and staff salaries</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSummary(v => !v)}>
            {showSummary
              ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> Hide Summary</>
              : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Show Summary</>
            }
          </button>
          {activeType === 'salaries' ? (<>
            <button className="btn btn-ghost btn-sm" onClick={() => setStaffModal(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Manage Staff
            </button>
            <button className="btn btn-sky" onClick={() => { setSlip(emptySlip); setSlipStaffDD(''); setManualEarnings(false); setEarnings({ basic:'', hra:'', conv:'', medical:'', other:'' }); setSlipModal('form'); }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Generate Pay Slip
            </button>
          </>) : (
            <button className="btn btn-sky" onClick={() => setAddModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Log Expense
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {showSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
          {EXPENSE_TYPES.map(t => {
            const amount = t.id === 'salaries' ? totalSalary : t.id === 'rent' ? totalRent : totalPetty;
            const isActive = activeType === t.id;
            return (
              <div key={t.id} onClick={() => setActiveType(t.id)} className={`card stat ${isActive ? 'active' : ''}`} style={{ cursor: 'pointer', border: isActive ? '1px solid var(--sky)' : '1px solid var(--border)', background: isActive ? 'rgba(56,189,248,0.05)' : 'var(--bg2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: isActive ? 'var(--sky)' : 'var(--text3)' }}>{t.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{t.label}</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px' }}>{fmt(amount)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>{EXPENSE_TYPES.find(t => t.id === activeType).label} History</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeType === 'salaries' ? (
              <button className="btn btn-sky btn-sm" onClick={() => { setSlip(emptySlip); setSlipStaffDD(''); setManualEarnings(false); setEarnings({ basic:'', hra:'', conv:'', medical:'', other:'' }); setSlipModal('form'); }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Generate Pay Slip
              </button>
            ) : (
              <button className="btn btn-sky btn-sm" onClick={() => setAddModal(true)}>+ Add Record</button>
            )}
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Employee</th><th>Amount</th><th>Note</th><th style={{ textAlign: 'right' }}>Action</th></tr>
            </thead>
            <tbody>
              {activeType === 'salaries' ? (
                salaryHistory.length > 0 ? salaryHistory.map((e) => (
                  <tr key={e.id}>
                    <td className="mono" style={{ fontSize: '11px' }}>{e.month} {e.year}</td>
                    <td style={{ fontWeight: 600 }}>
                      {e.employee_name}
                      {e.designation && <div style={{ fontSize: '10px', color: 'var(--text3)' }}>{e.designation} {e.employee_id && `• ${e.employee_id}`}</div>}
                    </td>
                    <td>
                      <div style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(e.net_salary)}</div>
                      {e.total_earnings !== e.net_salary && <div style={{ fontSize: '10px', color: 'var(--text3)' }}>Gross: {fmt(e.total_earnings)}</div>}
                    </td>
                    <td style={{ fontSize: '11px', color: 'var(--text3)' }}>{e.note || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" style={{ color: '#25a244' }}
                          onClick={() => {
                            const profile = staffList.find(p => p.name.toLowerCase() === e.employee_name.toLowerCase());
                            setSlip({
                              ...emptySlip,
                              empName:    e.employee_name,
                              empId:      e.employee_id || profile?.employee_id || '',
                              designation: e.designation || profile?.designation || '',
                              accountNo:  profile?.account_no || '',
                              bankName:   profile?.bank_name  || '',
                              doj:        profile?.doj        || '',
                              grossWages: String(e.gross_wages),
                              totalDays:  String(e.total_days),
                              lopDays:    String(e.lop_days),
                              month:      e.month,
                              year:       e.year,
                              salaryAdvance:    String(e.salary_advance),
                              balanceDeduction: String(e.balance_deduction),
                              professionalTax:  String(e.professional_tax),
                            });
                            setManualEarnings(true);
                            setEarnings({ basic: String(e.basic), hra: String(e.hra), conv: String(e.conveyance), medical: String(e.medical), other: String(e.other) });
                            setSlipStaffDD(e.employee_name);
                            setSlipModal('preview');
                          }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          Preview
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={async () => {
                          if (!window.confirm(`Delete salary record for ${e.employee_name}?`)) return;
                          try { await axios.delete(`/salary-history/delete/${e.id}`); toast('Deleted', 'warn'); fetchSalaryHistory(); }
                          catch (_) { toast('Delete failed', 'error'); }
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No salary records yet. Generate a Pay Slip and click "Log Salary" to save.</td></tr>
              ) : (
                (officeExpenses[activeType] || []).length > 0
                ? (officeExpenses[activeType] || []).map((e, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: '11px' }}>{e.date}</td>
                    <td style={{ fontWeight: 600 }}>{e.description}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(e.amount)}</td>
                    <td style={{ fontSize: '11px', color: 'var(--text3)' }}>{e.note || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteExpense(e)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </td>
                  </tr>
                ))
                : <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No records for this category</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Manage Staff Profiles Modal ── */}
      <Modal open={staffModal} onClose={() => { setStaffModal(false); resetStaffForm(); }} title={<span>Staff Profiles</span>} wide>
        {/* Add / Edit Form */}
        <div style={{ background: 'var(--bg3)', borderRadius: '10px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '12px' }}>
            {editStaff ? `Editing: ${editStaff.name}` : 'Add New Staff Profile'}
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            {/* Passport Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <div style={{ width: '88px', height: '108px', borderRadius: '8px', border: '2px dashed var(--border)', overflow: 'hidden', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(photoPreview || editStaff?.photo_url) ? (
                  <img src={photoPreview || editStaff?.photo_url} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                )}
              </div>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', fontSize: '10px', padding: '4px 8px' }}>
                {staffPhoto ? '✓ Selected' : 'Upload Photo'}
                <input type="file" hidden accept="image/*" onChange={e => {
                  const f = e.target.files[0];
                  if (f) { setStaffPhoto(f); setPhotoPreview(URL.createObjectURL(f)); }
                }} />
              </label>
              <span style={{ fontSize: '9px', color: 'var(--text3)', textAlign: 'center' }}>Passport Size</span>
            </div>

            {/* Form Fields */}
            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div className="fg"><label className="fl">Full Name *</label><input className="fi" placeholder="e.g. SUMIT PANIGRAHI" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} /></div>
              <div className="fg"><label className="fl">Employee ID</label><input className="fi" placeholder="e.g. EPB-001" value={staffForm.employee_id} onChange={e => setStaffForm({...staffForm, employee_id: e.target.value})} /></div>
              <div className="fg"><label className="fl">Designation</label><input className="fi" placeholder="e.g. LIFE GUARD" value={staffForm.designation} onChange={e => setStaffForm({...staffForm, designation: e.target.value})} /></div>
              <div className="fg"><label className="fl">Account No.</label><input className="fi" placeholder="e.g. 20279521524 / CASH" value={staffForm.account_no} onChange={e => setStaffForm({...staffForm, account_no: e.target.value})} /></div>
              <div className="fg"><label className="fl">Bank Name</label><input className="fi" placeholder="e.g. FINO PAYMENTS BANK" value={staffForm.bank_name} onChange={e => setStaffForm({...staffForm, bank_name: e.target.value})} /></div>
              <div className="fg"><label className="fl">Date of Joining</label><input className="fi" placeholder="e.g. 05-07-2024" value={staffForm.doj} onChange={e => setStaffForm({...staffForm, doj: e.target.value})} /></div>
              <div className="fg"><label className="fl">Phone</label><input className="fi" placeholder="+91 XXXXX XXXXX" value={staffForm.phone} onChange={e => setStaffForm({...staffForm, phone: e.target.value})} /></div>
              <div className="fg" style={{ gridColumn: 'span 2' }}>
                <label className="fl">Aadhar Card</label>
                <label className="btn btn-ghost" style={{ cursor: 'pointer', width: '100%', justifyContent: 'center', fontSize: '13px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {staffAadhar ? `✓ ${staffAadhar.name}` : (editStaff?.aadhar_url ? 'Replace Aadhar' : 'Upload Aadhar Card')}
                  <input type="file" hidden accept="image/*,.pdf" onChange={e => { const f = e.target.files[0]; if (f) setStaffAadhar(f); }} />
                </label>
                {editStaff?.aadhar_url && !staffAadhar && (
                  <a href={editStaff.aadhar_url} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: 'var(--sky)', marginTop: '4px', display: 'inline-block' }}>View existing →</a>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', justifyContent: 'flex-end' }}>
            {editStaff && <button className="btn btn-ghost btn-sm" onClick={resetStaffForm}>Cancel Edit</button>}
            <button className="btn btn-sky" onClick={saveStaff}>{editStaff ? 'Save Changes' : 'Add Staff'}</button>
          </div>
        </div>

        {/* Staff List */}
        <div style={{ marginBottom: '8px' }}>
          <input className="fi" placeholder="🔍 Search staff..." value={staffSearch} onChange={e => setStaffSearch(e.target.value)} style={{ marginBottom: '12px' }} />
        </div>
        <div className="tw" style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <table>
            <thead>
              <tr><th>Photo</th><th>Name</th><th>ID</th><th>Designation</th><th>Bank</th><th>DOJ</th><th>Aadhar</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {staffList.filter(p => p.name.toLowerCase().includes(staffSearch.toLowerCase())).length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text3)' }}>No staff profiles yet. Add one above.</td></tr>
              )}
              {staffList.filter(p => p.name.toLowerCase().includes(staffSearch.toLowerCase())).map(p => (
                <tr key={p.id}>
                  <td>
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.name} style={{ width: '36px', height: '44px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--border)' }} />
                    ) : (
                      <div style={{ width: '36px', height: '44px', borderRadius: '4px', background: 'var(--bg3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 700 }}>{p.name}<div style={{ fontSize: '11px', color: 'var(--text3)' }}>{p.phone || ''}</div></td>
                  <td style={{ fontSize: '12px' }}>{p.employee_id || '—'}</td>
                  <td style={{ fontSize: '12px' }}>{p.designation || '—'}</td>
                  <td style={{ fontSize: '12px' }}>{p.bank_name || '—'}<div style={{ fontSize: '10px', color: 'var(--text3)' }}>{p.account_no || ''}</div></td>
                  <td style={{ fontSize: '12px' }}>{p.doj || '—'}</td>
                  <td>
                    {p.aadhar_url ? (
                      <a href={p.aadhar_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ fontSize: '11px' }}>View</a>
                    ) : <span style={{ fontSize: '11px', color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => {
                        setEditStaff(p);
                        setStaffForm({ name: p.name, employee_id: p.employee_id||'', designation: p.designation||'', account_no: p.account_no||'', bank_name: p.bank_name||'', doj: p.doj||'', phone: p.phone||'' });
                        setPhotoPreview(p.photo_url || null);
                        setStaffPhoto(null); setStaffAadhar(null);
                      }}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteStaff(p.id, p.name)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ── Add Expense Modal ── */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={<span>Add {EXPENSE_TYPES.find(t => t.id === activeType).label}</span>} footer={
        <><button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button><button className="btn btn-sky" onClick={saveExpense}>Save Record</button></>
      }>
        {activeType === 'salaries' ? (
          <div className="fg" style={{ position: 'relative' }}>
            <label className="fl">Select Staff Member</label>
            <input
              className="fi"
              placeholder="Start typing staff name..."
              value={empSearch}
              onChange={e => { setEmpSearch(e.target.value); setEmpDdOpen(true); setForm({ ...form, description: e.target.value }); }}
              onFocus={() => setEmpDdOpen(true)}
              onBlur={() => setTimeout(() => setEmpDdOpen(false), 150)}
            />
            {empDdOpen && (
              <div style={{ position: 'absolute', zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', top: '100%', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                {staffList.filter(p => p.name.toLowerCase().includes(empSearch.toLowerCase())).length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                    No staff found.
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: '8px' }} onMouseDown={() => { setEmpDdOpen(false); setAddModal(false); setStaffModal(true); }}>
                      + Add Staff Profile
                    </button>
                  </div>
                ) : (
                  staffList.filter(p => p.name.toLowerCase().includes(empSearch.toLowerCase())).map(p => (
                    <div key={p.id}
                      onMouseDown={() => { setForm({ ...form, description: p.name }); setEmpSearch(p.name); setEmpDdOpen(false); }}
                      style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                          {p.employee_id && <span>{p.employee_id}</span>}
                          {p.designation && <span> • {p.designation}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {staffList.length === 0 && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text3)' }}>
                No staff profiles yet.{' '}
                <span style={{ color: 'var(--sky)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setAddModal(false); setStaffModal(true); }}>
                  Click here to add staff profiles first →
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="fg"><label className="fl">Description</label><input className="fi" placeholder="e.g. Electricity Bill" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        )}
        <div className="fr">
          <div className="fg"><label className="fl">Amount (₹)</label><input className="fi" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        </div>
        <div className="fg"><label className="fl">Additional Note</label><input className="fi" placeholder="Optional details..." value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
      </Modal>

      {/* ── Pay Slip Generator Modal ── */}
      {/* ── Pay Slip FORM Modal (Step 1) ── */}
      <Modal open={slipModal === 'form'} onClose={() => setSlipModal(false)} title={<span>Pay Slip Details</span>} wide footer={
        <>
          <button className="btn btn-ghost" onClick={() => setSlipModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={() => {
            if (!slip.empName) { toast('Select a staff member first', 'error'); return; }
            if (!slip.grossWages) { toast('Enter gross wages', 'error'); return; }
            setSlipModal('preview');
          }}>
            Generate Pay Slip →
          </button>
        </>
      }>
        {/* Staff Picker */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <label className="fl">Select Staff Member</label>
          <input className="fi" placeholder="🔍 Search staff name..." value={slipStaffDD} onChange={e => { setSlipStaffDD(e.target.value); setStaffDdOpen(true); }} onFocus={() => setStaffDdOpen(true)} onBlur={() => setTimeout(() => setStaffDdOpen(false), 150)} />
          {staffDdOpen && (
            <div style={{ position: 'absolute', zIndex: 9999, top: '100%', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              {staffList.filter(p => p.name.toLowerCase().includes(slipStaffDD.toLowerCase())).length === 0
                ? <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No staff found. <button className="btn btn-ghost btn-sm" onMouseDown={() => { setStaffDdOpen(false); setStaffModal(true); }}>+ Add Staff</button></div>
                : staffList.filter(p => p.name.toLowerCase().includes(slipStaffDD.toLowerCase())).map(p => (
                  <div key={p.id} onMouseDown={() => selectStaffForSlip(p)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{p.employee_id && `${p.employee_id} • `}{p.designation}</div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--sky)', fontWeight: 600 }}>Select →</span>
                  </div>
                ))
              }
            </div>
          )}
          {slip.empName && (
            <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>Auto-filled: {slip.empName}</span>
              <span style={{ color: 'var(--text3)' }}>{slip.designation} • {slip.empId}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px', padding: '16px', background: 'var(--bg3)', borderRadius: '10px' }}>
          <div style={{ gridColumn: 'span 3', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '4px' }}>Pay Period</div>
          <div className="fg"><label className="fl">Month</label><select className="fs" value={slip.month} onChange={e => setS('month', e.target.value)}>{MONTHS.map(m => <option key={m}>{m}</option>)}</select></div>
          <div className="fg"><label className="fl">Year</label><input className="fi" placeholder="2025" value={slip.year} onChange={e => setS('year', e.target.value)} /></div>
          <div style={{ gridColumn: 'span 3', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginTop: '8px', marginBottom: '4px' }}>Attendance</div>
          <div className="fg"><label className="fl">Gross Wages (₹)</label><input className="fi" type="number" placeholder="10000" value={slip.grossWages} onChange={e => setS('grossWages', e.target.value)} /></div>
          <div className="fg"><label className="fl">Total Working Days</label><input className="fi" type="number" placeholder="31" value={slip.totalDays} onChange={e => setS('totalDays', e.target.value)} /></div>
          <div className="fg"><label className="fl">LOP Days</label><input className="fi" type="number" placeholder="0" value={slip.lopDays} onChange={e => setS('lopDays', e.target.value)} /></div>
          <div className="fg"><label className="fl">CL (Casual Leaves)</label><input className="fi" placeholder="CL" value={slip.cl} onChange={e => setS('cl', e.target.value)} /></div>
          <div className="fg"><label className="fl">Leaves Taken</label><input className="fi" placeholder="0" value={slip.leaves} onChange={e => setS('leaves', e.target.value)} /></div>
          <div style={{ gridColumn: 'span 3', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginTop: '8px', marginBottom: '4px' }}>Earnings</div>
          <div style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{manualEarnings ? 'Manual mode' : `Auto: Basic ₹${autoCalc.basic.toLocaleString('en-IN')} | Total ₹${autoCalc.totalEarnings.toLocaleString('en-IN')}`}</span>
            <button type="button" className={`btn btn-sm ${manualEarnings ? 'btn-sky' : 'btn-ghost'}`} onClick={() => { if (!manualEarnings) syncAutoToManual(); setManualEarnings(v => !v); }}>{manualEarnings ? '✓ Manual' : 'Enter Manually'}</button>
          </div>
          {manualEarnings && (<>
            <div className="fg"><label className="fl">Basic (₹)</label><input className="fi" type="number" value={earnings.basic} onChange={e => setEarnings({...earnings, basic: e.target.value})} /></div>
            <div className="fg"><label className="fl">HRA (₹)</label><input className="fi" type="number" value={earnings.hra} onChange={e => setEarnings({...earnings, hra: e.target.value})} /></div>
            <div className="fg"><label className="fl">Conveyance (₹)</label><input className="fi" type="number" value={earnings.conv} onChange={e => setEarnings({...earnings, conv: e.target.value})} /></div>
            <div className="fg"><label className="fl">Medical (₹)</label><input className="fi" type="number" value={earnings.medical} onChange={e => setEarnings({...earnings, medical: e.target.value})} /></div>
            <div className="fg"><label className="fl">Other (₹)</label><input className="fi" type="number" value={earnings.other} onChange={e => setEarnings({...earnings, other: e.target.value})} /></div>
          </>)}
          <div style={{ gridColumn: 'span 3', fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginTop: '8px', marginBottom: '4px' }}>Deductions</div>
          <div className="fg"><label className="fl">Salary Advance (₹)</label><input className="fi" type="number" placeholder="0" value={slip.salaryAdvance} onChange={e => setS('salaryAdvance', e.target.value)} /></div>
          <div className="fg"><label className="fl">Balance Deduction (₹)</label><input className="fi" type="number" placeholder="0" value={slip.balanceDeduction} onChange={e => setS('balanceDeduction', e.target.value)} /></div>
          <div className="fg"><label className="fl">Professional Tax (₹)</label><input className="fi" type="number" placeholder="0" value={slip.professionalTax} onChange={e => setS('professionalTax', e.target.value)} /></div>
        </div>
      </Modal>

      {/* ── Pay Slip PREVIEW Modal (Step 2) ── */}
      <Modal open={slipModal === 'preview'} onClose={() => setSlipModal(false)} title={<span>Pay Slip — {slip.empName} ({slip.month} {slip.year})</span>} wide footer={
        <>
          <button className="btn btn-ghost" onClick={() => setSlipModal(false)}>Close</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSlipModal('form')}>← Edit</button>
          <button className="btn btn-ghost btn-sm" onClick={printSlip}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button className="btn btn-sky" onClick={downloadPDF}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download PDF
          </button>
        </>
      }>
        {/* ── Slip Preview — same template as PDF ── */}
        <div
          ref={slipRef}
          style={{ maxWidth: '700px', margin: '0 auto', fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#111', background: '#fff', border: '1px solid #aaa' }}
          dangerouslySetInnerHTML={{ __html: buildSlipBody() }}
        />
      </Modal>
    </div>
  );
};

export default OfficeExpensesPage;
