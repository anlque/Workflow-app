import { useEffect, useId, useRef, type ReactNode } from 'react';

export type DialogProps = Readonly<{
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  describedBy?: string;
  surface?: 'glass';
  modal?: boolean;
  presentation?: 'side-sheet';
  onCancel(): void;
}>;

export function Dialog({
  open,
  title,
  children,
  className,
  describedBy,
  surface,
  modal = true,
  presentation,
  onCancel,
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || !open) return;
    if (modal && typeof dialog.showModal === 'function') dialog.showModal();
    else if (!modal && typeof dialog.show === 'function') dialog.show();
    else dialog.setAttribute('open', '');
    if (!modal) {
      dialog
        .querySelector<HTMLElement>(
          'button, input, select, textarea, [tabindex]',
        )
        ?.focus();
    }
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [modal, open]);

  useEffect(() => {
    if (!open || modal) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', cancelOnEscape);
    return () => document.removeEventListener('keydown', cancelOnEscape);
  }, [modal, onCancel, open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={['dialog', className].filter(Boolean).join(' ')}
      data-position="viewport-center"
      data-surface={surface}
      data-modal={String(modal)}
      data-presentation={presentation}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 className="dialog__title" id={titleId}>
        {title}
      </h2>
      {children}
    </dialog>
  );
}
