import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import authBg from "./assets/auth/auth-bg.jpg";
import logoMark from "./assets/auth/logo-mark.svg";
import mascotBook from "./assets/auth/mascot-book.webp";
import mascotSu from "./assets/auth/mascot-su.webp";
import type { AuthRole as Role } from "./features/auth/auth.types";
import { AuthPreviewPanel } from "./features/auth/components/AuthPreviewPanel";
import { PasswordInput } from "./features/auth/components/PasswordInput";
import { useLoginPreview, useSignupPreview } from "./features/auth/hooks/useAuthPreview";
import "./login_signup_pages.css";

interface AuthLayoutProps {
  mascot: { src: string; alt: string; width: number; height: number };
  contentClassName?: string;
  children: ReactNode;
}

function AuthLayout({
  mascot,
  contentClassName = "",
  children,
}: AuthLayoutProps) {
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <img src={authBg} alt="" className="auth-aside-bg" />
        <div className="auth-aside-overlay" />
        <img
          src={mascot.src}
          alt={mascot.alt}
          className="auth-mascot"
          style={{ width: mascot.width, height: mascot.height }}
        />
      </aside>

      <section className="auth-main">
        <header className="auth-header">
          <Link to="/" className="auth-logo">
            <span className="auth-logo-mark">
              <img src={logoMark} alt="" width={23} height={23} />
            </span>
            <span className="auth-logo-text">SahmHoot</span>
          </Link>
        </header>

        <main className={`auth-content ${contentClassName}`}>
          <div className="auth-form-wrap">{children}</div>
        </main>
      </section>
    </div>
  );
}

function AuthField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-field">
      <label htmlFor={htmlFor} className="auth-label">
        {label}
      </label>
      {children}
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const preview = useLoginPreview();

  return (
    <AuthLayout
      mascot={{
        src: mascotSu,
        alt: "SU 티셔츠를 입은 SahmHoot 마스코트",
        width: 501,
        height: 539,
      }}
    >
      <form onSubmit={preview.handleSubmit} className="auth-form">
        <h1 className="auth-title auth-title--login">
          삼훗 <span className="auth-title-en">SahmHoot</span>
        </h1>
        <p className="auth-subtitle">수업 중 실시간 소통 서비스</p>
        <AuthPreviewPanel mode="login" role={preview.previewRole} onRoleChange={preview.setPreviewRole} />

        <div className="auth-fields auth-fields--login">
          <AuthField label="이메일" htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="example@syu.ac.kr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required={!import.meta.env.DEV}
            />
          </AuthField>

          <AuthField label="비밀번호" htmlFor="password">
            <PasswordInput
              id="password"
              autoComplete="current-password"
              required={!import.meta.env.DEV}
              value={password}
              onValueChange={setPassword}
            />
          </AuthField>

          <label className="auth-check">
            <input
              type="checkbox"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
            />
            로그인 상태 유지 (QR 접속 시 자동 로그인)
          </label>
        </div>

        <button
          type="submit"
          className="auth-btn-primary auth-btn-primary--login"
        >
          로그인
        </button>
        {preview.feedback && <p role="status" className="auth-status">{preview.feedback}</p>}

        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span>또는</span>
          <span className="auth-divider-line" />
        </div>

        <Link to="/signup" className="auth-btn-outline">
          계정이 없으신가요? 회원가입
        </Link>
      </form>
    </AuthLayout>
  );
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "PROFESSOR", label: "교수" },
  { value: "STUDENT", label: "학생" },
];

export function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState<Role>("PROFESSOR");
  const preview = useSignupPreview({ email, code, name, role });
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  const passwordMismatch =
    passwordConfirm !== "" && password !== passwordConfirm;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordMismatch) {
      passwordConfirmRef.current?.focus();
      return;
    }
    preview.finishSignup();
  };

  return (
    <AuthLayout
      mascot={{
        src: mascotBook,
        alt: "책을 든 SahmHoot 마스코트",
        width: 400,
        height: 528,
      }}
      contentClassName="auth-content--signup"
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <h1 className="auth-title">회원가입</h1>
        <AuthPreviewPanel mode="signup" />

        <div className="auth-fields">
          <AuthField label="이름" htmlFor="name">
            <input
              id="name"
              autoComplete="name"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              required
            />
          </AuthField>

          <AuthField label="이메일" htmlFor="email">
            <div className="auth-input-row">
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@syu.ac.kr"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setCode("");
                  preview.resetVerification();
                }}
                className="auth-input"
                required
              />
              <button type="button" className="auth-btn-side" onClick={preview.requestCode} disabled={import.meta.env.DEV && preview.emailVerified}>
                인증요청
              </button>
            </div>
          </AuthField>

          <AuthField label="인증코드" htmlFor="code">
            <div className="auth-input-row">
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="auth-input"
                required
              />
              <button type="button" className="auth-btn-side" onClick={preview.verifyCode} disabled={import.meta.env.DEV && !preview.canVerify}>
                {preview.emailVerified ? "확인 완료" : "확인"}
              </button>
            </div>
          </AuthField>

          <AuthField label="비밀번호" htmlFor="password">
            <PasswordInput
              id="password"
              autoComplete="new-password"
              value={password}
              onValueChange={setPassword}
            />
          </AuthField>

          <AuthField label="비밀번호 확인" htmlFor="pw2">
            <PasswordInput
              ref={passwordConfirmRef}
              id="pw2"
              autoComplete="new-password"
              value={passwordConfirm}
              onValueChange={setPasswordConfirm}
              aria-invalid={passwordMismatch}
              aria-describedby={passwordMismatch ? "pw2-error" : undefined}
            />
            {passwordMismatch && (
              <p id="pw2-error" role="alert" className="auth-error">
                비밀번호가 일치하지 않습니다.
              </p>
            )}
          </AuthField>

          <div className="auth-field">
            <p aria-hidden="true" className="auth-label">
              역할 선택
            </p>
            <div
              role="radiogroup"
              aria-label="역할 선택"
              className="auth-roles"
            >
              {ROLE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`auth-role ${role === option.value ? "auth-role--selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    className="auth-sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="auth-btn-primary auth-btn-primary--signup"
        >
          가입하기
        </button>
        {preview.feedback && <p role="status" className="auth-status">{preview.feedback}</p>}
        <Link to="/login" className="auth-login-link">이미 계정이 있으신가요? 로그인</Link>
      </form>
    </AuthLayout>
  );
}
