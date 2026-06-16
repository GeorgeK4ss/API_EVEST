import React from 'react';
import ExcelUploader from './components/ExcelUploader';

function App() {
  return (
    <div className="ap-shell">
      <header className="ap-header">
        <div className="ap-logo">
          <i className="bi bi-graph-up-arrow" style={{ fontSize: '1.5rem' }}></i>
        </div>
        <div>
          <h1 className="ap-title">Affiliate Leads Panel</h1>
          <p className="ap-subtitle">Upload your Excel file and push leads straight to the broker.</p>
        </div>
        <span className="ap-badge">
          <span className="ap-dot"></span>
          Broker API connected
        </span>
      </header>

      <ExcelUploader />
    </div>
  );
}

export default App;
