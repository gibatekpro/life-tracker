using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// PlannedPurchases: saving towards something each month, in its own Savings account (one each).
    /// Only adds: a new table, so IsEssential needs no database default (and has none, avoiding the
    /// bool-default trap). Savings itself needs no migration, since account types are stored as text.
    /// </summary>
    public partial class AddPlannedPurchases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlannedPurchases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TargetAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MonthlyAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    StartMonth = table.Column<DateOnly>(type: "date", nullable: false),
                    TargetMonth = table.Column<DateOnly>(type: "date", nullable: false),
                    IsEssential = table.Column<bool>(type: "boolean", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AccountId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlannedPurchases", x => x.Id);
                    table.CheckConstraint("CK_PlannedPurchases_AmountsAndMonths", "\"TargetAmount\" > 0 AND \"MonthlyAmount\" > 0 AND \"TargetMonth\" >= \"StartMonth\" AND EXTRACT(DAY FROM \"StartMonth\") = 1 AND EXTRACT(DAY FROM \"TargetMonth\") = 1");
                    table.ForeignKey(
                        name: "FK_PlannedPurchases_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlannedPurchases_AccountId",
                table: "PlannedPurchases",
                column: "AccountId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlannedPurchases");
        }
    }
}
