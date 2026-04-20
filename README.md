# Tag Filter — Obsidian Plugin

Advanced tag filtering with include/exclude logic. Click tags to filter files by inclusion, exclusion, or toggle off.

## Features

- **All tags in the sidebar** — displayed in the left panel, sorted alphabetically
- **Three filter states** per tag:
  - First click: show files **with** this tag (green)
  - Second click: show files **without** this tag (red)
  - Third click: clear the filter
- **Multi-tag filtering** — combine multiple tags for complex filters
- **Auto-tagging** — new files automatically receive all active inclusion tags
- **Dynamic updates** — files are hidden as soon as they no longer match the filter

## Installation

### Manual

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`)
2. Copy the files into your vault's plugins folder:
   - Windows: `%APPDATA%\Obsidian\plugins\tag-filter\`
   - macOS: `~/Library/Application Support/obsidian/plugins/tag-filter/`
   - Linux: `~/.config/obsidian/plugins/tag-filter/`
3. Enable the plugin in Obsidian: `Settings` → `Community plugins` → **Tag Filter**

### BRAT (Beta Reviewers Auto-update Tool)

1. Install the BRAT plugin from Community Plugins
2. Add this repository via BRAT: `Yvyn/obsidian-tag-filter`

## Usage

1. Open the **Tag Filter** panel in the left sidebar
2. Click tags to filter:
   - 🟢 **Green** — show files that have this tag
   - 🔴 **Red** — show files that do NOT have this tag
3. Create a new file — it will automatically receive all green (inclusion) tags
4. Remove a tag from a file — the file disappears if it no longer matches the filter

## Examples

### Include filter
```
#work (green) + #urgent (green)  →  files with both tags
```

### Exclude filter
```
#work (green) + #draft (red)  →  files tagged #work but NOT #draft
```

### Complex filter
```
#project-a (green) + #meeting (red) + #archive (red)
→  project-a files, excluding meetings and archived notes
```

## License

[MIT](LICENSE)
