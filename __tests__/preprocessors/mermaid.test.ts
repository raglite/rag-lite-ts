import { test, describe } from 'node:test';
import { strict as assert } from 'node:assert';
import { MermaidPreprocessor } from '../../src/../src/preprocessors/mermaid.js';
import { PreprocessorOptions } from '../../src/types.js';

describe('MermaidPreprocessor', () => {
  const preprocessor = new MermaidPreprocessor();

  describe('appliesTo', () => {
    test('should apply to mermaid language', () => {
      assert.equal(preprocessor.appliesTo('mermaid'), true);
    });

    test('should not apply to other languages', () => {
      assert.equal(preprocessor.appliesTo('javascript'), false);
      assert.equal(preprocessor.appliesTo('markdown'), false);
      assert.equal(preprocessor.appliesTo('mdx'), false);
      assert.equal(preprocessor.appliesTo(''), false);
    });
  });

  describe('process - strip mode', () => {
    const options: PreprocessorOptions = { mode: 'strip' };

    test('should remove mermaid code blocks entirely', () => {
      const content = `# Title

Some text before.

\`\`\`mermaid
graph TD
    A --> B
    B --> C
\`\`\`

Some text after.`;

      const result = preprocessor.process(content, options);
      assert.equal(result, `# Title

Some text before.

Some text after.`);
    });

    test('should handle multiple mermaid blocks', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Text between.

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.equal(result, 'Text between.');
    });

    test('should handle case-insensitive mermaid blocks', () => {
      const content = `\`\`\`MERMAID
graph TD
    A --> B
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.equal(result, '[content removed]');
    });

    test('should return fallback when all content is removed', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.equal(result, '[content removed]');
    });

    test('should clean up excessive newlines', () => {
      const content = `Text before.


\`\`\`mermaid
graph TD
    A --> B
\`\`\`



Text after.`;

      const result = preprocessor.process(content, options);
      assert.equal(result, `Text before.

Text after.`);
    });
  });

  describe('process - placeholder mode', () => {
    const options: PreprocessorOptions = { mode: 'placeholder' };

    test('should replace mermaid blocks with placeholder', () => {
      const content = `# Title

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

More content.`;

      const result = preprocessor.process(content, options);
      assert.equal(result, `# Title

[diagram removed]

More content.`);
    });

    test('should handle multiple mermaid blocks', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Text between.

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.equal(result, `[diagram removed]

Text between.

[diagram removed]`);
    });
  });

  describe('process - extract mode', () => {
    const options: PreprocessorOptions = { mode: 'extract' };

    test('should extract flowchart edges', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B
    B --> C
    C -.-> D
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.ok(result.includes('A leads to B'));
      assert.ok(result.includes('B leads to C'));
      assert.ok(result.includes('C optionally leads to D'));
    });

    test('should extract edges with labels', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B | Label text |
    B --- C | Another label |
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.ok(result.includes('A leads to B (Label text)'));
      assert.ok(result.includes('B connects to C (Another label)'));
    });

    test('should extract sequence diagram messages', () => {
      const content = `\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello Bob
    Bob-->>Alice: Hello Alice
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.ok(result.includes('Alice sends to Bob: Hello Bob'));
      assert.ok(result.includes('Bob sends to Alice: Hello Alice'));
    });

    test('should extract class diagram relationships', () => {
      const content = `\`\`\`mermaid
classDiagram
    Animal --|> Dog
    Dog *-- Tail
    Car o-- Engine
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.ok(result.includes('Animal inherits from Dog'));
      assert.ok(result.includes('Dog composes Tail'));
      assert.ok(result.includes('Car aggregates Engine'));
    });

    test('should extract state transitions', () => {
      const content = `\`\`\`mermaid
stateDiagram
    [*] --> Still
    Still --> Moving
    Moving --> Still
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.ok(result.includes('Still transitions to Moving'));
      assert.ok(result.includes('Moving transitions to Still'));
    });

    test('should extract ER diagram relationships', () => {
      const content = `\`\`\`mermaid
erDiagram
    CUSTOMER ||--o{ ORDER
    ORDER }o--|| PRODUCT
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.ok(result.includes('CUSTOMER has one-to-many relationship with ORDER'));
      assert.ok(result.includes('ORDER has many-to-one relationship with PRODUCT'));
    });

    test('should ignore layout and styling instructions', () => {
      const content = `\`\`\`mermaid
graph TD
    %% This is a comment
    classDef default fill:#f9f9f9
    A --> B
    style A fill:#ff0000
    class B highlight
    A:::someClass
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.equal(result, 'A leads to B');
      assert.ok(!result.includes('classDef'));
      assert.ok(!result.includes('style'));
      assert.ok(!result.includes('class B'));
      assert.ok(!result.includes(':::'));
    });

    test('should ignore subgraph declarations', () => {
      const content = `\`\`\`mermaid
graph TD
    subgraph "Group 1"
        A --> B
    end
    subgraph "Group 2"
        C --> D
    end
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.ok(result.includes('A leads to B'));
      assert.ok(result.includes('C leads to D'));
      assert.ok(!result.includes('subgraph'));
      assert.ok(!result.includes('Group 1'));
      assert.ok(!result.includes('end'));
    });

    test('should return fallback when no edges found', () => {
      const content = `\`\`\`mermaid
graph TD
    %% Only comments and styling
    classDef default fill:#f9f9f9
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.equal(result, '[diagram content extracted]');
    });
  });

  describe('process - unknown mode', () => {
    test('should fallback to placeholder mode for unknown modes', () => {
      const options: PreprocessorOptions = { mode: 'unknown' as any };
      const content = `\`\`\`mermaid
graph TD
    A --> B
\`\`\``;

      const result = preprocessor.process(content, options);
      assert.equal(result, '[diagram removed]');
    });
  });

  describe('process - no mermaid content', () => {
    test('should return content unchanged when no mermaid diagrams present', () => {
      const content = `# Title

This is regular markdown content.

\`\`\`javascript
console.log('hello');
\`\`\`

More text.`;

      const options: PreprocessorOptions = { mode: 'strip' };
      const result = preprocessor.process(content, options);
      assert.equal(result, content);
    });
  });

  describe('edge extraction edge cases', () => {
    test('should handle complex flowchart syntax', () => {
      const content = `\`\`\`mermaid
flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E((End))
    D --> E
\`\`\``;

      const options: PreprocessorOptions = { mode: 'extract' };
      const result = preprocessor.process(content, options);
      assert.ok(result.includes('Start leads to Decision'));
      assert.ok(result.includes('Decision leads to Action 1 (Yes)'));
      assert.ok(result.includes('Decision leads to Action 2 (No)'));
      assert.ok(result.includes('Action 1 leads to End'));
      assert.ok(result.includes('Action 2 leads to End'));
    });

    test('should handle different arrow types', () => {
      const content = `\`\`\`mermaid
graph TD
    A --> B
    C -.-> D
    E --- F
    G -.- H
\`\`\``;

      const options: PreprocessorOptions = { mode: 'extract' };
      const result = preprocessor.process(content, options);
      assert.ok(result.includes('A leads to B'));
      assert.ok(result.includes('C optionally leads to D'));
      assert.ok(result.includes('E connects to F'));
      assert.ok(result.includes('G optionally connects to H'));
    });
  });
});
