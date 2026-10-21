import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import './index.css';
import RefreshProvider from './data/RefreshProvider';
import AppLayout from './components/layout/AppLayout';
import OverviewPage from './features/overview/OverviewPage';
import TransactionsPage from './features/transactions/TransactionsPage';
import { LegacyAccounts, LegacyPlan, LegacySettings } from './features/legacy';

// Each section of the app has its own URL, inside the shared layout.
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'accounts', element: <LegacyAccounts /> },
      { path: 'plan', element: <LegacyPlan /> },
      { path: 'settings', element: <LegacySettings /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RefreshProvider>
      <RouterProvider router={router} />
    </RefreshProvider>
  </StrictMode>,
);
