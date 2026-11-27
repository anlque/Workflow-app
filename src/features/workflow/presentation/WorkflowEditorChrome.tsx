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
  identityTarget: HTMLElement | null;
  setTarget(target: HTMLElement | null): void;
  setStatusTarget(target: HTMLElement | null): void;
  setModeTarget(target: HTMLElement | null): void;
  setIdentityTarget(target: HTMLElement | null): void;
}>;

const WorkflowEditorChromeContext =
  createContext<WorkflowEditorChromeContextValue | null>(null);

export function WorkflowEditorChromeProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  const [modeTarget, setModeTarget] = useState<HTMLElement | null>(null);
  const [identityTarget, setIdentityTarget] = useState<HTMLElement | null>(
    null,
  );
  const value = useMemo(
    () => ({
      target,
      statusTarget,
      modeTarget,
      identityTarget,
      setTarget,
      setStatusTarget,
      setModeTarget,
      setIdentityTarget,
    }),
    [identityTarget, modeTarget, statusTarget, target],
  );

  return (
    <WorkflowEditorChromeContext.Provider value={value}>
      {children}
    </WorkflowEditorChromeContext.Provider>
  );
}

export function WorkflowEditorChromeIdentityTarget() {
  const context = useContext(WorkflowEditorChromeContext);
  const setIdentityTarget = context?.setIdentityTarget;
  const targetRef = useCallback(
    (target: HTMLDivElement | null) => {
      setIdentityTarget?.(target);
    },
    [setIdentityTarget],
  );

  return (
    <div className="workflow-editor-chrome__identity-target" ref={targetRef} />
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

export function WorkflowEditorChromeIdentity({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = useContext(WorkflowEditorChromeContext);
  return context?.identityTarget === null || context === null
    ? children
    : createPortal(children, context.identityTarget);
}

export function WorkflowEditorChromeModeAction({
  children,
}: Readonly<{ children: ReactNode }>) {
  const context = useContext(WorkflowEditorChromeContext);
  return context?.modeTarget === null || context === null
    ? children
    : createPortal(children, context.modeTarget);
}
