import type { Session } from '@/features/session';

export type FocusSpaceShortcutAction = 'pause' | 'resume';

export type FocusSpaceShortcutContext = Readonly<{
  enabled: boolean;
  studioOpen: boolean;
  dialogOpen: boolean;
  pending: boolean;
  session: Session | null;
}>;

const interactiveSelector =
  'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"])';

export function getFocusSpaceShortcutAction(
  event: KeyboardEvent,
  context: FocusSpaceShortcutContext,
): FocusSpaceShortcutAction | null {
  if (
    event.code !== 'Space' ||
    event.repeat ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey ||
    event.shiftKey ||
    !context.enabled ||
    context.studioOpen ||
    context.dialogOpen ||
    context.pending ||
    (event.target instanceof Element &&
      event.target.closest(interactiveSelector) !== null)
  ) {
    return null;
  }
  if (context.session?.status === 'running') return 'pause';
  if (
    context.session?.status === 'paused' &&
    context.session.pauseReason === 'user'
  )
    return 'resume';
  return null;
}
