import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // Manual sidebar configuration for custom ordering
  docsSidebar: [
    'README',
    'cli-reference',
    'api-reference',
    'configuration',
    {
      type: 'category',
      label: 'Multimodal Capabilities',
      items: [
        'multimodal-tutorial',
        'multimodal-configuration',
        'model-guide',
        'preprocessing',
        'multimodal-troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Integration & Examples',
      items: [
        'mcp-server-multimodal-guide',
        'examples-gallery',
        'integration-patterns',
      ],
    },
    'path-strategies',
    'troubleshooting',
    'EMBEDDING_MODELS_COMPARISON',
  ],
};

export default sidebars;
