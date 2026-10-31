
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
using LifeTracker.Api.Features.Insights;
using LifeTracker.Api.Features.PlannedPurchases;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("LifeTracker")));
builder.Services.Configure<BudgetOptions>(builder.Configuration.GetSection("Budget"));
// OpenAI:ApiKey comes from user secrets; the model and limits from appsettings.json.
builder.Services.Configure<OpenAIOptions>(builder.Configuration.GetSection(OpenAIOptions.Section));

builder.Services.AddScoped<SummaryService>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<ExchangeRateService>();
builder.Services.AddScoped<LedgerService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<BudgetService>();
builder.Services.AddScoped<InsightService>();
builder.Services.AddScoped<PlannedPurchaseService>();
builder.Services.AddScoped<PurchaseAdviceService>();
builder.Services.AddSingleton<IInsightModel, OpenAIInsightModel>();

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
app.MapExchangeRateEndpoints();
app.MapCategoryEndpoints();
app.MapBudgetEndpoints();
app.MapInsightEndpoints();
app.MapPlannedPurchaseEndpoints();
app.MapDebtEndpoints();
app.MapCaptureEndpoints();
app.MapSummaryEndpoints();
app.MapSettingsEndpoints();
app.MapTransactionEndpoints();


app.Run();

// Lets the tests start the API in memory (WebApplicationFactory<Program>).
public partial class Program;
