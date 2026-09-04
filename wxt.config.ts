import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: '../entrypoints',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Locusora',
    short_name: 'Locusora',
    description:
      'Build personalized focus workflows, environments and reward rituals.',
    permissions: ['sidePanel', 'storage', 'alarms', 'tabs'],
    icons: {
      16: 'brand/icon-16.png',
      32: 'brand/icon-32.png',
      48: 'brand/icon-48.png',
      128: 'brand/icon-128.png',
    },
    action: {
      default_title: 'Open Locusora focus view',
      default_icon: {
        16: 'brand/icon-16.png',
        32: 'brand/icon-32.png',
        48: 'brand/icon-48.png',
      },
    },
  },
});
