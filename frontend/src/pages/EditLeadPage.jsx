import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const EditLeadPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, refreshLeads, toast } = useAppContext();

  const lead = leads.find(x => x.id === id);

  const [formData, setFormData] = useState({
    name: '', phone: '', loc: '', req: '', src: 'Meta Ad', pri: 'Normal', notes: '', leadType: 'construction'
  });

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name,
        phone: lead.phone,
        loc: lead.loc || '',
        req: lead.req || '',
        src: lead.src || 'Meta Ad',
        pri: lead.pri || 'Normal',
        notes: lead.notes || '',
        leadType: lead.leadType || 'construction'
      });
    }
  }, [lead]);

  if (!lead) return <Navigate to="/dashboard" />;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const saveEditLead = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast('❌ Name and phone are required', 'error');
      return;
    }

    try {
      const endpoint = lead.leadType === 'amc'
        ? `/amc-leads/update/${lead.db_id}`
        : `/construction-leads/update/${lead.db_id}`;

      const payload = {
        name: formData.name,
        phone: formData.phone,
        location: formData.loc,
        inquiry_source: formData.src,
        requirements: formData.req,
        priority: formData.pri,
        notes: formData.notes
      };

      await axios.put(endpoint, payload);

      refreshLeads();
      toast(`✅ Lead "${formData.name}" updated!`, 'success');
      navigate(-1);
    } catch (error) {
      console.error("Error updating lead:", error);
      toast('❌ Failed to update lead', 'error');
    }
  };

  return (
    <div className="page" id="page_edit_lead">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Edit Lead Profile</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Updating record for {lead.id}</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
      </div>

      <div className="card" style={{ maxWidth: '900px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div className="fg">
            <label className="fl">Client Name</label>
            <input className="fi" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter client name..." />
          </div>
          <div className="fg">
            <label className="fl">Phone Number</label>
            <input className="fi" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Enter phone number..." />
          </div>
          <div className="fg">
            <label className="fl">Location</label>
            <input className="fi" name="loc" value={formData.loc} onChange={handleInputChange} placeholder="Enter location..." />
          </div>
          <div className="fg">
            <label className="fl">Inquiry Source</label>
            <input className="fi" name="src" value={formData.src} onChange={handleInputChange} placeholder="Enter inquiry source..." />
          </div>
          <div className="fg">
            <label className="fl">Lead Type</label>
            <select className="fs" name="leadType" value={formData.leadType} onChange={handleInputChange}>
              <option value="construction">Pool Construction</option>
              <option value="amc">Pool Maintenance (AMC)</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Priority</label>
            <select className="fs" name="pri" value={formData.pri} onChange={handleInputChange}>
              <option>Normal</option><option>High</option><option>Urgent</option>
            </select>
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="fl">Requirements / Pool Size</label>
            <textarea className="ft" name="req" value={formData.req} onChange={handleInputChange} style={{ minHeight: '100px' }} />
          </div>
          <div className="fg" style={{ gridColumn: 'span 2' }}>
            <label className="fl">Internal Staff Notes</label>
            <textarea className="ft" name="notes" value={formData.notes} onChange={handleInputChange} placeholder="No internal notes provided" style={{ minHeight: '80px' }} />
          </div>
        </div>
        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button className="btn btn-sky" onClick={saveEditLead}>Update Lead Profile</button>
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>Discard Changes</button>
        </div>
      </div>
    </div>
  );
};

export default EditLeadPage;
