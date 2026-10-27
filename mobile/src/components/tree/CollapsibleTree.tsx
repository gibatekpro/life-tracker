import type { TreeNode } from '@lifetracker/core';
import { Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useExpanded } from '@/hooks/useExpanded';
import { useTokens } from '@/theme/tokens';

export interface RowContext {
  depth: number;
  expandable: boolean; // has children: the row can open and close them
  expanded: boolean;
  toggle: () => void;
}

// Any tree as nested rows where each node's children open and close (an accordion), at any depth
// (web: CollapsibleTree, as on its small screens). Which nodes are open is remembered per screen.
// Each screen draws its own rows through renderRow; the tree logic lives only here.
export default function CollapsibleTree<T>({ nodes, page, renderRow }: {
  nodes: TreeNode<T>[];
  page: string; // which screen's open rows to remember, e.g. "budget"
  renderRow: (node: TreeNode<T>, context: RowContext) => ReactNode;
}) {
  const t = useTokens();
  const { isOpen, toggle } = useExpanded(page);
  const line = <View style={[styles.line, { backgroundColor: t.line }]} />;

  function rows(list: TreeNode<T>[], depth: number): ReactNode {
    return list.map((node, i) => {
      const hasChildren = node.children.length > 0;
      const expanded = isOpen(node.id);
      return (
        <Fragment key={node.id}>
          {(depth > 0 || i > 0) && line}
          {renderRow(node, { depth, expandable: hasChildren, expanded, toggle: () => toggle(node.id) })}
          {hasChildren && expanded && rows(node.children, depth + 1)}
        </Fragment>
      );
    });
  }

  return <View>{rows(nodes, 0)}</View>;
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth },
});
