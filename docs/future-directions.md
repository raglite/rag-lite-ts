# Future Directions for RAG-lite-ts

*Roadmap for extending multimodal capabilities and architectural evolution*

## Table of Contents

- [Overview](#overview)
- [Audio Support Roadmap](#audio-support-roadmap)
- [True Tri-Modal Architecture](#true-tri-modal-architecture)
- [Advanced Features](#advanced-features)
- [Technical Considerations](#technical-considerations)
- [Timeline and Priorities](#timeline-and-priorities)

## Overview

rag-lite-ts currently supports two operational modes:

- **Text Mode**: Optimized for text-only content using sentence-transformers
- **Multimodal Vision Mode**: True multimodal support for text and images using CLIP

This document outlines future directions for extending the system's capabilities, with a focus on audio support and advanced multimodal features.

### Current State

```
✅ Text Mode: Text-only embeddings (sentence-transformers)
✅ Multimodal Vision: Text + Images in unified space (CLIP)
🔄 Audio Support: Planned in phases
🔮 Tri-Modal: Future unified text + image + audio
```

## Audio Support Roadmap

### Phase 0: Audio Transcription (Recommended First Step)

**Status**: Ready to implement  
**Complexity**: Low  
**Time to Market**: Days  
**Dependencies**: Whisper (already in transformers.js)

#### Description

Extend text mode to support audio files by transcribing them to text using Whisper, then processing through the existing text pipeline. This is analogous to how images are currently handled in text mode (image-to-text descriptions).

#### Architecture

```
Audio Files (mp3, wav, m4a, etc.)
    ↓
Whisper Transcription
    ↓
Text Content
    ↓
Text Chunking
    ↓
Sentence-Transformer Embeddings
    ↓
Vector Search
```

#### Implementation Details

```typescript
// Configuration
{
  mode: 'text',  // Use existing text mode
  audio: {
    enabled: true,
    transcriptionModel: 'Xenova/whisper-tiny.en',  // Fast, English
    includeTimestamps: true,
    chunkLongAudio: true,
    maxAudioDuration: 300  // 5 minutes
  }
}

// Processing Pipeline
Audio → Whisper → Transcription → Text Chunks → Text Embeddings
```

#### Use Cases

- ✅ Podcast episode search
- ✅ Lecture and presentation transcription
- ✅ Voice note organization
- ✅ Interview and meeting search
- ✅ Audiobook content search

#### Advantages

- **Immediate implementation** - Uses existing text pipeline
- **Low resource requirements** - Text embeddings are efficient
- **High accuracy for speech** - Whisper is state-of-the-art
- **Semantic search** - Find exact quotes and topics
- **No architecture changes** - Extends current system cleanly

#### Limitations

- ❌ No audio-to-audio similarity search
- ❌ Cannot search by audio characteristics (tone, music, etc.)
- ❌ Only works for speech content
- ❌ Loses non-verbal audio information

#### Whisper Model Options

| Model | Size | Speed | Accuracy | Languages | Use Case |
|-------|------|-------|----------|-----------|----------|
| `whisper-tiny.en` | ~75MB | Very Fast | Good | English | Development, quick transcription |
| `whisper-base` | ~140MB | Fast | Better | Multilingual | Production, general use |
| `whisper-small` | ~460MB | Medium | Best | Multilingual | High-quality transcription |

#### Enhanced Features

**Timestamp-Aware Chunking**
```typescript
// Chunk by timestamp for precise retrieval
{
  text: "Discussion about neural networks...",
  audioTimestamp: 145.2,  // Jump to 2:25 in audio
  duration: 30.0
}
```

**Metadata Enrichment**
```typescript
{
  originalPath: "podcast-ep-42.mp3",
  duration: 3600,
  language: "en",
  confidence: 0.95,
  transcriptionModel: "whisper-base"
}
```

---

### Phase 1: Native Audio Embeddings

**Status**: Future implementation  
**Complexity**: Medium-High  
**Time to Market**: Weeks  
**Dependencies**: CLAP models in transformers.js

#### Description

Implement true multimodal audio support using CLAP (Contrastive Language-Audio Pretraining) models. This creates a unified embedding space for text and audio, enabling cross-modal search similar to how CLIP works for vision-language.

#### Architecture

```
Text Input → CLAP Text Encoder → Text Embedding (512-dim)
                                        ↓
                                  Unified Space
                                        ↓
Audio Input → CLAP Audio Encoder → Audio Embedding (512-dim)
```

#### Implementation Details

```typescript
// New mode type
mode: 'multimodal-audio'

// Model registry addition
'laion/clap-htsat-unfused': {
  type: 'clap',
  dimensions: 512,
  supportedContentTypes: ['text', 'audio'],
  capabilities: {
    supportsText: true,
    supportsAudio: true,
    supportsCrossModalSearch: true,
    unifiedEmbeddingSpace: true
  }
}

// New embedder implementation
class CLAPEmbedder extends BaseUniversalEmbedder {
  async embedText(text: string): Promise<EmbeddingResult>
  async embedAudio(audioPath: string): Promise<EmbeddingResult>
}
```

#### Use Cases

- ✅ Music similarity search
- ✅ Sound effect matching
- ✅ Audio-to-audio similarity
- ✅ Cross-modal audio/text search
- ✅ Non-speech audio retrieval
- ✅ Acoustic scene classification

#### Advantages

- **True multimodal** - Unified text/audio embedding space
- **Cross-modal search** - Text queries find audio, audio queries find text
- **Audio similarity** - Find similar sounding audio clips
- **Works for non-speech** - Music, sound effects, ambient audio
- **Semantic understanding** - Captures audio meaning, not just transcription

#### Technical Challenges

**1. Audio Preprocessing**
```typescript
interface AudioPreprocessor {
  loadAudio(path: string): Promise<AudioBuffer>
  resample(audio: AudioBuffer, targetRate: number): Promise<AudioBuffer>
  toMelSpectrogram(audio: AudioBuffer): Promise<Float32Array>
  chunkAudio(audio: AudioBuffer, duration: number): Promise<AudioBuffer[]>
}
```

**2. Memory Management**
- Raw audio buffers are large (~10MB/minute for 44.1kHz stereo)
- Mel spectrograms add additional overhead
- Need aggressive garbage collection
- Consider streaming for long files

**3. Storage Strategy**
```typescript
interface AudioStorageConfig {
  storeOriginal: boolean
  compressionFormat: 'mp3' | 'opus' | 'aac'
  compressionBitrate: number  // kbps
  maxChunkDuration: number    // seconds
  storageStrategy: 'filesystem' | 'database' | 'hybrid'
}
```

**4. Transformers.js Compatibility**
- Verify CLAP model availability in transformers.js
- May require waiting for library updates
- Alternative: Python backend with API bridge

#### Comparison: Phase 0 vs Phase 1

| Aspect | Phase 0 (Whisper) | Phase 1 (CLAP) |
|--------|------------------|----------------|
| **Implementation** | Easy, uses existing pipeline | Complex, new embedder |
| **Content Types** | Speech only | All audio types |
| **Search Type** | Text-based semantic search | Audio similarity search |
| **Cross-Modal** | No (text-only space) | Yes (unified audio/text space) |
| **Resource Usage** | Lower | Higher |
| **Accuracy** | Excellent for speech | Better for non-speech |
| **Use Cases** | Podcasts, lectures | Music, sound effects |

---

### Phase 2: Federated Multi-Modal Search

**Status**: Future research  
**Complexity**: High  
**Time to Market**: Months  
**Dependencies**: Phase 0 and Phase 1 complete

#### Description

Implement federated search across multiple specialized indexes, allowing users to search across text, images, and audio simultaneously while maintaining separate optimized indexes for each modality.

#### Architecture

```
User Query (text/image/audio)
    ↓
Query Router
    ↓
┌─────────────┬─────────────┬─────────────┐
│ Text Index  │ Vision Index│ Audio Index │
│ (Sentence-  │ (CLIP)      │ (CLAP)      │
│ Transformer)│             │             │
└─────────────┴─────────────┴─────────────┘
    ↓           ↓             ↓
Result Merger & Re-Ranker
    ↓
Unified Results
```

#### Implementation Details

```typescript
class FederatedSearchEngine {
  private textIndex: SearchEngine
  private visionIndex: SearchEngine
  private audioIndex: SearchEngine
  
  async search(query: string | Buffer, options: SearchOptions) {
    // Route query to appropriate indexes
    const queryType = this.detectQueryType(query)
    
    // Search relevant indexes in parallel
    const results = await Promise.all([
      this.searchText(query, queryType),
      this.searchVision(query, queryType),
      this.searchAudio(query, queryType)
    ])
    
    // Merge and re-rank results
    return this.mergeResults(results, options)
  }
  
  private mergeResults(results: SearchResult[][], options: SearchOptions) {
    // Normalize scores across different embedding spaces
    // Apply cross-modal re-ranking
    // Return unified result set
  }
}
```

#### Advantages

- **Flexibility** - Each modality optimized independently
- **Scalability** - Indexes can be distributed
- **Specialization** - Best model for each content type
- **Backward compatible** - Works with existing indexes

#### Challenges

- **Score normalization** - Different embedding spaces have different scales
- **Cross-modal ranking** - How to compare text vs image vs audio relevance?
- **Query routing** - Determining which indexes to search
- **Result merging** - Combining results from different spaces

---

## True Tri-Modal Architecture

### Phase 3: Unified Tri-Modal Embeddings

**Status**: Future research  
**Complexity**: Very High  
**Time to Market**: Long-term  
**Dependencies**: Model availability (ImageBind or similar)

#### Description

Implement a single unified embedding space for text, images, and audio using models like Meta's ImageBind. This would enable true cross-modal search across all three modalities simultaneously.

#### Architecture

```
Text Input ──┐
             ├──→ ImageBind Encoder → Unified Embedding (1024-dim)
Image Input ─┤
             │
Audio Input ─┘

All embeddings directly comparable in same space
```

#### Model Options

**ImageBind (Meta)**
```typescript
'facebook/imagebind-huge': {
  type: 'imagebind',
  dimensions: 1024,
  supportedContentTypes: ['text', 'image', 'audio', 'video'],
  capabilities: {
    supportsMultimodal: true,
    supportsCrossModalSearch: true,
    unifiedEmbeddingSpace: true,
    modalityCount: 4
  }
}
```

#### Use Cases

- ✅ Universal content search across all modalities
- ✅ Text query finds images, audio, and video
- ✅ Image query finds related text, audio, and video
- ✅ Audio query finds related text, images, and video
- ✅ True semantic understanding across modalities

#### Advantages

- **Single embedding space** - All content types comparable
- **Maximum flexibility** - Any query type finds any content type
- **Simplified architecture** - One model, one index
- **Future-proof** - Easy to add new modalities

#### Challenges

- **Model availability** - Waiting for transformers.js support
- **Computational requirements** - Larger models, more memory
- **Complexity** - More sophisticated preprocessing needed
- **Quality tradeoffs** - Jack-of-all-trades vs specialized models

---

## Advanced Features

### Video Support

**Status**: Future consideration  
**Approach**: Frame extraction + audio track separation

```typescript
// Video processing pipeline
Video File
    ↓
┌─────────────┬─────────────┐
│ Frame       │ Audio Track │
│ Extraction  │ Extraction  │
└─────────────┴─────────────┘
    ↓               ↓
CLIP Vision     CLAP Audio
Embeddings      Embeddings
    ↓               ↓
Temporal Aggregation
    ↓
Video Embedding
```

#### Implementation Considerations

- **Frame sampling** - Extract keyframes or sample at intervals
- **Audio extraction** - Separate and process audio track
- **Temporal modeling** - Aggregate frame embeddings over time
- **Storage efficiency** - Videos are large, need smart storage
- **Search granularity** - Scene-level vs frame-level search

### Document Understanding

**Status**: Ongoing improvement  
**Focus**: Better handling of complex documents

#### Enhanced PDF Processing

```typescript
// Multi-modal PDF understanding
PDF Document
    ↓
┌─────────┬─────────┬─────────┐
│ Text    │ Images  │ Tables  │
│ Extract │ Extract │ Extract │
└─────────┴─────────┴─────────┘
    ↓         ↓         ↓
Unified Document Representation
```

#### Features

- **Layout understanding** - Preserve document structure
- **Table extraction** - Structured data handling
- **Figure captioning** - Link images to text
- **Cross-reference resolution** - Connect related sections

### Semantic Chunking

**Status**: Research phase  
**Goal**: Smarter content chunking based on semantics

```typescript
// Current: Fixed-size chunking
Text → [Chunk 1] [Chunk 2] [Chunk 3] ...

// Future: Semantic chunking
Text → [Topic 1] [Topic 2] [Topic 3] ...
       (variable size based on semantic boundaries)
```

#### Approaches

- **Topic modeling** - Detect topic boundaries
- **Sentence embeddings** - Group semantically similar sentences
- **Discourse analysis** - Understand document structure
- **Hierarchical chunking** - Multi-level granularity

### Query Understanding

**Status**: Future enhancement  
**Goal**: Better interpret user intent

#### Features

- **Query expansion** - Add related terms
- **Intent detection** - Understand what user wants
- **Multi-modal query** - Accept text + image + audio queries
- **Conversational context** - Remember previous queries

---

## Technical Considerations

### Transformers.js Ecosystem

**Current Limitations**
- Not all models available in transformers.js
- Some models require ONNX conversion
- Performance varies by model

**Monitoring**
- Track transformers.js releases for new model support
- Test new models as they become available
- Contribute to transformers.js ecosystem

### Performance Optimization

**Memory Management**
```typescript
// Aggressive cleanup for ML resources
- Multiple garbage collection passes
- Resource pooling for models
- Lazy loading of embedders
- Streaming processing for large files
```

**Batch Processing**
```typescript
// Optimize batch sizes by modality
- Text: 16-32 items per batch
- Images: 8-16 items per batch
- Audio: 2-4 items per batch (memory intensive)
```

**Caching Strategy**
```typescript
// Multi-level caching
- Model cache (disk)
- Embedding cache (memory/disk)
- Result cache (memory)
```

### Storage Architecture

**Current: SQLite + Binary Index**
```
SQLite Database: Metadata, chunks, documents
Binary Index: Vector embeddings (hnswlib)
```

**Future Considerations**
- **Separate audio storage** - Filesystem for large audio files
- **Compression** - Reduce storage footprint
- **Distributed storage** - Scale beyond single machine
- **Cloud integration** - S3, Azure Blob, etc.

### API Design

**Maintain Simplicity**
```typescript
// Simple API should remain simple
const search = new SearchEngine('./index.bin', './db.sqlite')
const results = await search.search('query')

// Advanced features opt-in
const search = new SearchEngine('./index.bin', './db.sqlite', {
  federatedSearch: true,
  audioSupport: true,
  videoSupport: true
})
```

---

## Timeline and Priorities

### Immediate (Q1 2026)

**Phase 0: Audio Transcription**
- ✅ Highest priority
- ✅ Immediate value
- ✅ Low risk
- ✅ Uses existing architecture

**Implementation Steps**
1. Add Whisper integration
2. Extend content type detection
3. Implement audio transcription pipeline
4. Add timestamp-aware chunking
5. Update documentation and examples

### Short-term (Q2-Q3 2026)

**Phase 1: Native Audio Embeddings**
- Depends on transformers.js CLAP support
- Implement CLAPEmbedder
- Add multimodal-audio mode
- Optimize audio preprocessing
- Performance testing and tuning

**Enhanced Document Processing**
- Better PDF handling
- Table extraction
- Layout preservation
- Figure captioning

### Medium-term (Q4 2026 - Q1 2027)

**Phase 2: Federated Search**
- Implement query routing
- Build result merger
- Cross-modal re-ranking
- Performance optimization

**Video Support (Initial)**
- Frame extraction
- Audio track processing
- Basic video search

### Long-term (2027+)

**Phase 3: Unified Tri-Modal**
- Wait for ImageBind or similar in transformers.js
- Research and prototyping
- Architecture redesign if needed
- Migration path for existing users

**Advanced Features**
- Semantic chunking
- Query understanding
- Conversational search
- Real-time indexing

---

## Success Metrics

### Phase 0 Success Criteria
- ✅ Audio files can be ingested and searched
- ✅ Transcription accuracy > 90% for clear speech
- ✅ Search quality comparable to text documents
- ✅ Processing time < 2x real-time (30min audio in < 60min)
- ✅ No breaking changes to existing API

### Phase 1 Success Criteria
- ✅ True cross-modal audio/text search
- ✅ Audio similarity search works reliably
- ✅ Supports music and non-speech audio
- ✅ Performance acceptable for production use
- ✅ Clear migration path from Phase 0

### Overall Goals
- **Maintain simplicity** - Easy to use for common cases
- **Preserve performance** - No significant slowdown
- **Backward compatibility** - Existing code continues to work
- **Clear documentation** - Users understand capabilities and limitations
- **Production ready** - Reliable, tested, well-supported

---

## Contributing

We welcome contributions to these future directions! Areas where community help would be valuable:

- **Model testing** - Test new models as they become available in transformers.js
- **Performance optimization** - Improve batch processing and memory management
- **Documentation** - Help document new features and use cases
- **Use case validation** - Share your use cases and requirements
- **Code contributions** - Implement features from this roadmap

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

---

## Conclusion

RAG-lite-ts has a clear path forward for expanding multimodal capabilities. The phased approach allows us to:

1. **Deliver immediate value** (Phase 0) with audio transcription
2. **Build true multimodal** (Phase 1) with native audio embeddings
3. **Scale intelligently** (Phase 2) with federated search
4. **Future-proof** (Phase 3) with unified tri-modal embeddings

Each phase builds on the previous one while maintaining the core philosophy of RAG-lite-ts: **local-first, lightweight, and simple to use**.

The key is to start with practical, implementable features (Phase 0) that provide immediate value, then progressively add more sophisticated capabilities as the ecosystem matures and user needs evolve.

---

*Last Updated: January 2025*  
*Status: Living document - will be updated as plans evolve*
