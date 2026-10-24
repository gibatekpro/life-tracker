using LifeTracker.Api.Features.Capture;
using LifeTracker.Api.Features.Categories;

namespace LifeTracker.Api.Tests;

public class CategoryTreeTests
{
    private static readonly CategoryNode[] Tree =
    [
        new(1, null, "Subscriptions"),
        new(2, 1, "AI"),
        new(3, 2, "Claude"),
        new(4, 2, "OpenAI"),
        new(5, null, "Food"),
    ];

    [Fact]
    public void Paths_RunFromTheTop()
    {
        var paths = CategoryTree.Paths(Tree);

        Assert.Equal("Subscriptions › AI › Claude", paths[3]);
        Assert.Equal("Food", paths[5]);
    }

    [Fact]
    public void TopLevel_WalksUpToTheRoot()
    {
        var parents = Tree.ToDictionary(c => c.Id, c => c.ParentId);

        Assert.Equal(1, CategoryTree.TopLevel(3, parents));
        Assert.Equal(5, CategoryTree.TopLevel(5, parents));
    }

    [Fact]
    public void WithDescendants_IncludesEverythingUnderneath()
    {
        Assert.Equal([1, 2, 3, 4], CategoryTree.WithDescendants(1, Tree).Order());
        Assert.Equal([2, 3, 4], CategoryTree.WithDescendants(2, Tree).Order());
        Assert.Equal([5], CategoryTree.WithDescendants(5, Tree));
    }

    private static readonly (int Id, int? ParentId, string Name)[] Expense =
    [
        (1, null, "Food"), (2, null, "Other"), (3, 10, "Transport"), (4, null, "Transport"),
    ];

    [Theory]
    [InlineData("Food", 1)]
    [InlineData("food", 1)]          // case doesn't matter
    [InlineData("Transport", 4)]     // the top-level one wins over a subcategory with the same name
    [InlineData("Pets", 2)]          // no match: "Other"
    public void Resolve_FindsTheGuessedCategory(string guessed, int expected)
    {
        Assert.Equal(expected, CategoryGuesser.Resolve(guessed, Expense));
    }

    [Fact]
    public void Resolve_FindsASubcategoryWhenThereIsNoTopLevelOne()
    {
        Assert.Equal(3, CategoryGuesser.Resolve("Transport", [(3, 10, "Transport"), (2, null, "Other")]));
    }

    [Fact]
    public void Resolve_IsNullWithoutEvenOther()
    {
        Assert.Null(CategoryGuesser.Resolve("Pets", [(1, null, "Food")]));
    }
}
