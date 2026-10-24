
using LifeTracker.Api.Data;
using LifeTracker.Api.Features.Transactions;
using LifeTracker.Api.Features.Summary;
using LifeTracker.Api.Features.Debts;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;
using LifeTracker.Api.Features.Settings;
using LifeTracker.Api.Security;
using LifeTracker.Api.Features.Capture;
using LifeTracker.Api.Features.Accounts;
using LifeTracker.Api.Features.Categories;
using LifeTracker.Api.Features.Budgets;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("LifeTracker")));
builder.Services.Configure<BudgetOptions>(builder.Configuration.GetSection("Budget"));

builder.Services.AddScoped<SummaryService>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<ExchangeRateService>();
builder.Services.AddScoped<LedgerService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<BudgetService>();

// Enums go over JSON as names ("CreditCard"), not numbers.
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

app.UseMiddleware<NetworkApiKeyMiddleware>();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}
else
{
   app.UseHttpsRedirection(); 
}



app.MapAccountEndpoints();
app.MapCategoryEndpoints();
app.MapBudgetEndpoints();
app.MapDebtEndpoints();
app.MapCaptureEndpoints();
app.MapSummaryEndpoints();
app.MapSettingsEndpoints();
app.MapTransactionEndpoints();


app.Run();

