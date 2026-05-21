import React, { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import PriBadge from '../components/common/PriBadge';
import axios from 'axios';

const LeadDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, setLeads, designs, setDesigns, checkAccess, toast, refreshLeads } = useAppContext();
  const l = leads.find(x => x.id === id);
  const [selectedStatus, setSelectedStatus] = useState(l?.status || '');
  const [saving, setSaving] = useState(false);

  if (!l) return <Navigate to="/dashboard" />;

  const chStatus = (st) => {
    setSelectedStatus(st);
  };

  const saveStatus = async () => {
    setSaving(true);
    try {
      const params = new URLSearchParams();
      params.append('lead_code', l.id);
      params.append('new_status', selectedStatus);

      await axios.put('/pipeline/update-status', params);

      refreshLeads();
      toast(`✅ Status updated to ${selectedStatus.toUpperCase()}`, 'success');
    } catch (error) {
      console.error("Error updating status:", error);
      toast('❌ Failed to update status', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async () => {
    if (!window.confirm(`Are you sure you want to delete lead ${l.name}?`)) return;
    
    try {
      await axios.delete(`/pipeline/delete/${l.id}`);
      
      refreshLeads();
      toast(`🗑️ Lead "${l.name}" deleted successfully`, 'success');
      navigate(-1);
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast('❌ Failed to delete lead', 'error');
    }
  };

  const fwdDesign = () => {
    setLeads(prev => prev.map(x => x.id === id ? { ...x, status: 'design' } : x));
    if (!designs.find(d => d.leadId === l.id)) {
      setDesigns(prev => [{
        leadId: l.id,
        client: l.name,
        req: l.req,
        designer: 'Unassigned',
        style: 'Modern',
        status: 'progress'
      }, ...prev]);
    }
    toast(`📐 Sent to Design department`, 'success');
    navigate('/design');
  };



  return (
    <div className="page" id="page_lead_detail" style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <div className="ph" style={{ marginBottom: '24px', padding: 0 }}>
          <div className="ph-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Lead Details</h1>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Detailed overview for {l.name} ({l.id})</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-sky" onClick={() => navigate(`/leads/edit/${l.id}`)}>Edit Profile</button>
            <button className="btn" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={deleteLead}>Delete Lead</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Main Info */}
          <div className="card" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div style={{ width: '80px', height: '80px', background: 'var(--bg3)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>👤</div>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>{l.name}</h2>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <StatusBadge status={l.status} />
                    <PriBadge pri={l.pri} />
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase' }}>Lead Type</div>
                <div style={{ fontWeight: 700, color: 'var(--sky)' }}>{l.leadType === 'amc' ? 'Maintenance' : 'Construction'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              <div className="dg-item">
                <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '4px' }}>Phone Number</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{l.phone}</div>
              </div>
              <div className="dg-item">
                <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '4px' }}>Location</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{l.loc}</div>
              </div>
              <div className="dg-item">
                <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '4px' }}>Inquiry Source</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{l.src}</div>
              </div>
            </div>

            <div style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700 }}>Client Requirements</div>
              <div style={{ padding: '20px', background: 'var(--bg2)', borderRadius: '12px', lineHeight: '1.6', color: 'var(--text2)' }}>
                {l.req}
              </div>
            </div>
            {l.notes && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '12px', fontWeight: 700 }}>Internal Notes</div>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '13px', whiteSpace: 'pre-wrap', color: 'var(--text3)' }}>
                  {l.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailPage;
