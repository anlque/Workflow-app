import { useEffect, useId, useRef, type ReactNode } from 'react';

export type DialogProps = Readonly<{
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  className?: string;
  onCancel(): void;
}>;

export function Dialog({
  open,
  title,
  children,
  className,
  onCancel,
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null || !open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={['dialog', className].filter(Boolean).join(' ')}
      data-position="viewport-center"
      aria-labelledby={titleId}
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
