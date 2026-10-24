import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { cn } from '../../lib/cn';
import Icon from '../ui/Icon';
import { navItems } from './navItems';

const tabClass = (active: boolean) => cn(
  'flex flex-col items-center gap-1 py-2 text-[11px] font-medium',
  active ? 'text-accent' : 'text-muted',
);

// The phone's bottom bar: four tabs and More, which opens the other sections in a small panel
// above the bar. The panel closes when a section is chosen, on Escape, or on a tap outside it.
export default function BottomNav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const tabs = navItems.filter((i) => i.phone === 'tab');
  const more = navItems.filter((i) => i.phone === 'more');
  const onMorePage = more.some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {open && <div className="fixed inset-0 z-10 lg:hidden" aria-hidden onClick={() => setOpen(false)} />}

      <nav aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {open && (
          <ul id="more-menu" className="absolute right-2 bottom-full mb-2 w-52 overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-dialog">
            {more.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-surface-muted',
                  )}>
                  <Icon name={item.icon} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-5">
          {tabs.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setOpen(false)}
              className={({ isActive }) => tabClass(isActive)}>
              <Icon name={item.icon} />
              {item.short}
            </NavLink>
          ))}
          <button type="button" aria-expanded={open} aria-controls="more-menu" onClick={() => setOpen((o) => !o)}
            className={tabClass(open || onMorePage)}>
            <Icon name="more" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
