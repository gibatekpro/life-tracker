using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// Categories become a table (a tree), and transactions point at one by id instead of holding
    /// a text label. The labels in use, plus the web app's standard lists, become categories, and
    /// every expense and income is linked to its category. Transfers have none.
    /// Hand-written so no label is lost: EF scaffolded "drop the column, then add the new one".
    /// </summary>
    public partial class AddCategories : Migration
    {
        /// <inheritdoc />
        // The web app's standard lists until now (generic names; no personal data).
        private static readonly string[] Expense =
            ["Food", "Transport", "Bills", "Rent", "Shopping", "Entertainment", "Health", "Interest & fees", "Other"];
        private static readonly string[] Income = ["Salary", "Refund", "Gift", "Other"];

        private static string Quote(string s) => "'" + s.Replace("'", "''") + "'";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. The categories table: a tree (ParentId), names unique among siblings of the same kind.
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsArchived = table.Column<bool>(type: "boolean", nullable: false),
                    DefaultMonthlyAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ParentId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Categories_Categories_ParentId",
                        column: x => x.ParentId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_ParentId_Kind_Name",
                table: "Categories",
                columns: new[] { "ParentId", "Kind", "Name" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            // 2. The standard lists, as top-level categories, in their usual order.
            var standard = Expense.Select((name, i) => (name, kind: "Expense", order: i * 10))
                .Concat(Income.Select((name, i) => (name, kind: "Income", order: i * 10)));
            migrationBuilder.Sql(
                """INSERT INTO "Categories" ("Name", "Kind", "SortOrder", "IsArchived", "CreatedAt", "ParentId") VALUES """ +
                string.Join(", ", standard.Select(c => $"({Quote(c.name)}, '{c.kind}', {c.order}, false, now(), NULL)")) + ";");

            // 3. Any other label my transactions use, of the kind they're used as (after the standard ones).
            //    Transfers' labels ("Debt", "Transfer") aren't categories, and a blank label becomes "Other".
            migrationBuilder.Sql("""
                INSERT INTO "Categories" ("Name", "Kind", "SortOrder", "IsArchived", "CreatedAt", "ParentId")
                SELECT DISTINCT t."Category", t."Type", 1000, false, now(), NULL::integer
                FROM "Transactions" t
                WHERE t."Type" <> 'Transfer' AND btrim(t."Category") <> ''
                  AND NOT EXISTS (SELECT 1 FROM "Categories" c
                                  WHERE c."ParentId" IS NULL AND c."Kind" = t."Type" AND c."Name" = t."Category");
                """);

            // 4. Link every expense and income to its category by name and kind.
            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "Transactions",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Transactions" t
                SET "CategoryId" = c."Id"
                FROM "Categories" c
                WHERE t."Type" <> 'Transfer' AND c."ParentId" IS NULL AND c."Kind" = t."Type"
                  AND c."Name" = CASE WHEN btrim(t."Category") = '' THEN 'Other' ELSE t."Category" END;
                """);

            // 5. Now every transaction is linked, enforce it.
            migrationBuilder.CreateIndex(
                name: "IX_Transactions_CategoryId",
                table: "Transactions",
                column: "CategoryId");

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_Categories_CategoryId",
                table: "Transactions",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Transactions_CategoryUnlessTransfer",
                table: "Transactions",
                sql: "(\"Type\" = 'Transfer') = (\"CategoryId\" IS NULL)");

            // 6. Last, once it's been copied: the old text label.
            migrationBuilder.DropColumn(
                name: "Category",
                table: "Transactions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Back to text labels: each category's own name, and for transfers what the app used to
            // write, "Debt" for paying a card or loan and "Transfer" otherwise.
            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "Transactions",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.Sql("""
                UPDATE "Transactions" t SET "Category" = left(c."Name", 50)
                FROM "Categories" c WHERE c."Id" = t."CategoryId";
                """);
            migrationBuilder.Sql("""
                UPDATE "Transactions" t
                SET "Category" = CASE WHEN a."Type" = 'Current' THEN 'Transfer' ELSE 'Debt' END
                FROM "Accounts" a WHERE t."Type" = 'Transfer' AND a."Id" = t."ToAccountId";
                """);

            migrationBuilder.DropCheckConstraint(
                name: "CK_Transactions_CategoryUnlessTransfer",
                table: "Transactions");

            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_Categories_CategoryId",
                table: "Transactions");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_CategoryId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "Transactions");

            migrationBuilder.DropTable(
                name: "Categories");
        }
    }
}
