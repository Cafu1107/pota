import '@fontsource-variable/archivo/wdth.css';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router/dom';
import { registerSW } from 'virtual:pwa-register';
import { router } from './router';
import { CACHE_BUSTER, CACHE_MAX_AGE, persister, shouldPersist } from './lib/persist';
import './state/settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Restored data must outlive maxAge or it is dropped before it can paint.
      gcTime: CACHE_MAX_AGE,
      refetchOnWindowFocus: true,
    },
  },
});

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_MAX_AGE,
        buster: CACHE_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
);
