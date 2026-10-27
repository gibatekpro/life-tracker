import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { getAccounts, getCategories, getExchangeRates } from '../../api';
import { useData } from '../../data/useData';
import { cn } from '../../lib/cn';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import TransactionForm from '../../features/transactions/TransactionForm';
import { TransactionModalContext, type TransactionDraft } from '../../features/transactions/quickAdd';
import type { Transaction } from '@lifetracker/core';
import BottomNav from './BottomNav';
import { navItems } from './navItems';

type ModalState = { draft: TransactionDraft } | { transaction: Transaction } | null;

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden="true">
          <path d="M8 21l5-5 4 3 7-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span className="font-semibold tracking-tight">Life Tracker</span>
    </div>
  );
}

// The frame around every page: a sidebar on wide screens, a top bar and bottom tabs on phones.
// It also owns the one transaction form, which any page can open to add (useQuickAdd) or edit
// (useEditTransaction) a transaction.
export default function AppLayout() {
  const accounts = useData('accounts', getAccounts);
  const categories = useData('categories', getCategories);
  const rates = useData('rates', getExchangeRates);
  const [modal, setModal] = useState<ModalState>(null);
  const openQuickAdd = (draft?: TransactionDraft) => setModal({ draft: draft ?? {} });
  const editing = modal && 'transaction' in modal ? modal.transaction : undefined;

  return (
    <TransactionModalContext.Provider value={{ add: openQuickAdd, edit: (transaction) => setModal({ transaction }) }}>
      <div className="min-h-dvh lg:pl-64">
        {/* Sidebar (desktop) */}
        <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
          <div className="px-2"><Brand /></div>
          <Button variant="primary" icon="plus" className="mt-8 w-full" onClick={() => openQuickAdd()}>
            New transaction
          </Button>
          <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-muted hover:text-ink',
                )}>
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <p className="mt-auto px-3 text-xs text-subtle">Spending, debts and payoff, in one place.</p>
        </aside>

        {/* Top bar (phones) */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <Brand />
          <Button variant="primary" size="sm" icon="plus" onClick={() => openQuickAdd()} aria-label="New transaction">
            New
          </Button>
        </header>

        <main className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12">
          <Outlet />
        </main>

        <BottomNav />
      </div>

      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={editing ? 'Edit transaction' : 'New transaction'}
        description={editing ? 'Balances are corrected to match.' : 'Spending, money in, or a transfer between your accounts.'}>
        <TransactionForm accounts={accounts.data ?? []} categories={categories.data ?? []} rates={rates.data ?? []} transaction={editing}
          draft={modal && 'draft' in modal ? modal.draft : undefined} onDone={() => setModal(null)} />
      </Modal>
    </TransactionModalContext.Provider>
  );
}
