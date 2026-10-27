import type { SelectHTMLAttributes } from 'react';
import type { Account } from '@lifetracker/core';
import { Select } from '../../components/ui/Field';

const groups = [
  { label: 'Money', types: ['Current'] },
  { label: 'Credit cards', types: ['CreditCard'] },
  { label: 'Loans', types: ['Loan'] },
] as const;

// An account picker grouped the way I think about them: money I have, then what I owe.
// placeholder: a "choose one" prompt that can't be picked. allLabel: a real "all accounts" choice (value "").
export default function AccountSelect({ accounts, placeholder, allLabel, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & {
  accounts: Account[];
  placeholder?: string;
  allLabel?: string;
}) {
  return (
    <Select {...rest}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {allLabel && <option value="">{allLabel}</option>}
      {groups.map((g) => {
        const inGroup = accounts.filter((a) => (g.types as readonly string[]).includes(a.type));
        return inGroup.length === 0 ? null : (
          <optgroup key={g.label} label={g.label}>
            {inGroup.map((a) => (
              <option key={a.id} value={a.id}>{a.name}{a.currency !== 'GBP' ? ` (${a.currency})` : ''}</option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}
