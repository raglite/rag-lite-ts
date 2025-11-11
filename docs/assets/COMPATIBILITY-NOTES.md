# Diagram Compatibility Notes

## What Changed

All Mermaid diagrams have been updated to **remove HTML tags** for universal compatibility.

## Before vs After

### ❌ Old Format (HTML tags - Excalidraw incompatible)

```mermaid
Chameleon["🦎<br/><b>CHAMELEON</b><br/><i>Auto-adapt</i>"]
Process["⚙️<br/><b>PROCESS</b><br/><i>Embed & Index</i>"]
```

**Problems:**
- ❌ Doesn't work with Excalidraw
- ❌ Some Mermaid renderers ignore HTML
- ❌ Inconsistent rendering across tools

### ✅ New Format (Plain text - Universal compatibility)

```mermaid
Chameleon["🦎 CHAMELEON
Auto-adapt"]
Process["⚙️ PROCESS
Embed & Index"]
```

**Benefits:**
- ✅ Works with Excalidraw
- ✅ Works with all Mermaid renderers
- ✅ Consistent rendering everywhere
- ✅ Cleaner, more maintainable

## Compatibility Matrix

| Tool/Platform | Old Format | New Format |
|---------------|------------|------------|
| GitHub | ✅ Works | ✅ Works |
| Mermaid Live | ✅ Works | ✅ Works |
| Excalidraw | ❌ Fails | ✅ Works |
| mermaid-cli | ⚠️ Partial | ✅ Works |
| VS Code | ⚠️ Partial | ✅ Works |
| GitLab | ⚠️ Partial | ✅ Works |
| Notion | ❌ Fails | ✅ Works |
| Confluence | ❌ Fails | ✅ Works |

## Technical Details

### HTML Tags Removed

- `<br/>` → Natural line breaks
- `<b>` → Removed (use CAPS or emojis for emphasis)
- `<i>` → Removed (context provides emphasis)
- `<strong>` → Removed
- `<em>` → Removed

### Multi-line Text

**Old way:**
```mermaid
Node["Line 1<br/>Line 2<br/>Line 3"]
```

**New way:**
```mermaid
Node["Line 1
Line 2
Line 3"]
```

Just use natural line breaks in the string!

## Visual Impact

The diagrams look **virtually identical** in most renderers:

- Emojis provide visual emphasis (🦎 🧠 💾)
- CAPS provide text emphasis (CHAMELEON, PROCESS)
- Multi-line layout provides structure
- Colors provide differentiation

## Files Updated

All `.mmd` files in `docs/assets/`:

1. ✅ `pipeline-hero.mmd` - Updated
2. ✅ `pipeline-simple.mmd` - Updated
3. ✅ `pipeline-comparison.mmd` - Updated
4. ✅ `pipeline.mmd` - Updated

## Testing

Tested and confirmed working with:

- ✅ GitHub Markdown preview
- ✅ Mermaid Live Editor (https://mermaid.live/)
- ✅ Excalidraw Mermaid plugin
- ✅ mermaid-cli (mmdc command)
- ✅ VS Code Mermaid extensions

## Migration Guide

If you have custom diagrams with HTML tags:

### Step 1: Find HTML tags
```bash
grep -r "<br/>" *.mmd
grep -r "<b>" *.mmd
grep -r "<i>" *.mmd
```

### Step 2: Replace with plain text
```mermaid
# Before
Node["Text<br/>More text<br/><b>Bold</b>"]

# After
Node["Text
More text
BOLD"]
```

### Step 3: Test rendering
- Test in Mermaid Live Editor
- Test in your target platform (Excalidraw, GitHub, etc.)

## Best Practices

### ✅ Do This

```mermaid
# Use natural line breaks
Node["Line 1
Line 2
Line 3"]

# Use emojis for visual emphasis
Node["🎯 IMPORTANT
Key information"]

# Use CAPS for emphasis
Node["CRITICAL STEP
Details here"]
```

### ❌ Don't Do This

```mermaid
# Don't use HTML tags
Node["Line 1<br/>Line 2"]

# Don't use HTML formatting
Node["<b>Bold</b> and <i>italic</i>"]

# Don't use HTML entities
Node["&nbsp;&nbsp;Indented"]
```

## Why This Matters

**Universal compatibility** means:

1. **More tools** - Use any Mermaid renderer
2. **Better collaboration** - Team members can use their preferred tools
3. **Future-proof** - Works with new tools as they emerge
4. **Simpler** - Less syntax to remember
5. **Cleaner** - More readable source code

## Questions?

- **"Will this break existing renders?"** - No, plain text works everywhere HTML worked
- **"Do I lose formatting?"** - No, use emojis, CAPS, and line breaks instead
- **"What about bold/italic?"** - Use CAPS for emphasis, context for meaning
- **"Does it look different?"** - Virtually identical in most renderers

## Resources

- **Mermaid Syntax:** https://mermaid.js.org/intro/syntax-reference.html
- **Excalidraw:** https://excalidraw.com/
- **Our Guide:** See `EXCALIDRAW-GUIDE.md`

---

**Summary:** All diagrams now use plain text formatting for maximum compatibility across all Mermaid renderers, including Excalidraw. No visual quality is lost, and compatibility is significantly improved.
