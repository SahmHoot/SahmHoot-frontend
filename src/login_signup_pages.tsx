import {
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import authBg from "./assets/auth/auth-bg.jpg";
import logoMark from "./assets/brand/sahmhoot-symbol.svg";
import mascotBook from "./assets/auth/mascot-book.webp";
import mascotSu from "./assets/auth/mascot-su.webp";
import type { AuthRole as Role } from "./features/auth/auth.types";
import { AuthPreviewPanel } from "./features/auth/components/AuthPreviewPanel";
import { EmailVerificationFields } from "./features/auth/components/EmailVerificationFields";
import { PasswordInput } from "./features/auth/components/PasswordInput";
import { passwordProblem } from "./features/auth/password";
import { useAuth } from "./features/auth/AuthProvider";
import { useLogin } from "./features/auth/hooks/useLogin";
import { usePasswordReset } from "./features/auth/hooks/usePasswordReset";
import { homePath } from "./features/auth/session";
import { useSignup } from "./features/auth/hooks/useSignup";
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
              <img src={logoMark} alt="" width={32} height={32} />
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
  // 02 화면 목록: 로그인 상태 유지 기본 켜짐. QR로 새 탭이 열려도 다시 로그인하지 않게 한다(ACC-04).
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const { user } = useAuth();
  const preview = useLogin({ email, password, keepLoggedIn });
  // 비밀번호 찾기(#108)를 마치고 돌아오면 안내를 보여 준다.
  const incoming = useLocation().state as { notice?: unknown } | null;
  const notice = typeof incoming?.notice === "string" ? incoming.notice : "";

  if (user && !preview.signedInHere) return <Navigate to={homePath(user.role)} replace />;

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
          <Link to="/password-reset" className="auth-find-link">
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        <button
          type="submit"
          className="auth-btn-primary auth-btn-primary--login"
          disabled={preview.pending}
        >
          로그인
        </button>
        {(preview.feedback || notice) && (
          <p role="status" className="auth-status">{preview.feedback || notice}</p>
        )}

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
  const [role, setRole] = useState<Role | null>(null);
  const signup = useSignup({ email, code, name, role, onCodeSent: () => setCode("") });
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  const passwordError = password === "" ? null : passwordProblem(password);
  const passwordInvalid = passwordError !== null;

  const passwordMismatch =
    passwordConfirm !== "" && password !== passwordConfirm;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordProblem(password)) {
      passwordRef.current?.focus();
      return;
    }
    if (passwordMismatch) {
      passwordConfirmRef.current?.focus();
      return;
    }
    signup.finishSignup(password);
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

          <EmailVerificationFields
            email={email}
            code={code}
            onEmailChange={(value) => {
              setEmail(value);
              setCode("");
              signup.resetVerification();
            }}
            onCodeChange={setCode}
            verification={signup}
          />

          <AuthField label="비밀번호" htmlFor="password">
            <PasswordInput
              ref={passwordRef}
              id="password"
              autoComplete="new-password"
              value={password}
              onValueChange={setPassword}
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? "pw-error" : undefined}
            />
            {passwordInvalid && (
              <p id="pw-error" role="alert" className="auth-error">
                {passwordError}
              </p>
            )}
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
          disabled={signup.pending}
        >
          가입하기
        </button>
        {signup.feedback && <p role="status" className="auth-status">{signup.feedback}</p>}
        <Link to="/login" className="auth-login-link">이미 계정이 있으신가요? 로그인</Link>
      </form>
    </AuthLayout>
  );
}

/** 비밀번호 찾기(#108). 가입과 같은 이메일 인증 뒤 새 비밀번호를 저장하고 로그인 화면으로 돌아간다. */
export function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const reset = usePasswordReset({ email, code, onCodeSent: () => setCode("") });
  const passwordRef = useRef<HTMLInputElement>(null);
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  const passwordError = password === "" ? null : passwordProblem(password);
  const passwordInvalid = passwordError !== null;
  const passwordMismatch = passwordConfirm !== "" && password !== passwordConfirm;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordProblem(password)) {
      passwordRef.current?.focus();
      return;
    }
    if (password !== passwordConfirm) {
      passwordConfirmRef.current?.focus();
      return;
    }
    reset.finish(password);
  };

  return (
    <AuthLayout
      mascot={{
        src: mascotSu,
        alt: "SU 티셔츠를 입은 SahmHoot 마스코트",
        width: 501,
        height: 539,
      }}
      contentClassName="auth-content--signup"
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <h1 className="auth-title">비밀번호 찾기</h1>
        <p className="auth-subtitle">가입한 이메일로 인증한 뒤 새 비밀번호를 정합니다.</p>

        <div className="auth-fields">
          <EmailVerificationFields
            email={email}
            code={code}
            onEmailChange={(value) => {
              setEmail(value);
              setCode("");
              reset.resetVerification();
            }}
            onCodeChange={setCode}
            verification={reset}
          />

          <AuthField label="새 비밀번호" htmlFor="password">
            <PasswordInput
              ref={passwordRef}
              id="password"
              autoComplete="new-password"
              value={password}
              onValueChange={setPassword}
              aria-invalid={passwordInvalid}
              aria-describedby={passwordInvalid ? "pw-error" : undefined}
            />
            {passwordInvalid && (
              <p id="pw-error" role="alert" className="auth-error">
                {passwordError}
              </p>
            )}
          </AuthField>

          <AuthField label="새 비밀번호 확인" htmlFor="pw2">
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
        </div>

        <button
          type="submit"
          className="auth-btn-primary auth-btn-primary--signup"
          disabled={reset.pending}
        >
          비밀번호 변경
        </button>
        {reset.feedback && <p role="status" className="auth-status">{reset.feedback}</p>}
        <Link to="/login" className="auth-login-link">로그인으로 돌아가기</Link>
      </form>
    </AuthLayout>
  );
}
