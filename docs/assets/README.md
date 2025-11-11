# Pipeline Diagrams

This directory contains Mermaid diagram source files for the RAG-lite TS architecture.

## Available Diagrams

### 1. `pipeline.mmd` - Detailed Architecture
The comprehensive diagram showing all components of the Chameleon architecture including:
- Input layer with different content types
- Chameleon core mode detection
- Separate text and multimodal pipelines
- Unified storage layer
- Search layer with auto-detection
- Output layer with cross-modal capabilities

**Best for:** Documentation, technical presentations, architecture discussions

### 2. `pipeline-simple.mmd` - Simplified Flow
A streamlined version focusing on the high-level flow:
- Content input → Chameleon detection → Mode-specific processing → Storage → Search → Results

**Best for:** README hero image, quick understanding, marketing materials

### 3. `pipeline-comparison.mmd` - Side-by-Side Comparison
Shows text and multimodal pipelines side-by-side for easy comparison.

**Best for:** Feature comparison, understanding differences between modes

## Rendering the Diagrams

All diagrams use **plain text formatting** (no HTML tags) for maximum compatibility with:
- ✅ GitHub (automatic rendering)
- ✅ Mermaid Live Editor
- ✅ Excalidraw (Mermaid plugin)
- ✅ Command-line tools (mermaid-cli)
- ✅ VS Code extensions
- ✅ Documentation generators

### Option 1: GitHub (Automatic)
GitHub automatically renders `.mmd` files. Just view them in the repository.

### Option 2: Mermaid Live Editor
1. Go to https://mermaid.live/
2. Copy the content of any `.mmd` file
3. Paste into the editor
4. Export as PNG or SVG

### Option 3: Excalidraw (with Mermaid plugin)
1. Open Excalidraw (https://excalidraw.com/)
2. Copy the content of any `.mmd` file
3. Use the Mermaid to Excalidraw plugin
4. Customize and export

### Option 4: Command Line (mermaid-cli)
```bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Render to PNG (high quality)
mmdc -i pipeline-simple.mmd -o pipeline.png -w 1400 -H 1000 -b transparent

# Render to SVG (scalable)
mmdc -i pipeline-simple.mmd -o pipeline.svg -b transparent
```

### Option 4: VS Code Extension
1. Install "Markdown Preview Mermaid Support" extension
2. Open any `.mmd` file
3. Use preview to see the diagram
4. Right-click to export

### Option 5: Embed in Markdown
```markdown
```mermaid
[paste diagram code here]
```
```

## Recommended Export Settings

For the README hero image (`pipeline.jpg`):
- **Source:** `pipeline-simple.mmd` (clearest for quick understanding)
- **Format:** PNG or JPG
- **Width:** 1400px
- **Height:** 1000px
- **Background:** Transparent or white
- **Quality:** High (for GitHub display)

## Customization

To modify the diagrams:
1. Edit the `.mmd` files
2. Adjust colors in the `%%{init:...}%%` section
3. Modify node text and structure
4. Re-render using any of the methods above

## Color Scheme

The diagrams use a consistent color scheme:
- **Chameleon Core:** Yellow/Gold (#fff9c4) - Represents adaptability
- **Text Mode:** Blue/Purple (#e8eaf6) - Cool, analytical
- **Multimodal Mode:** Pink/Red (#fce4ec) - Warm, visual
- **Storage:** Green (#e8f5e9) - Stable, persistent
- **Search:** Orange (#fff3e0) - Active, dynamic
- **Output:** Purple (#f3e5f5) - Results, completion

## Tips for Best Results

1. **For README:** Use `pipeline-simple.mmd` - it's the clearest at a glance
2. **For docs:** Use `pipeline.mmd` - shows all technical details
3. **For presentations:** Use `pipeline-comparison.mmd` - great for explaining modes
4. **Export quality:** Always use high resolution (1400px+ width) for GitHub
5. **Background:** Transparent works best for dark/light mode compatibility

## Current Hero Image

The current `pipeline.jpg` should be replaced with a render of `pipeline-simple.mmd` to showcase the new Chameleon architecture with multimodal support.

To update:
```bash
# Render the new diagram
mmdc -i pipeline-simple.mmd -o pipeline.png -w 1400 -H 1000 -b white

# Convert to JPG if needed (or use PNG directly)
# PNG is recommended for better quality
```
