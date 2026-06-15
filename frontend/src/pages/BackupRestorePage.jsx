import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const ALL_TABLES = [
  'users', 'vendors', 'construction_leads', 'amc_leads',
  'pool_designs', 'design_files', 'quotations', 'attendence',
  'm2a_accounts', 'm2a_payments', 'm2a_expenditures',
  'ep_accounts', 'ep_payments', 'ep_expenditures', 'ep_invoices',
  'office_expenses', 'followup_schedule', 'followup_calls',
  'agent_daily_stats', 'client_reviews',
  'construction_sites', 'construction_plans', 'construction_logs',
  'construction_log_photos', 'amc_sites', 'amc_visits', 'amc_visit_photos',
  'procurements', 'salary_history', 'staff_profiles',
  'inventory', 'notifications',
];

const LABEL = {
  users: 'Users', vendors: 'Vendors', construction_leads: 'Construction Leads',
  amc_leads: 'AMC Leads', pool_designs: 'Pool Designs', design_files: 'Design Files',
  quotations: 'Quotations', attendence: 'Attendance', m2a_accounts: 'M2A Accounts',
  m2a_payments: 'M2A Payments', m2a_expenditures: 'M2A Expenditures',
  ep_accounts: 'EP Accounts', ep_payments: 'EP Payments', ep_expenditures: 'EP Expenditures',
  ep_invoices: 'EP Invoices', office_expenses: 'Office Expenses',
  followup_schedule: 'Follow-up Schedule', followup_calls: 'Follow-up Calls',
  agent_daily_stats: 'Agent Daily Stats', client_reviews: 'Client Reviews',
  construction_sites: 'Construction Sites', construction_plans: 'Construction Plans',
  construction_logs: 'Construction Logs', construction_log_photos: 'Construction Log Photos',
  amc_sites: 'AMC Sites', amc_visits: 'AMC Visits', amc_visit_photos: 'AMC Visit Photos',
  procurements: 'Procurements', salary_history: 'Salary History',
  staff_profiles: 'Staff Profiles', inventory: 'Inventory', notifications: 'Notifications',
};

const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-IN') : '—';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN') : '—';

