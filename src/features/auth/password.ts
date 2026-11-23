/** 서버 SignupRequest·PasswordResetRequest와 같은 규칙: 영문·숫자를 포함해 8~64자. u 플래그로 이모지 등을 서버(Java)처럼 한 글자로 센다. */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/u

/** BCrypt가 받는 최대 길이. 서버 `@Utf8MaxBytes(72)`와 같다. */
export const PASSWORD_MAX_BYTES = 72

/** 비밀번호 규칙 위반 안내. 문제가 없으면 null. */
export function passwordProblem(password: string): string | null {
  if (!PASSWORD_RULE.test(password)) return '비밀번호는 영문·숫자를 포함해 8~64자입니다.'
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return '비밀번호가 너무 깁니다. 이모지 등은 한 글자를 여러 바이트로 세며 72바이트까지 쓸 수 있습니다.'
  }
  return null
}
