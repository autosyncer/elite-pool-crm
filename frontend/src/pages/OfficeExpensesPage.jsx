import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/common/Modal';
import SearchBar from '../components/common/SearchBar';

const EXPENSE_TYPES = [
  { id: 'salaries', label: 'Staff Salaries', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
  { id: 'rent', label: 'Rent & Utilities', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg> },
  { id: 'petty', label: 'Petty Cash', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg> }
];

const OfficeExpensesPage = () => {
  const { officeExpenses, refreshOfficeExpenses, users, checkAccess, addNotification, toast } = useAppContext();

  const [activeType, setActiveType] = useState('salaries');
  const [addModal, setAddModal] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [empDdOpen, setEmpDdOpen] = useState(false);
  
  const [form, setForm] = useState({ description: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] });

  if (!checkAccess('officeexpenses')) return <Navigate to="/dashboard" />;

  const totalSalary = (officeExpenses.salaries || []).reduce((s, e) => s + e.amount, 0);
  const totalRent   = (officeExpenses.rent     || []).reduce((s, e) => s + e.amount, 0);
  const totalPetty  = (officeExpenses.petty    || []).reduce((s, e) => s + e.amount, 0);

  const saveExpense = async () => {
    const amt = parseFloat(form.amount);
    if (!amt || !form.description) { toast('Required fields missing', 'error'); return; }
    
    const categoryMap = {
      'salaries': 'Staffing Salaries',
      'rent': 'Office Rent / Utilities',
      'petty': 'Petty Office Expenses'
    };

    const formData = new FormData();
    formData.append('category', categoryMap[activeType]);
    formData.append('payee_name', activeType === 'salaries' ? form.description : 'Office');
    formData.append('description', form.description);
    formData.append('amount', amt);
    formData.append('expense_date', form.date);
    if (form.note) formData.append('note', form.note);

    try {
      await axios.post('/office-expenses/add_office_expense/', formData);
      
      addNotification({
        type: 'create',
        module: 'Office Overheads',
        action: 'Expense Added',
        message: `New ${EXPENSE_TYPES.find(t => t.id === activeType).label} of ₹${amt.toLocaleString('en-IN')} added`,
        entityId: activeType
      });

      toast('Expense recorded', 'success');
      setAddModal(false);
      setForm({ description: '', amount: '', note: '', date: new Date().toISOString().split('T')[0] });
      setEmpSearch('');
      refreshOfficeExpenses();
    } catch (err) {
      console.error(err);
      toast('Failed to save expense', 'error');
    }
  };

  const deleteExpense = async (expense) => {
    if (!window.confirm(`Are you sure you want to delete this record for "${expense.description}"?`)) return;

    const categoryMap = {
      'salaries': 'Staffing Salaries',
      'rent': 'Office Rent / Utilities',
      'petty': 'Petty Office Expenses'
    };

    try {
      // Backend expects /delete_expense/{category}/{payee_name}
      // Note: This backend logic is limited as it deletes by category and payee name, not ID.
      await axios.delete(`/office-expenses/delete_expense/${categoryMap[activeType]}/${expense.payee}`);
      
      addNotification({
        type: 'delete',
        module: 'Office Overheads',
        action: 'Expense Deleted',
        message: `${EXPENSE_TYPES.find(t => t.id === activeType).label} record removed`,
        entityId: activeType
      });

      toast('Record deleted', 'warn');
      refreshOfficeExpenses();
    } catch (err) {
      console.error(err);
      toast('Failed to delete record', 'error');
    }
  };

  const filteredUsers = users.filter(u => {
    const name = u.full_name || u.username || u.name || '';
    return name.toLowerCase().includes(empSearch.toLowerCase());
  });

  return (
    <div className="page" id="page_office">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Office Overheads</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Manage monthly expenses, rent, and staff salaries</p>
        </div>
        <button className="btn btn-sky" onClick={() => setAddModal(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Log Expense
        </button>
      </div>

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
              <div style={{ fontSize: '28px', fontWeight: 800, marginTop: '12px' }}>₹{amount.toLocaleString('en-IN')}</div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>{EXPENSE_TYPES.find(t => t.id === activeType).label} History</span>
          <button className="btn btn-sky btn-sm" onClick={() => setAddModal(true)}>+ Add Record</button>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Description</th><th>Amount</th><th>Note</th><th style={{ textAlign: 'right' }}>Action</th></tr>
            </thead>
            <tbody>
              {(officeExpenses[activeType] || []).length > 0 ? (officeExpenses[activeType] || []).map((e, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: '11px' }}>{e.date}</td>
                  <td style={{ fontWeight: 600 }}>{e.description}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 700 }}>₹{e.amount.toLocaleString('en-IN')}</td>
                  <td style={{ fontSize: '11px', color: 'var(--text3)' }}>{e.note || '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteExpense(e)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text3)', padding: '40px' }}>No records for this category</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Add {EXPENSE_TYPES.find(t => t.id === activeType).label}</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveExpense}>Save Record</button>
        </>
      }>
        {activeType === 'salaries' ? (
          <div className="fg" style={{ position: 'relative' }}>
            <label className="fl">Search Employee</label>
            <input className="fi" placeholder="Start typing name..." value={empSearch} onChange={e => { setEmpSearch(e.target.value); setEmpDdOpen(true); }} onFocus={() => setEmpDdOpen(true)} />
            {empDdOpen && filteredUsers.length > 0 && (
              <div style={{ position: 'absolute', zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', top: '100%', maxHeight: '150px', overflowY: 'auto' }}>
                {filteredUsers.map(u => {
                  const name = u.full_name || u.username || u.name || '';
                  return (
                    <div key={u.email} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onMouseDown={() => { setForm({...form, description: name}); setEmpSearch(name); setEmpDdOpen(false); }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{u.role}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="fg"><label className="fl">Description</label><input className="fi" placeholder="e.g. Electricity Bill" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
        )}
        <div className="fr">
          <div className="fg"><label className="fl">Amount (₹)</label><input className="fi" type="number" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} /></div>
          <div className="fg"><label className="fl">Date</label><input className="fi" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
        </div>
        <div className="fg"><label className="fl">Additional Note</label><input className="fi" placeholder="Optional details..." value={form.note} onChange={e => setForm({...form, note: e.target.value})} /></div>
      </Modal>
    </div>
  );
};

export default OfficeExpensesPage;
