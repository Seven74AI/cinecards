import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { RefProvider } from './ui/Refs.tsx';
import { FpsMeter } from './ui/FpsMeter.tsx';
import { fpsWanted } from './game/perf.ts';
import { warmAudio } from './audio/sfx.ts';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RefProvider>
      <App />
      {fpsWanted(location.search) ? <FpsMeter /> : null}
    </RefProvider>
  </StrictMode>,
);

// story 13.12: the sound engine starts on the first touch, not inside the first action (a long frame on phones)
warmAudio();
