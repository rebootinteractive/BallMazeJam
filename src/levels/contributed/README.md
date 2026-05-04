# Contributed Levels

Drop a level JSON in this folder and it ships with the next build — no code changes required.

## How to contribute a level

1. Run the game (`npm run dev`).
2. Open the editor from the main menu.
3. Design your level. Set name / cols / rows / time. Place pairs of same-colored balls.
4. Click **↓ Download** in the editor toolbar.
5. Move the downloaded `.json` file into this directory.
6. Commit and push (or open a PR). The deploy workflow picks it up automatically.

The file's contents must match the `LevelData` shape in `src/shared/types.ts`. The editor's downloaded JSON is already valid — no editing needed.

## Tips

- Each color must appear in exactly two balls (the level is unwinnable otherwise).
- Levels are sorted alphabetically by name within this folder.
- Filenames are cosmetic; the level's own `id` field is what matters internally.
- If two levels share an `id`, the menu will show duplicates — keep ids unique.
