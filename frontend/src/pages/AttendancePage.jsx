import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import Modal from '../components/common/Modal';

const AttendancePage = () => {
  const { attendanceRecords, attendanceKpis, refreshAttendance, employees, checkAccess, addNotification, toast } = useAppContext();

  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterEmp,  setFilterEmp]  = useState('');
  const [newAttModal,  setNewAttModal]  = useState(false);
  const [editAttModal, setEditAttModal] = useState(null); // record object

  const [form, setForm] = useState({ empId: '', date: new Date().toISOString().slice(0, 10), checkIn: '09:00', checkOut: '', status: 'present', notes: '' });

  // Employee search states
  const [empSearch, setEmpSearch] = useState('');
  const [empDdOpen, setEmpDdOpen] = useState(false);
  const [empLabel,  setEmpLabel]  = useState('');

  const selectEmployee = (id, name, dept) => {
    setForm({ ...form, empId: id });
    setEmpSearch(name);
    setEmpLabel(`✅ Selected: ${name}`);
    setEmpDdOpen(false);
  };

  const filteredEmployees = empSearch
    ? (employees || []).filter(e => 
        (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) || 
        String(e.id || '').includes(empSearch)
      )
    : (employees || []);

  if (!checkAccess('attendance')) return <Navigate to="/dashboard" />;

  // Filtered records
  let data = [...(attendanceRecords || [])];
  if (filterDate) data = data.filter(r => r.date === filterDate);
  if (filterEmp)  data = data.filter(r => r.empName.toLowerCase().includes(filterEmp.toLowerCase()));
  data.sort((a, b) => b.date.localeCompare(a.date) || a.empName.localeCompare(b.empName));

  const statPresent = attendanceKpis.total_present_today;
  const statAbsent  = attendanceKpis.total_absent_today;
  const statLate    = attendanceKpis.total_late_today;
  const statTotal   = attendanceKpis.total_employees;

  const saveNew = async () => {
    const emp = (employees || []).find(e => e.id === parseInt(form.empId));
    if (!emp)        { toast('❌ Select an employee', 'error'); return; }
    if (!form.date)  { toast('❌ Select a date', 'error'); return; }
    if (!form.checkIn) { toast('❌ Check-in time required', 'error'); return; }

    const formData = new FormData();
    formData.append('employee_id', emp.id);
    formData.append('date', form.date);
    formData.append('check_in', form.checkIn);
    formData.append('check_out', form.checkOut || '');
    formData.append('status', form.status);
    if (form.notes) formData.append('notes', form.notes);

    try {
      const res = await axios.post('/attendence/add_attendence', formData);
      toast(res.data.message, 'success');
      refreshAttendance();
      setNewAttModal(false);
      setForm({ empId: '', date: new Date().toISOString().slice(0, 10), checkIn: '09:00', checkOut: '', status: 'present', notes: '' });
      
      addNotification({
        type: 'create',
        module: 'Attendance',
        action: 'Record Added',
        message: `Attendance marked for ${emp.name} as ${form.status.toUpperCase()}`,
        entityId: res.data.attendence.id
      });
    } catch (err) {
      console.error(err);
      const errorDetail = err.response?.data?.detail;
      const errorMsg = typeof errorDetail === 'string' ? errorDetail : (Array.isArray(errorDetail) ? errorDetail[0].msg : 'Failed to save attendance');
      toast(errorMsg, 'error');
    }
  };

  const saveEdit = async () => {
    if (!editAttModal) return;
    
    const formData = new FormData();
    formData.append('date', editAttModal.date);
    formData.append('check_in', editAttModal.checkIn);
    formData.append('check_out', editAttModal.checkOut || '');
    formData.append('status', editAttModal.status);
    if (editAttModal.notes) formData.append('notes', editAttModal.notes);

    try {
      const res = await axios.put(`/attendence/edit_attendence/${editAttModal.id}`, formData);
      toast(res.data.message, 'success');
      refreshAttendance();
      setEditAttModal(null);
    } catch (err) {
      console.error(err);
      const errorDetail = err.response?.data?.detail;
      const errorMsg = typeof errorDetail === 'string' ? errorDetail : (Array.isArray(errorDetail) ? errorDetail[0].msg : 'Failed to update attendance');
      toast(errorMsg, 'error');
    }
  };

  const deleteAtt = async (empId) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await axios.delete(`/attendence/delete_attendence/${empId}`);
        toast('🗑 Record deleted', 'warn');
        refreshAttendance();
      } catch (err) {
        console.error(err);
        toast('Failed to delete record', 'error');
      }
    }
  };

  const getDept = (empId) => (employees || []).find(e => e.id === empId)?.dept || '—';

  return (
    <div className="page active" id="page_attendance">
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title" style={{ fontSize: '24px', fontWeight: 800 }}>ATTENDANCE</div>
          <div className="ph-sub" style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>Track employee attendance and check-in/out</div>
        </div>
        <button className="btn btn-sky" onClick={() => { setEmpSearch(''); setEmpLabel(''); setForm({...form, empId: ''}); setNewAttModal(true); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add Record
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card stat" style={{ borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Present Today</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{statPresent}</div>
          <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '8px', fontWeight: 600 }}>Active in workplace</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--red)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Absent Today</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{statAbsent}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>On-leave / No record</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--gold)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Late Today</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{statLate}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Check-in after 09:15</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--sky)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Employees</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{statTotal}</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Active workforce count</div>
        </div>
      </div>

      {/* Filters */}
      <div className="table-toolbar" style={{ marginBottom: '16px', borderRadius: '12px' }}>
        <div className="table-toolbar-left">
          <input
            type="date"
            className="fi"
            value={filterDate}
            style={{ width: '160px' }}
            onChange={e => setFilterDate(e.target.value)}
          />
          <div className="search-box">
            <span className="search-icon">
              <svg className="fi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              className="fi search-input"
              placeholder="Search employee..."
              value={filterEmp}
              onChange={e => setFilterEmp(e.target.value)}
            />
          </div>
        </div>
        <div className="table-toolbar-right">
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilterDate(''); setFilterEmp(''); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.length > 0 ? data.map(r => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{r.date}</td>
                  <td style={{ fontWeight: 700 }}>{r.empName}</td>
                  <td style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'capitalize' }}>{getDept(r.empId)}</td>
                  <td className="mono" style={{ color: 'var(--green)' }}>{r.checkIn || '—'}</td>
                  <td className="mono" style={{ color: r.checkOut ? 'var(--sky)' : 'var(--text3)' }}>{r.checkOut || 'Not checked out'}</td>
                  <td>
                    <span className={`s ${r.status === 'present' ? 's-followup' : r.status === 'absent' ? 's-closed' : 's-design'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text2)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditAttModal({ ...r })}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                        Edit
                      </button>
                      <button className="btn btn-red btn-sm" onClick={() => deleteAtt(r.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text3)', padding: '28px' }}>
                    No attendance records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Attendance Modal */}
      <Modal open={newAttModal} onClose={() => setNewAttModal(false)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          <span>Add Attendance Record</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setNewAttModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveNew}>Save Record</button>
        </>
      }>
        <div className="fg" style={{ position: 'relative' }}>
          <label className="fl">Employee *</label>
          <div className="search-box" style={{ width: '100%' }}>
            <span className="search-icon" style={{ left: '12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
            <input 
              className="fi" 
              style={{ paddingLeft: '36px' }}
              placeholder="Search employee by name or ID..." 
              value={empSearch} 
              onChange={(e) => { setEmpSearch(e.target.value); setEmpDdOpen(true); }} 
              onFocus={() => setEmpDdOpen(true)} 
            />
          </div>
          {empDdOpen && filteredEmployees.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', top: '100%', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 10px 20px rgba(0,0,0,0.5)', marginTop: '4px' }}>
              {filteredEmployees.map(e => (
                <div 
                  key={e.id} 
                  style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }} 
                  className="row-hover"
                  onMouseDown={() => selectEmployee(e.id, e.name, e.dept)}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{e.name}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: '11px', color: 'var(--sky)', marginTop: '4px', fontWeight: 600 }}>{empLabel}</div>
        </div>
        <div className="fr">
          <div className="fg"><label className="fl">Date *</label><input className="fi" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
          <div className="fg">
            <label className="fl">Status</label>
            <select className="fs" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="leave">On Leave</option>
            </select>
          </div>
        </div>
        <div className="fr">
          <div className="fg"><label className="fl">Check-In *</label><input className="fi" type="time" value={form.checkIn} onChange={e => setForm({...form, checkIn: e.target.value})} /></div>
          <div className="fg"><label className="fl">Check-Out</label><input className="fi" type="time" value={form.checkOut} onChange={e => setForm({...form, checkOut: e.target.value})} /></div>
        </div>
        <div className="fg"><label className="fl">Notes</label><input className="fi" placeholder="Optional notes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
      </Modal>

      {/* Edit Attendance Modal */}
      <Modal open={!!editAttModal} onClose={() => setEditAttModal(null)} title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
          <span>Edit Attendance Record</span>
        </div>
      } footer={
        <>
          <button className="btn btn-ghost" onClick={() => setEditAttModal(null)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveEdit}>Save Changes</button>
        </>
      }>
        {editAttModal && (
          <>
            <div style={{ marginBottom: '12px', padding: '10px 14px', background: 'var(--bg3)', borderRadius: '8px', fontSize: '13px' }}>
              <strong>{editAttModal.empName}</strong> — {editAttModal.date}
            </div>
            <div className="fr">
              <div className="fg"><label className="fl">Check-In</label><input className="fi" type="time" value={editAttModal.checkIn || ''} onChange={e => setEditAttModal({...editAttModal, checkIn: e.target.value})} /></div>
              <div className="fg"><label className="fl">Check-Out</label><input className="fi" type="time" value={editAttModal.checkOut || ''} onChange={e => setEditAttModal({...editAttModal, checkOut: e.target.value})} /></div>
            </div>
            <div className="fg">
              <label className="fl">Status</label>
              <select className="fs" value={editAttModal.status} onChange={e => setEditAttModal({...editAttModal, status: e.target.value})}>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="leave">On Leave</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Notes</label><input className="fi" value={editAttModal.notes || ''} onChange={e => setEditAttModal({...editAttModal, notes: e.target.value})} /></div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default AttendancePage;
