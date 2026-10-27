// A node of a tree (the web draws these with CollapsibleTree): an id, the item, and its children.
export interface TreeNode<T> {
  id: number;
  item: T;
  children: TreeNode<T>[];
}

// Turns a flat list (each item knowing its parent) into a tree, keeping the list's order among
// siblings. An item whose parent isn't in the list becomes a top-level node.
export function buildTree<T>(items: T[], id: (item: T) => number, parentId: (item: T) => number | null): TreeNode<T>[] {
  const nodes = new Map(items.map((item) => [id(item), { id: id(item), item, children: [] } as TreeNode<T>]));
  const roots: TreeNode<T>[] = [];
  for (const item of items) {
    const node = nodes.get(id(item))!;
    const parent = parentId(item);
    const parentNode = parent === null ? undefined : nodes.get(parent);
    if (parentNode) parentNode.children.push(node); else roots.push(node);
  }
  return roots;
}
