# Text Mode Workflow Example (PowerShell)
# This script demonstrates a complete text-only workflow using RAG-lite CLI

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "RAG-lite Text Mode Workflow Example" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create sample text content
Write-Host "Step 1: Creating sample text content..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "sample-content\text" | Out-Null

@"
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
"@ | Out-File -FilePath "sample-content\text\machine-learning.md" -Encoding UTF8

@"
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
"@ | Out-File -FilePath "sample-content\text\web-development.md" -Encoding UTF8

Write-Host "✓ Sample content created" -ForegroundColor Green
Write-Host ""

# Step 2: Ingest documents
Write-Host "Step 2: Ingesting documents in text mode..." -ForegroundColor Yellow
Write-Host "Command: raglite ingest sample-content\text\" -ForegroundColor Gray
Write-Host ""

raglite ingest "sample-content\text\"

Write-Host ""
Write-Host "✓ Ingestion complete" -ForegroundColor Green
Write-Host ""

# Step 3: Perform searches
Write-Host "Step 3: Performing searches..." -ForegroundColor Yellow
Write-Host ""

Write-Host "Search 1: General query about machine learning" -ForegroundColor Cyan
Write-Host "Command: raglite search `"machine learning`"" -ForegroundColor Gray
Write-Host ""
raglite search "machine learning"
Write-Host ""

Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

Write-Host "Search 2: Query with top-k limit" -ForegroundColor Cyan
Write-Host "Command: raglite search `"programming`" --top-k 3" -ForegroundColor Gray
Write-Host ""
raglite search "programming" --top-k 3
Write-Host ""

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Text Mode Workflow Complete!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "- Try multimodal-ingestion.ps1 for mixed content workflows"
Write-Host "- Explore cross-modal-search.ps1 for image search capabilities"
Write-Host ""
