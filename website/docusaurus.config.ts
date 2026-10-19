import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const repoUrl = 'https://github.com/benahm/sf-tdc';

const config: Config = {
  title: 'Technical Debt Collector',
  tagline: 'Price the technical debt of a Salesforce project, track in git who pays it back, and make a game of it.',
  favicon: 'img/logo.svg',

  future: {
    v4: true,
  },

  url: 'https://benahm.github.io',
  baseUrl: '/sf-tdc/',
  organizationName: 'benahm',
  projectName: 'sf-tdc',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  // .md files are plain CommonMark (the command pages are generated from --help), .mdx files are MDX.
  markdown: {
    format: 'detect',
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

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
          editUrl: `${repoUrl}/tree/main/website/`,
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
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'beta',
      content: `The Technical Debt Collector is in beta: <a href="${repoUrl}/issues">report issues</a>, and false positives first.`,
      isCloseable: true,
    },
    navbar: {
      title: 'Technical Debt Collector',
      logo: {
        alt: 'Technical Debt Collector',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {type: 'docSidebar', sidebarId: 'docs', position: 'left', label: 'Docs'},
        {to: '/docs/rules', label: 'Rules', position: 'left'},
        {to: '/docs/category/commands', label: 'Commands', position: 'left'},
        {href: 'https://www.npmjs.com/package/sf-tdc', label: 'npm', position: 'right'},
        {href: repoUrl, label: 'GitHub', position: 'right'},
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting started', to: '/docs/getting-started'},
            {label: 'The game', to: '/docs/guides/game'},
            {label: 'Rules', to: '/docs/rules'},
            {label: 'Commands', to: '/docs/category/commands'},
          ],
        },
        {
          title: 'Project',
          items: [
            {label: 'GitHub', href: repoUrl},
            {label: 'Issues', href: `${repoUrl}/issues`},
            {label: 'Releases', href: `${repoUrl}/releases`},
          ],
        },
      ],
      copyright: `Technical Debt Collector (sf-tdc), BSD-3-Clause license. Not affiliated with Salesforce.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
