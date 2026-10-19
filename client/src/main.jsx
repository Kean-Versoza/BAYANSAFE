import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/style.css';

const container = document.getElementById('root');

// StrictMode is intentionally not used: the loader measures and annotates the
// real DOM, and running its effects twice would double the skeleton paint.
createRoot(container).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
