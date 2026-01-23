/**
 * CORE MODULE — Prompt Templates for RAG Response Generation
 * 
 * Provides prompt engineering utilities for different generator model types.
 * Handles context formatting, token budget management, and system prompts.
 * 
 * PROMPT STRATEGIES:
 * - Instruct models: Use chat template with system/user/assistant roles
 * - Causal LM models: Use simple document + question format
 * 
 * @experimental This feature is experimental and may change in future versions.
 */

import type { SearchResult } from './types.js';
import type { GeneratorModelType } from './response-generator.js';

// =============================================================================
// DEFAULT PROMPTS
// =============================================================================

/**
 * Default system prompt for instruct models
 * Emphasizes grounded responses using only provided context
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based ONLY on the provided context documents. Follow these rules strictly:

1. Answer ONLY using information found in the context documents
2. If the answer cannot be found in the context, say "I cannot find this information in the provided documents"
3. Do not make up information or use external knowledge
4. Be concise and direct in your response
5. If the context is incomplete or unclear, acknowledge this limitation`;

/**
 * Default system prompt for RAG with source attribution
 */
export const DEFAULT_SYSTEM_PROMPT_WITH_ATTRIBUTION = `You are a helpful assistant that answers questions based ONLY on the provided context documents. Follow these rules strictly:

1. Answer ONLY using information found in the context documents
2. When possible, mention which document the information comes from
3. If the answer cannot be found in the context, say "I cannot find this information in the provided documents"
4. Do not make up information or use external knowledge
5. Be concise and direct in your response`;

// =============================================================================
// CHAT TEMPLATES
// =============================================================================

/**
 * SmolLM2 chat template format
 * Uses <|im_start|> and <|im_end|> tokens
 */
export const SMOLLM2_CHAT_TEMPLATE = {
  systemStart: '<|im_start|>system\n',
  systemEnd: '<|im_end|>\n',
  userStart: '<|im_start|>user\n',
  userEnd: '<|im_end|>\n',
  assistantStart: '<|im_start|>assistant\n',
  assistantEnd: '<|im_end|>',
  endOfText: '<|endoftext|>'
};

// =============================================================================
// CONTEXT FORMATTING
// =============================================================================

/**
 * Options for formatting context chunks
 */
export interface ContextFormattingOptions {
  /** Maximum tokens available for context */
  maxContextTokens: number;
  
  /** Include document titles/sources */
  includeDocumentInfo?: boolean;
  
  /** Include relevance scores */
  includeScores?: boolean;
  
  /** Separator between chunks */
  chunkSeparator?: string;
  
  /** Token estimation function (chars to tokens ratio) */
  tokenEstimationRatio?: number;
}

/**
 * Result of context formatting
 */
export interface FormattedContext {
  /** Formatted context string */
  text: string;
  
  /** Estimated token count */
  estimatedTokens: number;
  
  /** Number of chunks included */
  chunksIncluded: number;
  
  /** Total chunks available */
  totalChunks: number;
  
  /** Whether context was truncated */
  truncated: boolean;
}

/**
 * Format search result chunks into context string for the prompt
 * 
 * @param chunks - Search result chunks to format
 * @param options - Formatting options
 * @returns Formatted context with metadata
 */
export function formatContextChunks(
  chunks: SearchResult[],
  options: ContextFormattingOptions
): FormattedContext {
  const {
    maxContextTokens,
    includeDocumentInfo = true,
    includeScores = false,
    chunkSeparator = '\n---\n',
    tokenEstimationRatio = 4  // ~4 chars per token for English
  } = options;

  const maxChars = maxContextTokens * tokenEstimationRatio;
  
  let currentChars = 0;
  const includedChunks: string[] = [];
  let truncated = false;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Format this chunk
    let chunkText = '';
    
    if (includeDocumentInfo) {
      chunkText += `[Document ${i + 1}: ${chunk.document.title}]`;
      if (includeScores) {
        chunkText += ` (relevance: ${(chunk.score * 100).toFixed(1)}%)`;
      }
      chunkText += '\n';
    }
    
    chunkText += chunk.content;
    
    // Check if adding this chunk would exceed budget
    const chunkChars = chunkText.length + (includedChunks.length > 0 ? chunkSeparator.length : 0);
    
    if (currentChars + chunkChars > maxChars) {
      // Check if we can fit a truncated version of this chunk
      const remainingChars = maxChars - currentChars - (includedChunks.length > 0 ? chunkSeparator.length : 0);
      
      if (remainingChars > 100 && includedChunks.length === 0) {
        // Truncate the first chunk if it's the only option
        chunkText = chunkText.substring(0, remainingChars - 20) + '\n[Content truncated...]';
        includedChunks.push(chunkText);
        currentChars += chunkText.length;
      }
      
      truncated = true;
      break;
    }
    
    includedChunks.push(chunkText);
    currentChars += chunkChars;
  }

  const text = includedChunks.join(chunkSeparator);
  const estimatedTokens = Math.ceil(text.length / tokenEstimationRatio);

  return {
    text,
    estimatedTokens,
    chunksIncluded: includedChunks.length,
    totalChunks: chunks.length,
    truncated
  };
}

