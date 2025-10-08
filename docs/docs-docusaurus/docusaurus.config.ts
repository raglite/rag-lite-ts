import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'RAG-lite TS',
  tagline: 'Local-first TypeScript retrieval engine for semantic search',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://raglite.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/rag-lite-ts/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'raglite', // Usually your GitHub org/user name.
  projectName: 'rag-lite-ts', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          path: '../docs',
          routeBasePath: 'docs',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/raglite/rag-lite-ts/tree/main/docs/',
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'RAG-lite TS',
      logo: {
        alt: 'RAG-lite TS Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://www.npmjs.com/package/rag-lite-ts',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/raglite/rag-lite-ts',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/README',
            },
            {
              label: 'CLI Reference',
              to: '/docs/cli-reference',
            },
            {
              label: 'API Reference',
              to: '/docs/api-reference',
            },
          ],
        },
        {
          title: 'Resources',
          items: [
            {
              label: 'Model Guide',
              to: '/docs/model-guide',
            },
            {
              label: 'Configuration',
              to: '/docs/configuration',
            },
            {
              label: 'Troubleshooting',
              to: '/docs/troubleshooting',
            },
          ],
        },
        {
          title: 'Links',
          items: [
            {
              label: 'npm Package',
              href: 'https://www.npmjs.com/package/rag-lite-ts',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/raglite/rag-lite-ts',
            },
            {
              label: 'Issues',
              href: 'https://github.com/raglite/rag-lite-ts/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} RAG-lite TS Contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
