import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

const DRAG_THRESHOLD = 6;
const AUTOSCROLL_EDGE = 48;
const AUTOSCROLL_STEP = 10;

type DragState = {
  pointerId: number;
  phaseKey: string;
  originY: number;
  handle: HTMLElement;
  dragging: boolean;
  targetIndex: number | null;
  scrollTarget: HTMLElement | 'viewport';
  scrollDirection: -1 | 0 | 1;
  clientY: number;
};

type UsePhaseDragInput = Readonly<{
  phaseKeys: readonly string[];
  listRef: RefObject<HTMLElement | null>;
  onMove(phaseKey: string, targetIndex: number): void;
  onCancel?(): void;
}>;

function nearestScrollElement(element: HTMLElement | null): HTMLElement | null {
  for (
    let current = element;
    current !== null;
    current = current.parentElement
  ) {
    const overflow = getComputedStyle(current).overflowY;
    if (
      (overflow === 'auto' || overflow === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
  }
  return null;
}

export function usePhaseDrag({
  phaseKeys,
  listRef,
  onMove,
  onCancel,
}: UsePhaseDragInput) {
  const phaseElements = useRef(new Map<string, HTMLElement>());
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const onMoveRef = useRef(onMove);
  const onCancelRef = useRef(onCancel);
  onMoveRef.current = onMove;
  onCancelRef.current = onCancel;
  const [activePhaseKey, setActivePhaseKey] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const stopAutoscroll = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const calculateTarget = useCallback(
    (phaseKey: string, clientY: number): number | null => {
      const remaining = phaseKeys.filter((key) => key !== phaseKey);
      if (remaining.length === phaseKeys.length) return null;
      let index = 0;
      for (const key of remaining) {
        const bounds = phaseElements.current.get(key)?.getBoundingClientRect();
        if (bounds !== undefined && clientY >= bounds.top + bounds.height / 2) {
          index += 1;
        }
      }
      return Math.min(index, phaseKeys.length - 1);
    },
    [phaseKeys],
  );

  const runAutoscroll = useCallback(() => {
    frameRef.current = null;
    const drag = dragRef.current;
    if (drag === null || drag.scrollDirection === 0) return;
    const amount = drag.scrollDirection * AUTOSCROLL_STEP;
    if (drag.scrollTarget === 'viewport') window.scrollBy({ top: amount });
    else drag.scrollTarget.scrollBy({ top: amount });
    const nextTarget = calculateTarget(drag.phaseKey, drag.clientY);
    drag.targetIndex = nextTarget;
    setTargetIndex(nextTarget);
    frameRef.current = requestAnimationFrame(runAutoscroll);
  }, [calculateTarget]);

  const updateAutoscroll = useCallback(
    (clientY: number) => {
      const drag = dragRef.current;
      if (drag === null) return;
      drag.clientY = clientY;
      const bounds =
        drag.scrollTarget === 'viewport'
          ? { top: 0, bottom: window.innerHeight }
          : drag.scrollTarget.getBoundingClientRect();
      drag.scrollDirection =
        clientY <= bounds.top + AUTOSCROLL_EDGE
          ? -1
          : clientY >= bounds.bottom - AUTOSCROLL_EDGE
            ? 1
            : 0;
      if (drag.scrollDirection === 0) {
        stopAutoscroll();
      } else {
        frameRef.current ??= requestAnimationFrame(runAutoscroll);
      }
    },
    [runAutoscroll, stopAutoscroll],
  );

  const finish = useCallback(
    (commit: boolean, announceCancellation: boolean) => {
      const drag = dragRef.current;
      if (drag === null) return;
      dragRef.current = null;
      stopAutoscroll();
      if (drag.handle.hasPointerCapture(drag.pointerId)) {
        drag.handle.releasePointerCapture(drag.pointerId);
      }
      setActivePhaseKey(null);
      setTargetIndex(null);
      if (commit && drag.dragging && drag.targetIndex !== null) {
        onMoveRef.current(drag.phaseKey, drag.targetIndex);
      } else if (announceCancellation && drag.dragging) {
        onCancelRef.current?.();
      }
    },
    [stopAutoscroll],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dragRef.current !== null) {
        event.preventDefault();
        finish(false, true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      finish(false, false);
    };
  }, [finish]);

  return {
    activePhaseKey,
    targetIndex,
    registerPhase(phaseKey: string, element: HTMLElement | null): void {
      if (element === null) phaseElements.current.delete(phaseKey);
      else phaseElements.current.set(phaseKey, element);
    },
    getHandleProps(phaseKey: string) {
      return {
        onPointerDown(event: ReactPointerEvent<HTMLElement>) {
          if (
            !event.isPrimary ||
            event.button !== 0 ||
            dragRef.current !== null
          )
            return;
          const handle = event.currentTarget;
          handle.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointerId: event.pointerId,
            phaseKey,
            originY: event.clientY,
            handle,
            dragging: false,
            targetIndex: null,
            scrollTarget: nearestScrollElement(listRef.current) ?? 'viewport',
            scrollDirection: 0,
            clientY: event.clientY,
          };
        },
        onPointerMove(event: ReactPointerEvent<HTMLElement>) {
          const drag = dragRef.current;
          if (drag?.pointerId !== event.pointerId) return;
          if (
            !drag.dragging &&
            Math.abs(event.clientY - drag.originY) < DRAG_THRESHOLD
          ) {
            return;
          }
          drag.dragging = true;
          const nextTarget = calculateTarget(drag.phaseKey, event.clientY);
          drag.targetIndex = nextTarget;
          setActivePhaseKey(drag.phaseKey);
          setTargetIndex(nextTarget);
          updateAutoscroll(event.clientY);
        },
        onPointerUp(event: ReactPointerEvent<HTMLElement>) {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          finish(true, false);
        },
        onPointerCancel(event: ReactPointerEvent<HTMLElement>) {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          finish(false, true);
        },
        onLostPointerCapture(event: ReactPointerEvent<HTMLElement>) {
          if (dragRef.current?.pointerId !== event.pointerId) return;
          finish(false, true);
        },
      };
    },
    cancel(): void {
      finish(false, true);
    },
  };
}
