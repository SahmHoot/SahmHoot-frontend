import {
  useRef,
  useState,
  type ChangeEvent,
  type CompositionEvent,
  type Dispatch,
  type FormEvent,
  type ComponentProps,
  type ReactNode,
  type SetStateAction,
} from "react";
import { Link } from "react-router-dom";
import authBg from "./assets/auth/auth-bg.jpg";
import logoMark from "./assets/auth/logo-mark.svg";
import mascotBook from "./assets/auth/mascot-book.webp";
import mascotSu from "./assets/auth/mascot-su.webp";
import { hangulToQwerty } from "./shared/utils/hangulToQwerty";
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

function EyeIcon({ off = false }: { off?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function PasswordInput({
  onValueChange,
  ...props
}: Omit<
  ComponentProps<"input">,
  "type" | "className" | "value" | "onChange"
> & {
  value: string;
  onValueChange: Dispatch<SetStateAction<string>>;
}) {
  const [visible, setVisible] = useState(false);

  // 한글 자판 상태로 입력해도 같은 자리의 영문으로 바꿔 넣음 (ㅁ → a)
  // 조합 중에 값을 바꾸면 IME가 글자를 중복 입력하므로 조합이 끝난 뒤 변환
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    const composing = (event.nativeEvent as InputEvent).isComposing;
    onValueChange(composing ? value : hangulToQwerty(value));
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLInputElement>) => {
    onValueChange(hangulToQwerty(event.currentTarget.value));
  };

  return (
    <div className="auth-password">
      <input
        placeholder="******"
        required
        {...props}
        onChange={handleChange}
        onCompositionEnd={handleCompositionEnd}
        type={visible ? "text" : "password"}
        className="auth-input auth-input--with-toggle"
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        aria-pressed={visible}
        className="auth-toggle"
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 로그인 API 연동은 인증 API 작업에서 진행
  };

  return (
    <AuthLayout
      mascot={{
        src: mascotSu,
        alt: "SU 티셔츠를 입은 SahmHoot 마스코트",
        width: 501,
        height: 539,
      }}
    >
      <form onSubmit={handleSubmit} className="auth-form">
        <h1 className="auth-title auth-title--login">
          삼훗 <span className="auth-title-en">SahmHoot</span>
        </h1>
        <p className="auth-subtitle">수업 중 실시간 소통 서비스</p>

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
              required
            />
          </AuthField>

          <AuthField label="비밀번호" htmlFor="password">
            <PasswordInput
              id="password"
              autoComplete="current-password"
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

type Role = "PROFESSOR" | "STUDENT";

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
  const passwordConfirmRef = useRef<HTMLInputElement>(null);

  const passwordMismatch =
    passwordConfirm !== "" && password !== passwordConfirm;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordMismatch) {
      passwordConfirmRef.current?.focus();
      return;
    }
    // 회원가입·이메일 인증 API 연동은 인증 API 작업에서 진행
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

          <AuthField label="이메일" htmlFor="email">
            <div className="auth-input-row">
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="example@syu.ac.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                required
              />
              <button type="button" className="auth-btn-side">
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
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="auth-input"
                required
              />
              <button type="button" className="auth-btn-side">
                확인
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
            {/* 표시 문구는 Figma 원본 그대로 유지, 보조기기에는 역할 선택으로 안내 */}
            <p aria-hidden="true" className="auth-label">
              비밀번호 확인
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
      </form>
    </AuthLayout>
  );
}
