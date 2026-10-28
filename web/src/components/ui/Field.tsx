import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import Icon from './Icon';

// The look every control shares; one-line controls add their height (a second height class
// wouldn't override it, so the textarea builds on this instead).
const surface =
  'w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-subtle ' +
  'transition focus:border-accent focus:ring-3 focus:ring-accent/20 focus:outline-none disabled:opacity-60';
const control = `h-10 ${surface}`;

// A label, the control, and an optional hint. The control gets the label's id through the
// render function, so clicking the label focuses it and screen readers read them together:
//   <Field label="Amount">{(id) => <Input id={id} ... />}</Field>
export function Field({ label, hint, children, className }: {
  label: ReactNode;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">{label}</label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...rest} />;
}

// Several lines of text, growing with the page rather than scrolling inside a one-line box.
export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(surface, 'min-h-20 resize-y py-2 leading-relaxed', className)} {...rest} />;
}

// A money input: decimal keypad on phones, right-aligned digits, and the currency symbol inside.
export function MoneyInput({ symbol, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { symbol: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-subtle">{symbol}</span>
      <input type="number" step="0.01" min="0" inputMode="decimal"
        className={cn(control, 'pl-8 tabular-nums', className)} {...rest} />
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(control, 'appearance-none pr-9', className)} {...rest}>{children}</select>
      <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" />
    </div>
  );
}
