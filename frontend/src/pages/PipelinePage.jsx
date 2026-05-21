import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import StatusBadge from '../components/common/StatusBadge';
import PriBadge from '../components/common/PriBadge';

const PipelinePage = () => {
  const { 
    leads, checkAccess, refreshLeads, toast, 
    designs, refreshDesigns, 
    quotes, refreshQuotes, 
    followups, refreshFollowups 
  } = useAppContext();
  const navigate = useNavigate();
  const [expandedCols, setExpandedCols] = useState({});
  const [loading, setLoading] = useState(false);
  const [timeframe, setTimeframe] = useState('all');

  useEffect(() => {
    refreshLeads();
    if (refreshDesigns) refreshDesigns();
    if (refreshQuotes) refreshQuotes();
    if (refreshFollowups) refreshFollowups();
  }, []);

  const toggleExpand = (colKey) => {
    setExpandedCols(prev => ({
      ...prev,
      [colKey]: !prev[colKey]
    }));
  };

  const updateStatus = async (leadCode, newStatus) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('lead_code', leadCode);
      formData.append('new_status', newStatus);

      await axios.put('/pipeline/update-status', formData);
      
      refreshLeads();
      toast(`✅ Status updated to ${newStatus.toUpperCase()}`, 'success');
    } catch (error) {
      console.error("Error updating status:", error);
      toast('❌ Failed to update status', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!checkAccess('pipeline')) {
    return <Navigate to="/dashboard" />;
  }

  const PCOLS = [
    { k: 'new', label: 'New Leads', color: 'var(--sky)' },
    { k: 'design', label: 'In Design', color: 'var(--pink)' },
    { k: 'quoted', label: 'Quoted', color: 'var(--gold)' },
    { k: 'followup', label: 'Follow-up', color: 'var(--green)' },
    { k: 'closed', label: 'Closed', color: 'var(--red)' },
  ];

  return (
    <div className="page" id="page_pipeline">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Sales Pipeline</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Drag-and-drop visual tracking (Coming Soon)</p>
        </div>
        <div className="ph-right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text2)' }}>Timeframe:</span>
          <select 
            className="fs" 
            style={{ width: '150px', padding: '6px 12px', borderRadius: '8px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '13px' }} 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
          >
            <option value="all">All Leads</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>
      </div>

      <div className="pipeline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', overflowX: 'auto', minHeight: '600px', paddingBottom: '20px' }}>
        {PCOLS.map(c => {
          const cl = leads.filter(l => l.leadType === 'construction').filter(l => {
            // Apply timeframe filtering
            if (timeframe !== 'all') {
              if (!l.date) return false;
              const leadDate = new Date(l.date);
              const now = new Date();
              if (timeframe === 'today') {
                if (leadDate.toDateString() !== now.toDateString()) return false;
              } else if (timeframe === 'week') {
                const diffTime = Math.abs(now - leadDate);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                if (diffDays > 7) return false;
              } else if (timeframe === 'month') {
                const diffTime = Math.abs(now - leadDate);
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                if (diffDays > 30) return false;
              }
            }

            const associatedDesign = (designs || []).find(d => d.leadId === l.id);
            const associatedQuote = (quotes || []).find(q => q.leadId === l.id);
            const associatedFollowup = (followups || []).find(f => String(f.leadId) === String(l.db_id) && f.leadType === l.leadType);

            // Closed is mutually exclusive
            if (l.status === 'closed') {
              return c.k === 'closed';
            }
            if (c.k === 'closed') return false;

            // Check match for each pipeline column
            if (c.k === 'design') {
              return associatedDesign && associatedDesign.status === 'progress';
            }
            if (c.k === 'quoted') {
              return associatedQuote && associatedQuote.status === 'pending';
            }
            if (c.k === 'followup') {
              return !!associatedFollowup;
            }
            if (c.k === 'new') {
              const hasDesign = associatedDesign && associatedDesign.status === 'progress';
              const hasQuote = !!associatedQuote;
              const hasFollowup = !!associatedFollowup;
              return !hasDesign && !hasQuote && !hasFollowup;
            }
            return false;
          });
          return (
            <div key={c.k} style={{ background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minWidth: '240px' }}>
              <div style={{ padding: '16px', borderBottom: `2px solid ${c.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '1px' }}>{c.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, background: 'var(--bg3)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text2)' }}>{cl.length}</span>
              </div>
              
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                {cl.length > 0 ? (
                  <>
                    {(expandedCols[c.k] ? cl : cl.slice(0, 5)).map(l => {
                      const associatedDesign = (designs || []).find(d => d.leadId === l.id);
                      const associatedQuote = (quotes || []).find(q => q.leadId === l.id);
                      const associatedFollowup = (followups || []).find(f => String(f.leadId) === String(l.db_id) || String(f.leadId) === String(l.id));

                      return (
                        <div 
                          key={l.id} 
                          className="pcard" 
                          onClick={() => navigate(`/leads/${l.id}`)}
                          style={{ 
                            background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '10px', 
                            padding: '14px', cursor: 'pointer', transition: '0.2s', position: 'relative' 
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.borderColor = 'var(--border2)';
                            e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.3)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{l.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📍 {l.loc}
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>

                          <span style={{ fontSize: '10px', color: 'var(--text2)', background: 'var(--bg3)', padding: '2px 6px', borderRadius: '4px' }}>{l.src}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Delete this lead?')) {
                                  axios.delete(`/pipeline/delete/${l.id}`).then(() => {
                                    refreshLeads();
                                    toast('🗑️ Lead removed', 'success');
                                  });
                                }
                              }}
                              style={{ 
                                background: 'transparent', border: 'none', color: '#ef4444', 
                                cursor: 'pointer', fontSize: '14px', padding: '4px', opacity: 0.6 
                              }}
                              onMouseEnter={e => e.currentTarget.style.opacity = 1}
                              onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                              title="Delete Lead"
                            >
                              🗑️
                            </button>
                            <PriBadge priority={l.pri} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                    
                    {cl.length > 5 && (
                      <button
                        onClick={() => toggleExpand(c.k)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--sky)',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '8px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          marginTop: '4px',
                          transition: '0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {expandedCols[c.k] ? 'Show Less ↑' : `Show More (${cl.length - 5} more) ↓`}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: '11px' }}>
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .pcard {
          animation: fadeIn 0.3s ease;
        }
      `}</style>
    </div>
  );
};

export default PipelinePage;
