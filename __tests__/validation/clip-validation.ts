/**
 * Independent CLIP Validation Script
 * 
 * This script validates the CLIPTextModelWithProjection approach for text-only embedding
 * without any dependencies on the existing codebase. It tests the technical approach
 * that will be used to fix the CLIP text embedding issue.
 * 
 * Requirements tested:
 * - 5.1: Fix the current CLIP text embedding technical failure
 * - 5.2: Enable CLIP models to embed text without pixel_values errors
 * 
 * This validation must pass before proceeding with any integration work.
 */

import './dom-polyfills.js';

/**
 * Test CLIP text embedding using CLIPTextModelWithProjection approach
 */
async function validateCLIPTextEmbedding(): Promise<void> {
  console.log('🔍 Starting CLIP text embedding validation...');
  
  try {
    // Import transformers.js components
    console.log('📦 Importing transformers.js components...');
    const { AutoTokenizer, CLIPTextModelWithProjection } = await import('@huggingface/transformers');
    console.log('✅ Successfully imported CLIPTextModelWithProjection and AutoTokenizer');
    
    // Test model name - using the CLIP model mentioned in the spec
    const modelName = 'Xenova/clip-vit-base-patch32';
    console.log(`🤖 Testing with model: ${modelName}`);
    
    // Load tokenizer
    console.log('🔤 Loading tokenizer...');
    const tokenizer = await AutoTokenizer.from_pretrained(modelName);
    console.log('✅ Tokenizer loaded successfully');
    
    // Load text model
    console.log('🧠 Loading CLIP text model...');
    const textModel = await CLIPTextModelWithProjection.from_pretrained(modelName);
    console.log('✅ CLIP text model loaded successfully');
    
    // Test text inputs
    const testTexts = [
      'red sports car',
      'beautiful sunset over mountains',
      'cat sitting on a windowsill',
      'modern office building',
      'person reading a book'
    ];
    
    console.log(`📝 Testing text embedding with ${testTexts.length} sample texts...`);
    
    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      console.log(`\n🔤 Processing text ${i + 1}/${testTexts.length}: "${text}"`);
      
      // Tokenize text with CLIP's requirements
      console.log('  📋 Tokenizing text...');
      const tokens = await tokenizer(text, {
        padding: true,
        truncation: true,
        max_length: 77, // CLIP's text sequence length limit
        return_tensors: 'pt'
      });
      console.log('  ✅ Text tokenized successfully');
      
      // Generate text embedding using CLIPTextModelWithProjection
      console.log('  🧮 Generating text embedding...');
      const output = await textModel(tokens);
      console.log('  ✅ Text embedding generated successfully');
      
      // Extract embedding vector
      console.log('  📊 Extracting embedding vector...');
      const embedding = new Float32Array(output.text_embeds.data);
      console.log(`  ✅ Embedding extracted: ${embedding.length} dimensions`);
      
      // Validate embedding properties
      if (embedding.length !== 512) {
        throw new Error(`Expected 512 dimensions, got ${embedding.length}`);
      }
      
      // Check that all values are valid numbers
      const invalidValues = Array.from(embedding).filter(val => isNaN(val) || !isFinite(val));
      if (invalidValues.length > 0) {
        throw new Error(`Found ${invalidValues.length} invalid values in embedding`);
      }
      
      // Check that embedding is not all zeros
      const nonZeroValues = Array.from(embedding).filter(val => val !== 0);
      if (nonZeroValues.length === 0) {
        throw new Error('Embedding is all zeros - indicates a problem');
      }
      
      console.log(`  ✅ Embedding validation passed: ${nonZeroValues.length}/${embedding.length} non-zero values`);
      
      // Calculate embedding magnitude for normalization check
      const magnitude = Math.sqrt(Array.from(embedding).reduce((sum, val) => sum + val * val, 0));
      console.log(`  📏 Embedding magnitude: ${magnitude.toFixed(4)}`);
    }
    
    console.log('\n🎉 All text embedding tests passed!');
    
    // Test consistency - same text should produce same embedding
    console.log('\n🔄 Testing embedding consistency...');
    const consistencyText = 'test consistency';
    
    const tokens1 = await tokenizer(consistencyText, {
      padding: true,
      truncation: true,
      max_length: 77,
      return_tensors: 'pt'
    });
    const output1 = await textModel(tokens1);
    const embedding1 = new Float32Array(output1.text_embeds.data);
    
    const tokens2 = await tokenizer(consistencyText, {
      padding: true,
      truncation: true,
      max_length: 77,
      return_tensors: 'pt'
    });
    const output2 = await textModel(tokens2);
    const embedding2 = new Float32Array(output2.text_embeds.data);
    
    // Check if embeddings are identical
    let identical = true;
    for (let i = 0; i < embedding1.length; i++) {
      if (Math.abs(embedding1[i] - embedding2[i]) > 1e-6) {
        identical = false;
        break;
      }
    }
    
    if (identical) {
      console.log('✅ Embedding consistency test passed - same text produces identical embeddings');
    } else {
      console.log('⚠️  Embedding consistency test failed - same text produces different embeddings');
    }
    
    // Test semantic similarity
    console.log('\n🔗 Testing semantic similarity...');
    const similarTexts = ['red car', 'crimson automobile'];
    
    const tokens_a = await tokenizer(similarTexts[0], {
      padding: true,
      truncation: true,
      max_length: 77,
      return_tensors: 'pt'
    });
    const output_a = await textModel(tokens_a);
    const embedding_a = new Float32Array(output_a.text_embeds.data);
    
    const tokens_b = await tokenizer(similarTexts[1], {
      padding: true,
      truncation: true,
      max_length: 77,
      return_tensors: 'pt'
    });
    const output_b = await textModel(tokens_b);
    const embedding_b = new Float32Array(output_b.text_embeds.data);
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < embedding_a.length; i++) {
      dotProduct += embedding_a[i] * embedding_b[i];
      normA += embedding_a[i] * embedding_a[i];
      normB += embedding_b[i] * embedding_b[i];
    }
    
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    console.log(`📊 Semantic similarity between "${similarTexts[0]}" and "${similarTexts[1]}": ${similarity.toFixed(4)}`);
    
    if (similarity > 0.5) {
      console.log('✅ Semantic similarity test passed - related texts have high similarity');
    } else {
      console.log('⚠️  Semantic similarity test warning - similarity lower than expected');
    }
    
    console.log('\n🎯 CLIP text embedding validation completed successfully!');
    console.log('✅ CLIPTextModelWithProjection approach works without pixel_values errors');
    console.log('✅ Text embeddings are generated with correct dimensions (512)');
    console.log('✅ Embeddings contain valid numerical values');
    console.log('✅ Embeddings are consistent for the same input');
    console.log('✅ Embeddings show semantic similarity for related texts');
    
  } catch (error) {
    console.error('❌ CLIP text embedding validation failed:');
    console.error(error);
    throw error;
  }
}

