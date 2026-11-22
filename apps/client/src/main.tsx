import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { RefProvider } from './ui/Refs.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RefProvider>
      <App />
    </RefProvider>
  </StrictMode>,
);
