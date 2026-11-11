import { Button } from '../../shared/components/Button'
import { Card } from '../../shared/components/Card'

export function ClassroomStatus({ error, onHome }: { error?: string; onHome: () => void }) {
  return <Card className="m-6 space-y-4">
    <p role={error ? 'alert' : 'status'}>{error || '수업에 연결하는 중입니다.'}</p>
    {error && <Button onClick={onHome}>홈으로</Button>}
  </Card>
}
