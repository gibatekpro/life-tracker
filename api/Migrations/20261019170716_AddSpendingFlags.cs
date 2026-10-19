using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSpendingFlags : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CountsAsSpending",
                table: "Transactions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "PaymentsCountAsSpending",
                table: "Debts",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CountsAsSpending",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "PaymentsCountAsSpending",
                table: "Debts");
        }
    }
}
