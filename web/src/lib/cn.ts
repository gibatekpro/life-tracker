// Joins class names, skipping the false/undefined ones: cn('a', isOn && 'b').
export const cn = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');
