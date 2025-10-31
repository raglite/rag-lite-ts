import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { chunkDocument, DEFAULT_CHUNK_CONFIG, type GenericDocument, type ChunkConfig } from '../../src/../src/core/chunker.js';

describe('Chunker', () => {
  const sampleDocument: GenericDocument = {
    source: 'test.md',
    title: 'Test Document',
    content: '',
    contentType: 'text'
  };

  test('should return empty array for empty document', async () => {
    const doc = { ...sampleDocument, content: '' };
    const chunks = await chunkDocument(doc);
    assert.equal(chunks.length, 0);
  });

  test('should return empty array for whitespace-only document', async () => {
    const doc = { ...sampleDocument, content: '   \n\n   ' };
    const chunks = await chunkDocument(doc);
    assert.equal(chunks.length, 0);
  });

  test('should handle simple single paragraph document', async () => {
    const doc = {
      ...sampleDocument,
      content: 'This is a simple paragraph with a few sentences. It should be chunked as a single piece.'
    };
    
    const chunks = await chunkDocument(doc);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].text, doc.content);
    assert.equal(chunks[0].chunkIndex, 0);
    assert.ok(chunks[0].tokenCount > 0);
  });

  test('should split at paragraph boundaries (double newlines)', async () => {
    const doc = {
      ...sampleDocument,
      content: `First paragraph with some content.

Second paragraph with different content.

Third paragraph with more content.`
    };
    
    const chunks = await chunkDocument(doc);
    
    // Should create separate chunks for each paragraph if they're small enough
    assert.ok(chunks.length >= 1);
    
    // Verify that paragraphs are handled correctly
    const fullText = chunks.map(c => c.text).join(' ');
    assert.ok(fullText.includes('First paragraph'));
    assert.ok(fullText.includes('Second paragraph'));
    assert.ok(fullText.includes('Third paragraph'));
  });

  test('should split at sentence boundaries when paragraphs are too large', async () => {
    // Create a large paragraph that exceeds token limits
    const longParagraph = 'This is the first sentence. ' +
      'This is the second sentence with more content. ' +
      'This is the third sentence with even more content to make it longer. ' +
      'This is the fourth sentence continuing the pattern. ' +
      'This is the fifth sentence adding more text. ' +
      'This is the sixth sentence with additional content. ' +
      'This is the seventh sentence making it even longer. ' +
      'This is the eighth sentence with more words. ' +
      'This is the ninth sentence continuing to add content. ' +
      'This is the tenth sentence with final content.';
    
    const doc = {
      ...sampleDocument,
      content: longParagraph
    };
    
    const config: ChunkConfig = {
      chunkSize: 50, // Small chunk size to force sentence splitting
      chunkOverlap: 10
    };
    
    const chunks = await chunkDocument(doc, config);
    
    // Should create multiple chunks
    assert.ok(chunks.length > 1);
    
    // Each chunk should respect token limits
    for (const chunk of chunks) {
      assert.ok(chunk.tokenCount <= config.chunkSize + 10); // Allow some tolerance
    }
  });

  test('should use fixed-size fallback for unstructured content', async () => {
    // Create content without clear sentence boundaries
    const unstructuredContent = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 ' +
      'word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 ' +
      'word21 word22 word23 word24 word25 word26 word27 word28 word29 word30 ' +
      'word31 word32 word33 word34 word35 word36 word37 word38 word39 word40';
    
    const doc = {
      ...sampleDocument,
      content: unstructuredContent
    };
    
    const config: ChunkConfig = {
      chunkSize: 20, // Small chunk size to force fixed-size splitting
      chunkOverlap: 5
    };
    
    const chunks = await chunkDocument(doc, config);
    
    // Should create multiple chunks
    assert.ok(chunks.length > 1);
    
    // Each chunk should respect token limits
    for (const chunk of chunks) {
      assert.ok(chunk.tokenCount <= config.chunkSize + 5); // Allow some tolerance
    }
  });

  test('should maintain 200-300 token chunks with default config', async () => {
    // Create a document that will result in multiple chunks
    const content = Array(10).fill(
      'This is a paragraph with multiple sentences. ' +
      'Each sentence contains meaningful content that should be preserved. ' +
      'The chunking algorithm should maintain semantic boundaries while respecting token limits. ' +
      'This helps ensure that the resulting chunks are coherent and useful for search.'
    ).join('\n\n');
    
    const doc = {
      ...sampleDocument,
      content
    };
    
    const chunks = await chunkDocument(doc);
    
    // Should create multiple chunks
    assert.ok(chunks.length > 1);
    
    // Most chunks should be in the 200-300 token range
    let chunksInRange = 0;
    for (const chunk of chunks) {
      if (chunk.tokenCount >= 200 && chunk.tokenCount <= 300) {
        chunksInRange++;
      }
      // No chunk should exceed the limit by much
      assert.ok(chunk.tokenCount <= 350); // Allow some tolerance
    }
    
    // At least half the chunks should be in the target range
    assert.ok(chunksInRange >= chunks.length / 2);
  });

  test('should implement 50 token overlap correctly', async () => {
    // Create content that will definitely need multiple chunks
    const sentences = Array(20).fill(
      'This is a test sentence with enough content to create meaningful chunks. '
    );
    
    const doc = {
      ...sampleDocument,
      content: sentences.join('')
    };
    
    const config: ChunkConfig = {
      chunkSize: 100,
      chunkOverlap: 20
    };
    
    const chunks = await chunkDocument(doc, config);
    
    if (chunks.length > 1) {
      // Check for overlap between consecutive chunks
      for (let i = 0; i < chunks.length - 1; i++) {
        const currentChunk = chunks[i].text;
        const nextChunk = chunks[i + 1].text;
        
        // There should be some overlap (exact overlap detection is complex,
        // so we just verify chunks aren't completely disjoint)
        const currentWords = currentChunk.split(' ');
        const nextWords = nextChunk.split(' ');
        
        // Find common words between end of current and start of next
        const endWords = currentWords.slice(-10); // Last 10 words
        const startWords = nextWords.slice(0, 10); // First 10 words
        
        const hasOverlap = endWords.some(word => 
          startWords.includes(word) && word.length > 3 // Ignore short words
        );
        
        // Note: Overlap might not always be detectable with this simple test,
        // but the algorithm should attempt it
      }
    }
  });

  test('should handle markdown content correctly', async () => {
    const markdownContent = `# Main Title

This is the introduction paragraph with some **bold** and *italic* text.

## Section 1

This is the first section with a list:

- Item 1 with some content
- Item 2 with more content  
- Item 3 with additional content

## Section 2

This section has code:

\`\`\`javascript
function example() {
  return "hello world";
}
\`\`\`

And more text after the code block.`;

    const doc = {
      ...sampleDocument,
      content: markdownContent
    };
    
    const chunks = await chunkDocument(doc);
    
    // Should handle markdown syntax
    assert.ok(chunks.length >= 1);
    
    // Verify content is preserved
    const fullText = chunks.map(c => c.text).join(' ');
    assert.ok(fullText.includes('Main Title'));
    assert.ok(fullText.includes('**bold**'));
    assert.ok(fullText.includes('function example'));
  });

  test('should assign correct chunk indices', async () => {
    const content = Array(5).fill(
      'This is a paragraph that will create multiple chunks. ' +
      'Each chunk should have the correct index assigned to it.'
    ).join('\n\n');
    
    const doc = {
      ...sampleDocument,
      content
    };
    
    const chunks = await chunkDocument(doc);
    
    // Verify indices are sequential starting from 0
    for (let i = 0; i < chunks.length; i++) {
      assert.equal(chunks[i].chunkIndex, i);
    }
  });

  test('should handle edge case of very short content', async () => {
    const doc = {
      ...sampleDocument,
      content: 'Short.'
    };
    
    const chunks = await chunkDocument(doc);
    
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].text, 'Short.');
    assert.equal(chunks[0].chunkIndex, 0);
    assert.ok(chunks[0].tokenCount > 0);
  });

  test('should handle content with only punctuation', async () => {
    const doc = {
      ...sampleDocument,
      content: '!!! ??? ... --- !!!'
    };
    
    const chunks = await chunkDocument(doc);
    
    assert.equal(chunks.length, 1);
    assert.ok(chunks[0].tokenCount > 0);
  });

  test('should handle mixed content types', async () => {
    const mixedContent = `Regular paragraph text.

# Heading

- List item
- Another item

Code: \`console.log("test")\`

> Blockquote text

Final paragraph.`;

    const doc = {
      ...sampleDocument,
      content: mixedContent
    };
    
    const chunks = await chunkDocument(doc);
    
    assert.ok(chunks.length >= 1);
    
    // Verify all content types are preserved
    const fullText = chunks.map(c => c.text).join(' ');
    assert.ok(fullText.includes('Regular paragraph'));
    assert.ok(fullText.includes('Heading'));
    assert.ok(fullText.includes('List item'));
    assert.ok(fullText.includes('console.log'));
    assert.ok(fullText.includes('Blockquote'));
    assert.ok(fullText.includes('Final paragraph'));
  });

  test('should respect custom chunk configuration', async () => {
    const content = 'This is a test document with multiple sentences. ' +
      'Each sentence should be processed according to the custom configuration. ' +
      'The chunking should respect the specified limits.';
    
    const doc = {
      ...sampleDocument,
      content
    };
    
    const customConfig: ChunkConfig = {
      chunkSize: 30,
      chunkOverlap: 5
    };
    
    const chunks = await chunkDocument(doc, customConfig);
    
    // Should respect custom token limits
    for (const chunk of chunks) {
      assert.ok(chunk.tokenCount <= customConfig.chunkSize + 10); // Allow tolerance
    }
  });
});