using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// Replaces Debts + DebtPayments + spending flags with Accounts and typed transactions.
    /// Hand-written: EF scaffolded "drop Debts, create Accounts", which would delete the data.
    /// Npgsql runs the whole migration in one database transaction, so any failure rolls it all back.
    /// </summary>
    public partial class AccountsAndTransfers : Migration
    {
        private const string LloydsId =
            """(SELECT "Id" FROM "Accounts" WHERE "Name" = 'Lloyds Current' AND "Type" = 'Current')""";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Debts become Accounts. A rename keeps every Id, value and the Id sequence.
            migrationBuilder.RenameTable(name: "Debts", newName: "Accounts");
            migrationBuilder.Sql("""ALTER TABLE "Accounts" RENAME CONSTRAINT "PK_Debts" TO "PK_Accounts";""");

            // 2. Every existing debt is a credit card (Capital One, Aqua, Klarna).
            //    The default fills the existing rows, then goes, so new rows must say what they are.
            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Accounts",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "CreditCard");
            migrationBuilder.Sql("""ALTER TABLE "Accounts" ALTER COLUMN "Type" DROP DEFAULT;""");

            migrationBuilder.AddColumn<decimal>(
                name: "CreditLimit",
                table: "Accounts",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            // 3. The two current accounts. Balances start at 0 and are set by hand afterwards.
            migrationBuilder.Sql("""
                INSERT INTO "Accounts" ("Name", "Type", "Balance", "Apr", "MinimumPayment", "MonthlyPayment", "CreatedAt")
                VALUES ('Lloyds Current', 'Current', 0, 0, 0, 0, now()),
                       ('Revolut',        'Current', 0, 0, 0, 0, now());
                """);

            // 4. Aliases: other names for an account, such as the card name Apple Pay sends.
            migrationBuilder.CreateTable(
                name: "AccountAliases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountId = table.Column<int>(type: "integer", nullable: false),
                    Alias = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountAliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AccountAliases_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountAliases_AccountId",
                table: "AccountAliases",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_AccountAliases_Alias",
                table: "AccountAliases",
                column: "Alias",
                unique: true);

            // 5. New transaction columns. AccountId stays nullable until step 9, after it's filled in.
            //    Every existing transaction starts as an Expense.
            migrationBuilder.AddColumn<int>(
                name: "AccountId",
                table: "Transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ToAccountId",
                table: "Transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Type",
                table: "Transactions",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Expense");
            migrationBuilder.Sql("""ALTER TABLE "Transactions" ALTER COLUMN "Type" DROP DEFAULT;""");

            // 6. Every existing transaction was paid from Lloyds Current (corrected by hand afterwards).
            migrationBuilder.Sql($"""UPDATE "Transactions" SET "AccountId" = {LloydsId};""");

            // 7. A debt payment that already has a transaction: that transaction becomes the transfer
            //    Lloyds Current -> the debt. Amount, date and description stay as they were.
            migrationBuilder.Sql("""
                UPDATE "Transactions" t
                SET "Type" = 'Transfer', "ToAccountId" = p."DebtId"
                FROM "DebtPayments" p
                WHERE p."TransactionId" = t."Id";
                """);

            // 8. A debt payment without a transaction (its transaction was deleted): create the transfer.
            migrationBuilder.Sql($"""
                INSERT INTO "Transactions" ("Amount", "Description", "Category", "Date", "CreatedAt", "Type", "AccountId", "ToAccountId")
                SELECT p."Amount", 'Payment to ' || a."Name", 'Debt', p."Date", p."CreatedAt", 'Transfer', {LloydsId}, p."DebtId"
                FROM "DebtPayments" p
                JOIN "Accounts" a ON a."Id" = p."DebtId"
                WHERE p."TransactionId" IS NULL;
                """);

            // 9. Now every transaction has an account, so it can be required, and the links enforced.
            migrationBuilder.AlterColumn<int>(
                name: "AccountId",
                table: "Transactions",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_AccountId",
                table: "Transactions",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_ToAccountId",
                table: "Transactions",
                column: "ToAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_Accounts_AccountId",
                table: "Transactions",
                column: "AccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_Accounts_ToAccountId",
                table: "Transactions",
                column: "ToAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Transactions_TransferHasDestination",
                table: "Transactions",
                sql: "(\"Type\" = 'Transfer') = (\"ToAccountId\" IS NOT NULL) AND (\"ToAccountId\" IS NULL OR \"ToAccountId\" <> \"AccountId\")");

            // 10. Apple Pay captures fall back to Lloyds Current.
            migrationBuilder.AddColumn<int>(
                name: "DefaultAccountId",
                table: "Settings",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql($"""UPDATE "Settings" SET "DefaultAccountId" = {LloydsId};""");

            migrationBuilder.CreateIndex(
                name: "IX_Settings_DefaultAccountId",
                table: "Settings",
                column: "DefaultAccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Settings_Accounts_DefaultAccountId",
                table: "Settings",
                column: "DefaultAccountId",
                principalTable: "Accounts",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            // 11. Last, once their data has been copied out: the old table and flags.
            migrationBuilder.DropTable(name: "DebtPayments");

            migrationBuilder.DropColumn(name: "CountsAsSpending", table: "Transactions");

            migrationBuilder.DropColumn(name: "PaymentsCountAsSpending", table: "Accounts");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Undoing a data conversion can't be done reliably (which transfers were debt payments?
            // which flags were set?). The pg_dump backup taken before migrating is the way back.
            throw new NotSupportedException(
                "AccountsAndTransfers can't be reversed. Restore the database from the backup taken before migrating.");
        }
    }
}
