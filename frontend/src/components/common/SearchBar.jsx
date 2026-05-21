import React from 'react';

const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="search-box">
    <span className="search-icon">
      <svg className="fi-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </span>
    <input 
      type="text" 
      placeholder={placeholder || "Search..."}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="fi search-input"
    />
  </div>
);

export default SearchBar;
