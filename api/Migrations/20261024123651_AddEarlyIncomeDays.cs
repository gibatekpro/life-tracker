using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// Settings.EarlyIncomeDays: recorded income this many days before a budget month counts towards
    /// it (a salary paid early because payday fell on a weekend). The existing row starts at 3.
    /// </summary>
    public partial class AddEarlyIncomeDays : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EarlyIncomeDays",
                table: "Settings",
                type: "integer",
                nullable: false,
                defaultValue: 3);
            migrationBuilder.Sql("""ALTER TABLE "Settings" ALTER COLUMN "EarlyIncomeDays" DROP DEFAULT;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EarlyIncomeDays",
                table: "Settings");
        }
    }
}
