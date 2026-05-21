import React from 'react';

const EmptyState = ({ icon, title, subtitle }) => (
  <div className="empty">
    <div className="empty-icon">{icon || '📭'}</div>
    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>{title || 'No data found'}</div>
    <div style={{ fontSize: '13px', color: 'var(--text3)' }}>{subtitle || 'Try adjusting your filters or adding a new record.'}</div>
  </div>
);

export default EmptyState;
