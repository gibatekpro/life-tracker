import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { getAccounts, getSettings, setDefaultAccount, updateSettings } from '../../api';
import type { IncomeMode, Settings } from '../../types';
import { useData } from '../../data/useData';
import { useRefresh } from '../../data/refresh';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Icon from '../../components/ui/Icon';
import { Field, MoneyInput, Select } from '../../components/ui/Field';
import { Alert, Badge, PageHeader, SegmentedControl, Skeleton } from '../../components/ui/Bits';
import { ordinal } from '../../lib/format';
import AccountSelect from '../accounts/AccountSelect';
import CategoriesCard from '../categories/CategoriesCard';

const incomeModes: { value: IncomeMode; label: string }[] = [
  { value: 'Fixed', label: 'Take-home pay' },
  { value: 'Recorded', label: 'Recorded income' },
];

const startDays = Array.from({ length: 28 }, (_, i) => i + 1);

// Income, the debt budget and when a budget month starts. Its own component so the inputs
// start from the saved values.
function BudgetForm({ settings }: { settings: Settings }) {
  const { refresh } = useRefresh();
  const [incomeMode, setIncomeMode] = useState<IncomeMode>(settings.incomeMode);
  const [income, setIncome] = useState(String(settings.monthlyIncome));
  const [budget, setBudget] = useState(settings.monthlyDebtBudget?.toString() ?? '');
  const [startDay, setStartDay] = useState(settings.monthStartDay);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      await updateSettings({
        monthlyIncome: Number(income || 0),
        monthlyDebtBudget: budget === '' ? null : Number(budget),
        incomeMode,
        monthStartDay: startDay,
      });
      setStatus({ ok: true, text: 'Saved' });
      refresh();
    } catch (err) {
      setStatus({ ok: false, text: (err as Error).message });
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-2">
        <p className="text-sm font-medium">Measure spending against</p>
        <SegmentedControl label="Measure spending against" options={incomeModes} value={incomeMode} onChange={setIncomeMode} />
        <p className="text-xs text-muted">
          {incomeMode === 'Fixed'
            ? 'A set monthly amount. Simple, and right if your pay is the same every month.'
            : 'The Income transactions you record each month. Right if your pay varies or you have more than one income.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {incomeMode === 'Fixed' && (
          <Field label="Monthly take-home pay">
            {(id) => <MoneyInput id={id} symbol="£" required value={income} onChange={(e) => setIncome(e.target.value)} />}
          </Field>
        )}
        <Field label="Budget month starts on"
          hint={startDay === 1 ? 'Calendar months.' : `Each month runs from the ${ordinal(startDay)} to the day before the next ${ordinal(startDay)}.`}>
          {(id) => (
            <Select id={id} value={startDay} onChange={(e) => setStartDay(Number(e.target.value))}>
              {startDays.map((d) => <option key={d} value={d}>{d === 1 ? '1st (calendar month)' : `${ordinal(d)} (payday)`}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Monthly debt budget" hint="Optional. A fixed amount for all debts; when one is cleared, its payment rolls on to the rest.">
          {(id) => <MoneyInput id={id} symbol="£" placeholder="Not set" value={budget} onChange={(e) => setBudget(e.target.value)} />}
        </Field>
      </div>

      <div className="flex items-center justify-end gap-3">
        {status && (
          <span role="status" className={status.ok ? 'inline-flex items-center gap-1 text-sm text-positive' : 'text-sm text-negative'}>
            {status.ok && <Icon name="check" className="size-4" />}{status.text}
          </span>
        )}
        <Button type="submit" variant="primary">Save budget</Button>
      </div>
    </form>
  );
}

// My personal settings: the numbers the summary and debt plan use, and how Apple Pay
// captures find their account.
export default function SettingsPage() {
  const settings = useData('settings', getSettings);
  const accounts = useData('accounts', getAccounts);
  const { refresh } = useRefresh();
  const [defaultError, setDefaultError] = useState<string | null>(null);

  async function changeDefault(value: string) {
    setDefaultError(null);
    try {
      await setDefaultAccount(value === '' ? null : Number(value));
      refresh();
    } catch (err) {
      setDefaultError((err as Error).message);
    }
  }

  const s = settings.data;
  const withNames = accounts.data ?? [];

  return (
    <>
      <PageHeader title="Settings" description="Your income and budget, categories, and how Apple Pay payments find their account." />

      {(settings.error || accounts.error) && <Alert tone="negative" className="mb-6">{settings.error ?? accounts.error}</Alert>}

      <div className="grid max-w-3xl gap-6">
        <Card title="Income and budget" description="What the monthly summary measures against, and when your month starts.">
          {s ? <BudgetForm key={s.updatedAt} settings={s} /> : <Skeleton className="h-28" />}
        </Card>

        <CategoriesCard />

        <Card title="Apple Pay capture"
          description="An iOS Shortcut sends each Apple Pay payment here with the card's Wallet name, and it's recorded as an expense.">
          <ol className="mb-6 grid gap-2 text-sm text-muted">
            <li className="flex gap-2"><Badge tone="accent">1</Badge> An account with a matching Apple Pay name</li>
            <li className="flex gap-2"><Badge tone="accent">2</Badge> An account whose name matches the card</li>
            <li className="flex gap-2"><Badge tone="accent">3</Badge> Otherwise, the default account below</li>
          </ol>

          <Field label="Default account" hint="Where a payment goes when no card name matches.">
            {(id) => s && accounts.data ? (
              <AccountSelect id={id} accounts={accounts.data} allLabel="No default (reject unmatched payments)"
                value={s.defaultAccountId ?? ''} onChange={(e) => changeDefault(e.target.value)} />
            ) : <Skeleton className="h-10" />}
          </Field>
          {defaultError && <Alert tone="negative" className="mt-3">{defaultError}</Alert>}

          <h3 className="mt-6 mb-2 text-sm font-medium">Card names set up</h3>
          {!accounts.data ? <Skeleton className="h-24" /> : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {withNames.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <Link to={`/accounts/${a.id}`} className="font-medium hover:underline">{a.name}</Link>
                  <span className="flex flex-wrap gap-1.5">
                    {a.aliases.length === 0
                      ? <span className="text-subtle">Name only</span>
                      : a.aliases.map((x) => <Badge key={x.id}>{x.alias}</Badge>)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Add names on each account's page. Case and punctuation are ignored.</p>
        </Card>

        <Card title="Appearance">
          <p className="text-sm text-muted">Light and dark mode follow your device's setting.</p>
        </Card>
      </div>
    </>
  );
}
