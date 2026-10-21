import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

// The panel everything sits in. A title and an action (e.g. a "View all" link) are optional.
export default function Card({ title, description, action, children, className, bodyClassName }: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(title || action ? 'p-5 pt-4' : 'p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
