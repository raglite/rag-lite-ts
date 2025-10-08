import { countTokens } from './tokenizer.js';

/**
 * Configuration for chunking behavior
 */
export interface ChunkConfig {
  /** Target chunk size in tokens (200-300 recommended) */
  chunkSize: number;
  /** Overlap between chunks in tokens (50 recommended) */
  chunkOverlap: number;
}

/**
 * Represents a text chunk with metadata
 */
export interface Chunk {
  /** The text content of the chunk */
  text: string;
  /** Index of this chunk within the document */
  chunkIndex: number;
  /** Number of tokens in this chunk */
  tokenCount: number;
}

/**
 * Represents a document to be chunked
 */
export interface Document {
  /** Source path or identifier */
  source: string;
  /** Document title */
  title: string;
  /** Full text content */
  content: string;
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  chunkSize: 250, // Target 200-300 tokens
  chunkOverlap: 50
};

/**
 * Split text at paragraph boundaries (double newlines)
 * This is the first tier of the chunking strategy
 */
function splitIntoParagraphs(text: string): string[] {
  // Split on double newlines, filter out empty strings
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Split text at sentence boundaries using punctuation marks
 * This is the second tier of the chunking strategy
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end of string
  // Handle common abbreviations and edge cases
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  return sentences;
}

/**
 * Split text into fixed-size chunks based on character count
 * This is the fallback tier when semantic splitting fails
 */
