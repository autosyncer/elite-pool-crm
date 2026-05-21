import React, { useState } from 'react';
import axios from 'axios';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../common/StatusBadge';
import PriBadge from '../common/PriBadge';
import TypeBadge from '../common/TypeBadge';
import SearchBar from '../common/SearchBar';
import EmptyState from '../common/EmptyState';

const LeadTable = ({ type }) => {
  const { leads, setLeads, refreshLeads, checkAccess, addNotification, toast } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sort, setSort] = useState('d-desc');

  const filteredLeads = leads
    .filter(l => type === 'construction' ? (l.leadType === 'construction' || !l.leadType) : (l.leadType === 'amc'))
    .filter(l => {
      const q = search.toLowerCase();
      return l.name.toLowerCase().includes(q) || l.phone.includes(q) || l.loc.toLowerCase().includes(q) || String(l.id).toLowerCase().includes(q);
    })
    .filter(l => !statusFilter || l.status === statusFilter)
    .filter(l => !priorityFilter || l.pri === priorityFilter)
    .sort((a, b) => {
      if (sort === 'd-asc') return a.date.localeCompare(b.date);
      if (sort === 'd-desc') return b.date.localeCompare(a.date);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const delLead = async (db_id, lead_code, leadType) => {
    if (window.confirm(`Are you sure you want to delete lead ${lead_code}?`)) {
      try {
        const endpoint = leadType === 'amc' 
          ? `/amc-leads/delete/${db_id}`
          : `/construction-leads/delete/${db_id}`;
        
        await axios.delete(endpoint);
        refreshLeads();
        
        addNotification({
          type: 'delete',
          module: leadType === 'amc' ? 'AMC & Maintenance' : 'Construction',
          action: 'Lead Deleted',
          message: `Lead ${lead_code} was removed from the system.`,
          entityId: lead_code
        });

        toast('🗑 Lead deleted successfully', 'info');
      } catch (error) {
        console.error("Error deleting lead:", error);
        toast('❌ Failed to delete lead', 'error');
      }
    }
  };

  const exportLeads = () => {
    if (filteredLeads.length === 0) { toast('No leads to export', 'error'); return; }
    const headers = ['ID', 'Name', 'Phone', 'Location', 'Type', 'Source', 'Status', 'Priority', 'Date', 'Requirements'];
    const rows = filteredLeads.map(l => [
      l.id, l.name, l.phone, `"${l.loc}"`, l.leadType || 'construction', l.src, l.status, l.pri, l.date, `"${l.req || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Leads_${type}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('✅ Leads exported to CSV', 'success');
  };

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="table-toolbar">
        <div className="table-toolbar-left">
          <SearchBar value={search} onChange={setSearch} placeholder="Search leads..." />
          <select className="fs" style={{ width: '130px' }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All Priority</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
          </select>
          <select className="fs" style={{ width: '150px' }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="d-desc">Newest First</option>
            <option value="d-asc">Oldest First</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        <div className="table-toolbar-right">
          <button className="btn btn-ghost btn-sm" onClick={exportLeads}>
            <svg className="fi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" style={{ width: '14px', height: '14px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </button>
        </div>
      </div>

      <div className="tw" style={{ border: 'none' }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>Location</th>
              <th>Type</th>
              <th>Source</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length > 0 ? filteredLeads.map(l => (
              <tr key={l.id} onClick={() => navigate(`/leads/${l.id}`)} style={{ cursor: 'pointer' }}>
                <td className="mono" style={{ fontSize: '11px', color: 'var(--sky)' }}>{l.id}</td>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{l.name}</div>
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{l.phone}</div>
                </td>
                <td style={{ fontSize: '13px' }}>{l.loc}</td>
                <td><TypeBadge type={l.leadType || 'construction'} /></td>
                <td style={{ color: 'var(--text2)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>{l.src}</td>
                <td><StatusBadge status={l.status} /></td>
                <td><PriBadge priority={l.pri} /></td>
                <td style={{ fontSize: '11px', color: 'var(--text3)' }}>{l.date.split(' ')[0]}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/leads/edit/${l.id}`)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                    </button>
                    {(checkAccess('ceo') || checkAccess('admin')) && (
                      <button className="btn btn-red btn-sm" title="Delete Lead" onClick={() => delLead(l.db_id, l.id, l.leadType)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="9">
                  <EmptyState title={`No ${type} leads found`} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadTable;
