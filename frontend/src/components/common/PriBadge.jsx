import React from 'react';

const PriBadge = ({ priority, pri }) => {
  const p = (priority || pri || 'Normal').toLowerCase();
  
  const map = {
    'urgent': 'pb-urgent',
    'high': 'pb-high',
    'normal': 'pb-normal'
  };

  return (
    <span className={`pb ${map[p] || 'pb-normal'}`}>
      {priority || pri || 'Normal'}
    </span>
  );
};

export default PriBadge;
