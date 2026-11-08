import { Button } from '../../../shared/components/Button'
import { Card } from '../../../shared/components/Card'
import { useAuth } from '../AuthProvider'

/**
 * 저장된 로그인을 서버에서 확인하지 못했을 때(서버 중단·네트워크 끊김) 보여 준다(02 화면 목록 '연결 끊김').
 * 로그아웃이 아니므로 토큰과 현재 주소를 그대로 두고, 다시 시도에 성공하면 이 주소의 화면이 열린다.
 */
export function AuthUnavailable() {
  const { retry } = useAuth()
  return (
    <main className="flex min-h-dvh items-center justify-center bg-page p-5">
      <Card className="w-full max-w-sm text-center" role="alert">
        <h1 className="text-lg font-bold text-text">서버에 연결할 수 없습니다</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">
          네트워크 연결을 확인한 뒤 다시 시도해 주세요.
          <br />
          로그인 정보는 그대로 유지됩니다.
        </p>
        <Button className="mt-5" fullWidth onClick={retry}>
          다시 시도
        </Button>
      </Card>
    </main>
  )
}
