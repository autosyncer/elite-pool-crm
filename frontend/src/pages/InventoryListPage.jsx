import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Modal from '../components/common/Modal';
import axios from 'axios';

const InventoryListPage = () => {
  const { procurements, toast } = useAppContext();
  const [items, setItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState('');
  const [filterLow, setFilterLow] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [adjustModal, setAdjustModal] = useState({ open: false, item: null });
  const [adjustment, setAdjustment] = useState('');
  const [loading, setLoading] = useState(true);

  const emptyForm = { item_name: '', category: '', quantity: '', unit: '', min_quantity: '', vendor_id: '', notes: '' };
  const [form, setForm] = useState(emptyForm);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [invRes, vendRes] = await Promise.allSettled([
        axios.get('/inventory/all'),
        axios.get('/vendors/all'),
      ]);
      setItems(invRes.status === 'fulfilled' ? invRes.value.data || [] : []);
      setVendors(vendRes.status === 'fulfilled' ? vendRes.value.data || [] : []);
    } catch (err) {
      setItems([]);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => { setForm(emptyForm); setEditItem(null); setAddModal(true); };
  const openEdit = (item) => {
    setForm({ item_name: item.item_name, category: item.category || '', quantity: item.quantity, unit: item.unit || '', min_quantity: item.min_quantity, vendor_id: item.vendor_id || '', notes: item.notes || '' });
    setEditItem(item);
    setAddModal(true);
  };

  const saveItem = async () => {
    if (!form.item_name) { toast('Item name required', 'error'); return; }
    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v !== '') formData.append(k, v); });
    try {
      if (editItem) {
        await axios.put(`/inventory/update/${editItem.id}`, formData);
        toast('Item updated', 'success');
      } else {
        await axios.post('/inventory/create', formData);
        toast('Item added', 'success');
      }
      setAddModal(false);
      fetchAll();
    } catch (err) {
      toast('Failed to save item', 'error');
    }
  };

  const deleteItem = async (id, name) => {
    if (!window.confirm(`Delete "${name}" from inventory?`)) return;
    try {
      await axios.delete(`/inventory/delete/${id}`);
      toast('Item deleted', 'warn');
      fetchAll();
    } catch (err) {
      toast('Delete failed', 'error');
    }
  };

  const handleAdjust = async () => {
    const val = parseFloat(adjustment);
    if (isNaN(val)) { toast('Enter a valid number', 'error'); return; }
    try {
      const formData = new FormData();
      formData.append('adjustment', val);
      await axios.put(`/inventory/adjust/${adjustModal.item.id}`, formData);
      toast(`Quantity ${val >= 0 ? 'added' : 'deducted'}`, 'success');
      setAdjustModal({ open: false, item: null });
      setAdjustment('');
      fetchAll();
    } catch (err) {
      toast(err.response?.data?.detail || 'Adjustment failed', 'error');
    }
  };

  const filtered = items.filter(item => {
    const matchSearch = item.item_name?.toLowerCase().includes(search.toLowerCase()) || item.category?.toLowerCase().includes(search.toLowerCase());
    const matchLow = !filterLow || item.low_stock;
    return matchSearch && matchLow;
  });

  const lowStockCount = items.filter(i => i.low_stock).length;
  const totalItems = items.length;

  return (
    <div className="page active">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <div className="ph-title" style={{ fontSize: '24px', fontWeight: 800 }}>Inventory</div>
          <div className="ph-sub" style={{ fontSize: '13px', color: 'var(--text2)' }}>Track materials, equipment, and supplies. Linked with Procurement.</div>
        </div>
        <button className="btn btn-sky" onClick={openAdd}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Item
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card stat" style={{ borderLeft: '4px solid var(--sky)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Total Items</div>
          <div style={{ fontSize: '28px', fontWeight: 800 }}>{totalItems}</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--red)', cursor: 'pointer' }} onClick={() => setFilterLow(v => !v)}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Low Stock Alert</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: lowStockCount > 0 ? 'var(--red)' : 'var(--green)' }}>{lowStockCount}</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--orange, #f97316)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Pending Procurement</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--orange, #f97316)' }}>{(procurements || []).filter(p => p.status === 'pending').length}</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '6px' }}>Vendors Linked</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--green)' }}>{vendors.length}</div>
        </div>
      </div>

      {/* Procurement Link Banner */}
      {(procurements || []).filter(p => p.status === 'pending').length > 0 && (
        <div style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '12px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
            {(procurements || []).filter(p => p.status === 'pending').length} pending procurement requests need to be fulfilled — adjust inventory quantities accordingly.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input className="fi" style={{ flex: 1 }} placeholder="🔍 Search items or category..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className={`btn ${filterLow ? 'btn-sky' : 'btn-ghost'} btn-sm`} onClick={() => setFilterLow(v => !v)}>
            {filterLow ? '✓ Low Stock Only' : 'Low Stock Only'}
          </button>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr><th>Item Name</th><th>Category</th><th>Quantity</th><th>Min Stock</th><th>Vendor</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>Loading...</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '48px', color: 'var(--text3)' }}>No items found</td></tr>}
              {filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{item.item_name}</div>
                    {item.notes && <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{item.notes}</div>}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{item.category || '—'}</td>
                  <td style={{ fontWeight: 700, color: item.low_stock ? 'var(--red)' : 'var(--text)' }}>
                    {item.quantity} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text3)' }}>{item.unit || ''}</span>
                  </td>
                  <td style={{ fontSize: '13px', color: 'var(--text3)' }}>{item.min_quantity} {item.unit || ''}</td>
                  <td style={{ fontSize: '13px' }}>{item.vendor_name || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td>
                    {item.low_stock ? (
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--red)', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: '4px' }}>LOW STOCK</span>
                    ) : (
                      <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--green)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '4px' }}>OK</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-sm" title="Adjust Quantity" onClick={() => { setAdjustModal({ open: true, item }); setAdjustment(''); }}>± Qty</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => deleteItem(item.id, item.item_name)}>
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

      {/* Add/Edit Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title={<span>{editItem ? 'Edit Item' : 'Add Inventory Item'}</span>} wide footer={
        <>
          <button className="btn btn-ghost" onClick={() => setAddModal(false)}>Cancel</button>
          <button className="btn btn-sky" onClick={saveItem}>{editItem ? 'Save Changes' : 'Add Item'}</button>
        </>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="fg" style={{ gridColumn: 'span 2' }}><label className="fl">Item Name *</label><input className="fi" placeholder="e.g. Cement Bags, PVC Pipe..." value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} /></div>
          <div className="fg"><label className="fl">Category</label><input className="fi" placeholder="e.g. Plumbing, Structure..." value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
          <div className="fg"><label className="fl">Unit</label><input className="fi" placeholder="e.g. bags, meters, pieces" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
          <div className="fg"><label className="fl">Current Quantity</label><input className="fi" type="number" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
          <div className="fg"><label className="fl">Minimum Stock Level</label><input className="fi" type="number" placeholder="0" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} /></div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="fl">Preferred Vendor</label>
            <select className="fs" value={form.vendor_id} onChange={e => setForm({ ...form, vendor_id: e.target.value })}>
              <option value="">No vendor linked</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.category})</option>)}
            </select>
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}><label className="fl">Notes</label><input className="fi" placeholder="Storage location, specs, etc." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>

      {/* Adjust Quantity Modal */}
      <Modal open={adjustModal.open} onClose={() => setAdjustModal({ open: false, item: null })} title={<span>Adjust Quantity — {adjustModal.item?.item_name}</span>} footer={
        <>
          <button className="btn btn-ghost" onClick={() => setAdjustModal({ open: false, item: null })}>Cancel</button>
          <button className="btn btn-sky" onClick={handleAdjust}>Apply Adjustment</button>
        </>
      }>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '8px' }}>Current Stock</div>
          <div style={{ fontSize: '32px', fontWeight: 800 }}>{adjustModal.item?.quantity} <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text3)' }}>{adjustModal.item?.unit}</span></div>
        </div>
        <div className="fg">
          <label className="fl">Adjustment (positive = add stock, negative = deduct)</label>
          <input className="fi" type="number" placeholder="e.g. +50 or -10" value={adjustment} onChange={e => setAdjustment(e.target.value)} />
        </div>
        {adjustment !== '' && !isNaN(parseFloat(adjustment)) && (
          <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg3)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
            New quantity: {(parseFloat(adjustModal.item?.quantity || 0) + parseFloat(adjustment)).toFixed(2)} {adjustModal.item?.unit}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default InventoryListPage;
