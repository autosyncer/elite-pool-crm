import React from 'react';
import { useAppContext } from '../../context/AppContext';

const Toasts = () => {
  const { toasts } = useAppContext();

  return (
    <div id="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.msg}
        </div>
      ))}
    </div>
  );
};

export default Toasts;
