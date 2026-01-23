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
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'README',
        'cli-reference',
        'ui-guide',
        'api-reference',
        'preprocessing',
        'configuration',
      ],
    },
    {
      type: 'category',
      label: 'Multimodal Capabilities',
      collapsed: false,
      items: [
        'multimodal-tutorial',
        'multimodal-configuration',
        'model-guide',
        'multimodal-troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Integration & Examples',
      collapsed: false,
      items: [
        'mcp-server-multimodal-guide',
        'dynamic-tool-descriptions',
        'examples-gallery',
        'integration-patterns',
      ],
    },
    {
      type: 'category',
      label: 'Advanced Topics',
      items: [
        'path-strategies',
        'EMBEDDING_MODELS_COMPARISON',
      ],
    },
    'troubleshooting',
  ],
};

export default sidebars;
