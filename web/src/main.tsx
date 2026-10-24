import { StrictMode, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import './index.css';
import RefreshProvider from './data/RefreshProvider';
import AppLayout from './components/layout/AppLayout';
import RouteError from './components/layout/RouteError';

// Loads a page's code the first time it's opened, so the charts library and other pages
// aren't downloaded until they're needed.
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

// Each section of the app has its own URL, inside the shared layout.
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, lazy: page(() => import('./features/overview/OverviewPage')) },
          { path: 'transactions', lazy: page(() => import('./features/transactions/TransactionsPage')) },
          { path: 'budget', lazy: page(() => import('./features/budget/BudgetPage')) },
          { path: 'accounts', lazy: page(() => import('./features/accounts/AccountsPage')) },
          { path: 'accounts/:id', lazy: page(() => import('./features/accounts/AccountDetailPage')) },
          { path: 'plan', lazy: page(() => import('./features/plan/DebtPlanPage')) },
          { path: 'insights', lazy: page(() => import('./features/insights/InsightsPage')) },
          { path: 'settings', lazy: page(() => import('./features/settings/SettingsPage')) },
          { path: '*', element: <RouteError notFound /> },
        ],
      },
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
