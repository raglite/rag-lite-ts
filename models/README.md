# Model Management

## Overview

RAG-lite TS does **not store models in this repository** to keep the codebase lightweight and avoid large binary files in version control. Instead, models are automatically downloaded and cached locally when first used.

## Automatic Model Download

When you first run RAG-lite TS with a specific embedding model, the system will:

1. **Automatically download** the model from Hugging Face
2. **Cache it locally** for future use
3. **Reuse the cached model** across all projects using RAG-lite TS

This happens seamlessly in the background - no manual intervention required.

## Default Cache Location

Models are cached in the RAG-lite TS dedicated cache directory:

**Default location:** `~/.raglite/models/`

The cache structure looks like:
```
~/.raglite/models/
├── sentence-transformers/
│   └── all-MiniLM-L6-v2/
│       ├── config.json
│       ├── tokenizer.json
│       ├── tokenizer_config.json
│       └── onnx/
│           └── model.onnx
└── Xenova/
    └── all-mpnet-base-v2/
        ├── config.json
        ├── tokenizer.json
        ├── tokenizer_config.json
        └── onnx/
            └── model.onnx
```

## Custom Cache Path

You can override the default cache location by setting the `model_cache_path` in your configuration:

```typescript
// In your config
const config = {
  model_cache_path: "/custom/path/to/models",
  // ... other config options
};
```

Or via environment variable:
```bash
export RAG_MODEL_CACHE_PATH="/custom/path/to/models"
```##
 Cache Management

### Viewing Cached Models

To see which models are currently cached on your system:

**Linux/macOS:**
```bash
# List all cached models
ls -la ~/.raglite/models/

# View specific model details
ls -la ~/.raglite/models/sentence-transformers/all-MiniLM-L6-v2/
```

**Windows (Command Prompt):**
```cmd
# List all cached models
dir "%USERPROFILE%\.raglite\models"

# View specific model details
dir "%USERPROFILE%\.raglite\models\sentence-transformers\all-MiniLM-L6-v2"
```

**Windows (PowerShell):**
```powershell
# List all cached models
Get-ChildItem "$env:USERPROFILE\.raglite\models"

# View specific model details
Get-ChildItem "$env:USERPROFILE\.raglite\models\sentence-transformers\all-MiniLM-L6-v2"
```

### Cache Cleanup

To free up disk space, you can delete cached models you no longer need:

**Linux/macOS:**
```bash
# Remove a specific model
rm -rf ~/.raglite/models/sentence-transformers/all-MiniLM-L6-v2/

# Remove all cached models (use with caution!)
rm -rf ~/.raglite/models/
```

**Windows (Command Prompt):**
```cmd
# Remove a specific model
rmdir /s /q "%USERPROFILE%\.raglite\models\sentence-transformers\all-MiniLM-L6-v2"

# Remove all cached models (use with caution!)
rmdir /s /q "%USERPROFILE%\.raglite\models"
```

**Windows (PowerShell):**
```powershell
# Remove a specific model
Remove-Item -Recurse -Force "$env:USERPROFILE\.raglite\models\sentence-transformers\all-MiniLM-L6-v2"

# Remove all cached models (use with caution!)
Remove-Item -Recurse -Force "$env:USERPROFILE\.raglite\models"
```

**Note:** Deleted models will be automatically re-downloaded when next needed.## Offl
ine Setup

If you need to use RAG-lite TS in an environment without internet access, you can manually download and cache models beforehand.

### Manual Model Download

#### Option 1: Using Hugging Face Hub (Recommended)

Install the Hugging Face Hub library:
```bash
pip install huggingface-hub
```

Download models to the RAG-lite cache:
```bash
# Download MiniLM model (384 dimensions)
huggingface-cli download sentence-transformers/all-MiniLM-L6-v2 --include="*.json" --include="onnx/*" --cache-dir ~/.raglite/models

# Download MPNet model (768 dimensions)  
huggingface-cli download Xenova/all-mpnet-base-v2 --include="*.json" --include="onnx/*" --cache-dir ~/.raglite/models
```

#### Option 2: Manual Download from Hugging Face

1. **MiniLM Model (384 dimensions):**
   - Visit: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
   - Download required files: `config.json`, `tokenizer.json`, and files from the `onnx/` folder

2. **MPNet Model (768 dimensions):**
   - Visit: https://huggingface.co/Xenova/all-mpnet-base-v2
   - Download required files: `config.json`, `tokenizer.json`, and files from the `onnx/` folder

### Manual Cache Placement

#### Default Cache Location

Place downloaded files in the RAG-lite cache structure:

**Linux/macOS:**
```
~/.raglite/models/sentence-transformers/all-MiniLM-L6-v2/
├── config.json
├── tokenizer.json
├── tokenizer_config.json
└── onnx/
    └── model.onnx
```

**Windows:**
```
%USERPROFILE%\.raglite\models\sentence-transformers\all-MiniLM-L6-v2\
├── config.json
├── tokenizer.json
├── tokenizer_config.json
└── onnx\
    └── model.onnx
```

#### Custom Cache Location

If using a custom `model_cache_path`, place files in:
```
/your/custom/path/sentence-transformers/all-MiniLM-L6-v2/
├── config.json
├── tokenizer.json
├── tokenizer_config.json
└── onnx/
    └── model.onnx
```

## Multi-Model Support

RAG-lite TS supports multiple embedding models with different vector dimensions:

- **sentence-transformers/all-MiniLM-L6-v2**: 384 dimensions
- **Xenova/all-mpnet-base-v2**: 768 dimensions

### Important: Index Rebuild Required

**When switching between models with different dimensions, you must rebuild your vector index:**

1. Delete existing index files (`.index` files)
2. Re-run the indexing process with the new model
3. The system will automatically detect the dimension mismatch and require a rebuild

This is necessary because vector indexes are dimension-specific and cannot be reused across models with different embedding sizes.

## Troubleshooting

### Model Download Failures

If you encounter network errors during model download:

1. **Check internet connection**
2. **Try again later** (Hugging Face servers may be temporarily unavailable)
3. **Use manual offline setup** (see above)
4. **Check firewall/proxy settings** that might block downloads

### Unsupported Model Errors

RAG-lite TS currently supports these models:
- `sentence-transformers/all-MiniLM-L6-v2`
- `Xenova/all-mpnet-base-v2`

Using other models will result in an error with the list of supported models.

### Disk Space

Models can be large (100MB+ each). Ensure sufficient disk space in your cache directory:
- **MiniLM**: ~90MB
- **MPNet**: ~420MB

Monitor cache size and clean up unused models as needed.