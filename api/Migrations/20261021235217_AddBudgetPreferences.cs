using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// Settings gets IncomeMode (take-home pay or recorded income) and MonthStartDay (payday).
    /// Only adds columns; the existing row keeps today's behaviour: fixed income, calendar months.
    /// </summary>
    public partial class AddBudgetPreferences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "IncomeMode",
                table: "Settings",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Fixed");

            migrationBuilder.AddColumn<int>(
                name: "MonthStartDay",
                table: "Settings",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            // The defaults only fill in the existing row; the app always sets both from now on.
            migrationBuilder.Sql("""ALTER TABLE "Settings" ALTER COLUMN "IncomeMode" DROP DEFAULT;""");
            migrationBuilder.Sql("""ALTER TABLE "Settings" ALTER COLUMN "MonthStartDay" DROP DEFAULT;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IncomeMode",
                table: "Settings");

            migrationBuilder.DropColumn(
                name: "MonthStartDay",
                table: "Settings");
        }
    }
}
