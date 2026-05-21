import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAppContext, API_BASE_URL } from '../context/AppContext';

const AddLeadPage = () => {
  const navigate = useNavigate();
  const { checkAccess, refreshLeads, addNotification, toast } = useAppContext();
  const [formData, setFormData] = useState({
    name: '', phone: '', loc: '', src: 'Meta Ad', lt: 'construction', req: '', 
    projectFeatures: [], pri: 'Normal', notes: ''
  });

  if (!checkAccess('addlead')) return <Navigate to="/dashboard" />;

  const handleFileUpload = async (file) => {
    if (!file || !file.name.endsWith('.csv')) { toast('❌ Please upload a valid CSV', 'error'); return; }
    
    const formDataImport = new FormData();
    formDataImport.append('file', file);

    try {
      const endpoint = formData.lt === 'amc' 
        ? `${API_BASE_URL}/amc-leads/Import_Leads_csv_amc`
        : `${API_BASE_URL}/construction-leads/Import_Leads_csv_construction`;

      await axios.post(endpoint, formDataImport, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      refreshLeads();
      toast(`✅ Leads imported successfully!`, 'success');
      navigate(formData.lt === 'amc' ? '/leads-amc' : '/leads-construction');
    } catch (error) {
      console.error("Error importing leads:", error);
      toast('❌ Failed to import leads', 'error');
    }
  };

  const saveLead = async () => {
    if (!formData.name || !formData.phone) { toast('Name and phone required', 'error'); return; }
    
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        loc: formData.loc,
        src: formData.src,
        lt: formData.lt,
        req: formData.req,
        budget: formData.projectFeatures, // Mapping features to budget list in backend
        pri: formData.pri,
        notes: formData.notes
      };

      await axios.post('/add-leads/create', payload);
      
      refreshLeads();
      
      addNotification({
        type: 'create',
        module: formData.lt === 'amc' ? 'AMC & Maintenance' : 'Construction',
        action: 'Lead Added',
        message: `New Lead "${formData.name}" added to ${formData.lt === 'amc' ? 'AMC' : 'Construction'}`,
      });

      toast(`✅ Lead "${formData.name}" added!`, 'success');
      navigate(formData.lt === 'amc' ? '/leads-amc' : '/leads-construction');
    } catch (error) {
      console.error("Error creating lead:", error);
      toast('❌ Failed to create lead', 'error');
    }
  };


  const FEATURE_OPTIONS = ["End-to-End", "MEP", "With Kids Pool"];

  const toggleFeature = (feature) => {
    setFormData(prev => ({
      ...prev,
      projectFeatures: prev.projectFeatures.includes(feature)
        ? prev.projectFeatures.filter(f => f !== feature)
        : [...prev.projectFeatures, feature]
    }));
  };

  return (
    <div className="page" id="page_add_lead" style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '800px' }}>
        <div className="ph" style={{ marginBottom: '24px', padding: 0 }}>
          <div className="ph-left">
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Create New Lead</h1>
            <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Register a new client inquiry manually into the CRM</p>
          </div>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="fg"><label className="fl">Client Name *</label><input className="fi" name="name" placeholder="Enter full name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            <div className="fg"><label className="fl">Phone Number *</label><input className="fi" name="phone" placeholder="+91 XXXXX XXXXX" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
            <div className="fg"><label className="fl">Location</label><input className="fi" name="loc" placeholder="City, State" value={formData.loc} onChange={e => setFormData({...formData, loc: e.target.value})} /></div>
            <div className="fg"><label className="fl">Inquiry Source</label>
              <select className="fs" value={formData.src} onChange={e => setFormData({...formData, src: e.target.value})}>
                <option>Meta Ad</option><option>Cold Call</option><option>Website</option><option>Referral</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Lead Type</label>
              <select className="fs" value={formData.lt} onChange={e => setFormData({...formData, lt: e.target.value})}>
                <option value="construction">Pool Construction</option><option value="amc">AMC / Maintenance</option>
              </select>
            </div>
            <div className="fg"><label className="fl">Priority</label>
              <select className="fs" value={formData.pri} onChange={e => setFormData({...formData, pri: e.target.value})}>
                <option>Normal</option><option>High</option><option>Urgent</option>
              </select>
            </div>


            <div className="fg" style={{ gridColumn: 'span 2' }}>
              <label className="fl" style={{ marginBottom: '12px' }}>Project Features</label>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {FEATURE_OPTIONS.map(feature => {
                  const isSelected = formData.projectFeatures.includes(feature);
                  return (
                    <div 
                      key={feature}
                      onClick={() => toggleFeature(feature)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        background: isSelected ? 'rgba(56,189,248,0.1)' : 'var(--bg2)',
                        border: `1px solid ${isSelected ? 'var(--sky)' : 'var(--border)'}`,
                        color: isSelected ? 'var(--sky)' : 'var(--text2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <div style={{ 
                        width: '8px', height: '8px', borderRadius: '50%', 
                        background: isSelected ? 'var(--sky)' : 'var(--text3)' 
                      }}></div>
                      {feature}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="fg" style={{ gridColumn: 'span 2' }}>
              <label className="fl">Requirements</label>
              <textarea className="ft" placeholder="e.g. 20x40ft infinity pool..." style={{ minHeight: '100px' }} value={formData.req} onChange={e => setFormData({...formData, req: e.target.value})} />
            </div>
          </div>
          <button className="btn btn-sky" style={{ width: '100%', marginTop: '12px' }} onClick={saveLead}>Create Lead Record</button>
        </div>
      </div>
    </div>
  );
};

const parseCSV = (text) => {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return headers.reduce((obj, header, index) => { obj[header] = values[index]; return obj; }, {});
  });
};

export default AddLeadPage;
