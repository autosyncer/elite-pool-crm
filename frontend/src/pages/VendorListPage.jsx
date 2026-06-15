import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/common/Modal';
import axios from 'axios';

const CATEGORIES = ['materials', 'equipment', 'labour', 'transport', 'other'];
const CAT_LABELS = { materials: 'Materials', equipment: 'Equipment', labour: 'Labour', transport: 'Transport', other: 'Other' };
const CAT_COLORS = { materials: 'var(--sky)', equipment: 'var(--orange, #f97316)', labour: 'var(--green)', transport: '#a855f7', other: 'var(--text3)' };

const Stars = ({ rating }) => (
  <span>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{ color: i <= rating ? '#f59e0b' : 'var(--border)', fontSize: '14px' }}>★</span>
    ))}
  </span>
);

const VendorListPage = () => {
  const { toast } = useAppContext();
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [addModal, setAddModal] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  const emptyForm = { name: '', category: 'materials', contact_person: '', phone: '', email: '', address: '', rating: 0, notes: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/vendors/all');
      setVendors(res.data || []);
    } catch (err) {
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditVendor(null); setAddModal(true); };
  const openEdit = (v) => { setForm({ name: v.name, category: v.category, contact_person: v.contact_person || '', phone: v.phone || '', email: v.email || '', address: v.address || '', rating: v.rating || 0, notes: v.notes || '' }); setEditVendor(v); setAddModal(true); };

  const saveVendor = async () => {
    if (!form.name) { toast('Vendor name required', 'error'); return; }
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    try {
      if (editVendor) {
        await axios.put(`/vendors/update/${editVendor.id}`, formData);
        toast('Vendor updated', 'success');
      } else {
        await axios.post('/vendors/create', formData);
        toast('Vendor added', 'success');
      }
      setAddModal(false);
      fetchVendors();
    } catch (err) {
      toast('Failed to save vendor', 'error');
    }
  };

  const deleteVendor = async (id, name) => {
    if (!window.confirm(`Delete vendor "${name}"?`)) return;
    try {
      await axios.delete(`/vendors/delete/${id}`);
      toast('Vendor deleted', 'warn');
      fetchVendors();
    } catch (err) {
      toast('Delete failed', 'error');
    }
  };

  const filtered = vendors.filter(v => {
    const matchSearch = v.name?.toLowerCase().includes(search.toLowerCase()) || v.contact_person?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || v.category === filterCat;
    return matchSearch && matchCat;
  });

  return (
    <div className="page active">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <div className="ph-title" style={{ fontSize: '24px', fontWeight: 800 }}>Vendor List</div>
          <div className="ph-sub" style={{ fontSize: '13px', color: 'var(--text2)' }}>Manage suppliers and service providers</div>
        </div>
        <button className="btn btn-sky" onClick={openAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Vendor
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card stat" style={{ borderLeft: '4px solid var(--sky)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Vendors</div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{vendors.length}</div>
        </div>
        {CATEGORIES.map(cat => (
          <div key={cat} className="card stat" style={{ borderLeft: `4px solid ${CAT_COLORS[cat]}`, cursor: 'pointer', opacity: filterCat === cat ? 1 : 0.7 }} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>{CAT_LABELS[cat]}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: CAT_COLORS[cat] }}>{vendors.filter(v => v.category === cat).length}</div>
          </div>
        ))}
      </div>

      {/* Filters + Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-toolbar" style={{ padding: '14px 20px', display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <input className="fi" style={{ flex: 1 }} placeholder="🔍 Search vendor name or contact..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="fs" style={{ width: '160px', margin: 0 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Vendor Name</th><th>Category</th><th>Contact</th><th>Phone</th><th>Rating</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>Loading...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>No vendors found</td></tr>}
              {filtered.map(v => (
                <tr key={v.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{v.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{v.address || '—'}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: CAT_COLORS[v.category], background: `${CAT_COLORS[v.category]}22`, padding: '2px 8px', borderRadius: '4px' }}>
                      {CAT_LABELS[v.category] || v.category}
                    </span>
                  </td>
                  <td style={{ fontSize: '13px' }}>{v.contact_person || '—'}</td>
                  <td style={{ fontSize: '13px' }}>{v.phone || '—'}</td>
                  <td><Stars rating={v.rating || 0} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteVendor(v.id, v.name)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={<span>{editVendor ? 'Edit Vendor' : 'Add Vendor'}</span>} wide footer={
        <>
          <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveVendor}>{editVendor ? 'Save Changes' : 'Add Vendor'}</button>
        </>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg" style={{ gridColumn: 'span 2' }}><label className="fl">Vendor Name *</label><input className="fi" placeholder="Company or individual name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="fg"><label className="fl">Category</label>
            <select className="fs" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Rating (1-5)</label>
            <select className="fs" value={form.rating} onChange={e => setForm({ ...form, rating: Number(e.target.value) })}>
              {[0,1,2,3,4,5].map(r => <option key={r} value={r}>{r === 0 ? 'Not rated' : '★'.repeat(r)}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Contact Person</label><input className="fi" placeholder="Name" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
          <div className="fg"><label className="fl">Phone</label><input className="fi" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="fg"><label className="fl">Email</label><input className="fi" placeholder="vendor@email.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div className="fg"><label className="fl">Address</label><input className="fi" placeholder="City / Area" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          <div className="fg" style={{ gridColumn: 'span 2' }}><label className="fl">Notes</label><input className="fi" placeholder="Any additional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
};

export default VendorListPage;
