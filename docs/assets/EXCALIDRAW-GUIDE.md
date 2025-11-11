# Using Diagrams with Excalidraw

All RAG-lite TS pipeline diagrams are now **Excalidraw-compatible** (no HTML tags).

## Quick Start with Excalidraw

### Method 1: Mermaid to Excalidraw Plugin

1. **Open Excalidraw**
   - Go to https://excalidraw.com/

2. **Install Mermaid Plugin** (if not already installed)
   - Look for Mermaid integration in Excalidraw
   - Or use: https://mermaid.ink/ to convert first

3. **Load Your Diagram**
   - Open any `.mmd` file from `docs/assets/`
   - Copy the entire content
   - Paste into Excalidraw's Mermaid tool

4. **Customize**
   - Excalidraw will convert it to editable shapes
   - Adjust colors, positions, fonts
   - Add hand-drawn style if desired

5. **Export**
   - Export as PNG, SVG, or Excalidraw format
   - Use for presentations, documentation, etc.

### Method 2: Via Mermaid.ink (Recommended)

If Excalidraw's Mermaid plugin isn't working:

1. **Convert to Image First**
   ```bash
   # Using mermaid-cli
   mmdc -i pipeline-hero.mmd -o pipeline.svg -b transparent
   ```

2. **Import to Excalidraw**
   - Open Excalidraw
   - Drag and drop the SVG file
   - Trace over it with Excalidraw tools if you want the hand-drawn style

### Method 3: Manual Recreation

For full Excalidraw style:

1. **Use diagram as reference**
   - Open the `.mmd` file to see structure
   - View ASCII preview in `VISUAL-PREVIEW.md`

2. **Recreate in Excalidraw**
   - Use rectangles for nodes
   - Use arrows for connections
   - Apply Excalidraw's hand-drawn style

3. **Benefits**
   - Full control over appearance
   - Native Excalidraw format
   - Easy to edit later

## Why Our Diagrams Work with Excalidraw

✅ **No HTML tags** - We removed `<br/>`, `<b>`, `<i>` tags
✅ **Plain text** - Multi-line text uses natural line breaks
✅ **Standard Mermaid** - Compatible with all Mermaid renderers
✅ **Clean syntax** - Easy to parse and convert

### Before (Incompatible)
```mermaid
Chameleon["🦎<br/><b>CHAMELEON</b><br/><i>Auto-adapt</i>"]
```

### After (Compatible)
```mermaid
Chameleon["🦎 CHAMELEON
Auto-adapt"]
```

## Recommended Workflow

For the **best results** with Excalidraw:

1. **Start with our Mermaid files** - They provide the structure
2. **Render to SVG** - Use mermaid-cli or Mermaid Live
3. **Import to Excalidraw** - Drag and drop the SVG
4. **Customize** - Add Excalidraw's signature hand-drawn style
5. **Export** - Save as PNG for documentation

## Excalidraw Style Tips

To make diagrams look great in Excalidraw:

- **Use hand-drawn style** - Enable "Hand-drawn" in settings
- **Vary stroke widths** - Make important elements thicker
- **Add shadows** - Gives depth to the diagram
- **Use consistent colors** - Match our color scheme:
  - Yellow/Gold for Chameleon
  - Blue for Text mode
  - Pink/Red for Multimodal
  - Green for Storage
  - Orange for Search
  - Purple for Results

## Alternative: Direct SVG Export

If you prefer vector graphics without Excalidraw:

```bash
# Export directly to SVG
mmdc -i pipeline-hero.mmd -o pipeline.svg -b transparent

# Or PNG with high quality
mmdc -i pipeline-hero.mmd -o pipeline.png -w 1400 -H 800 -b white
```

Then use the SVG/PNG directly in your documentation.

## Troubleshooting

### "Mermaid syntax error" in Excalidraw
- **Solution:** Our diagrams are now HTML-free and should work
- **Fallback:** Use Method 2 (convert to SVG first)

### "Plugin not found"
- **Solution:** Use Mermaid Live Editor (https://mermaid.live/) to export, then import to Excalidraw

### "Diagram too complex"
- **Solution:** Use `pipeline-hero.mmd` (simplest) instead of `pipeline.mmd` (most detailed)

## Which Diagram for Excalidraw?

| Diagram | Excalidraw Suitability | Notes |
|---------|----------------------|-------|
| `pipeline-hero.mmd` | ⭐⭐⭐⭐⭐ | Perfect - simple and clean |
| `pipeline-simple.mmd` | ⭐⭐⭐⭐ | Good - moderate complexity |
| `pipeline-comparison.mmd` | ⭐⭐⭐ | OK - side-by-side layout |
| `pipeline.mmd` | ⭐⭐ | Complex - better for other tools |

**Recommendation:** Start with `pipeline-hero.mmd` for Excalidraw projects.

## Resources

- **Excalidraw:** https://excalidraw.com/
- **Mermaid Live:** https://mermaid.live/
- **Mermaid Docs:** https://mermaid.js.org/
- **Our Diagrams:** `docs/assets/*.mmd`
