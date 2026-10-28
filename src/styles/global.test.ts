import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

const stylesheet = readFileSync(
  new URL('./global.css', import.meta.url),
  'utf8',
);

function declarationsFor(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const body = new RegExp(
    `${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\n\\}`,
    'u',
  ).exec(stylesheet)?.groups?.['body'];

  expect(body, `missing CSS block for ${selector}`).toBeDefined();
  return body ?? '';
}

function variablesFor(selector: string) {
  return Object.fromEntries(
    [...declarationsFor(selector).matchAll(/(--[\w-]+):\s*([^;]+);/gu)].map(
      (match) => {
        const name = match[1];
        const value = match[2];
        if (name === undefined || value === undefined) {
          throw new Error(`Invalid declaration in ${selector}`);
        }
        const normalized = value.trim();
        return [
          name,
          normalized.startsWith('#') ? normalized.toUpperCase() : normalized,
        ];
      },
    ),
  );
}

function hexLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/gu)
    ?.map((value) => Number.parseInt(value, 16) / 255);
  if (channels === undefined) throw new Error(`Invalid hex color: ${hex}`);
  const converted = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const red = converted[0];
  const green = converted[1];
  const blue = converted[2];
  if (red === undefined || green === undefined || blue === undefined) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const values = [hexLuminance(first), hexLuminance(second)].sort(
    (left, right) => right - left,
  );
  const lighter = values[0];
  const darker = values[1];
  if (lighter === undefined || darker === undefined) {
    throw new Error('Contrast requires two colors');
  }
  return (lighter + 0.05) / (darker + 0.05);
}

const lightPalette = {
  '--color-canvas': '#F6FAF7',
  '--color-chrome': '#E4F2EA',
  '--color-surface': '#FFFFFF',
  '--color-surface-muted': '#EDF7F1',
  '--color-text': '#1B2823',
  '--color-text-muted': '#66766E',
  '--color-border': '#D5E2DA',
  '--color-primary': '#2F7B5C',
  '--color-primary-foreground': '#EDF7F1',
  '--color-primary-soft': '#C2E9D3',
  '--color-growth': '#78C29B',
  '--color-reward': '#D88A2C',
  '--color-danger': '#B85C4B',
  '--color-danger-foreground': '#843C30',
  '--color-dark': '#29483A',
  '--color-light-text': '#EDF7F1',
  '--color-reward-surface': '#FFF0DC',
  '--color-reward-soft': '#FFD296',
  '--color-reward-border': '#E2DCD5',
  '--color-reward-muted': '#767066',
  '--color-reward-foreground': '#814D0F',
  '--color-primary-mint': '#E4F2EA',
  '--color-focus-ring': '#4A7AFF',
  '--color-focus-subtle': '#C7D5FA',
  '--color-reward-subtle': '#FFF7EE',
};

const darkPalette = {
  '--color-canvas': '#142019',
  '--color-chrome': '#1B2B22',
  '--color-surface': '#21332A',
  '--color-surface-muted': '#294037',
  '--color-text': '#F0F7F3',
  '--color-text-muted': '#A9B9B0',
  '--color-border': '#3B5246',
  '--color-primary': '#78C29B',
  '--color-primary-foreground': '#102219',
  '--color-primary-soft': '#315844',
  '--color-growth': '#9BDAB7',
  '--color-reward': '#F2B86B',
  '--color-danger': '#EA8A78',
  '--color-danger-foreground': '#FFC2B6',
  '--color-dark': '#102219',
  '--color-light-text': '#F5FBF7',
  '--color-reward-surface': '#332619',
  '--color-reward-soft': '#5A3B18',
  '--color-reward-border': '#70502A',
  '--color-reward-muted': '#D5B894',
  '--color-reward-foreground': '#FFD5A0',
  '--color-primary-mint': '#1B2B22',
  '--color-focus-ring': '#8FAAFF',
  '--color-focus-subtle': '#29355A',
  '--color-reward-subtle': '#2D2013',
};