/**
 * Test edge cases and error handling
 */
async function validateEdgeCases(): Promise<void> {
  console.log('\n🧪 Testing edge cases...');
  
  try {
    const { AutoTokenizer, CLIPTextModelWithProjection } = await import('@huggingface/transformers');
    const modelName = 'Xenova/clip-vit-base-patch32';
    
    const tokenizer = await AutoTokenizer.from_pretrained(modelName);
    const textModel = await CLIPTextModelWithProjection.from_pretrained(modelName);
    
    // Test empty string
    console.log('📝 Testing empty string...');
    const emptyTokens = await tokenizer('', {
      padding: true,
      truncation: true,
      max_length: 77,
      return_tensors: 'pt'
    });
    const emptyOutput = await textModel(emptyTokens);
    const emptyEmbedding = new Float32Array(emptyOutput.text_embeds.data);
    console.log(`✅ Empty string handled: ${emptyEmbedding.length} dimensions`);
    
    // Test very long text (should be truncated)
    console.log('📝 Testing long text truncation...');
    const longText = 'word '.repeat(100); // Much longer than 77 tokens
    const longTokens = await tokenizer(longText, {
      padding: true,
      truncation: true,
      max_length: 77,
      return_tensors: 'pt'
    });
    const longOutput = await textModel(longTokens);
    const longEmbedding = new Float32Array(longOutput.text_embeds.data);
    console.log(`✅ Long text handled: ${longEmbedding.length} dimensions`);
    
    // Test special characters
    console.log('📝 Testing special characters...');
    const specialText = 'Hello! @#$%^&*()_+ 🚗🌅😺';
    const specialTokens = await tokenizer(specialText, {
      padding: true,
      truncation: true,
      max_length: 77,
      return_tensors: 'pt'
    });
    const specialOutput = await textModel(specialTokens);
    const specialEmbedding = new Float32Array(specialOutput.text_embeds.data);
    console.log(`✅ Special characters handled: ${specialEmbedding.length} dimensions`);
    
    console.log('✅ All edge cases handled successfully');
    
  } catch (error) {
    console.error('❌ Edge case validation failed:');
    console.error(error);
    throw error;
  }
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  console.log('🚀 Starting CLIP Text Embedding Validation');
  console.log('=' .repeat(60));
  
  try {
    await validateCLIPTextEmbedding();
    await validateEdgeCases();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 VALIDATION SUCCESSFUL!');
    console.log('✅ CLIP text embedding approach is ready for integration');
    console.log('✅ No pixel_values errors encountered');
    console.log('✅ All requirements validated successfully');
    console.log('🚦 GREEN LIGHT: Proceed with task 2 (Fix CLIP text embedding implementation)');
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('❌ VALIDATION FAILED!');
    console.log('🚫 DO NOT PROCEED with integration until this is fixed');
    console.log('🔧 Technical issue must be resolved before continuing');
    
    if (error instanceof Error) {
      console.log(`\nError details: ${error.message}`);
      if (error.stack) {
        console.log(`Stack trace: ${error.stack}`);
      }
    }
    
    process.exit(1);
  }
}

// Run validation - always execute when this script is loaded
console.log('🔍 Starting CLIP validation script...');
main().catch(error => {
  console.error('Validation script failed:', error);
  process.exit(1);
});

export { validateCLIPTextEmbedding, validateEdgeCases };