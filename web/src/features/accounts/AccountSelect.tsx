import type { SelectHTMLAttributes } from 'react';
import type { Account } from '@lifetracker/core';
import { accountGroups, accountLabel } from '@lifetracker/core';
import { Select } from '../../components/ui/Field';

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
      {accountGroups(accounts).map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.accounts.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
        </optgroup>
      ))}
    </Select>
  );
}
