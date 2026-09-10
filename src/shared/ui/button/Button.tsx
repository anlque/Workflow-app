import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> &
  Readonly<{
    children: ReactNode;
    pending?: boolean;
    pendingLabel?: string;
    variant?: ButtonVariant;
    buttonRef?: Ref<HTMLButtonElement>;
  }>;

export function Button({
  children,
  pending = false,
  pendingLabel = 'Saving…',
  variant = 'secondary',
  className,
  disabled,
  buttonRef,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = ['button', `button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={buttonRef}
      {...props}
      type={type}
      className={classes}
      disabled={disabled === true || pending}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
