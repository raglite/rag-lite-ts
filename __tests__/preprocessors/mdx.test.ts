import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { MdxPreprocessor } from '../../src/../src/preprocessors/mdx.js';

describe('MdxPreprocessor', () => {
  const preprocessor = new MdxPreprocessor();

  describe('appliesTo', () => {
    test('should apply to MDX content type', () => {
      assert.equal(preprocessor.appliesTo('mdx'), true);
      assert.equal(preprocessor.appliesTo('markdown'), false);
      assert.equal(preprocessor.appliesTo('python'), false);
      assert.equal(preprocessor.appliesTo('javascript'), false);
      assert.equal(preprocessor.appliesTo('typescript'), false);
    });
  });

  describe('process', () => {
    test('should return content unchanged if no JSX detected', () => {
      const content = '# Regular Markdown\n\nThis is just plain markdown content.';
      const result = preprocessor.process(content, { mode: 'strip' });
      assert.equal(result, content);
    });

    test('should strip JSX imports in strip mode', () => {
      const content = `import React from 'react';
import { Component } from './component';
# Title
Regular text`;

      const result = preprocessor.process(content, { mode: 'strip' });
      
      // Should remove imports but keep markdown
      assert.ok(!result.includes('import'));
      assert.ok(result.includes('# Title'));
      assert.ok(result.includes('Regular text'));
    });

    test('should strip JSX exports in strip mode', () => {
      const content = `# Title
export default MyComponent;
export const metadata = { title: 'Test' };
export default function Layout() {
  return <div>content</div>
}
Regular text`;

      const result = preprocessor.process(content, { mode: 'strip' });
      
      // Should remove all export statements
      assert.ok(!result.includes('export'));
      assert.ok(result.includes('# Title'));
      assert.ok(result.includes('Regular text'));
    });

    test('should strip JSX components in strip mode', () => {
      const content = `# Title
<Component prop="value" />
<AnotherComponent>
  <NestedComponent />
</AnotherComponent>
Regular text`;

      const result = preprocessor.process(content, { mode: 'strip' });
      
      // Should remove all components
      assert.ok(!result.includes('<Component'));
      assert.ok(!result.includes('<AnotherComponent'));
      assert.ok(!result.includes('<NestedComponent'));
      assert.ok(result.includes('# Title'));
      assert.ok(result.includes('Regular text'));
    });

    test('should handle nested JSX components in strip mode', () => {
      const content = `# Title
<OuterComponent>
  <InnerComponent>
    <DeepComponent />
  </InnerComponent>
</OuterComponent>
Regular text`;

      const result = preprocessor.process(content, { mode: 'strip' });
      
      // Should remove all nested components
      assert.ok(!result.includes('<OuterComponent'));
      assert.ok(!result.includes('<InnerComponent'));
      assert.ok(!result.includes('<DeepComponent'));
      assert.ok(result.includes('# Title'));
      assert.ok(result.includes('Regular text'));
    });

    test('should replace JSX with placeholders in placeholder mode', () => {
      const content = `import React from 'react';
# Title
<Component prop="value" />
export default MyComponent;
Regular text`;

      const result = preprocessor.process(content, { mode: 'placeholder' });
      
      // Should replace with placeholders
      assert.ok(result.includes('[import removed]'));
      assert.ok(result.includes('[export removed]'));
      assert.ok(result.includes('[component removed]'));
      assert.ok(result.includes('# Title'));
      assert.ok(result.includes('Regular text'));
    });

    test('should keep JSX content unchanged in keep mode', () => {
      const content = `import React from 'react';
# Title
<Component prop="value" />
Regular text`;

      const result = preprocessor.process(content, { mode: 'keep' });
      assert.equal(result, content);
    });

    test('should handle unknown mode by defaulting to placeholder', () => {
      const content = `<Component />`;
      const result = preprocessor.process(content, { mode: 'unknown' as any });
      assert.ok(result.includes('[component removed]'));
    });

    test('should clean up excessive whitespace', () => {
      const content = `import React from 'react';


<Component />



Regular text`;

      const result = preprocessor.process(content, { mode: 'strip' });
      
      // Should not have more than double newlines
      assert.ok(!result.includes('\n\n\n'));
      assert.ok(result.includes('Regular text'));
    });

    test('should handle complex MDX with multiple export types', () => {
      const content = `import React from 'react';
import { Component } from './component';

export const metadata = {
  title: 'Test Page',
  description: 'A test page'
};

# Main Title

<Component prop="value">
  Content inside component
</Component>

Regular markdown content.

export default function Layout({ children }) {
  return <div className="layout">{children}</div>
}`;

      const stripResult = preprocessor.process(content, { mode: 'strip' });
      
      // Should remove all JSX but keep markdown
      assert.ok(!stripResult.includes('import'));
      assert.ok(!stripResult.includes('export'));
      assert.ok(!stripResult.includes('<Component'));
      assert.ok(!stripResult.includes('function Layout'));
      assert.ok(stripResult.includes('# Main Title'));
      assert.ok(stripResult.includes('Regular markdown content.'));

      const placeholderResult = preprocessor.process(content, { mode: 'placeholder' });
      
      // Should replace with placeholders
      assert.ok(placeholderResult.includes('[import removed]'));
      assert.ok(placeholderResult.includes('[export removed]'));
      assert.ok(placeholderResult.includes('[component removed]'));
      assert.ok(placeholderResult.includes('# Main Title'));
      assert.ok(placeholderResult.includes('Regular markdown content.'));
    });

    test('should never return empty content after processing', () => {
      const jsxOnlyContent = `import React from 'react';
<Component />
export default MyComponent;`;

      const stripResult = preprocessor.process(jsxOnlyContent, { mode: 'strip' });
      const placeholderResult = preprocessor.process(jsxOnlyContent, { mode: 'placeholder' });
      
      // Should never return empty content
      assert.ok(stripResult.trim().length > 0);
      assert.ok(placeholderResult.trim().length > 0);
      assert.ok(placeholderResult.includes('[import removed]'));
      assert.ok(placeholderResult.includes('[component removed]'));
      assert.ok(placeholderResult.includes('[export removed]'));
    });
  });
});
