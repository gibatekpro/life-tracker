import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import Icon, { type IconName } from './Icon';

const variants = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-muted hover:bg-surface-muted hover:text-ink',
  danger: 'bg-negative-soft text-negative hover:brightness-95',
};

const sizes = {
  sm: 'h-8 gap-1.5 px-3 text-sm',
  md: 'h-10 gap-2 px-4 text-sm',
};

// A button with only an icon is square (it needs an aria-label instead of text).
const iconOnlySizes = {
  sm: 'size-8 text-sm',
  md: 'size-10 text-sm',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  icon?: IconName;
};

// type="button" by default, so a button inside a form only submits when asked to.
export default function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant], children ? sizes[size] : iconOnlySizes[size], className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} className="size-4" />}
      {children}
    </button>
  );
}
