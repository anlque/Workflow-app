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
    action: {
      default_title: 'Open Locusora focus view',
    },
  },
});
