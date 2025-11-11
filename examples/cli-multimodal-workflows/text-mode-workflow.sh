#!/bin/bash

# Text Mode Workflow Example
# This script demonstrates a complete text-only workflow using RAG-lite CLI

echo "=================================================="
echo "RAG-lite Text Mode Workflow Example"
echo "=================================================="
echo ""

# Step 1: Create sample text content
echo "Step 1: Creating sample text content..."
mkdir -p sample-content/text

cat > sample-content/text/machine-learning.md << 'EOF'
# Machine Learning Basics

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.

## Key Concepts

- **Supervised Learning**: Learning from labeled data
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Neural Networks**: Computing systems inspired by biological neural networks
- **Deep Learning**: Multi-layered neural networks for complex pattern recognition

## Applications

Machine learning powers many modern applications including:
- Image recognition and computer vision
- Natural language processing
- Recommendation systems
- Autonomous vehicles
EOF

cat > sample-content/text/web-development.md << 'EOF'
# Web Development Guide

Web development involves building and maintaining websites and web applications.

## Frontend Technologies

- **HTML**: Structure and content
- **CSS**: Styling and layout
- **JavaScript**: Interactivity and dynamic behavior
- **React**: Component-based UI library

## Backend Technologies

- **Node.js**: JavaScript runtime for server-side development
- **Express**: Web application framework
- **Databases**: PostgreSQL, MongoDB, SQLite
- **APIs**: RESTful and GraphQL interfaces

## Best Practices

- Responsive design for mobile devices
- Performance optimization
- Security considerations
- Accessibility standards
EOF

cat > sample-content/text/data-science.txt << 'EOF'
Data Science Overview

Data science combines statistics, mathematics, and programming to extract insights from data.

Core Skills:
- Statistical analysis and probability
- Programming (Python, R)
- Data visualization
- Machine learning algorithms
- Big data technologies

Tools and Libraries:
- Python: pandas, numpy, scikit-learn
- Visualization: matplotlib, seaborn, plotly
- Notebooks: Jupyter, Google Colab
- Big Data: Spark, Hadoop

Career Paths:
- Data Analyst
- Data Engineer
- Machine Learning Engineer
- Research Scientist
EOF

echo "✓ Sample content created"
echo ""

# Step 2: Ingest documents in text mode (default)
echo "Step 2: Ingesting documents in text mode..."
echo "Command: raglite ingest sample-content/text/"
echo ""

raglite ingest sample-content/text/

echo ""
echo "✓ Ingestion complete"
echo ""

# Step 3: Perform various searches
echo "Step 3: Performing searches..."
echo ""

echo "Search 1: General query about machine learning"
echo "Command: raglite search \"machine learning\""
echo ""
raglite search "machine learning"
echo ""

echo "----------------------------------------"
echo ""

echo "Search 2: Specific query about web technologies"
echo "Command: raglite search \"frontend technologies\""
echo ""
raglite search "frontend technologies"
echo ""

echo "----------------------------------------"
echo ""

echo "Search 3: Query with top-k limit"
echo "Command: raglite search \"programming\" --top-k 3"
echo ""
raglite search "programming" --top-k 3
echo ""

echo "----------------------------------------"
echo ""

echo "Search 4: Query with reranking enabled"
echo "Command: raglite search \"data analysis\" --rerank"
echo ""
raglite search "data analysis" --rerank
echo ""

# Step 4: Demonstrate filtering (text mode only has text results)
echo "Step 4: Filtering results by content type..."
echo "Command: raglite search \"python\" --content-type text"
echo ""
raglite search "python" --content-type text
echo ""

echo "=================================================="
echo "Text Mode Workflow Complete!"
echo "=================================================="
echo ""
echo "Key Takeaways:"
echo "- Text mode is the default and optimized for text-only content"
echo "- All content is processed as text, even if images are present"
echo "- Use sentence-transformer models for best text similarity"
echo "- Reranking improves result quality for complex queries"
echo ""
echo "Next Steps:"
echo "- Try multimodal-ingestion.sh for mixed content workflows"
echo "- Explore cross-modal-search.sh for image search capabilities"
echo ""
