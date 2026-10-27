import DateTimePicker from '@react-native-community/datetimepicker';
import { parseDate, toIsoDate } from '@lifetracker/core';
import { useColorScheme } from 'react-native';

import FormRow from './FormRow';
import { useTokens } from '@/theme/tokens';

// A date row with the iOS compact date picker: shows the date, tap it for a calendar.
// Values are "2026-10-21" strings, read and written as local dates so they never shift a day.
export default function DateRow({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const t = useTokens();
  const scheme = useColorScheme();
  return (
    <FormRow label={label}>
      <DateTimePicker
        value={parseDate(value)}
        mode="date"
        display="compact"
        accentColor={t.accent}
        themeVariant={scheme === 'dark' ? 'dark' : 'light'}
        onValueChange={(_, date) => onChange(toIsoDate(date))}
      />
    </FormRow>
  );
}
