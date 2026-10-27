import type { Account, AccountType } from './types';

// An account as a picker shows it: "PalmPay (NGN)", or just the name in pounds.
export const accountLabel = (a: Account) => `${a.name}${a.currency !== 'GBP' ? ` (${a.currency})` : ''}`;

// Accounts grouped the way I think about them: money I have, then what I owe. Empty groups are left out.
export const accountGroupOrder: { label: string; types: AccountType[] }[] = [
  { label: 'Money', types: ['Current'] },
  { label: 'Credit cards', types: ['CreditCard'] },
  { label: 'Loans', types: ['Loan'] },
];

export function accountGroups(accounts: Account[]) {
  return accountGroupOrder
    .map((g) => ({ label: g.label, accounts: accounts.filter((a) => g.types.includes(a.type)) }))
    .filter((g) => g.accounts.length > 0);
}