export default function BackupRestorePage() {
  // ── create backup state ──
  const [selectedTables, setSelectedTables] = useState([...ALL_TABLES]);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // ── restore state ──
  const [restoreFile, setRestoreFile] = useState(null);
  const [restorePreview, setRestorePreview] = useState(null); // parsed JSON
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ── logs ──
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // ── reset ──
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // ── auto-backup ──
  const autoBackupDone = useRef(false);

  const showToast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;max-width:340px;box-shadow:0 4px 16px rgba(0,0,0,.2);background:${type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#10b981'}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const { data } = await axios.get('/backup/logs');
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // ── auto backup on mount ──
  useEffect(() => {
    if (autoBackupDone.current) return;
    autoBackupDone.current = true;

    // Daily auto-backup (if Drive connected — placeholder flag)
    const driveConnected = localStorage.getItem('google_drive_connected') === 'true';
    const lastDaily = localStorage.getItem('last_daily_drive_backup');
    const today = new Date().toDateString();
    if (driveConnected && lastDaily !== today) {
      silentAutoBackup('auto');
      localStorage.setItem('last_daily_drive_backup', today);
    }

    // Weekly local backup
    const lastWeekly = localStorage.getItem('last_weekly_local_backup');
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    if (!lastWeekly || Number(lastWeekly) < sevenDaysAgo) {
      const ok = window.confirm(
        '📦 Weekly Backup Reminder\n\nIt has been 7+ days since your last local backup.\n\nDownload a full backup now?'
      );
      if (ok) {
        triggerDownload([...ALL_TABLES], 'auto');
        localStorage.setItem('last_weekly_local_backup', String(Date.now()));
      } else {
        // Snooze 1 day
        localStorage.setItem('last_weekly_local_backup', String(Date.now() - 6 * 24 * 60 * 60 * 1000));
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const silentAutoBackup = async (type = 'auto') => {
    try {
      const tables = ALL_TABLES.join(',');
      const url = `/backup/export?tables=${encodeURIComponent(tables)}&backup_type=${type}`;
      await axios.get(url); // just triggers logging, no download
    } catch { /* silent */ }
  };

  const triggerDownload = async (tables, type = 'manual') => {
    const tableParam = tables.join(',');
    const url = `/backup/export?tables=${encodeURIComponent(tableParam)}&backup_type=${type}`;
    const a = document.createElement('a');
    a.href = (axios.defaults.baseURL || '') + url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCreateBackup = async () => {
    if (selectedTables.length === 0) {
      showToast('Select at least one table', 'error'); return;
    }
    setIsCreating(true);
    setProgress(0);

    const steps = [
      { pct: 10, msg: 'Connecting to database...' },
      { pct: 30, msg: 'Exporting tables...' },
      { pct: 60, msg: 'Packaging backup...' },
      { pct: 80, msg: 'Uploading to server logs...' },
      { pct: 95, msg: 'Preparing download...' },
    ];

    for (const s of steps) {
      await new Promise(r => setTimeout(r, 300));
      setProgress(s.pct);
      setProgressMsg(s.msg);
    }

    try {
      await triggerDownload(selectedTables, 'manual');
      setProgress(100);
      setProgressMsg('Backup downloaded successfully!');
      showToast('Backup created and downloaded');
      await fetchLogs();
    } catch {
      showToast('Backup failed', 'error');
    } finally {
      setTimeout(() => { setIsCreating(false); setProgress(0); setProgressMsg(''); }, 1200);
    }
  };

  // ── reset ──
  const handleReset = async () => {
    if (resetConfirmText !== 'RESET ALL DATA') {
      showToast('Type "RESET ALL DATA" exactly to confirm', 'error'); return;
    }
    const ok1 = window.confirm('⚠️ WARNING: This will permanently delete ALL data in every table.\n\nThis cannot be undone. Are you absolutely sure?');
    if (!ok1) return;
    const ok2 = window.confirm('🔴 FINAL CONFIRMATION\n\nEvery record in every table will be erased.\n\nClick OK to proceed with factory reset.');
    if (!ok2) return;

    setIsResetting(true);
    const fd = new FormData();
    fd.append('confirm', 'RESET');
    try {
      const { data } = await axios.post('/backup/reset', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      showToast(`Reset complete — ${data.tables_cleared?.length || 0} tables cleared`);
      setResetConfirmText('');
      await fetchLogs();
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Reset failed', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // ── restore ──
  const parseFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.tables) { showToast('Invalid backup file', 'error'); return; }
        setRestoreFile(file);
        setRestorePreview(data);
      } catch {
        showToast('Could not parse file — must be a valid JSON backup', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleFileDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) parseFile(file);
  };

  const handleRestore = async () => {
    if (!restoreFile || !restorePreview) return;

    const ok1 = window.confirm(
      '⚠️ WARNING: This will ERASE all current data and replace it with the backup.\n\nThis action CANNOT be undone.\n\nAre you sure you want to proceed?'
    );
    if (!ok1) return;

    const ok2 = window.confirm(
      '🔴 FINAL CONFIRMATION\n\nAll tables will be cleared and restored from:\n' +
      restoreFile.name + '\n\nBackup date: ' + (restorePreview.created_at?.slice(0, 10) || 'unknown') +
      '\n\nClick OK to start restore.'
    );
    if (!ok2) return;

    setIsRestoring(true);
    setRestoreProgress(10);

    const formData = new FormData();
    formData.append('file', restoreFile);

    const tick = setInterval(() => {
      setRestoreProgress(p => Math.min(p + 5, 90));
    }, 600);

    try {
      const { data } = await axios.post('/backup/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearInterval(tick);
      setRestoreProgress(100);
      showToast(`Restore complete — ${data.tables_restored?.length || 0} tables restored`);
      await fetchLogs();
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      clearInterval(tick);
      showToast(err?.response?.data?.detail || 'Restore failed', 'error');
      setIsRestoring(false);
      setRestoreProgress(0);
    }
  };

  const deleteLog = async (id) => {
    if (!window.confirm('Delete this log entry?')) return;
    try {
      await axios.delete(`/backup/logs/${id}`);
      setLogs(l => l.filter(x => x.id !== id));
    } catch {
      showToast('Could not delete log', 'error');
    }
  };

  const toggleTable = (t) =>
    setSelectedTables(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const allSelected = selectedTables.length === ALL_TABLES.length;

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text1)', marginBottom: '6px' }}>
          🗄️ Backup &amp; Restore
        </h1>
        <p style={{ color: 'var(--text3)', fontSize: '14px' }}>
          Export a full JSON snapshot of the CRM database or restore from a previous backup.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* ── CREATE BACKUP ── */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text1)', marginBottom: '16px' }}>
            📦 Create Backup
          </h2>

          {/* Table selector */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>
                Select tables ({selectedTables.length}/{ALL_TABLES.length})
              </span>
              <button
                onClick={() => setSelectedTables(allSelected ? [] : [...ALL_TABLES])}
                style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer' }}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px' }}>
              {ALL_TABLES.map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text2)', cursor: 'pointer', padding: '2px 0' }}>
                  <input
                    type="checkbox"
                    checked={selectedTables.includes(t)}
                    onChange={() => toggleTable(t)}
                    style={{ accentColor: '#3b82f6' }}
                  />
                  {LABEL[t] || t}
                </label>
              ))}
            </div>
          </div>

          {/* Progress */}
          {isCreating && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text3)', marginBottom: '6px' }}>
                <span>{progressMsg}</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: '#3b82f6', borderRadius: '4px', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          <button
            onClick={handleCreateBackup}
            disabled={isCreating || selectedTables.length === 0}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: 'none', cursor: isCreating ? 'not-allowed' : 'pointer',
              background: isCreating ? 'var(--border)' : '#3b82f6', color: '#fff', fontWeight: 600, fontSize: '14px',
            }}
          >
            {isCreating ? `${progress}% — ${progressMsg}` : '⬇️ Download Backup'}
          </button>

          <p style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '10px', lineHeight: '1.5' }}>
            The backup downloads as a JSON file to your computer. Store it safely — it can restore the entire database.
          </p>
        </div>

        {/* ── RESTORE ── */}
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text1)', marginBottom: '16px' }}>
            🔁 Restore from Backup
          </h2>

          {/* Drop zone */}
          <div
            onDrop={handleFileDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#3b82f6' : 'var(--border)'}`,
              borderRadius: '8px', padding: '28px', textAlign: 'center',
              cursor: 'pointer', marginBottom: '16px',
              background: dragOver ? 'rgba(59,130,246,0.05)' : 'var(--bg2)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>📂</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)', marginBottom: '4px' }}>
              {restoreFile ? restoreFile.name : 'Drop backup .json file here'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text3)' }}>or click to browse</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
          </div>

          {/* Preview */}
          {restorePreview && (
            <div style={{ background: 'var(--bg2)', borderRadius: '6px', padding: '12px', marginBottom: '16px', maxHeight: '180px', overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>
                Backup: <strong style={{ color: 'var(--text1)' }}>{restorePreview.created_at?.slice(0, 10)}</strong>
                &nbsp;|&nbsp; Type: <strong>{restorePreview.backup_type}</strong>
                &nbsp;|&nbsp; Version: {restorePreview.backup_version}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: 'var(--text3)' }}>
                    <th style={{ textAlign: 'left', padding: '3px 6px' }}>Table</th>
                    <th style={{ textAlign: 'right', padding: '3px 6px' }}>Records</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(restorePreview.tables).map(([tbl, meta]) => (
                    <tr key={tbl} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '3px 6px', color: 'var(--text2)' }}>{LABEL[tbl] || tbl}</td>
                      <td style={{ padding: '3px 6px', textAlign: 'right', color: 'var(--text1)', fontWeight: 600 }}>
                        {meta.count ?? meta.records?.length ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Restore progress */}
          {isRestoring && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text3)', marginBottom: '6px' }}>
                <span>Restoring database…</span><span>{restoreProgress}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${restoreProgress}%`, background: '#ef4444', borderRadius: '4px', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRestore}
              disabled={!restorePreview || isRestoring}
              style={{
                flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                cursor: (!restorePreview || isRestoring) ? 'not-allowed' : 'pointer',
                background: (!restorePreview || isRestoring) ? 'var(--border)' : '#ef4444',
                color: '#fff', fontWeight: 600, fontSize: '13px',
              }}
            >
              {isRestoring ? `Restoring ${restoreProgress}%…` : '🔁 Restore Now'}
            </button>
            {restorePreview && (
              <button
                onClick={() => { setRestoreFile(null); setRestorePreview(null); }}
                style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontSize: '13px' }}
              >
                Clear
              </button>
            )}
          </div>

          <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '10px', lineHeight: '1.5' }}>
            ⚠️ Restore is destructive — all current data will be overwritten. You will be asked to confirm twice.
          </p>
        </div>
      </div>

      {/* ── RESET DATA ── */}
      <div className="card" style={{ padding: '24px', marginTop: '24px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#ef4444', marginBottom: '6px' }}>
          🗑️ Reset All Data
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '18px', lineHeight: '1.6' }}>
          This will permanently erase <strong>every record in every table</strong> — leads, accounts, expenses, salary history, staff, vendors, inventory, everything.
          <br />It is recommended to <strong>download a backup first</strong> before resetting.
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text3)', display: 'block', marginBottom: '6px' }}>
              Type <strong style={{ color: '#ef4444' }}>RESET ALL DATA</strong> to unlock the button:
            </label>
            <input
              type="text"
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="RESET ALL DATA"
              style={{
                width: '100%', padding: '9px 12px', borderRadius: '6px',
                border: '1px solid rgba(239,68,68,0.4)', background: 'var(--bg2)',
                color: 'var(--text1)', fontSize: '13px', outline: 'none',
                fontFamily: 'monospace',
              }}
            />
          </div>
          <button
            onClick={handleReset}
            disabled={resetConfirmText !== 'RESET ALL DATA' || isResetting}
            style={{
              padding: '9px 22px', borderRadius: '6px', border: 'none',
              fontWeight: 600, fontSize: '13px', cursor: (resetConfirmText !== 'RESET ALL DATA' || isResetting) ? 'not-allowed' : 'pointer',
              background: (resetConfirmText !== 'RESET ALL DATA' || isResetting) ? 'var(--border)' : '#ef4444',
              color: '#fff', whiteSpace: 'nowrap',
            }}
          >
            {isResetting ? 'Resetting…' : '🗑️ Reset All Data'}
          </button>
        </div>
      </div>

      {/* ── AUTO BACKUP INFO ── */}
      <div className="card" style={{ padding: '20px', marginTop: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text1)', marginBottom: '14px' }}>
          🔄 Auto Backup Schedule
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {[
            {
              icon: '📅', title: 'Weekly Local Backup',
              desc: 'Runs automatically each week when you open the app. Prompts you to download a full JSON backup.',
              key: 'last_weekly_local_backup',
            },
            {
              icon: '☁️', title: 'Daily Drive Backup',
              desc: 'If Google Drive is connected, a silent backup is triggered once per day.',
              key: 'last_daily_drive_backup',
            },
            {
              icon: '📝', title: 'Backup Logging',
              desc: 'Every manual and auto backup is logged in the history table below.',
              key: null,
            },
          ].map(item => {
            const val = item.key ? localStorage.getItem(item.key) : null;
            const lastRun = val
              ? (item.key === 'last_daily_drive_backup' ? val : fmtDate(new Date(Number(val)).toISOString()))
              : 'Never';
            return (
              <div key={item.title} style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{item.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text1)', marginBottom: '4px' }}>{item.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px', lineHeight: '1.5' }}>{item.desc}</div>
                {item.key && (
                  <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                    Last run: <strong style={{ color: 'var(--text2)' }}>{lastRun}</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BACKUP HISTORY ── */}
      <div className="card" style={{ padding: '24px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text1)' }}>📋 Backup History</h2>
          <button
            onClick={fetchLogs}
            style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer' }}
          >
            ↻ Refresh
          </button>
        </div>

        {logsLoading ? (
          <p style={{ color: 'var(--text3)', fontSize: '13px' }}>Loading…</p>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: '13px' }}>No backups yet. Create your first backup above.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Backup File', 'Size', 'Type', 'Tables', 'Status', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px', color: 'var(--text1)', fontWeight: 500, maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.backup_name}
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text2)' }}>{log.backup_size || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                        background: log.backup_type === 'auto' ? 'rgba(139,92,246,.12)' : 'rgba(59,130,246,.12)',
                        color: log.backup_type === 'auto' ? '#8b5cf6' : '#3b82f6',
                      }}>
                        {log.backup_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text3)' }}>
                      {log.tables_included ? log.tables_included.split(',').length + ' tables' : '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                        background: log.status === 'success' ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                        color: log.status === 'success' ? '#10b981' : '#ef4444',
                      }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {fmt(log.created_at)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => deleteLog(log.id)}
                        title="Delete log"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
