
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
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("LifeTracker")));
builder.Services.Configure<BudgetOptions>(builder.Configuration.GetSection("Budget"));

builder.Services.AddScoped<SummaryService>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<LedgerService>();

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



app.MapDebtEndpoints();
app.MapCaptureEndpoints();
app.MapSummaryEndpoints();
app.MapSettingsEndpoints();
app.MapTransactionEndpoints();


app.Run();

