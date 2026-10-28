using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LifeTracker.Api.Migrations
{
    /// <summary>
    /// Category.IsEssential: a need rather than a want, so AI insights never suggest cutting it.
    /// Existing categories start as not essential. The default only fills those rows and is then
    /// dropped: the model has none (a bool with a database default is EF's trap, since false would
    /// look "unset" and the default would win).
    /// </summary>
    public partial class AddCategoryIsEssential : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsEssential",
                table: "Categories",
                type: "boolean",
                nullable: false,
                defaultValue: false);
            migrationBuilder.Sql("""ALTER TABLE "Categories" ALTER COLUMN "IsEssential" DROP DEFAULT;""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsEssential",
                table: "Categories");
        }
    }
}
