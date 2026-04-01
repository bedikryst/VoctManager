/**
 * @file main.tsx
 * @description Application entry point. Bootstraps React, Context Providers, Data Query Client, and routing.
 * @architecture Enterprise 2026 Standards
 * @module core/main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CursorProvider } from './app/providers/CursorProvider'; 
import { AuthProvider } from './app/providers/AuthProvider';
import './shared/config/i18n';
import App from './app/App';
import './app/styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 2, 
    },
  },
});

const rootElement = document.getElementById('root')!;

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CursorProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </CursorProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
