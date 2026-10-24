using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// BudgetMonthAmounts: a month's own budget figure for a spending category or a debt account
    /// (exactly one), overriding the default. Only creates the table; no existing data changes.
    /// </summary>
    public partial class AddBudgets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BudgetMonthAmounts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CategoryId = table.Column<int>(type: "integer", nullable: true),
                    AccountId = table.Column<int>(type: "integer", nullable: true),
                    PeriodStart = table.Column<DateOnly>(type: "date", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetMonthAmounts", x => x.Id);
                    table.CheckConstraint("CK_BudgetMonthAmounts_CategoryOrAccount", "(\"CategoryId\" IS NULL) <> (\"AccountId\" IS NULL) AND \"Amount\" >= 0");
                    table.ForeignKey(
                        name: "FK_BudgetMonthAmounts_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BudgetMonthAmounts_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BudgetMonthAmounts_AccountId_PeriodStart",
                table: "BudgetMonthAmounts",
                columns: new[] { "AccountId", "PeriodStart" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BudgetMonthAmounts_CategoryId_PeriodStart",
                table: "BudgetMonthAmounts",
                columns: new[] { "CategoryId", "PeriodStart" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BudgetMonthAmounts");
        }
    }
}
