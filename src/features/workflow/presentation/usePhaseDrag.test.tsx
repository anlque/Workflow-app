import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { usePhaseDrag } from './usePhaseDrag';

const keys = ['one', 'two', 'three'] as const;

function Harness({
  onMove = vi.fn(),
}: {
  onMove?: (key: string, index: number) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  const drag = usePhaseDrag({ phaseKeys: keys, listRef, onMove });
  return (
    <ol ref={listRef} data-testid="list">
      {keys.map((key) => (
        <li
          key={key}
          ref={(node) => {
            drag.registerPhase(key, node);
          }}
          data-testid={`phase-${key}`}
        >
          <button data-testid={`handle-${key}`} {...drag.getHandleProps(key)}>
            Drag
          </button>
        </li>
      ))}
      <output data-testid="state">
        {drag.activePhaseKey ?? ''}:{drag.targetIndex ?? ''}
      </output>
    </ol>
  );
}

function setGeometry(): void {
  keys.forEach((key, index) => {
    vi.spyOn(
      screen.getByTestId(`phase-${key}`),
      'getBoundingClientRect',
    ).mockReturnValue({
      top: index * 100,
      bottom: index * 100 + 80,
      height: 80,
      left: 0,
      right: 300,
      width: 300,
      x: 0,
      y: index * 100,
      toJSON: () => undefined,
    });
  });
}

afterEach(() => vi.restoreAllMocks());

describe('usePhaseDrag', () => {
  test.each(['mouse', 'touch', 'pen'] as const)(
    'commits one %s move after threshold',
    (pointerType) => {
      const onMove = vi.fn();
      render(<Harness onMove={onMove} />);
      setGeometry();
      const handle = screen.getByTestId('handle-one');
      Object.assign(handle, {
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: () => true,
      });

      fireEvent.pointerDown(handle, {
        pointerId: 4,
        pointerType,
        button: 0,
        isPrimary: true,
        clientY: 20,
      });
      fireEvent.pointerMove(handle, {
        pointerId: 4,
        pointerType,
        clientY: 260,
      });
      expect(screen.getByTestId('state')).toHaveTextContent('one:2');
      fireEvent.pointerUp(handle, { pointerId: 4, pointerType, clientY: 260 });
      fireEvent.pointerUp(handle, { pointerId: 4, pointerType, clientY: 260 });
      expect(onMove).toHaveBeenCalledOnce();
      expect(onMove).toHaveBeenCalledWith('one', 2);
    },
  );

  test('does not start below threshold or for a non-primary pointer', () => {
    const onMove = vi.fn();
    render(<Harness onMove={onMove} />);
    setGeometry();
    const handle = screen.getByTestId('handle-two');
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });
    fireEvent.pointerDown(handle, {
      pointerId: 1,
      button: 0,
      isPrimary: true,
      clientY: 120,
    });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 124 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 124 });
    fireEvent.pointerDown(handle, {
      pointerId: 2,
      button: 0,
      isPrimary: false,
      clientY: 120,
    });
    fireEvent.pointerMove(handle, { pointerId: 2, clientY: 10 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientY: 10 });
    expect(onMove).not.toHaveBeenCalled();
  });

  test.each(['Escape', 'pointercancel', 'lostpointercapture'] as const)(
    'cancels on %s',
    (reason) => {
      const onMove = vi.fn();
      render(<Harness onMove={onMove} />);
      setGeometry();
      const handle = screen.getByTestId('handle-one');
      Object.assign(handle, {
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        hasPointerCapture: () => true,
      });
      fireEvent.pointerDown(handle, {
        pointerId: 8,
        button: 0,
        isPrimary: true,
        clientY: 20,
      });
      fireEvent.pointerMove(handle, { pointerId: 8, clientY: 180 });
      if (reason === 'Escape') fireEvent.keyDown(document, { key: 'Escape' });
      else
        fireEvent[
          reason === 'pointercancel' ? 'pointerCancel' : 'lostPointerCapture'
        ](handle, { pointerId: 8 });
      expect(onMove).not.toHaveBeenCalled();
      expect(screen.getByTestId('state')).toHaveTextContent(':');
    },
  );

  test('starts and clears edge autoscroll with drag cleanup', () => {
    let frame: FrameRequestCallback | undefined;
    const request = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        frame = callback;
        return 1;
      });
    const cancel = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    render(<Harness />);
    setGeometry();
    const list = screen.getByTestId('list');
    Object.defineProperties(list, {
      scrollHeight: { value: 600 },
      clientHeight: { value: 200 },
    });
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 200,
    } as DOMRect);
    Object.assign(list.style, { overflowY: 'auto' });
    const scrollBy = vi.fn();
    Object.assign(list, { scrollBy });
    const handle = screen.getByTestId('handle-two');
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });

    fireEvent.pointerDown(handle, {
      pointerId: 9,
      button: 0,
      isPrimary: true,
      clientY: 120,
    });
    fireEvent.pointerMove(handle, { pointerId: 9, clientY: 195 });
    fireEvent.pointerMove(handle, { pointerId: 9, clientY: 194 });
    expect(request).toHaveBeenCalledOnce();
    frame?.(1);
    expect(scrollBy).toHaveBeenCalled();
    fireEvent.pointerCancel(handle, { pointerId: 9 });
    expect(cancel).toHaveBeenCalled();
  });

  test('falls back to the document viewport for autoscroll', () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    const scrollBy = vi
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => undefined);
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 300,
    });
    render(<Harness />);
    setGeometry();
    const handle = screen.getByTestId('handle-two');
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });

    fireEvent.pointerDown(handle, {
      pointerId: 11,
      button: 0,
      isPrimary: true,
      clientY: 120,
    });
    fireEvent.pointerMove(handle, { pointerId: 11, clientY: 295 });
    frame?.(1);

    expect(scrollBy).toHaveBeenCalledWith({ top: 10 });
    fireEvent.pointerCancel(handle, { pointerId: 11 });
  });

  test('recalculates the drop target during autoscroll without pointer movement', () => {
    let frame: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frame = callback;
      return 1;
    });
    render(<Harness />);
    setGeometry();
    const list = screen.getByTestId('list');
    Object.defineProperties(list, {
      scrollHeight: { value: 600 },
      clientHeight: { value: 200 },
    });
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 200,
    } as DOMRect);
    Object.assign(list.style, { overflowY: 'auto' });
    Object.assign(list, { scrollBy: vi.fn() });
    const third = screen.getByTestId('phase-three');
    vi.spyOn(third, 'getBoundingClientRect')
      .mockReturnValueOnce({ top: 200, height: 80 } as DOMRect)
      .mockReturnValue({ top: 100, height: 80 } as DOMRect);
    const handle = screen.getByTestId('handle-one');
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
      hasPointerCapture: () => true,
    });

    fireEvent.pointerDown(handle, {
      pointerId: 12,
      button: 0,
      isPrimary: true,
      clientY: 20,
    });
    fireEvent.pointerMove(handle, { pointerId: 12, clientY: 195 });
    expect(screen.getByTestId('state')).toHaveTextContent('one:1');
    act(() => {
      frame?.(1);
    });
    expect(screen.getByTestId('state')).toHaveTextContent('one:2');
    fireEvent.pointerCancel(handle, { pointerId: 12 });
  });

  test('releases capture without committing when unmounted during drag', () => {
    const onMove = vi.fn();
    const { unmount } = render(<Harness onMove={onMove} />);
    setGeometry();
    const handle = screen.getByTestId('handle-one');
    const releasePointerCapture = vi.fn();
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture,
      hasPointerCapture: () => true,
    });
    fireEvent.pointerDown(handle, {
      pointerId: 10,
      button: 0,
      isPrimary: true,
      clientY: 20,
    });
    fireEvent.pointerMove(handle, { pointerId: 10, clientY: 160 });
    unmount();
    expect(releasePointerCapture).toHaveBeenCalledWith(10);
    expect(onMove).not.toHaveBeenCalled();
  });
});
