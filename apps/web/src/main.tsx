import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './fonts/fonts';
import './index.css';
import { preloadCoreFonts } from './fonts/fonts';
import { flushUnsynced } from './lib/projectRepo';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

// Warm the default preset's faces immediately: the first canvas paint happens
// before React finishes mounting the editor, and an unloaded face renders in a
// fallback without any error.
void preloadCoreFonts();

// Any edits that never reached the server get pushed on the next start.
void flushUnsynced();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
