import '@fontsource/poiret-one/400.css';
import '@fontsource-variable/montserrat/wght.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// PayPal returns to /?donation=ok|cancelled|error. Keep the result, then show the confirmation page.
const q = new URLSearchParams(window.location.search);
if (q.get('donation')) {
  sessionStorage.setItem('rf_result', JSON.stringify({ kind: q.get('donation'), id: q.get('d'), reason: q.get('reason') }));
  window.history.replaceState(null, '', '/#/thanks');
}

createRoot(document.getElementById('root')).render(<App />);
