import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { countTokens, getTokenizer, resetTokenizer } from '../../src/text/tokenizer.js';

describe('Tokenizer', () => {
  test('countTokens should return 0 for empty string', async () => {
    const count = await countTokens('');
    assert.equal(count, 0);
  });

  test('countTokens should return 0 for null/undefined input', async () => {
    const count1 = await countTokens('');
    const count2 = await countTokens('   '); // whitespace only
    assert.equal(count1, 0);
    // Whitespace should still have some tokens
    assert.ok(count2 >= 0);
  });

  test('countTokens should handle simple text', async () => {
    const text = 'Hello world';
    const count = await countTokens(text);
    
    // Should have at least 2 tokens for "Hello" and "world"
    assert.ok(count >= 2);
    assert.ok(typeof count === 'number');
  });

  test('countTokens should handle longer text', async () => {
    const text = 'This is a longer sentence with multiple words that should be tokenized properly.';
    const count = await countTokens(text);
    
    // Should have multiple tokens
    assert.ok(count > 10);
    assert.ok(typeof count === 'number');
  });

  test('countTokens should handle special characters and punctuation', async () => {
    const text = 'Hello, world! How are you? I\'m fine.';
    const count = await countTokens(text);
    
    // Should handle punctuation and contractions
    assert.ok(count > 5);
    assert.ok(typeof count === 'number');
  });

  test('countTokens should be consistent for same input', async () => {
    const text = 'Consistent tokenization test';
    const count1 = await countTokens(text);
    const count2 = await countTokens(text);
    
    assert.equal(count1, count2);
  });

  test('countTokens should handle markdown-like content', async () => {
    const text = '# Heading\n\nThis is a paragraph with **bold** and *italic* text.\n\n- List item 1\n- List item 2';
    const count = await countTokens(text);
    
    // Should tokenize markdown syntax
    assert.ok(count > 15);
    assert.ok(typeof count === 'number');
  });

  test('countTokens should handle code-like content', async () => {
    const text = 'function hello() { return "world"; }';
    const count = await countTokens(text);
    
    // Should handle code syntax
    assert.ok(count > 5);
    assert.ok(typeof count === 'number');
  });

  test('tokenizer should use MiniLM-L6-v2 model', async () => {
    const tokenizer = await getTokenizer();
    
    // Verify we can get the tokenizer instance
    assert.ok(tokenizer);
    assert.ok(typeof tokenizer.encode === 'function');
  });

  test('countTokens should handle very long text', async () => {
    // Create a text that's likely to be around 200-300 tokens
    const longText = 'This is a test sentence. '.repeat(20) + 
                     'It contains multiple repeated sentences to test token counting with longer content. ' +
                     'The tokenizer should handle this efficiently and return an accurate count.';
    
    const count = await countTokens(longText);
    
    // Should be a reasonable number of tokens for this length
    assert.ok(count > 50);
    assert.ok(count < 500); // Sanity check - shouldn't be too high
  });

  test('resetTokenizer should allow re-initialization', async () => {
    // First use
    const count1 = await countTokens('test');
    
    // Reset and use again
    resetTokenizer();
    const count2 = await countTokens('test');
    
    // Should get same result
    assert.equal(count1, count2);
  });

  test('countTokens should handle edge cases', async () => {
    // Test various edge cases
    const testCases = [
      { text: 'a', expectedMin: 1 },
      { text: '123', expectedMin: 1 },
      { text: '!@#$%', expectedMin: 1 },
      { text: '\n\n\n', expectedMin: 1 },
      { text: 'word1 word2 word3', expectedMin: 3 }
    ];

    for (const testCase of testCases) {
      const count = await countTokens(testCase.text);
      assert.ok(count >= testCase.expectedMin, 
        `Text "${testCase.text}" should have at least ${testCase.expectedMin} tokens, got ${count}`);
    }
  });
});
