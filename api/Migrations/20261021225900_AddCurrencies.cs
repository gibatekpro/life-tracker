using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// Accounts get a currency, and transactions a £ value (for the summary) and a received
    /// amount (for transfers between currencies). Only adds columns; everything so far was in pounds.
    /// </summary>
    public partial class AddCurrencies : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GbpAmount",
                table: "Transactions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            // Everything recorded so far is in pounds, so its £ value is just its amount.
            // The default above only exists to add the column; it goes once the rows are filled in.
            migrationBuilder.Sql("""UPDATE "Transactions" SET "GbpAmount" = "Amount";""");
            migrationBuilder.Sql("""ALTER TABLE "Transactions" ALTER COLUMN "GbpAmount" DROP DEFAULT;""");

            migrationBuilder.AddColumn<decimal>(
                name: "ToAmount",
                table: "Transactions",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "Accounts",
                type: "character varying(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "GBP");

            // Every existing account is a UK one, in pounds. New accounts must say their currency.
            migrationBuilder.Sql("""ALTER TABLE "Accounts" ALTER COLUMN "Currency" DROP DEFAULT;""");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Transactions_ToAmountOnlyOnTransfers",
                table: "Transactions",
                sql: "\"ToAmount\" IS NULL OR (\"Type\" = 'Transfer' AND \"ToAmount\" > 0)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Transactions_ToAmountOnlyOnTransfers",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "GbpAmount",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ToAmount",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "Accounts");
        }
    }
}
