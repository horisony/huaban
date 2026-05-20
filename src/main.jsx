import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyPageSeo, getInitialLang } from './lib/seo.js';
import './styles/app.css';

applyPageSeo(getInitialLang());
createRoot(document.getElementById('root')).render(<App />);
