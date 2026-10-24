import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import Icon from '../ui/Icon';

// The name of an expandable row, as a real button: a chevron that turns when open, aria-expanded
// for screen readers, and aria-controls pointing at the list it opens.
export default function ExpandButton({ expanded, controls, onClick, children, className }: {
  expanded: boolean;
  controls: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button type="button" aria-expanded={expanded} aria-controls={controls} onClick={onClick}
      className={cn('-mx-1 flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-surface-muted', className)}>
      <Icon name="chevronRight" className={cn('size-4 shrink-0 text-subtle transition-transform', expanded && 'rotate-90')} />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
