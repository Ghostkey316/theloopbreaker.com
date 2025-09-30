import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

if (typeof window !== 'undefined') {
  window.__VAULTFIRE_DASHBOARD_ENV__ = import.meta.env;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
