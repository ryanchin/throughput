import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'AAVA Product Studio',
  tagline: 'AI-Accelerated Product Management Methodology',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.aava.ai',
  baseUrl: '/',

  organizationName: 'aava',
  projectName: 'docs',

  onBrokenLinks: 'throw',

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
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'AAVA Docs',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://throughput.aava.ai/certifications',
          label: 'Certifications',
          position: 'left',
        },
        {
          href: 'https://throughput.aava.ai',
          label: 'Throughput',
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
            { label: 'Getting Started', to: '/getting-started/what-is-aava' },
            { label: 'Methodology', to: '/methodology/goals-and-okrs/overview' },
            { label: 'Certifications', to: '/certifications/overview' },
          ],
        },
        {
          title: 'Platform',
          items: [
            { label: 'Training', href: 'https://throughput.aava.ai/training' },
            { label: 'Certifications', href: 'https://throughput.aava.ai/certifications' },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} AAVA Product Studio. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
