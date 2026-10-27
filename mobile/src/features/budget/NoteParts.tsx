import type { NotePart } from '@lifetracker/core';
import { Fragment } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A line's note from core (budgetLineNote, debtLineNote): its pieces joined with " · ", each in its tone.
export default function NoteParts({ parts, style }: { parts: NotePart[]; style?: StyleProp<TextStyle> }) {
  const t = useTokens();
  return (
    <Text style={[{ color: t.muted, fontSize: 12, lineHeight: 17 }, style]}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          <Text style={p.tone ? { color: t[p.tone] } : undefined}>{p.text}</Text>
        </Fragment>
      ))}
    </Text>
  );
}
