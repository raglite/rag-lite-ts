# Architecture Documentation

**Version:** 3.0.0  
**Last Updated:** November 25, 2025

---

## Overview

RAG-lite-ts uses a **three-layer architecture** with a **two-tier API pattern** to balance simplicity for users with flexibility for advanced use cases.

---

## Three-Layer Architecture

### Layer 1: Public API (Simple & User-Friendly)

**Purpose:** Provide simple, intuitive interfaces for typical users

**Components:**
- `SearchEngine` - Simple constructor for search operations
- `IngestionPipeline` - Simple constructor for ingestion operations
- `createEmbedder()` - Simple function for creating embedders
- `createReranker()` - Simple function for creating rerankers

**Characteristics:**
- Simple constructors that "just work"
- Automatic initialization and configuration
- Hides internal complexity
- Lazy loading where appropriate

**Example:**
```typescript
// Simple and intuitive
const search = new SearchEngine('./index.bin', './db.sqlite');
const results = await search.search('query');
```

---

### Layer 2: Factory Layer (Internal Complexity)

**Purpose:** Handle complex initialization, mode detection, and dependency injection

**Components:**
- `SearchFactory` - Polymorphic search engine creation
- `IngestionFactory` - Complex ingestion pipeline setup
- Mode detection services
- Model validation and compatibility checking

**Characteristics:**
- Handles polymorphic runtime (text vs multimodal)
- Performs mode detection from database
- Validates model compatibility
- Manages complex dependency injection
- Used internally by public API layer

**Example:**
```typescript
// Internal usage (not typically called by users)
const search = await SearchFactory.create('./index.bin', './db.sqlite');
// Automatically detects mode and creates appropriate engine
```

---

### Layer 3: Core Layer (Pure Business Logic)

**Purpose:** Model-agnostic business logic with dependency injection

**Components:**
- `CoreSearchEngine` - Pure search logic
- `CoreIngestionPipeline` - Pure ingestion logic
- Database operations
- Vector index management
- Content management

**Characteristics:**
- Model-agnostic (no knowledge of specific models)
- Pure dependency injection
- No mode-specific logic
- Highly testable
- Used by factory layer

**Example:**
```typescript
// Advanced usage with full control
const embedder = await createEmbedder('Xenova/all-mpnet-base-v2');
const embedFn = async (query: string) => await embedder.embedText(query);
const search = new CoreSearchEngine(embedFn, indexManager, db);
```

---

## Two-Tier API Pattern

### Public Tier: Simplicity

**Philosophy:** "The common case should be simple"

**Approach:**
- Simple constructors and functions
- Automatic configuration
- Sensible defaults
- Hide complexity

**Target Users:** 90% of developers

**Example:**
```typescript
// Just works!
const search = new SearchEngine('./index.bin', './db.sqlite');
```

---

### Internal Tier: Sophistication

**Philosophy:** "Complex scenarios require sophisticated tools"

**Approach:**
- Factory classes for complex initialization
- Polymorphic runtime with mode detection
- Dependency injection and validation
- Advanced configuration options

**Target Users:** Library authors, advanced users, internal code

**Example:**
```typescript
// Full control for advanced scenarios
const factory = SearchFactory.create('./index.bin', './db.sqlite');
// Handles mode detection, validation, etc.
```

---

## Key Architectural Decisions

### 1. Factory Classes Are Internal

**Decision:** Factory classes (`SearchFactory`, `IngestionFactory`) are for internal use

**Rationale:**
- Polymorphic runtime requires complex initialization
- Mode detection and validation are inherently complex
- Users shouldn't need to understand factories for basic usage

**Implementation:**
- Public API wrappers hide factory complexity
- Factories handle mode detection automatically
- Users see simple constructors, not factories

---

### 2. Simple Functions for Utilities

**Decision:** Use simple functions (`createEmbedder`, `createReranker`) for straightforward cases

**Rationale:**
- Not all complexity requires factory classes
- Simple functions are more intuitive
- Easier to discover and use

**Implementation:**
- `createEmbedder()` - Simple function with validation
- `createReranker()` - Simple function with mode support
- Factory classes only when truly needed

---

### 3. Mode Detection and Persistence

**Decision:** Mode is stored during ingestion, auto-detected during search

**Rationale:**
- Users shouldn't specify mode twice
- Prevents mode mismatches
- Enables "chameleon architecture" (adapts automatically)