async function splitIntoFixedSizeChunks(text: string, maxTokens: number, overlapTokens: number): Promise<string[]> {
  const chunks: string[] = [];
  const words = text.split(/\s+/);
  
  let currentChunk = '';
  let currentTokens = 0;
  let i = 0;
  
  while (i < words.length) {
    const word = words[i];
    const testChunk = currentChunk ? `${currentChunk} ${word}` : word;
    const testTokens = await countTokens(testChunk);
    
    if (testTokens <= maxTokens) {
      currentChunk = testChunk;
      currentTokens = testTokens;
      i++;
    } else {
      // Current chunk is full, save it
      if (currentChunk) {
        chunks.push(currentChunk);
        
        // Create overlap for next chunk
        if (overlapTokens > 0 && chunks.length > 0) {
          const overlapText = await createOverlapFromWords(currentChunk, overlapTokens);
          currentChunk = overlapText;
          currentTokens = await countTokens(currentChunk);
        } else {
          currentChunk = '';
          currentTokens = 0;
        }
      } else {
        // Single word exceeds limit, add it anyway
        chunks.push(word);
        i++;
      }
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Create overlap text from words at the end of a chunk
 */
async function createOverlapFromWords(text: string, overlapTokens: number): Promise<string> {
  const words = text.split(/\s+/);
  let overlapText = '';
  let tokens = 0;
  
  // Work backwards from the end
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    const testText = word + (overlapText ? ' ' + overlapText : '');
    const testTokens = await countTokens(testText);
    
    if (testTokens <= overlapTokens) {
      overlapText = testText;
      tokens = testTokens;
    } else {
      break;
    }
  }
  
  return overlapText;
}

/**
 * Create chunks from a list of text segments, respecting token limits
 */
async function createChunksFromSegments(
  segments: string[], 
  config: ChunkConfig
): Promise<string[]> {
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;
  
  for (const segment of segments) {
    const segmentTokens = await countTokens(segment);
    
    // If this single segment exceeds our limit, we need to split it further
    if (segmentTokens > config.chunkSize) {
      // Save current chunk if it has content
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentTokens = 0;
      }
      
      // Split the large segment using fixed-size chunking based on tokens
      const subChunks = await splitIntoFixedSizeChunks(segment, config.chunkSize, config.chunkOverlap);
      chunks.push(...subChunks);
      continue;
    }
    
    // Check if adding this segment would exceed our token limit
    const potentialChunk = currentChunk ? `${currentChunk}\n\n${segment}` : segment;
    const potentialTokens = await countTokens(potentialChunk);
    
    if (potentialTokens <= config.chunkSize) {
      // Add to current chunk
      currentChunk = potentialChunk;
      currentTokens = potentialTokens;
    } else {
      // Save current chunk and start a new one
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      
      // Start new chunk with overlap if possible
      if (config.chunkOverlap > 0 && currentChunk) {
        const overlapText = await createOverlapText(currentChunk, config.chunkOverlap);
        currentChunk = overlapText ? `${overlapText}\n\n${segment}` : segment;
      } else {
        currentChunk = segment;
      }
      currentTokens = await countTokens(currentChunk);
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Create overlap text from the end of a chunk
 */
async function createOverlapText(text: string, overlapTokens: number): Promise<string> {
  // Split into sentences and work backwards to get approximately the right amount of overlap
  const sentences = splitIntoSentences(text);
  let overlapText = '';
  let tokens = 0;
  
  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentence = sentences[i];
    const sentenceTokens = await countTokens(sentence);
    
    if (tokens + sentenceTokens <= overlapTokens) {
      overlapText = sentence + (overlapText ? ' ' + overlapText : '');
      tokens += sentenceTokens;
    } else {
      break;
    }
  }
  
  return overlapText;
}

/**
 * Main chunking function implementing the three-tier strategy:
 * 1. Split at paragraph boundaries (double newlines)
 * 2. If paragraphs are too large, split at sentence boundaries
 * 3. If sentences are still too large, use fixed-size chunking
 * 
 * @param document - Document to chunk
 * @param config - Chunking configuration
 * @returns Array of chunks with metadata
 */
export async function chunkDocument(
  document: Document, 
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Promise<Chunk[]> {
  console.log(`📝 Chunking document "${document.title}" with config: chunkSize=${config.chunkSize}, chunkOverlap=${config.chunkOverlap}`);
  
  if (!document.content || document.content.trim().length === 0) {
    return [];
  }
  
  // Tier 1: Split into paragraphs
  const paragraphs = splitIntoParagraphs(document.content);
  
  // Tier 2: For large paragraphs, split into sentences
  const segments: string[] = [];
  
  for (const paragraph of paragraphs) {
    const paragraphTokens = await countTokens(paragraph);
    
    if (paragraphTokens <= config.chunkSize) {
      // Paragraph is small enough, use as-is
      segments.push(paragraph);
    } else {
      // Paragraph is too large, split into sentences
      const sentences = splitIntoSentences(paragraph);
      
      // Group sentences that fit within token limits
      let currentGroup = '';
      let currentTokens = 0;
      
      for (const sentence of sentences) {
        const sentenceTokens = await countTokens(sentence);
        
        // If single sentence exceeds limit, it will be handled in createChunksFromSegments
        if (sentenceTokens > config.chunkSize) {
          // Save current group if it has content
          if (currentGroup.trim()) {
            segments.push(currentGroup.trim());
            currentGroup = '';
            currentTokens = 0;
          }
          // Add the large sentence as its own segment (will be split later)
          segments.push(sentence);
          continue;
        }
        
        const potentialGroup = currentGroup ? `${currentGroup} ${sentence}` : sentence;
        const potentialTokens = await countTokens(potentialGroup);
        
        if (potentialTokens <= config.chunkSize) {
          currentGroup = potentialGroup;
          currentTokens = potentialTokens;
        } else {
          // Save current group and start new one
          if (currentGroup.trim()) {
            segments.push(currentGroup.trim());
          }
          currentGroup = sentence;
          currentTokens = sentenceTokens;
        }
      }
      
      // Add final group if it has content
      if (currentGroup.trim()) {
        segments.push(currentGroup.trim());
      }
    }
  }
  
  // Tier 3: Create final chunks with overlap handling
  const chunkTexts = await createChunksFromSegments(segments, config);
  
  // Convert to Chunk objects with metadata
  const chunks: Chunk[] = [];
  for (let i = 0; i < chunkTexts.length; i++) {
    const text = chunkTexts[i];
    const tokenCount = await countTokens(text);
    
    chunks.push({
      text,
      chunkIndex: i,
      tokenCount
    });
  }
  
  return chunks;
}