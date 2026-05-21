import React from 'react';
import { useAppContext } from '../context/AppContext';
import { Navigate } from 'react-router-dom';
import axios from 'axios';

const CallTrackerPage = () => {
  const { agents, setAgents, callLog, setCallLog, checkAccess, toast, user, refreshCallTrack } = useAppContext();

  if (!checkAccess('calltracker')) return <Navigate to="/dashboard" />;

  const totalCalls  = agents.reduce((a, x) => a + x.calls, 0);
  const avgRate     = agents.length > 0 ? Math.round((agents.reduce((a, x) => a + x.calls / x.target, 0) / agents.length) * 100) : 0;
  const today       = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const addCall = async (id) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    try {
      await axios.post(`/call-track/increment-call/${agent.name}`);
      toast(`📞 Call incremented for ${agent.name}`, 'success');
      refreshCallTrack();
    } catch (error) {
      console.error("Error incrementing call:", error);
      toast('❌ Failed to increment call', 'error');
    }
  };

  const removeCall = async (id) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return;
    try {
      await axios.post(`/call-track/decrement-call/${agent.name}`);
      toast(`↩️ Call decremented for ${agent.name}`, 'warn');
      refreshCallTrack();
    } catch (error) {
      console.error("Error decrementing call:", error);
      toast('❌ Failed to decrement call', 'error');
    }
  };

  return (
    <div className="page" id="page_calltracker">
      <div className="ph" style={{ marginBottom: '24px' }}>
        <div className="ph-left">
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)' }}>Agent Performance Tracker</h1>
          <p style={{ fontSize: '13px', color: 'var(--text2)' }}>Live metrics and call volume monitoring — {today}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card stat" style={{ borderLeft: '4px solid var(--sky)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Total Team Calls</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{totalCalls}</div>
          <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '8px', fontWeight: 600 }}>LIVE Monitoring Active</div>
        </div>
        <div className="card stat" style={{ borderLeft: '4px solid var(--green)' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: '8px' }}>Target Completion</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--text)' }}>{avgRate}%</div>
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px' }}>Combined team efficiency</div>
        </div>
      </div>

      {/* Agents Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)' }}>Team Performance Matrix</span>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Daily Target</th>
                <th>Calls Logged</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(a => {
                const pct = Math.min(100, (a.calls / a.target) * 100);
                return (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--sky)', fontWeight: 800 }}>
                          {a.name.charAt(0)}
                        </div>
                        {a.name}
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: '13px' }}>{a.target}</td>
                    <td>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: pct >= 100 ? 'var(--green)' : 'var(--text)' }}>{a.calls}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: '120px', height: '6px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--sky)', transition: '0.5s' }}></div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '35px' }}>{Math.round(pct)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Call History Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text3)' }}>System-wide Call History</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ width: '8px', height: '8px', background: 'var(--green)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></span>
             <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text3)' }}>LIVE FEED</span>
          </div>
        </div>
        <div className="tw" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Client Name</th>
                <th>Touchpoint</th>
                <th>Duration</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {callLog.length > 0 ? callLog.map((l, i) => (
                <tr key={i}>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--text3)' }}>{l.time}</td>
                  <td style={{ fontWeight: 700 }}>{l.agent}</td>
                  <td>{l.client}</td>
                  <td>
                    <span style={{ fontSize: '11px', background: 'var(--bg3)', padding: '2px 8px', borderRadius: '4px' }}>Call #{l.cn}</span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{l.dur}</td>
                  <td>
                    <span style={{ 
                      fontSize: '11px', fontWeight: 800, 
                      color: l.out.includes('Converted') ? 'var(--green)' : l.out.includes('Interested') ? 'var(--sky)' : 'var(--text3)',
                      background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)'
                    }}>
                      {l.out.toUpperCase()}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '60px', color: 'var(--text3)' }}>No interaction logs detected for today</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CallTrackerPage;
