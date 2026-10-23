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
  navigation(orientation: WorkflowStudioNavigationOrientation): ReactNode;
  children: ReactNode;
}>;

export function WorkflowStudioShell({
  topBar,
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
      <header className="workflow-studio-shell__top-bar">{topBar}</header>
      <div className="workflow-studio-shell__body">
        <div className="workflow-studio-shell__sidebar">
          <nav
            aria-label="Studio sections"
            className="workflow-studio-shell__navigation"
          >
            {navigation(orientation)}
          </nav>
        </div>
        <main className="workflow-studio-shell__content workflow-studio">
          {children}
        </main>
      </div>
    </div>
  );
}
