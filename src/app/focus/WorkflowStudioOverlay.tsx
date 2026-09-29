import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react';

import { CompactSessionSummary, type Session } from '@/features/session';
import { Button } from '@/shared';

type ContentBoundaryProps = Readonly<{ children: ReactNode }>;
type ContentBoundaryState = Readonly<{ error: string | null }>;

class StudioContentBoundary extends Component<
  ContentBoundaryProps,
  ContentBoundaryState
> {
  public override state: ContentBoundaryState = { error: null };

  public static getDerivedStateFromError(cause: unknown): ContentBoundaryState {
    return {
      error: cause instanceof Error ? cause.message : 'Workflow Studio failed.',
    };
  }

  public override componentDidCatch(): void {
    // The visible alert is the recoverable document-local boundary.
  }

  public override render(): ReactNode {
    return this.state.error === null ? (
      this.props.children
    ) : (
      <p className="feedback feedback--error" role="alert">
        {this.state.error}
      </p>
    );
  }
}

export type WorkflowStudioOverlayProps = Readonly<{
  open: boolean;
  reducedMotion: boolean;
  session: Session | null;
  onClose(): void;
  children: ReactNode;
}>;

export function WorkflowStudioOverlay({
  open,
  reducedMotion,
  session,
  onClose,
  children,
}: WorkflowStudioOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  return (
    <section
      className="workflow-studio-overlay"
      role="region"
      aria-label="Workflow Studio"
      aria-hidden={open ? undefined : true}
      inert={open ? undefined : true}
      data-open={open ? 'true' : 'false'}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          if (
            event.target instanceof Element &&
            event.target.closest('dialog[open]') !== null
          ) {
            return;
          }
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="workflow-studio-overlay__header">
        {session === null ? null : (
          <section aria-label="Active session summary">
            <CompactSessionSummary session={session} />
          </section>
        )}
        <Button buttonRef={closeRef} variant="secondary" onClick={onClose}>
          Close Workflow Studio
        </Button>
      </header>
      <div className="workflow-studio-overlay__content">
        <StudioContentBoundary>
          <Suspense fallback={<p role="status">Loading Workflow Studio…</p>}>
            {children}
          </Suspense>
        </StudioContentBoundary>
      </div>
    </section>
  );
}
