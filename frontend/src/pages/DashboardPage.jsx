import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import StatusBadge from '../components/common/StatusBadge';
import PriBadge from '../components/common/PriBadge';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { leads, quotes, followups, designs, agents } = useAppContext();

  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const res = await axios.get('/dashboard/kpis');
        setKpis(res.data);
      } catch (err) {
        console.error("Error fetching dashboard KPIs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, []);

  const totalLeads = kpis?.leads?.total ?? leads.length;
  const quotesSent = kpis?.quotations?.sent ?? quotes.filter(q => q.status === 'sent').length;
  const followupActive = kpis?.followups?.active ?? followups.length;
  const pendingDesigns = kpis?.pipeline?.design ?? designs.filter(d => d.status === 'progress').length;

  const recentLeads = leads.slice(0, 5);

  // Map lead sources to match backend enum keys with user-friendly labels
  const leadSources = [
    { label: 'Meta Ads', key: 'meta_ad' },
    { label: 'Google Ads', key: 'google_ad' },
    { label: 'Referrals', key: 'referral' },
    { label: 'Walk-ins', key: 'walk_in' },
    { label: 'Other', key: 'other' }
  ];

  // Fallback agents list
  const displayAgents = (kpis?.agents && kpis.agents.length > 0)
    ? kpis.agents.map((a, idx) => ({ id: idx, name: a.agent_name, calls: a.calls_today, target: 20 }))
    : agents;

  const StatCard = ({ title, value, delta, color, icon }) => (
    <div className="card stat" style={{ borderBottom: `2px solid var(--${color})`, position: 'relative', minWidth: '240px', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>{title}</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
          <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '8px' }}>{delta}</div>
        </div>
        <div style={{ opacity: 0.8, color: `var(--${color})` }}>{icon}</div>
      </div>
    </div>
  );

  return (
    <div className="page" id="page_dashboard" style={{ height: 'auto', minHeight: '100%', overflowY: 'visible', overflowX: 'hidden', width: '100%' }}>
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Executive Overview</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Live metrics for Elite Pool Builders</p>
        </div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text3)' }}>
            <span className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--sky)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
            Syncing live data...
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', WebkitOverflowScrolling: 'touch', gap: '20px', marginBottom: '24px', paddingBottom: '8px' }}>
        <StatCard 
          title="Total Leads" 
          value={totalLeads} 
          delta={kpis?.leads?.new_this_month !== undefined ? `↑ +${kpis.leads.new_this_month} this month` : "↑ +3 this week"} 
          color="sky" 
          icon={<svg className="fi-icon" style={{width:24,height:24}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>} 
        />
        <StatCard 
          title="Quotes Sent" 
          value={quotesSent} 
          delta={kpis?.quotations?.total !== undefined ? `${kpis.quotations.total} total quotations` : "₹ 14.8L value"} 
          color="green" 
          icon={<svg className="fi-icon" style={{width:24,height:24}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>} 
        />
        <StatCard 
          title="Active Follow-up" 
          value={followupActive} 
          delta={kpis?.followups?.calls_today !== undefined ? `${kpis.followups.calls_today} logged today` : "8 pending today"} 
          color="gold" 
          icon={<svg className="fi-icon" style={{width:24,height:24}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>} 
        />
        <StatCard 
          title="In Design" 
          value={pendingDesigns} 
          delta={kpis?.sites?.active_construction !== undefined ? `${kpis.sites.active_construction} active sites` : "3 needs action"} 
          color="pink" 
          icon={<svg className="fi-icon" style={{width:24,height:24}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m13.5 10.5 5 5"></path><path d="m3.5 18.5 5-5"></path><circle cx="11.5" cy="8.5" r="5.5"></circle></svg>} 
        />
      </div>

      <div className="dash-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', marginBottom: '24px' }}>
        {/* Recent Leads */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Recent Leads</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/leads-construction')}>View All</button>
          </div>
          <div className="tw" style={{ border: 'none', overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Location</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map(l => (
                  <tr key={l.id} onClick={() => navigate(`/leads/${l.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{l.name}</div>
                      <div className="mono" style={{ fontSize: '11px', color: 'var(--text3)' }}>{l.phone}</div>
                    </td>
                    <td style={{ fontSize: '13px' }}>{l.loc}</td>
                    <td style={{ fontSize: '12px', textTransform: 'capitalize' }}>{l.src?.replace('_', ' ')}</td>
                    <td><StatusBadge status={l.status} /></td>
                    <td><PriBadge priority={l.pri} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pipeline & Sources */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>Pipeline Summary</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'New', count: kpis?.pipeline?.new ?? leads.filter(l => l.status === 'new').length, color: 'var(--sky)' },
                { label: 'Design', count: kpis?.pipeline?.design ?? leads.filter(l => l.status === 'design').length, color: 'var(--pink)' },
                { label: 'Quoted', count: kpis?.pipeline?.quoted ?? leads.filter(l => l.status === 'quoted').length, color: 'var(--gold)' },
                { label: 'Follow-up', count: kpis?.pipeline?.followup ?? leads.filter(l => l.status === 'followup').length, color: 'var(--green)' }
              ].map(s => (
                <div key={s.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text2)' }}>{s.label}</span>
                    <span style={{ fontWeight: 600 }}>{s.count}</span>
                  </div>
                  <div style={{ height: '6px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${totalLeads > 0 ? (s.count / totalLeads) * 100 : 0}%`, background: s.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>Lead Sources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leadSources.map(src => {
                const count = kpis?.sources?.[src.key] ?? leads.filter(l => l.src === src.key).length;
                return (
                  <div key={src.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, fontSize: '12px', color: 'var(--text2)' }}>{src.label}</div>
                    <div style={{ width: '120px', height: '8px', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${totalLeads > 0 ? (count / totalLeads) * 100 : 0}%`, background: 'var(--teal)' }}></div>
                    </div>
                    <div style={{ width: '20px', fontSize: '11px', fontWeight: 600, textAlign: 'right' }}>{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="dash-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Agent Performance */}
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>Agent Performance</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {displayAgents.map(a => (
              <div key={a.id} className="card2" style={{ textAlign: 'center', padding: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>{a.name?.split(' ')[0]}</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--sky)' }}>{a.calls}</div>
                <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase' }}>calls</div>
                <div style={{ height: '4px', background: 'var(--bg3)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (a.calls / a.target) * 100)}%`, background: 'var(--sky)' }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Follow-up Activity */}
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px' }}>Follow-up Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {followups.slice(0, 3).map(f => (
              <div key={f.leadId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'var(--bg3)', borderRadius: '8px' }}>
                <div style={{ width: '32px', height: '32px', background: 'var(--card2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>{f.calls.filter(c => c.done).length}/5 touches completed</div>
                </div>
                <div style={{ color: 'var(--gold)', display: 'flex', gap: '2px' }}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < f.rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
