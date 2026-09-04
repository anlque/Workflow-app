import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const lowerLayerAppRestriction = {
  group: ['@/app', '@/app/**'],
  message: 'Only the composition root may import app modules.',
};

const featureDeepImportRestriction = {
  group: ['@/features/*/**'],
  message: 'Import another feature through its root public API.',
};

export default defineConfig(
  globalIgnores([
    '.output/**',
    '.wxt/**',
    'coverage/**',
    'eslint.config.js',
    'node_modules/**',
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: {
        chrome: 'readonly',
        console: 'readonly',
        document: 'readonly',
        indexedDB: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    files: [
      'src/features/**/*.{ts,tsx}',
      'src/platform/**/*.{ts,tsx}',
      'src/shared/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [lowerLayerAppRestriction, featureDeepImportRestriction] },
      ],
    },
  },
  {
    files: ['src/features/*/{domain,application}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            lowerLayerAppRestriction,
            featureDeepImportRestriction,
            {
              group: [
                'react',
                'react/**',
                'wxt',
                'wxt/**',
                'zustand',
                'zustand/**',
                'dexie',
                'dexie/**',
                '@/platform',
                '@/platform/**',
                '**/infrastructure/**',
                '**/presentation/**',
              ],
              message:
                'Domain and Application may depend only on stable inward modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/platform/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            lowerLayerAppRestriction,
            featureDeepImportRestriction,
            {
              group: ['@/features', '@/features/**'],
              message: 'Platform must remain business-independent.',
            },
          ],
        },
      ],
    },
  },
);
