import { useState, type FormEvent } from 'react';
import { addAlias, removeAlias } from '../../api';
import type { Account } from '@lifetracker/core';
import { useRefresh } from '../../data/refresh';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import { Input } from '../../components/ui/Field';
import { Alert } from '../../components/ui/Bits';

// The names Apple Pay might send for this card, e.g. "Lloyd's" for "Lloyds Current".
// Capture matches them ignoring case and punctuation; anything unmatched goes to the default account.
export default function AliasesCard({ account }: { account: Account }) {
  const { refresh } = useRefresh();
  const [alias, setAlias] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await addAlias(account.id, alias.trim());
      setAlias('');
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(aliasId: number) {
    setError(null);
    try {
      await removeAlias(account.id, aliasId);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Card title="Apple Pay names"
      description={<>Wallet card names that should land in this account. <span className="whitespace-nowrap">“{account.name}” already matches.</span></>}>
      {account.aliases.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {account.aliases.map((a) => (
            <li key={a.id} className="inline-flex items-center gap-1 rounded-full bg-surface-muted py-1 pr-1 pl-3 text-sm">
              {a.alias}
              <button type="button" onClick={() => remove(a.id)} aria-label={`Remove ${a.alias}`}
                className="rounded-full p-1 text-subtle hover:bg-line hover:text-ink">
                <Icon name="x" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <Input aria-label="New Apple Pay name" placeholder="e.g. Lloyd's" maxLength={100} value={alias}
          onChange={(e) => setAlias(e.target.value)} />
        <Button type="submit" disabled={alias.trim() === ''}>Add</Button>
      </form>
      {error && <Alert tone="negative" className="mt-3">{error}</Alert>}
    </Card>
  );
}
