/**
 * @file main.tsx
 * @description Application entry point. Bootstraps React, Context Providers, Data Query Client, and routing.
 * @author Krystian Bugalski
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CursorProvider } from './context/CursorContext'; 
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './assets/styles/index.css';

// Initialize the data fetching client with Enterprise-grade caching defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // Data remains fresh for 5 minutes
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