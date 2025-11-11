# Visual Preview of Diagrams

Quick ASCII previews so you can see what each diagram looks like before rendering.

## 1. pipeline-hero.mmd ⭐ RECOMMENDED

```
┌─────────────┐
│  📥 INPUT   │
│   📄 Text   │
│  🖼️ Images  │
│  📊 Mixed   │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│     🦎      │
│  CHAMELEON  │
│  Auto-adapt │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│     ⚙️      │
│   PROCESS   │
│ Embed & Index│
└──────┬──────┘
       │
       ↓
┌─────────────┐
│     💾      │
│   STORAGE   │
│ Local-first │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│     🔍      │
│   SEARCH    │
│  Semantic   │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│     🎯      │
│   RESULTS   │
│ Cross-modal │
└─────────────┘
```

**Style:** Horizontal flow, ultra-simple, perfect for README hero
**Best for:** First impression, quick understanding
**Complexity:** ⭐ (1/5)

---

## 2. pipeline-simple.mmd

```
                    ┌─────────────────┐
                    │  Your Content   │
                    │ Text•Images•Mix │
                    └────────┬────────┘
                             │
                             ↓
                    ┌─────────────────┐
                    │  🦎 CHAMELEON   │
                    │  Auto-detect    │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                ↓                         ↓
        ┌──────────────┐         ┌──────────────┐
        │  TEXT MODE   │         │ MULTIMODAL   │
        │ Sentence     │         │    CLIP      │
        │ Transformers │         │  Embeddings  │
        │  384D vectors│         │ 512D unified │
        └──────┬───────┘         └──────┬───────┘
               │                        │
               └────────────┬───────────┘
                            ↓
                   ┌─────────────────┐
                   │    💾 STORAGE   │
                   │ HNSW + SQLite   │
                   └────────┬────────┘
                            ↓
                   ┌─────────────────┐
                   │   🔎 SEARCH     │
                   │  Auto-detect    │
                   │ Vector similarity│
                   └────────┬────────┘
                            ↓
                   ┌─────────────────┐
                   │   🎯 RESULTS    │
                   │ Semantic matches│
                   │ Cross-modal     │
                   └─────────────────┘
```

**Style:** Vertical flow with branching, shows mode selection
**Best for:** Documentation overview, understanding flow
**Complexity:** ⭐⭐ (2/5)

---

## 3. pipeline-comparison.mmd

```
┌──────────────────────────────────────────────────────────┐
│     RAG-lite TS: Chameleon Architecture                  │
│     One System, Two Modes, Automatic Adaptation          │
└──────────────────────────────────────────────────────────┘

        TEXT MODE                    MULTIMODAL MODE
        ─────────                    ───────────────

    📄 Text Documents            📄🖼️ Mixed Content
            ↓                              ↓
    🧹 Preprocess                  🔀 Content Router
    Clean JSX, Mermaid             Separate text/images
            ↓                              ↓
    ✂️ Semantic Chunk                 🧠 CLIP Embedder
    Natural boundaries             clip-vit-base-patch32
            ↓                              ↓
    🧠 Sentence Transformer        📊 512D Unified Space
    all-MiniLM-L6-v2              Text ↔ Image compatible
            ↓                              ↓
    📊 384D Vectors                🔄 Text-Derived Rerank
            ↓                              ↓
    🔄 Cross-Encoder Rerank              
            ↓                              
            └──────────────┬───────────────┘
                           ↓
                  ┌─────────────────┐
                  │ 💾 UNIFIED      │
                  │    STORAGE      │
                  │ HNSW + SQLite   │
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │  🔎 SEARCH      │
                  │  Auto-detect    │
                  │  mode from DB   │
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │  🎯 RESULTS     │
                  │ Semantic matches│
                  │ Cross-modal     │
                  │ Sub-100ms       │
                  └─────────────────┘

    🦎 Set mode once → Auto-detected → Same API
```

**Style:** Side-by-side comparison, shows both pipelines
**Best for:** Explaining differences, feature comparison
**Complexity:** ⭐⭐⭐ (3/5)

---

## 4. pipeline.mmd

