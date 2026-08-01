import type { ButtonHTMLAttributes, ReactNode } from 'react';

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
  }>;

export function Button({
  children,
  pending = false,
  pendingLabel = 'Saving…',
  variant = 'secondary',
  className,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const classes = ['button', `button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
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
