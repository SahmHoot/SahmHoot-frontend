import type { ComponentPropsWithRef, ReactNode } from 'react';
import { Button, type ButtonProps } from './Button';

const logoMark = new URL('./header-assets/logo-mark.svg', import.meta.url).href;
const chevronDown = new URL('./header-assets/chevron-down.svg', import.meta.url).href;
const participantsIcon = new URL('./header-assets/participants.svg', import.meta.url).href;

export interface HeaderProps extends Omit<ComponentPropsWithRef<'header'>, 'title' | 'children'> {
  variant?: 'auth' | 'brand' | 'classroom';
  title?: ReactNode;
  logoHref?: string;
  user?: ReactNode;
  status?: ReactNode;
  desktopInfo?: ReactNode;
  actions?: ReactNode;
  mobileActions?: ReactNode;
  sticky?: boolean;
}

export interface HeaderUserInfoProps extends ComponentPropsWithRef<'button'> {
  displayName: string;
  initial?: string;
}

export interface HeaderStatusProps extends ComponentPropsWithRef<'span'> {
  children: ReactNode;
}

export interface HeaderParticipantCountProps extends Omit<ComponentPropsWithRef<'span'>, 'children'> {
  count: number;
}

export interface HeaderActionProps extends Omit<ButtonProps, 'variant' | 'size' | 'fullWidth'> {
  variant?: 'outline' | 'danger';
}

// Observed status labels: 218:644 (waiting) and 218:816 (active).
// These are presentational slots; the caller supplies the classroom state.
export function HeaderStatus({ children, className = '', ...props }: HeaderStatusProps) {
  return (
    <span
      {...props}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-pill bg-success/10 px-3 py-1 font-sans text-xs font-semibold leading-4 text-success ${className}`}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-pill bg-success" />
      {children}
    </span>
  );
}

// Figma 218:822: connection count, with its original 14px icon.
export function HeaderParticipantCount({ count, className = '', ...props }: HeaderParticipantCountProps) {
  return (
    <span
      {...props}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill bg-brand-subtle px-3 py-1.5 font-sans text-xs font-semibold leading-4 text-brand ${className}`}
    >
      <img src={participantsIcon} alt="" className="size-3.5 shrink-0" />
      접속 {count}명
    </span>
  );
}

// Header actions are 40px desktop (218:1935 / 218:829), 32px mobile (269:625).
// Responsive sizing is local to Header; the shared Button API stays unchanged.
export function HeaderAction({ variant = 'outline', className = '', type = 'button', ...props }: HeaderActionProps) {
  return (
    <Button
      {...props}
      type={type}
      variant={variant}
      size="sm"
      className={`rounded-control! shadow-surface! disabled:shadow-none! md:min-h-10 md:px-4 md:py-0 md:text-sm md:leading-5 ${variant === 'outline' ? 'border-border-input!' : ''} ${className}`}
    />
  );
}

// Figma user control: 218:248 / 218:1673 / 269:392. Menu behavior is caller-owned.
export function HeaderUserInfo({
  displayName,
  initial = Array.from(displayName.trim())[0] ?? '',
  className = '',
  type = 'button',
  ...props
}: HeaderUserInfoProps) {
  return (
    <button
      {...props}
      type={type}
      className={`inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-pill border border-border bg-surface py-1 pl-1 pr-3 font-sans text-sm font-medium leading-5 text-text shadow-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-xs font-bold leading-4 text-brand">
        {initial}
      </span>
      <span className="whitespace-nowrap">{displayName}</span>
      <img src={chevronDown} alt="" className="block size-3.5 shrink-0" />
    </button>
  );
}

// Figma page 169:2: auth 214:2534 / 269:325, brand 218:238 / 269:382,
// classroom 218:1923 / 218:807 / 269:616. md is an implementation breakpoint.
export function Header({
  variant = 'brand',
  title,
  logoHref,
  user,
  status,
  desktopInfo,
  actions,
  mobileActions,
  sticky,
  className = '',
  ...props
}: HeaderProps) {
  const isAuth = variant === 'auth';
  const isClassroom = variant === 'classroom';
  const isSticky = sticky ?? !isAuth;
  const mark = (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-pill bg-brand shadow-brand ${isClassroom ? 'size-7' : 'size-8'}`}>
      <img src={logoMark} alt="" className="block size-4 rotate-45" />
    </span>
  );
  const brand = (
    <>
      {mark}
      <span className="inline-flex items-baseline gap-[3px] whitespace-nowrap text-lg leading-7 tracking-[-0.45px]">
        {!isAuth && <span className="font-sans font-black text-text">삼훗</span>}
        <span className="font-display font-bold text-brand">SahmHoot</span>
      </span>
    </>
  );
  const hasRightContent = user != null || desktopInfo != null || actions != null || mobileActions != null;

  return (
    <header
      {...props}
      className={`font-sans text-text ${isSticky ? 'sticky top-0 z-20' : ''} ${isAuth ? '' : 'border-b border-border bg-surface/90 backdrop-blur-[4px]'} ${className}`}
    >
      <div className={`mx-auto flex w-full min-w-0 items-center justify-between gap-3 ${isAuth ? 'min-h-14 px-6 pt-6 md:min-h-[72px] md:px-12 md:pt-10' : `min-h-14 px-4 md:min-h-16 md:px-8 ${isClassroom ? 'max-w-[1400px]' : 'max-w-[1280px]'}`}`}>
        <div className={`flex min-w-0 items-center ${isClassroom ? 'gap-2 md:gap-3' : 'gap-2.5'}`}>
          {isClassroom ? (
            <>
              {mark}
              {title != null && <h1 className="min-w-0 truncate text-base font-bold leading-6 md:text-lg md:leading-7">{title}</h1>}
            </>
          ) : logoHref ? (
            <a href={logoHref} className="inline-flex shrink-0 items-center gap-2.5 rounded-compact focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {brand}
            </a>
          ) : (
            <div className="inline-flex shrink-0 items-center gap-2.5">{brand}</div>
          )}
          {status}
        </div>
        {hasRightContent && (
          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            {desktopInfo != null && <div className="hidden items-center text-sm leading-5 md:inline-flex">{desktopInfo}</div>}
            {user}
            {mobileActions === undefined ? actions : (
              <>
                <div className="flex items-center gap-2 md:hidden">{mobileActions}</div>
                <div className="hidden items-center gap-3 md:flex">{actions}</div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
