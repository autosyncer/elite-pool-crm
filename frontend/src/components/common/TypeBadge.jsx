import React from 'react';

const TypeBadge = ({ type }) => {
  const isAmc = type?.toLowerCase().includes('amc');
  return (
    <span className={`pill ${isAmc ? 'pill-gold' : 'pill-sky'}`}>
      {isAmc ? 'AMC' : 'Construction'}
    </span>
  );
};

export default TypeBadge;
