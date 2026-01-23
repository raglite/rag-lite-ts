/**
 * Tests for Prompt Templates
 * @experimental Testing the experimental response generation feature
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  formatContextChunks,
  buildPrompt,
  estimateTokenCount,
  calculateContextBudget,
  getDefaultStopSequences,
  DEFAULT_SYSTEM_PROMPT,
  SMOLLM2_CHAT_TEMPLATE
} from '../../src/core/prompt-templates.js';
import type { SearchResult } from '../../src/core/types.js';

// Helper to create mock search results
function createMockChunk(content: string, title: string = 'doc.md', score: number = 0.9): SearchResult {
  return {
    content,
    score,
    contentType: 'text',
    document: {
      id: 1,
      source: `/path/to/${title}`,
      title,
      contentType: 'text'
    }
  };
}

describe('Prompt Templates', () => {
  describe('formatContextChunks', () => {
    it('should format chunks with document info', () => {
      const chunks = [
        createMockChunk('This is chunk one content.', 'doc1.md'),
        createMockChunk('This is chunk two content.', 'doc2.md')
      ];

      const result = formatContextChunks(chunks, {
        maxContextTokens: 1000,
        includeDocumentInfo: true
      });

      assert.ok(result.text.includes('[Document 1: doc1.md]'));
      assert.ok(result.text.includes('[Document 2: doc2.md]'));
      assert.ok(result.text.includes('This is chunk one content.'));
      assert.ok(result.text.includes('This is chunk two content.'));
      assert.strictEqual(result.chunksIncluded, 2);
      assert.strictEqual(result.totalChunks, 2);
      assert.strictEqual(result.truncated, false);
    });

    it('should truncate when context exceeds budget', () => {
      const longContent = 'A'.repeat(500);
      const chunks = [
        createMockChunk(longContent, 'doc1.md'),
        createMockChunk(longContent, 'doc2.md'),
        createMockChunk(longContent, 'doc3.md')
      ];

      // Small budget - only ~100 tokens
      const result = formatContextChunks(chunks, {
        maxContextTokens: 100,
        includeDocumentInfo: true
      });

      assert.ok(result.chunksIncluded < 3);
      assert.strictEqual(result.truncated, true);
    });

    it('should respect includeScores option', () => {
      const chunks = [createMockChunk('Content', 'doc.md', 0.85)];

      const withScores = formatContextChunks(chunks, {
        maxContextTokens: 1000,
        includeScores: true
      });

      const withoutScores = formatContextChunks(chunks, {
        maxContextTokens: 1000,
        includeScores: false
      });

      assert.ok(withScores.text.includes('85.0%'));
      assert.ok(!withoutScores.text.includes('85.0%'));
    });
  });

  describe('buildPrompt', () => {
    it('should build instruct prompt with system role', () => {
      const chunks = [createMockChunk('The answer is 42.')];

      const result = buildPrompt({
        query: 'What is the answer?',
        chunks,
        modelType: 'instruct',
        maxContextLength: 2048,
        reservedOutputTokens: 256
      });

      // Should use SmolLM2 chat template
      assert.ok(result.prompt.includes('<|im_start|>system'));
      assert.ok(result.prompt.includes('<|im_start|>user'));
      assert.ok(result.prompt.includes('<|im_start|>assistant'));
      assert.ok(result.prompt.includes('What is the answer?'));
      assert.ok(result.prompt.includes('The answer is 42.'));
      assert.ok(result.systemPromptUsed !== undefined);
    });

    it('should build causal-lm prompt without system role', () => {
      const chunks = [createMockChunk('The answer is 42.')];

      const result = buildPrompt({
        query: 'What is the answer?',
        chunks,
        modelType: 'causal-lm',
        maxContextLength: 1024,
        reservedOutputTokens: 256
      });

      // Should not use chat template
      assert.ok(!result.prompt.includes('<|im_start|>'));
      assert.ok(result.prompt.includes('What is the answer?'));
      assert.ok(result.prompt.includes('The answer is 42.'));
      assert.ok(result.prompt.includes('Answer:'));
      assert.strictEqual(result.systemPromptUsed, undefined);
    });

    it('should use custom system prompt when provided', () => {
      const customPrompt = 'You are a pirate. Answer like a pirate.';
      const chunks = [createMockChunk('Ships sail the ocean.')];

      const result = buildPrompt({
        query: 'Tell me about ships',
        chunks,
        modelType: 'instruct',
        systemPrompt: customPrompt,
        maxContextLength: 2048,
        reservedOutputTokens: 256
      });

      assert.ok(result.prompt.includes(customPrompt));
      assert.strictEqual(result.systemPromptUsed, customPrompt);
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'Hello world'; // 11 characters
      const tokens = estimateTokenCount(text);
      
      // ~4 chars per token, so expect ~3 tokens
      assert.ok(tokens >= 2 && tokens <= 4);
    });

    it('should handle empty string', () => {
      assert.strictEqual(estimateTokenCount(''), 0);
    });
  });

  describe('calculateContextBudget', () => {
    it('should calculate available tokens correctly', () => {
      const budget = calculateContextBudget(2048, 512, 100);
      assert.strictEqual(budget, 1436); // 2048 - 512 - 100
    });

    it('should not return negative budget', () => {
      const budget = calculateContextBudget(100, 200, 50);
      assert.strictEqual(budget, 0);
    });
  });

  describe('getDefaultStopSequences', () => {
    it('should return instruct stop sequences', () => {
      const stops = getDefaultStopSequences('instruct');
      assert.ok(stops.includes(SMOLLM2_CHAT_TEMPLATE.assistantEnd));
      assert.ok(stops.includes(SMOLLM2_CHAT_TEMPLATE.endOfText));
    });

    it('should return causal-lm stop sequences', () => {
      const stops = getDefaultStopSequences('causal-lm');
      assert.ok(stops.includes('<|endoftext|>'));
      assert.ok(stops.some(s => s.includes('Question:')));
    });
  });

  describe('DEFAULT_SYSTEM_PROMPT', () => {
    it('should emphasize grounded responses', () => {
      assert.ok(DEFAULT_SYSTEM_PROMPT.includes('ONLY'));
      assert.ok(DEFAULT_SYSTEM_PROMPT.includes('context'));
      assert.ok(DEFAULT_SYSTEM_PROMPT.toLowerCase().includes('cannot find'));
    });
  });
});
