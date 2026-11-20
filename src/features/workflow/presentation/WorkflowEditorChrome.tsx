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
  statusTarget: HTMLElement | null;
  modeTarget: HTMLElement | null;
  setTarget(target: HTMLElement | null): void;
  setStatusTarget(target: HTMLElement | null): void;
  setModeTarget(target: HTMLElement | null): void;
}>;

const WorkflowEditorChromeContext =
  createContext<WorkflowEditorChromeContextValue | null>(null);

export function WorkflowEditorChromeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  const [modeTarget, setModeTarget] = useState<HTMLElement | null>(null);
  const value = useMemo(
    () => ({
      target,
      statusTarget,
      modeTarget,
      setTarget,
      setStatusTarget,
      setModeTarget,
    }),
    [modeTarget, statusTarget, target],
  );

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

export function WorkflowEditorChromeStatusTarget() {
  const context = useContext(WorkflowEditorChromeContext);
  const setStatusTarget = context?.setStatusTarget;
  const targetRef = useCallback(
    (target: HTMLDivElement | null) => {
      setStatusTarget?.(target);
    },
    [setStatusTarget],
  );

  return <div className="workflow-editor-chrome__status" ref={targetRef} />;
}

export function WorkflowEditorChromeModeTarget() {
  const context = useContext(WorkflowEditorChromeContext);
  const setModeTarget = context?.setModeTarget;
  const modeTargetRef = useCallback(
    (target: HTMLDivElement | null) => {
      setModeTarget?.(target);
    },
    [setModeTarget],
  );

  return <div className="workflow-editor-chrome__mode" ref={modeTargetRef} />;
}

export function WorkflowEditorChromeActions({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = useContext(WorkflowEditorChromeContext);
  return context?.target === null || context === null
    ? children
    : createPortal(children, context.target);
}

export function WorkflowEditorChromeStatus({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = useContext(WorkflowEditorChromeContext);
  return context?.statusTarget === null || context === null
    ? children
    : createPortal(children, context.statusTarget);
}

export function WorkflowEditorChromeModeAction({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = useContext(WorkflowEditorChromeContext);
  return context?.modeTarget === null || context === null
    ? children
    : createPortal(children, context.modeTarget);
}
