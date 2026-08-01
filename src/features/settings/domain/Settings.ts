import { createWorkflowId, type WorkflowId } from '@/features/workflow';

export type Theme = 'system' | 'light' | 'dark';
export type ReducedMotion = 'system' | 'reduce' | 'no-preference';

export type Settings = Readonly<{
  theme: Theme;
  reducedMotion: ReducedMotion;
  lastSelectedWorkflowId?: WorkflowId;
}>;

export class SettingsValidationError extends Error {
  public constructor() {
    super('Settings are invalid.');
    this.name = 'SettingsValidationError';
  }
}

export const defaultSettings: Settings = Object.freeze({
  theme: 'system',
  reducedMotion: 'system',
});

export function createSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new SettingsValidationError();
  }
  const input = value as Readonly<Record<string, unknown>>;
  const keys = Object.keys(input);
  if (
    keys.some(
      (key) =>
        key !== 'theme' &&
        key !== 'reducedMotion' &&
        key !== 'lastSelectedWorkflowId',
    )
  ) {
    throw new SettingsValidationError();
  }
  const theme = input['theme'];
  const reducedMotion = input['reducedMotion'];
  if (theme !== 'system' && theme !== 'light' && theme !== 'dark') {
    throw new SettingsValidationError();
  }
  if (
    reducedMotion !== 'system' &&
    reducedMotion !== 'reduce' &&
    reducedMotion !== 'no-preference'
  ) {
    throw new SettingsValidationError();
  }
  const workflowIdValue = input['lastSelectedWorkflowId'];
  if (workflowIdValue !== undefined && typeof workflowIdValue !== 'string') {
    throw new SettingsValidationError();
  }
  try {
    const lastSelectedWorkflowId =
      workflowIdValue === undefined
        ? undefined
        : createWorkflowId(workflowIdValue);
    return Object.freeze({
      theme,
      reducedMotion,
      ...(lastSelectedWorkflowId === undefined
        ? {}
        : { lastSelectedWorkflowId }),
    });
  } catch {
    throw new SettingsValidationError();
  }
}
