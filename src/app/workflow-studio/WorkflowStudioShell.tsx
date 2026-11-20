import { useEffect, useState, type ReactNode } from 'react';

export type WorkflowStudioNavigationOrientation = 'vertical' | 'horizontal';

const narrowStudioQuery = '(max-width: 52rem)';

function isNarrowStudio(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia(narrowStudioQuery).matches
  );
}

export type WorkflowStudioShellProps = Readonly<{
  topBar: ReactNode;
  railContext: ReactNode;
  workflowCount: number;
  assetCount: number;
  navigation(
    orientation: WorkflowStudioNavigationOrientation,
    counts: Readonly<{ workflowCount: number; assetCount: number }>,
  ): ReactNode;
  children: ReactNode;
}>;

export function WorkflowStudioShell({
  topBar,
  railContext,
  workflowCount,
  assetCount,
  navigation,
  children,
}: WorkflowStudioShellProps) {
  const [narrow, setNarrow] = useState(isNarrowStudio);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(narrowStudioQuery);
    const update = () => {
      setNarrow(media.matches);
    };
    media.addEventListener('change', update);
    update();
    return () => {
      media.removeEventListener('change', update);
    };
  }, []);

  const orientation: WorkflowStudioNavigationOrientation = narrow
    ? 'horizontal'
    : 'vertical';

  return (
    <div className="workflow-studio-shell">
      <aside
        className="workflow-studio-shell__sidebar"
        aria-label="Workflow Studio navigation"
      >
        <div className="workflow-studio-shell__brand">
          <img
            className="brand-logo"
            src="/brand/locusora-mark.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="workflow-studio-shell__brand-name">Locusora</span>
        </div>
        {railContext}
        <p className="workflow-studio-shell__workspace-label">WORKSPACE</p>
        <nav
          aria-label="Studio sections"
          className="workflow-studio-shell__navigation"
        >
          {navigation(orientation, {
            workflowCount,
            assetCount,
          })}
        </nav>
      </aside>
      <div className="workflow-studio-shell__workspace">
        <header className="workflow-studio-shell__top-bar">{topBar}</header>
        <main className="workflow-studio-shell__content workflow-studio">
          {children}
        </main>
      </div>
    </div>
  );
}
