import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import StatusBadge from '../components/common/StatusBadge';
import TypeBadge from '../components/common/TypeBadge';
import SearchBar from '../components/common/SearchBar';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';

const ProcurementPage = () => {
  const { procurements, setProcurements, checkAccess, toast, refreshProcurements } = useAppContext();
  
  const [localProcurements, setLocalProcurements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('newest');

  const [manualModal, setManualModal] = useState(false);
  const [manualForm, setManualForm] = useState({ client_name: '', site_name: '', site_type: 'construction', requirements: '' });

  useEffect(() => {
    fetchProcurements();
  }, []);

  const fetchProcurements = async () => {
    try {
      const res = await axios.get('/procurements/all');
      setLocalProcurements(res.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching procurements:", error);
      setLoading(false);
    }
  };

  if (!checkAccess('procurements')) {
    return <Navigate to="/dashboard" />;
  }

  const filteredProcurements = localProcurements
    .filter(p => {
      const q = search.toLowerCase();
      return (p.client || '').toLowerCase().includes(q) || (p.requirements || '').toLowerCase().includes(q);
    })
    .filter(p => {
      if (filter === 'construction') return p.siteType === 'construction';
      if (filter === 'amc') return p.siteType === 'amc';
      if (filter === 'pending') return p.status === 'pending';
      if (filter === 'done') return p.status === 'done';
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sort === 'oldest' ? dateA - dateB : dateB - dateA;
    });

  const markDone = async (id) => {
    try {
      await axios.put(`/procurements/mark-done/${id}`);
      toast('✅ Marked as Procured', 'success');
      fetchProcurements();
      refreshProcurements();
    } catch (error) {
      console.error("Error updating procurement:", error);
      toast('❌ Failed to update status', 'error');
    }
  };

  const submitManual = async () => {
    if (!manualForm.client_name.trim() || !manualForm.requirements.trim()) {
      toast('Client name and requirements are required', 'error'); return;
    }
    try {
      const fd = new FormData();
      Object.entries(manualForm).forEach(([k, v]) => fd.append(k, v));
      await axios.post('/procurements/add-manual', fd);
      toast('✅ Procurement entry added!', 'success');
      setManualModal(false);
      setManualForm({ client_name: '', site_name: '', site_type: 'construction', requirements: '' });
      fetchProcurements();
      refreshProcurements();
    } catch (error) {
      console.error('Error adding manual procurement:', error);
      toast('❌ Failed to add entry', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this procurement task?")) return;
    try {
      await axios.delete(`/procurements/delete/${id}`);
      toast('🗑️ Procurement deleted', 'success');
      fetchProcurements();
      refreshProcurements();
    } catch (error) {
      console.error("Error deleting procurement:", error);
      toast('❌ Failed to delete item', 'error');
    }
  };

  return (
    <div className="page" id="page_procurements">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Procurements</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Manage inventory requirements and supply chain</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-sky" onClick={() => setManualModal(true)}>+ Add Manual Entry</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <SearchBar value={search} onChange={setSearch} placeholder="Search site or item..." />
          <select className="fs" style={{ width: '150px' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="construction">Construction Only</option>
            <option value="amc">AMC Only</option>
          </select>
          <select className="fs" style={{ width: '150px' }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>
      </div>

        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Site/Client</th>
                <th>Type</th>
                <th>Requirements</th>
                <th>Logged At</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcurements.length > 0 ? filteredProcurements.map(p => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontSize: '11px', color: 'var(--sky)' }}>{p.code}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{p.client}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{p.siteName}</div>
                  </td>
                  <td><TypeBadge type={p.siteType} /></td>
                  <td style={{ fontSize: '13px', color: 'var(--text2)' }}>{p.requirements}</td>
                  <td style={{ fontSize: '11px', color: 'var(--text3)' }}>{p.date}</td>
                  <td><StatusBadge status={p.status === 'done' ? 'closed' : 'followup'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                      {p.status === 'pending' ? (
                        <button className="btn btn-sky btn-sm" onClick={() => markDone(p.id)}>Procure</button>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 600 }}>✓ Procured</span>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', padding: '6px' }} onClick={() => handleDelete(p.id)}>
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7">
                    <EmptyState title="No procurement tasks found" icon={
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    } />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        open={manualModal}
        onClose={() => { setManualModal(false); setManualForm({ client_name: '', site_name: '', site_type: 'construction', requirements: '' }); }}
        title="📦 Add Manual Procurement Entry"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setManualModal(false)}>Cancel</button>
            <button className="btn btn-sky" onClick={submitManual}>Add Entry</button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="fg">
              <label className="fl">Client Name</label>
              <input className="fi" placeholder="e.g. Mr. Sharma" value={manualForm.client_name} onChange={e => setManualForm(p => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Site / Project Name</label>
              <input className="fi" placeholder="e.g. Kanpur Site" value={manualForm.site_name} onChange={e => setManualForm(p => ({ ...p, site_name: e.target.value }))} />
            </div>
          </div>
          <div className="fg">
            <label className="fl">Type</label>
            <select className="fs" value={manualForm.site_type} onChange={e => setManualForm(p => ({ ...p, site_type: e.target.value }))}>
              <option value="construction">Construction</option>
              <option value="amc">AMC</option>
              <option value="general">General</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Requirements / Items Needed</label>
            <textarea className="ft" style={{ minHeight: '100px' }} placeholder="List the materials, equipment or items needed..." value={manualForm.requirements} onChange={e => setManualForm(p => ({ ...p, requirements: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProcurementPage;
