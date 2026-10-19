using LifeTracker.Api.Features.Accounts;

namespace LifeTracker.Api.Tests;

public class AccountResolverTests
{
    private static readonly ResolvableAccount[] Accounts =
    [
        new(1, "Lloyds Current", ["Lloyds"]),
        new(2, "Aqua", []),
        new(3, "Revolut", ["Revolut Metal", "Rev"])
    ];

    [Theory]
    [InlineData("Lloyd's")]
    [InlineData("LLOYDS")]
    [InlineData(" lloyds ")]
    public void Alias_MatchesIgnoringCaseAndPunctuation(string card)
    {
        Assert.Equal(new AccountResolution(1, MatchedBy.Alias), AccountResolver.Resolve(card, Accounts, null));
    }

    [Fact]
    public void AccountName_MatchesWhenNoAliasDoes()
    {
        Assert.Equal(new AccountResolution(2, MatchedBy.Name), AccountResolver.Resolve("aqua", Accounts, null));
    }

    [Fact]
    public void Alias_WinsOverAnotherAccountsName()
    {
        ResolvableAccount[] accounts = [new(1, "Rev", []), new(3, "Revolut", ["Rev"])];

        Assert.Equal(new AccountResolution(3, MatchedBy.Alias), AccountResolver.Resolve("Rev", accounts, null));
    }

    [Fact]
    public void UnknownCard_FallsBackToTheDefault()
    {
        Assert.Equal(new AccountResolution(1, MatchedBy.Default), AccountResolver.Resolve("Monzo", Accounts, 1));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("'")]
    public void MissingCard_FallsBackToTheDefault(string? card)
    {
        Assert.Equal(new AccountResolution(1, MatchedBy.Default), AccountResolver.Resolve(card, Accounts, 1));
    }

    [Fact]
    public void NoMatchAndNoDefault_IsNull()
    {
        Assert.Null(AccountResolver.Resolve("Monzo", Accounts, null));
    }
}
