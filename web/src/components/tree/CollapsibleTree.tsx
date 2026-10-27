import type { ReactNode } from 'react';
import { useExpanded } from '../../hooks/useExpanded';
import { cn } from '../../lib/cn';
import type { TreeNode } from '@lifetracker/core';

export interface RowContext {
  depth: number;
  expandable: boolean;   // has children and the tree is collapsible: show an ExpandButton
  expanded: boolean;
  toggle: () => void;
  controls: string;      // the id of the children's list, for aria-controls
}

// Any tree as nested lists, where each node's children can be opened and closed (an accordion),
// at any depth. Which nodes are open is remembered per page. With collapsible off (larger screens)
// every node is open and there's nothing to toggle, so the page looks as it always did.
// Each page draws its own rows through renderRow; the tree logic lives only here.
export default function CollapsibleTree<T>({ nodes, page, collapsible, renderRow, className }: {
  nodes: TreeNode<T>[];
  page: string;                 // which page's open rows to remember, e.g. "budget"
  collapsible: boolean;
  renderRow: (node: TreeNode<T>, context: RowContext) => ReactNode;
  className?: string;
}) {
  const { isOpen, toggle } = useExpanded(page);

  function rows(list: TreeNode<T>[], depth: number): ReactNode {
    return list.map((node) => {
      const hasChildren = node.children.length > 0;
      const expanded = !collapsible || isOpen(node.id);
      const controls = `${page}-children-${node.id}`;
      return (
        <li key={node.id}>
          {renderRow(node, { depth, expandable: collapsible && hasChildren, expanded, toggle: () => toggle(node.id), controls })}
          {hasChildren && expanded && (
            <ul id={controls} className="divide-y divide-line border-t border-line">{rows(node.children, depth + 1)}</ul>
          )}
        </li>
      );
    });
  }

  return <ul className={cn('divide-y divide-line', className)}>{rows(nodes, 0)}</ul>;
}
