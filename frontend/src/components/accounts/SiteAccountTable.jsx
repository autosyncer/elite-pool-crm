import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

const SiteAccountTable = ({ company }) => {
  const { siteAccounts, checkAccess } = useAppContext();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('newest');

  const filteredAccounts = siteAccounts
    .filter(s => {
      if (company === 'm2a') return s.isM2A;
      return s.isElitePool;
    })
    .filter(s => {
      const q = search.toLowerCase();
      return s.siteName.toLowerCase().includes(q) || s.location.toLowerCase().includes(q);
    })
    .filter(s => {
      if (filter === 'construction') return s.projectType === 'construction';
      if (filter === 'amc') return s.projectType === 'amc';
      return true;
    })
    .sort((a, b) => {
      if (sort === 'name') return a.siteName.localeCompare(b.siteName);
      return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    });

  const calculateTotals = (s) => {
    const totalIn = s.totalIn || 0;
    const totalOut = s.totalOut || 0;
    return { totalIn, totalOut, balance: totalIn - totalOut };
  };

  return (
    <div className="card">
      <div className="card-head">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
          <span className="card-title">
            {company === 'm2a' ? '🏗️ M2A Project Accounts' : '🏊 Elite Pool Operations'}
          </span>
          <div className="toolbar">
            <input 
              className="si" 
              placeholder="🔍 Search site…" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
            <select className="sel" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All Types</option>
              <option value="construction">Construction</option>
              <option value="amc">AMC</option>
            </select>
            <select className="sel" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="newest">Latest Updated</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>
      </div>
      <div className="tw">
        <table>
          <thead>
            <tr>
              <th>Site Name</th>
              <th>Location</th>
              <th>Type</th>
              <th>Received</th>
              <th>Expenditure</th>
              <th>Balance</th>
              <th>Updated</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length > 0 ? filteredAccounts.map(s => {
              const { totalIn, totalOut, balance } = calculateTotals(s);
              return (
                <tr key={s.id} onClick={() => toast('Detail view coming soon', 'info')}>
                  <td style={{ fontWeight: 700, color: 'var(--text)' }}>{s.siteName}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text3)' }}>{s.location}</td>
                  <td>
                    <span className="pill pill-sky">
                      {s.linkedSiteId.startsWith('CS') ? 'Construction' : 'AMC'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--green)', fontWeight: 600 }}>₹{totalIn.toLocaleString('en-IN')}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 600 }}>₹{totalOut.toLocaleString('en-IN')}</td>
                  <td style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                    ₹{balance.toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text3)' }}>{s.lastUpdated}</td>
                  <td>
                    <button className="btn btn-sky btn-xs">📂 Open</button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text3)', padding: '20px' }}>
                  No site accounts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SiteAccountTable;
