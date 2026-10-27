import { Fragment } from 'react';
import type { NotePart } from '@lifetracker/core';

const toneClass = { negative: 'text-negative', warning: 'text-warning', positive: 'text-positive' };

// A line's note from core (budgetLineNote, debtLineNote): its pieces joined with " · ", each in its tone.
export default function NoteParts({ parts }: { parts: NotePart[] }) {
  return parts.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && ' · '}
      <span className={p.tone ? toneClass[p.tone] : undefined}>{p.text}</span>
    </Fragment>
  ));
}
