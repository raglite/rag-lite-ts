# Quick Guide: Updating the Pipeline Diagram

## TL;DR - Fastest Way

1. Go to https://mermaid.live/
2. Copy content from `pipeline-hero.mmd` (simplest, best for README)
3. Paste into Mermaid Live Editor
4. Click "Actions" → "PNG" or "SVG"
5. Download and replace `pipeline.jpg`

## Which Diagram to Use?

| Diagram | Use Case | Complexity |
|---------|----------|------------|
| `pipeline-hero.mmd` | ⭐ **README hero image** | Simplest |
| `pipeline-simple.mmd` | Quick overview | Simple |
| `pipeline-comparison.mmd` | Show text vs multimodal | Medium |
| `pipeline.mmd` | Full technical details | Detailed |

**Recommendation for README:** Use `pipeline-hero.mmd` - it's clean, simple, and immediately shows the Chameleon concept.

## Step-by-Step: Update README Image

### Method 1: Mermaid Live (No Installation)

1. **Open Mermaid Live Editor**
   - Go to: https://mermaid.live/

2. **Load the diagram**
   - Open `docs/assets/pipeline-hero.mmd`
   - Copy all content
   - Paste into the editor

3. **Adjust if needed**
   - The diagram should render automatically
   - Tweak colors or text if desired

4. **Export**
   - Click "Actions" in top right
   - Select "PNG" for best quality
   - Or "SVG" for scalable vector

5. **Save and replace**
   - Save as `pipeline.png` or `pipeline.jpg`
   - Replace `docs/assets/pipeline.jpg`
   - Update README if changing format

### Method 2: Command Line (Requires Node.js)

```bash
# Install mermaid-cli (one time)
npm install -g @mermaid-js/mermaid-cli

# Navigate to assets directory
cd docs/assets

# Render the hero diagram
mmdc -i pipeline-hero.mmd -o pipeline.png -w 1400 -H 800 -b white

# Or render with transparent background
mmdc -i pipeline-hero.mmd -o pipeline.png -w 1400 -H 800 -b transparent

# Convert to JPG if needed (requires imagemagick)
convert pipeline.png -quality 95 pipeline.jpg
```

### Method 3: VS Code (If you use VS Code)

1. **Install extension**
   - Search for "Markdown Preview Mermaid Support"
   - Install it

2. **Open diagram file**
   - Open `pipeline-hero.mmd`
   - Right-click in editor
   - Select "Preview Mermaid Diagram"

3. **Export**
   - Right-click on preview
   - Save as image

## Customizing the Diagram

### Change Colors

Edit the `style` lines at the bottom of the `.mmd` file:

```mermaid
style Chameleon fill:#fff9c4,stroke:#f57f17,stroke-width:5px,color:#f57f17
```

- `fill` = background color
- `stroke` = border color
- `stroke-width` = border thickness
- `color` = text color

### Change Text

Just edit the text in quotes. Use plain line breaks (no HTML tags):

```mermaid
Chameleon["🦎 CHAMELEON
Auto-adapt"]
```

**Note:** These diagrams use plain text formatting (no HTML tags like `<br/>`, `<b>`, `<i>`) to ensure compatibility with all Mermaid renderers including Excalidraw, GitHub, and command-line tools.

### Add/Remove Nodes

Follow the pattern:

```mermaid
NodeName["🎯 Display Text"]
NodeName --> NextNode
```

## Recommended Settings for README

- **Width:** 1400px (good for GitHub)
- **Height:** 800-1000px (depends on diagram)
- **Format:** PNG (better quality) or JPG (smaller file)
- **Background:** White or transparent
- **Quality:** High/Maximum

## Testing the New Diagram

After updating:

1. **Check README locally**
   ```bash
   # View README in browser
   # Or use GitHub preview
   ```

2. **Verify on GitHub**
   - Push changes
   - View README on GitHub
   - Check both light and dark modes

3. **Check mobile view**
   - Ensure text is readable
   - Diagram should scale properly

## Current vs New Diagram

**Old diagram (pipeline.jpg):**
- ❌ Text-only pipeline
- ❌ No multimodal representation
- ❌ Doesn't show Chameleon architecture

**New diagram (any .mmd file):**
- ✅ Shows Chameleon adaptive architecture
- ✅ Represents both text and multimodal modes
- ✅ Highlights cross-modal capabilities
- ✅ Modern, clean design
- ✅ Easy to update (just edit text file)

## Need Help?

- **Mermaid Syntax:** https://mermaid.js.org/
- **Live Editor:** https://mermaid.live/
- **Examples:** https://mermaid.js.org/syntax/flowchart.html

## Quick Comparison

**For the README, I recommend `pipeline-hero.mmd` because:**
- ✅ Simplest and clearest
- ✅ Shows the key concept (Chameleon adaptation)
- ✅ Not overwhelming with details
- ✅ Works great at any size
- ✅ Immediately communicates the value proposition

The other diagrams are great for documentation pages where you want more detail.
