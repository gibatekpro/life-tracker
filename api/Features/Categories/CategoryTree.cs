namespace LifeTracker.Api.Features.Categories;

public record CategoryNode(int Id, int? ParentId, string Name);

// Helpers for walking the category tree. Pure: callers load the (small) list of categories once.
public static class CategoryTree
{
    public const string Separator = " › ";

    // Every category's full name from the top: "Subscriptions › AI › Claude".
    public static Dictionary<int, string> Paths(IEnumerable<CategoryNode> categories)
    {
        var byId = categories.ToDictionary(c => c.Id);
        var paths = new Dictionary<int, string>();

        string PathOf(CategoryNode c, int depth) =>
            paths.TryGetValue(c.Id, out var known) ? known
            : paths[c.Id] = c.ParentId is { } p && byId.TryGetValue(p, out var parent) && depth < byId.Count
                ? PathOf(parent, depth + 1) + Separator + c.Name
                : c.Name;

        foreach (var c in byId.Values) PathOf(c, 0);
        return paths;
    }

    // The top-level category a category sits under (itself, if it's at the top).
    public static int TopLevel(int id, IReadOnlyDictionary<int, int?> parents)
    {
        var current = id;
        for (var guard = 0; parents.GetValueOrDefault(current) is { } parent && guard < parents.Count; guard++)
            current = parent;
        return current;
    }

    // The categories that count as essential: the ones marked essential and everything under them.
    // A plain bool can't say "not set", so a parent's true passes down and a subcategory's own true
    // wins under a flexible parent (mark Groceries, not all of Food, if takeaways are a want).
    public static HashSet<int> Essential(IReadOnlyDictionary<int, int?> parents, IReadOnlySet<int> marked)
    {
        var essential = new HashSet<int>();
        foreach (var id in parents.Keys)
        {
            int? current = id;
            for (var guard = 0; current is { } c && guard <= parents.Count; guard++, current = parents.GetValueOrDefault(c))
                if (marked.Contains(c)) { essential.Add(id); break; }
        }
        return essential;
    }

    // A category and everything under it, e.g. for "can't move a category under its own child".
    public static HashSet<int> WithDescendants(int id, IEnumerable<CategoryNode> categories)
    {
        var byParent = categories.ToLookup(c => c.ParentId);
        var found = new HashSet<int> { id };
        var queue = new Queue<int>([id]);
        while (queue.TryDequeue(out var current))
            foreach (var child in byParent[current])
                if (found.Add(child.Id)) queue.Enqueue(child.Id);
        return found;
    }
}
