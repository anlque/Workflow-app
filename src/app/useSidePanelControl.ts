import { useCallback, useEffect, useRef, useState } from 'react';

export type SidePanelControlDependencies = Readonly<{
  openSidePanel(): Promise<void>;
  closeSidePanel(): Promise<void>;
  subscribeSidePanelState(listener: (open: boolean) => void): () => void;
}>;

export function useSidePanelControl(
  dependencies: SidePanelControlDependencies,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOpenRef = useRef(false);
  const nextOperationIdRef = useRef(0);
  const activeOperationIdRef = useRef<number | null>(null);
  const lifecycleVersionRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = dependencies.subscribeSidePanelState((open) => {
      lifecycleVersionRef.current += 1;
      isOpenRef.current = open;
      setIsOpen(open);
      setError(null);
      if (activeOperationIdRef.current !== null) {
        activeOperationIdRef.current = null;
        setPending(false);
      }
    });
    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [dependencies]);

  const toggle = useCallback(async (): Promise<void> => {
    if (activeOperationIdRef.current !== null) return;
    const operationId = nextOperationIdRef.current + 1;
    nextOperationIdRef.current = operationId;
    activeOperationIdRef.current = operationId;
    const wasOpen = isOpenRef.current;
    const lifecycleVersion = lifecycleVersionRef.current;
    const optimisticOpen = !wasOpen;
    isOpenRef.current = optimisticOpen;
    setIsOpen(optimisticOpen);
    setPending(true);
    setError(null);
    try {
      await (wasOpen
        ? dependencies.closeSidePanel()
        : dependencies.openSidePanel());
    } catch (cause) {
      if (
        mountedRef.current &&
        activeOperationIdRef.current === operationId &&
        lifecycleVersionRef.current === lifecycleVersion
      ) {
        isOpenRef.current = wasOpen;
        setIsOpen(wasOpen);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to update the Side Panel. Try again.',
        );
      }
    } finally {
      if (activeOperationIdRef.current === operationId) {
        activeOperationIdRef.current = null;
        if (mountedRef.current) setPending(false);
      }
    }
  }, [dependencies]);

  return { isOpen, pending, error, toggle } as const;
}
