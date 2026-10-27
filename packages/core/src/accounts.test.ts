import { describe, expect, it } from 'vitest';

import { accountGroups, accountLabel } from './accounts';
import { account } from './testData';

describe('accountGroups', () => {
  it('orders money, then cards, then loans, leaving out empty groups and keeping order within one', () => {
    const groups = accountGroups([
      account({ id: 1, name: 'Ease Cash', type: 'Loan', currency: 'NGN' }),
      account({ id: 2, name: 'Lloyds' }),
      account({ id: 3, name: 'PalmPay', currency: 'NGN' }),
    ]);
    expect(groups.map((g) => [g.label, g.accounts.map(accountLabel)])).toEqual([
      ['Money', ['Lloyds', 'PalmPay (NGN)']],
      ['Loans', ['Ease Cash (NGN)']],
    ]);
  });
});