describe('visual foundation', () => {
  test('maps the approved light and dark Figma variables exactly', () => {
    expect(variablesFor(':root')).toMatchObject(lightPalette);
    expect(variablesFor(":root[data-theme='dark']")).toMatchObject(darkPalette);
  });

  test('keeps semantic text and indicators above required contrast', () => {
    const light = variablesFor(':root');
    const dark = variablesFor(":root[data-theme='dark']");

    for (const palette of [light, dark]) {
      expect(
        contrast(
          palette['--color-primary'] ?? '',
          palette['--color-primary-foreground'] ?? '',
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          palette['--color-danger-surface'] ?? '',
          palette['--color-danger-foreground'] ?? '',
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrast(
          palette['--color-surface'] ?? '',
          palette['--color-control-border'] ?? '',
        ),
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrast(
          palette['--color-surface'] ?? '',
          palette['--color-selected-indicator'] ?? '',
        ),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  test('defines the approved typography and geometry scales', () => {
    const root = variablesFor(':root');
    expect(root).toMatchObject({
      '--font-size-caption': '0.75rem',
      '--font-size-body': '0.875rem',
      '--space-1': '0.25rem',
      '--space-2': '0.5rem',
      '--space-3': '0.75rem',
      '--space-4': '1rem',
      '--space-5': '1.5rem',
      '--space-6': '2rem',
      '--radius-small': '0.5rem',
      '--radius-control': '0.75rem',
      '--radius-surface': '1rem',
    });
  });

  test('preserves button variants during pending and distinguishes disabled', () => {
    const pending = declarationsFor(".button[aria-busy='true']");
    const disabled = declarationsFor(
      ".button:disabled:not([aria-busy='true'])",
    );

    expect(pending).not.toMatch(/background(?:-color)?:/u);
    expect(pending).toContain('cursor: progress;');
    expect(pending).toContain('opacity: 1;');
    expect(disabled).toContain('opacity: 0.52;');
    expect(declarationsFor('.button--primary')).toContain(
      'background: var(--color-primary);',
    );
    expect(declarationsFor('.button--secondary')).toContain(
      'background: var(--color-chrome);',
    );
    expect(declarationsFor('.button--quiet')).toContain(
      'background: transparent;',
    );
    expect(declarationsFor('.button--danger')).toContain(
      'background: var(--color-danger-surface);',
    );
    expect(declarationsFor('.button--danger')).toContain(
      'border: 1px solid var(--color-danger);',
    );
    expect(stylesheet).not.toMatch(/\.button:hover:not\(:disabled\)/u);
  });

  test('applies accessible semantic tokens to errors, controls and selection', () => {
    expect(stylesheet).toMatch(
      /\.field__error\s*\{\s*color: var\(--color-danger-foreground\);/u,
    );
    expect(stylesheet).toMatch(
      /\.field input,[\s\S]*?border: 1px solid var\(--color-control-border\);/u,
    );
    expect(declarationsFor(".tab[aria-selected='true']")).toContain(
      'border-color: var(--color-selected-indicator);',
    );
  });

  test('provides responsive Workflow Studio shell contracts without page overflow', () => {
    expect(declarationsFor('.workflow-studio-shell')).toContain(
      'min-width: 0;',
    );
    expect(declarationsFor('.workflow-studio-shell__body')).toContain(
      'grid-template-columns: minmax(13rem, 17rem) minmax(0, 1fr);',
    );
    expect(declarationsFor('.workflow-studio-shell__content')).toContain(
      'min-width: 0;',
    );
    expect(declarationsFor('.workflow-studio-shell__sidebar')).toContain(
      'overflow-x: hidden;',
    );
    expect(declarationsFor('.workflow-studio-shell__tabs')).toContain(
      'flex-direction: column;',
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 52rem\)[\s\S]*?\.workflow-studio-shell__body\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/u,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 52rem\)[\s\S]*?\.workflow-studio-shell__tabs\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/u,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 34rem\)[\s\S]*?\.workflow-studio-shell__top-bar\s*\{[^}]*align-items: stretch;[^}]*flex-direction: column;/u,
    );
    expect(stylesheet).toMatch(
      /@media \(max-width: 34rem\)[\s\S]*?\.workflow-studio-shell__top-bar > \.button\s*\{[^}]*width: 100%;/u,
    );
    expect(stylesheet).toMatch(/@media \(prefers-reduced-motion: reduce\)/u);
  });

  test('provides the approved phase sequence and atmospheric preview contracts', () => {
    const sequence = declarationsFor('.phase-sequence');
    const entry = declarationsFor('.phase-sequence__entry');
    const indicator = declarationsFor('.phase-drop-indicator');
    const dragging = declarationsFor(
      ".phase-sequence__entry[data-dragging='true']",
    );
    const preview = declarationsFor('.phase-environment-preview');
    const image = declarationsFor('.phase-environment-preview__image');

    expect(sequence).toContain('display: flex;');
    expect(sequence).toContain('overflow-x: auto;');
    expect(sequence).toContain('scroll-snap-type: inline proximity;');
    expect(entry).toContain('flex: 1 0 10rem;');
    expect(indicator).toContain('flex: 0 0 0.25rem;');
    expect(indicator).toContain('width: 0.25rem;');
    expect(indicator).toContain('align-self: stretch;');
    expect(dragging).toContain('background: var(--color-accent-soft);');
    expect(dragging).toContain('border-color: var(--color-accent);');
    expect(preview).toContain('overflow: hidden;');
    expect(preview).toContain('min-height: clamp(16rem, 38vw, 28rem);');
    expect(image).toContain('object-fit: cover;');
    expect(stylesheet).toMatch(
      /\.phase-sequence__item\[aria-pressed='true'\][\s\S]*?border: 2px solid var\(--color-selected-indicator\);/u,
    );
  });
});