```
┌─────────────────────────────────────────────────────────────┐
│                    📥 INPUT LAYER                           │
│  📄 Text Files    🖼️ Images    📊 Mixed Content            │
└────────────────────────┬────────────────────────────────────┘
                         ↓
                ┌─────────────────┐
                │  🦎 CHAMELEON   │
                │  Auto-detect    │
                │  content mode   │
                └────────┬────────┘
                         │
            ┌────────────┴────────────┐
            ↓                         ↓
┌───────────────────────┐   ┌───────────────────────┐
│   TEXT PIPELINE       │   │ MULTIMODAL PIPELINE   │
├───────────────────────┤   ├───────────────────────┤
│ 🧹 Text Preprocessing │   │ 🔀 Content Router     │
│    Clean JSX/Mermaid  │   │    Text → CLIP Text   │
│    Remove code blocks │   │    Image → CLIP Vision│
│         ↓             │   │         ↓             │
│ ✂️ Semantic Chunking  │   │ 🧠 CLIP Embedder      │
│    Natural boundaries │   │    Unified 512D space │
│    Token limits       │   │    Cross-modal ready  │
│         ↓             │   │         ↓             │
│ 🧠 Sentence Transform │   │ 📊 Vector Generation  │
│    all-MiniLM-L6-v2   │   │    Text ↔ Image       │
│    384D embeddings    │   │         ↓             │
│         ↓             │   │ 🔄 Text-Derived       │
│ 🔄 Cross-Encoder      │   │    Reranking          │
│    Reranking          │   │                       │
└───────────┬───────────┘   └───────────┬───────────┘
            │                           │
            └───────────┬───────────────┘
                        ↓
        ┌───────────────────────────────┐
        │   💾 UNIFIED STORAGE LAYER    │
        │  ┌──────────────────────────┐ │
        │  │ 🔍 HNSW Index            │ │
        │  │ Fast vector search       │ │
        │  └──────────────────────────┘ │
        │  ┌──────────────────────────┐ │
        │  │ 🗄️ SQLite Database       │ │
        │  │ Metadata & mode info     │ │
        │  └──────────────────────────┘ │
        │  ┌──────────────────────────┐ │
        │  │ 📁 Content Directory     │ │
        │  │ File storage             │ │
        │  └──────────────────────────┘ │
        └───────────────┬───────────────┘
                        ↓
        ┌───────────────────────────────┐
        │      🔎 SEARCH LAYER          │
        │  ❓ Query (text or image)     │
        │         ↓                     │
        │  🦎 Auto-detect mode          │
        │     (from database)           │
        │         ↓                     │
        │  🧠 Appropriate embedder      │
        │  (Sentence Transformer/CLIP)  │
        │         ↓                     │
        │  🔍 Vector Search             │
        │  (Cosine similarity)          │
        │         ↓                     │
        │  🔄 Reranking                 │
        │  (Cross-encoder/text-derived) │
        └───────────────┬───────────────┘
                        ↓
        ┌───────────────────────────────┐
        │      🎯 OUTPUT LAYER          │
        │  ✨ Semantic Results          │
        │     Ranked by relevance       │
        │  🔄 Cross-Modal Search        │
        │     Text finds images         │
        │     Images find text          │
        │  📤 Format-Adaptive           │
        │     File paths or base64      │
        └───────────────────────────────┘
```

**Style:** Comprehensive, shows all components and layers
**Best for:** Technical documentation, architecture deep-dive
**Complexity:** ⭐⭐⭐⭐⭐ (5/5)

---

## Recommendation Matrix

| Use Case | Recommended Diagram | Why |
|----------|-------------------|-----|
| **README hero image** | `pipeline-hero.mmd` | Clearest, most impactful |
| **Quick start guide** | `pipeline-simple.mmd` | Shows flow without overwhelming |
| **Feature comparison** | `pipeline-comparison.mmd` | Side-by-side is perfect |
| **Architecture docs** | `pipeline.mmd` | Complete technical details |
| **Blog post** | `pipeline-hero.mmd` | Simple and shareable |
| **Presentation** | `pipeline-comparison.mmd` | Great for explaining modes |
| **Technical talk** | `pipeline.mmd` | Shows engineering depth |

---

## Color Legend

All diagrams use consistent colors:

- 🟡 **Yellow/Gold** - Chameleon core (adaptability)
- 🔵 **Blue/Purple** - Text mode (analytical)
- 🔴 **Pink/Red** - Multimodal mode (visual)
- 🟢 **Green** - Storage (persistent)
- 🟠 **Orange** - Search (dynamic)
- 🟣 **Purple** - Results (output)

---

## My Strong Recommendation

**Use `pipeline-hero.mmd` for your README.**

Why?
1. ✅ **Instant clarity** - Anyone can understand it in 3 seconds
2. ✅ **Shows the magic** - Chameleon adaptation is front and center
3. ✅ **Not overwhelming** - Doesn't scare away newcomers
4. ✅ **Professional** - Clean, modern, polished
5. ✅ **Mobile-friendly** - Works at any size
6. ✅ **Memorable** - The Chameleon concept sticks

Save the detailed diagrams for documentation pages where people want to dig deeper.