**Implementation:**
- Mode stored in `system_info` table during ingestion
- `ModeDetectionService` reads mode during search
- Appropriate embedder/reranker created automatically

---

### 4. Unified System Information API

**Decision:** Single `getSystemInfo()`/`setSystemInfo()` instead of multiple functions

**Rationale:**
- Reduces API surface
- More information available
- Better structure (objects vs positional params)
- Easier to extend

**Implementation:**
```typescript
// Old
await setModelVersion(db, 'v1.0');
await setStoredModelInfo(db, 'model', 384);

// New
await setSystemInfo(db, {
  modelVersion: 'v1.0',
  modelName: 'model',
  modelDimensions: 384,
  mode: 'text'
});
```

---

## Design Patterns

### 1. Facade Pattern

**Usage:** Public API classes (`SearchEngine`, `IngestionPipeline`)

**Purpose:** Hide factory complexity behind simple interface

**Benefits:**
- Users see simple API
- Internal complexity is hidden
- Easy to use for common cases

---

### 2. Factory Pattern

**Usage:** `SearchFactory`, `IngestionFactory`

**Purpose:** Handle complex object creation with mode detection

**Benefits:**
- Encapsulates complex initialization
- Supports polymorphic runtime
- Validates compatibility

---

### 3. Dependency Injection

**Usage:** Core layer classes

**Purpose:** Enable testability and flexibility

**Benefits:**
- Highly testable
- Model-agnostic
- Flexible and extensible

---

### 4. Lazy Initialization

**Usage:** Public API wrappers

**Purpose:** Defer complex setup until first use

**Benefits:**
- Fast construction
- Better error messages (at point of use)
- Allows simple constructors

---

## Polymorphic Runtime (Chameleon Architecture)

### Concept

The system automatically adapts to the mode (text or multimodal) stored in the database.

### How It Works

1. **During Ingestion:**
   - User specifies mode (text or multimodal)
   - Mode stored in `system_info` table
   - Appropriate embedder created

2. **During Search:**
   - Mode automatically detected from database
   - Appropriate embedder created automatically
   - User doesn't need to specify mode

3. **Benefits:**
   - No mode mismatches
   - Consistent behavior
   - Simple user experience

### Example

```typescript
// Ingestion (mode specified once)
const ingestion = new IngestionPipeline('./db.sqlite', './index.bin', {
  mode: 'multimodal'
});

// Search (mode auto-detected)
const search = new SearchEngine('./index.bin', './db.sqlite');
// Automatically uses multimodal mode!
```

---

## Content System Architecture

### Unified Content Management

**Purpose:** Abstract content storage from content retrieval

**Components:**
- `ContentManager` - Handles content storage and deduplication
- `ContentResolver` - Handles content retrieval and format adaptation

**Benefits:**
- Supports both filesystem and memory ingestion
- Deduplication for memory content
- Format adaptation (file paths for CLI, base64 for MCP)
- Transparent to users

---

## Testing Strategy

### Layer-Based Testing

1. **Core Layer:** Test with mock dependencies
2. **Factory Layer:** Test mode detection and creation
3. **Public API:** Test end-to-end scenarios

### Test Isolation

- Use unique directories per test (Windows compatibility)
- Proper resource cleanup
- Forced exit for ML tests (prevent hanging)

---

## Backward Compatibility Policy (v3.0.0+)

### Breaking Changes

**v3.0.0 is a clean slate release** with no backward compatibility for removed functions.

### Future Policy

- **Major versions (4.0, 5.0):** May include breaking changes
- **Minor versions (3.1, 3.2):** No breaking changes, new features only
- **Patch versions (3.0.1, 3.0.2):** Bug fixes only

### Deprecation Process (Future)

1. Mark function as `@deprecated` with migration guide
2. Add console warnings
3. Keep for at least one minor version
4. Remove in next major version

---

## Future Directions

### Planned Enhancements

1. **Additional content types** - Video, audio support
2. **Advanced reranking** - More sophisticated strategies
3. **Performance optimizations** - Batch processing improvements
4. **Extended multimodal** - More CLIP model variants

### Architectural Stability

The three-layer architecture is **stable and will not change** in future versions. New features will be added within this framework.

---

## References

- `api-design-principles.md` - API design guidelines
- `core-layer-architecture.md` - Core layer details
- `CLEANUP_SUMMARY_v3.0.0.md` - v3.0.0 changes
- `ARCHITECTURE_REVIEW.md` - Architecture analysis