// =============================================================================
// PROMPT BUILDING
// =============================================================================

/**
 * Options for building the complete prompt
 */
export interface PromptBuildOptions {
  /** User's query */
  query: string;
  
  /** Search result chunks */
  chunks: SearchResult[];
  
  /** Generator model type */
  modelType: GeneratorModelType;
  
  /** Custom system prompt (optional) */
  systemPrompt?: string;
  
  /** Maximum context window tokens */
  maxContextLength: number;
  
  /** Tokens reserved for output */
  reservedOutputTokens: number;
  
  /** Include source attribution hint */
  includeSourceAttribution?: boolean;
}

/**
 * Result of prompt building
 */
export interface BuiltPrompt {
  /** Complete prompt string */
  prompt: string;
  
  /** Estimated total tokens */
  estimatedTokens: number;
  
  /** Context metadata */
  contextInfo: FormattedContext;
  
  /** System prompt used (if any) */
  systemPromptUsed?: string;
}

/**
 * Build a complete prompt for the generator model
 * 
 * @param options - Prompt building options
 * @returns Built prompt with metadata
 */
export function buildPrompt(options: PromptBuildOptions): BuiltPrompt {
  const {
    query,
    chunks,
    modelType,
    systemPrompt,
    maxContextLength,
    reservedOutputTokens,
    includeSourceAttribution = false
  } = options;

  // Calculate available tokens for context
  const promptOverhead = modelType === 'instruct' ? 150 : 50;  // Tokens for formatting
  const queryTokens = Math.ceil(query.length / 4);
  const availableContextTokens = maxContextLength - reservedOutputTokens - promptOverhead - queryTokens;

  // Format context chunks
  const contextInfo = formatContextChunks(chunks, {
    maxContextTokens: availableContextTokens,
    includeDocumentInfo: true,
    includeScores: false
  });

  // Build prompt based on model type
  let prompt: string;
  let systemPromptUsed: string | undefined;

  if (modelType === 'instruct') {
    prompt = buildInstructPrompt(query, contextInfo.text, systemPrompt, includeSourceAttribution);
    systemPromptUsed = systemPrompt || (includeSourceAttribution ? DEFAULT_SYSTEM_PROMPT_WITH_ATTRIBUTION : DEFAULT_SYSTEM_PROMPT);
  } else {
    prompt = buildCausalLMPrompt(query, contextInfo.text);
  }

  const estimatedTokens = Math.ceil(prompt.length / 4);

  return {
    prompt,
    estimatedTokens,
    contextInfo,
    systemPromptUsed
  };
}

/**
 * Build prompt for instruct models (SmolLM2-Instruct)
 * Uses chat template format with system/user/assistant roles
 */
function buildInstructPrompt(
  query: string,
  context: string,
  customSystemPrompt?: string,
  includeSourceAttribution: boolean = false
): string {
  const systemPrompt = customSystemPrompt || 
    (includeSourceAttribution ? DEFAULT_SYSTEM_PROMPT_WITH_ATTRIBUTION : DEFAULT_SYSTEM_PROMPT);

  const template = SMOLLM2_CHAT_TEMPLATE;

  const userMessage = `Context:
${context}

Question: ${query}

Answer based only on the context above:`;

  return `${template.systemStart}${systemPrompt}${template.systemEnd}${template.userStart}${userMessage}${template.userEnd}${template.assistantStart}`;
}

/**
 * Build prompt for causal LM models (DistilGPT2)
 * Uses simple document + question format without roles
 */
function buildCausalLMPrompt(query: string, context: string): string {
  return `The following documents contain information to answer the question.

Documents:
${context}

Based on the documents above, answer this question: ${query}

Answer:`;
}

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate token count for a string
 * Uses a simple character-based heuristic (~4 chars per token for English)
 * 
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  // Simple heuristic: ~4 characters per token for English text
  // This is a rough approximation; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

/**
 * Calculate available context budget
 * 
 * @param maxContextLength - Maximum context window size
 * @param reservedOutputTokens - Tokens reserved for generation
 * @param promptOverhead - Tokens used by prompt formatting
 * @returns Available tokens for context chunks
 */
export function calculateContextBudget(
  maxContextLength: number,
  reservedOutputTokens: number,
  promptOverhead: number = 100
): number {
  return Math.max(0, maxContextLength - reservedOutputTokens - promptOverhead);
}

// =============================================================================
// STOP SEQUENCES
// =============================================================================

/**
 * Get default stop sequences for a model type
 * 
 * @param modelType - Generator model type
 * @returns Array of stop sequences
 */
export function getDefaultStopSequences(modelType: GeneratorModelType): string[] {
  if (modelType === 'instruct') {
    return [
      SMOLLM2_CHAT_TEMPLATE.assistantEnd,
      SMOLLM2_CHAT_TEMPLATE.endOfText,
      '<|im_start|>',
      '\n\nQuestion:',
      '\n\nContext:'
    ];
  }
  
  // Causal LM stop sequences
  return [
    '\n\nQuestion:',
    '\n\nDocuments:',
    '\n\n---',
    '<|endoftext|>'
  ];
}
