import React from 'react';

const StatusBadge = ({ status }) => {
  const s = status?.toLowerCase() || 'new';
  
  // Map internal status to display classes
  const map = {
    'new': 's-new',
    'design': 's-design',
    'quoted': 's-quoted',
    'followup': 's-followup',
    'closed': 's-closed',
    'active': 's-followup',
    'done': 's-followup',
    'pending': 's-quoted',
    'sent': 's-followup'
  };

  return (
    <span className={`s ${map[s] || 's-new'}`}>
      {status}
    </span>
  );
};

export default StatusBadge;
