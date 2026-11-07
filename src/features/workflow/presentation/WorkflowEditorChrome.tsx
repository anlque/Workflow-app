import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

type WorkflowEditorChromeContextValue = Readonly<{
  target: HTMLElement | null;
  setTarget(target: HTMLElement | null): void;
}>;

const WorkflowEditorChromeContext =
  createContext<WorkflowEditorChromeContextValue | null>(null);

export function WorkflowEditorChromeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const value = useMemo(() => ({ target, setTarget }), [target]);

  return (
    <WorkflowEditorChromeContext.Provider value={value}>
      {children}
    </WorkflowEditorChromeContext.Provider>
  );
}

export function WorkflowEditorChromeTarget() {
  const context = useContext(WorkflowEditorChromeContext);
  const setTarget = context?.setTarget;
  const targetRef = useCallback(
    (target: HTMLDivElement | null) => {
      setTarget?.(target);
    },
    [setTarget],
  );

  return <div className="workflow-editor-chrome__actions" ref={targetRef} />;
}

export function WorkflowEditorChromeActions({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = useContext(WorkflowEditorChromeContext);
  return context?.target === null || context === null
    ? children
    : createPortal(children, context.target);
}
