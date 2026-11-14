import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> &
  Readonly<{
    children: ReactNode;
    pending?: boolean;
    pendingLabel?: ReactNode;
    variant?: ButtonVariant;
    buttonRef?: Ref<HTMLButtonElement>;
    iconOnly?: boolean;
  }>;

export function Button({
  children,
  pending = false,
  pendingLabel = 'Saving…',
  variant = 'secondary',
  className,
  disabled,
  buttonRef,
  iconOnly = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = [
    'button',
    `button--${variant}`,
    iconOnly && 'button--icon',
    className,
  ]
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
      {pending && !iconOnly ? pendingLabel : children}
    </button>
  );
}
