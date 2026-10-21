import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

// The panel everything sits in. A title and an action (e.g. a "View all" link) are optional.
// flush drops the body padding, for content that runs edge to edge (toolbars, lists).
export default function Card({ title, description, action, children, className, bodyClassName, flush }: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  flush?: boolean;
}) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface shadow-card', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn(!flush && 'p-4 sm:p-5', !flush && Boolean(title || action) && 'pt-4 sm:pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}
