#!/bin/bash

# Multimodal Ingestion Example
# This script demonstrates how to ingest mixed content (text + images) in multimodal mode

echo "=================================================="
echo "RAG-lite Multimodal Ingestion Example"
echo "=================================================="
echo ""

# Step 1: Create sample content structure
echo "Step 1: Creating sample content structure..."
mkdir -p sample-content/multimodal/text
mkdir -p sample-content/multimodal/images

# Create text documents
cat > sample-content/multimodal/text/vehicles.md << 'EOF'
# Vehicle Types

## Sports Cars

Sports cars are high-performance vehicles designed for speed and agility. They typically feature:
- Powerful engines
- Aerodynamic designs
- Low ground clearance
- Two-seater or 2+2 configurations

Popular colors include red, black, and silver.

## SUVs

Sport Utility Vehicles (SUVs) are versatile vehicles that combine:
- Off-road capabilities
- Spacious interiors
- Higher ground clearance
- All-wheel drive options

Common in urban and rural settings.
EOF

cat > sample-content/multimodal/text/nature.md << 'EOF'
# Natural Landscapes

## Ocean Views

Ocean landscapes feature vast expanses of blue water meeting the horizon. Key characteristics:
- Deep blue or turquoise waters
- Waves and tides
- Coastal features like beaches and cliffs
- Marine life and ecosystems

## Mountain Scenery

Mountain landscapes showcase dramatic elevation changes:
- Snow-capped peaks
- Rocky terrain
- Alpine vegetation
- Stunning sunrise and sunset views
- Hiking trails and viewpoints
EOF

# Note: In a real scenario, you would have actual image files here
# For this example, we'll create placeholder descriptions
cat > sample-content/multimodal/images/README.md << 'EOF'
# Image Content

This directory should contain actual image files for multimodal ingestion.

Example images:
- red-car.jpg: A bright red sports car
- blue-ocean.jpg: Ocean view with deep blue water
- mountain-sunset.jpg: Mountain landscape at sunset

For testing, you can use any JPEG or PNG images.
EOF

echo "✓ Sample content structure created"
echo ""

# Step 2: Explain multimodal mode
echo "Step 2: Understanding Multimodal Mode"
echo "--------------------------------------"
echo ""
echo "Multimodal mode uses CLIP models to create a unified embedding space where:"
echo "  • Text and images are embedded in the same vector space"
echo "  • Text queries can find semantically similar images"
echo "  • Image queries can find semantically similar text"
echo "  • No conversion between content types - native processing"
echo ""
echo "Key differences from text mode:"
echo "  • Uses CLIP models (e.g., Xenova/clip-vit-base-patch32)"
echo "  • Images are processed natively, not converted to text"
echo "  • Enables true cross-modal search capabilities"
echo ""

# Step 3: Ingest in multimodal mode
echo "Step 3: Ingesting content in multimodal mode..."
echo ""
echo "Command: raglite ingest sample-content/multimodal/ --mode multimodal --model Xenova/clip-vit-base-patch32"
echo ""

raglite ingest sample-content/multimodal/ --mode multimodal --model Xenova/clip-vit-base-patch32

echo ""
echo "✓ Multimodal ingestion complete"
echo ""

# Step 4: Verify ingestion
echo "Step 4: Verifying ingestion..."
echo ""
echo "Search for text content:"
echo "Command: raglite search \"sports cars\" --content-type text"
echo ""
raglite search "sports cars" --content-type text
echo ""

# Step 5: Explain reranking strategies
echo "Step 5: Multimodal Reranking Strategies"
echo "----------------------------------------"
echo ""
echo "Multimodal mode supports different reranking strategies:"
echo ""
echo "1. text-derived (default):"
echo "   - Converts images to text descriptions"
echo "   - Uses cross-encoder for reranking"
echo "   - Best for text-heavy queries"
echo ""
echo "2. metadata:"
echo "   - Uses filename and metadata for scoring"
echo "   - Fast and efficient"
echo "   - Good for filename-based searches"
echo ""
echo "3. disabled:"
echo "   - No reranking, pure vector similarity"
echo "   - Fastest option"
echo "   - Good for large-scale searches"
echo ""

# Step 6: Demonstrate different reranking strategies
echo "Step 6: Ingesting with different reranking strategies..."
echo ""

echo "Example 1: Metadata reranking"
echo "Command: raglite ingest sample-content/multimodal/ --mode multimodal --rerank-strategy metadata"
echo ""
echo "This would use filename-based reranking for faster results."
echo ""

echo "Example 2: Disabled reranking"
echo "Command: raglite ingest sample-content/multimodal/ --mode multimodal --rerank-strategy disabled"
echo ""
echo "This would use pure vector similarity without reranking."
echo ""

# Step 7: Best practices
echo "Step 7: Best Practices for Multimodal Ingestion"
echo "------------------------------------------------"
echo ""
echo "✓ Use descriptive filenames for images (e.g., 'red-sports-car.jpg')"
echo "✓ Organize content in logical directory structures"
echo "✓ Choose reranking strategy based on your use case:"
echo "  - text-derived: Best for semantic search"
echo "  - metadata: Best for filename-based search"
echo "  - disabled: Best for performance"
echo "✓ Use consistent image formats (JPEG, PNG)"
echo "✓ Consider image quality and resolution"
echo ""

echo "=================================================="
echo "Multimodal Ingestion Complete!"
echo "=================================================="
echo ""
echo "What's Next?"
echo "- Run cross-modal-search.sh to see cross-modal search in action"
echo "- Try content-type-filtering.sh to filter results by type"
echo "- Explore advanced-workflows.sh for complex scenarios"
echo ""
