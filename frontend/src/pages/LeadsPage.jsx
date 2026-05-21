import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAppContext, API_BASE_URL } from '../context/AppContext';
import LeadTable from '../components/leads/LeadTable';
import Modal from '../components/common/Modal';

const LeadsPage = ({ type }) => {
  const navigate = useNavigate();
  const { checkAccess, refreshLeads, addNotification, toast } = useAppContext();
  const [importModal, setImportModal] = useState(false);

  if (!checkAccess('leads')) {
    return <Navigate to="/dashboard" />;
  }

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return headers.reduce((obj, header, index) => { obj[header] = values[index]; return obj; }, {});
    });
  };

  const handleFileUpload = async (file) => {
    if (!file || !file.name.endsWith('.csv')) { toast('❌ Please upload a valid CSV', 'error'); return; }
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = type === 'amc' 
        ? `${API_BASE_URL}/amc-leads/Import_Leads_csv_amc`
        : `${API_BASE_URL}/construction-leads/Import_Leads_csv_construction`;

      await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      refreshLeads();
      
      addNotification({
        type: 'create',
        module: type === 'construction' ? 'Construction Leads' : 'AMC & Repair Leads',
        action: 'Bulk Import',
        message: `Imported leads via CSV into ${type === 'construction' ? 'Construction' : 'AMC'}`,
      });

      toast(`✅ Leads imported successfully!`, 'success');
      setImportModal(false);
    } catch (error) {
      console.error("Error importing leads:", error);
      toast('❌ Failed to import leads', 'error');
    }
  };

  return (
    <div className="page">
      <div className="ph">
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>
            {type === 'construction' ? 'Construction Leads' : 'AMC & Repair Leads'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '4px' }}>
            {type === 'construction' 
              ? 'Manage and track pool construction inquiries' 
              : 'Manage and track AMC, repair, and renovation inquiries'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button className="btn btn-sky" onClick={() => navigate('/addlead')}>+ Add New Lead</button>
        <button className="btn btn-ghost" onClick={() => setImportModal(true)}>
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
           Import CSV
        </button>
      </div>

      <LeadTable key={type} type={type} />

      {/* Import Modal */}
      <Modal open={importModal} onClose={() => setImportModal(false)} title={`📦 Bulk Import ${type === 'construction' ? 'Construction' : 'AMC'} Leads`}>
        <div style={{ padding: '40px 20px', border: '2px dashed var(--border)', borderRadius: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', cursor: 'pointer', transition: '0.2s' }} 
             onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--sky)'; e.currentTarget.style.background = 'rgba(56,189,248,0.05)'; }} 
             onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; }}
             onDrop={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; handleFileUpload(e.dataTransfer.files[0]); }}>
          <label style={{ cursor: 'pointer', display: 'block' }}>
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={e => handleFileUpload(e.target.files[0])} />
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📁</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>Drop CSV File Here</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '8px', lineHeight: '1.5' }}>
               Supported columns: <strong>name, phone, location, requirements</strong><br/>
               The import will automatically be tagged as <strong>{type.toUpperCase()}</strong>
            </div>
            <button className="btn btn-sky btn-sm" style={{ marginTop: '20px' }}>Browse Files</button>
          </label>
        </div>
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
           <button className="btn btn-ghost btn-sm" onClick={() => setImportModal(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
};

export default LeadsPage;
