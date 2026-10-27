import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTokens } from '@/theme/tokens';

// A rounded group of rows with hairlines between them, like a section in iOS Settings,
// with an optional note underneath. Rows that render nothing (false, null) are skipped.
export default function FormSection({ children, footer }: { children: ReactNode; footer?: string }) {
  const t = useTokens();
  const rows = Children.toArray(children);
  return (
    <View>
      <View style={[styles.section, { backgroundColor: t.surface, borderColor: t.line }]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.separator, { backgroundColor: t.line }]} />}
            {row}
          </Fragment>
        ))}
      </View>
      {footer ? <Text style={[styles.footer, { color: t.muted }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth },
  footer: { fontSize: 13, lineHeight: 18, marginTop: 6, marginHorizontal: 16 },
});
