import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../shared/components/Button';
import { Input } from '../../shared/components/Input';
import { FormField } from '../../shared/components/FormField';
import { Card } from '../../shared/components/Card';
import { Badge } from '../../shared/components/Badge';
import {
  Header, HeaderUserInfo, HeaderStatus, HeaderParticipantCount, HeaderAction,
} from '../../shared/components/Header';

const buttonVariants = ['primary', 'secondary', 'outline', 'danger'] as const;
const buttonSizes = ['sm', 'md', 'lg'] as const;
const badgeExamples = [
  ['public', '공개'], ['private', '비공개'], ['teacher', '교수'],
  ['correct', '정답'], ['selected', '내 선택'],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function HeaderExample({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{label}</h3>
      <div className="max-h-48 overflow-auto rounded-compact border border-border bg-page">
        {children}
        <p className="min-h-64 p-4 text-xs leading-5 text-text-muted">
          이 영역을 스크롤하면 sticky 동작을 확인할 수 있습니다. 액션은 미리보기 알림만 표시합니다.
        </p>
      </div>
    </div>
  );
}

function Gallery() {
  const [notice, setNotice] = useState('버튼을 누르면 이곳에 선택한 예시가 표시됩니다.');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const notify = (label: string) => () => setNotice(`${label} 예시를 클릭했습니다.`);

  return (
    <main className="min-h-screen space-y-10 bg-page p-4 font-sans text-text md:p-8">
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">SahmHoot 공통 UI</h1>
        <p className="text-sm leading-6 text-text-muted">
          기존 컴포넌트를 그대로 렌더링한 개발 전용 화면입니다. Tab으로 focus-visible, 마우스로 hover를 확인하세요.
          disabled·loading·오류 표시는 구현 상태 예시이며 Figma의 확정 디자인과 구분해 비교하세요.
        </p>
        <nav aria-label="컴포넌트 바로가기" className="flex flex-wrap gap-3 text-sm text-brand">
          {['buttons', 'inputs', 'cards', 'badges', 'headers'].map(id => (
            <a key={id} href={`#${id}`} className="rounded-compact underline focus-visible:outline-2 focus-visible:outline-brand">{id}</a>
          ))}
        </nav>
        <p role="status" className="min-h-10 rounded-compact bg-surface p-3 text-xs text-text-muted">{notice}</p>
      </div>

      <Section id="buttons" title="Button · variant / size / 상태">
        <div className="grid gap-4 lg:grid-cols-2">
          {buttonVariants.map(variant => (
            <Card key={variant} padding="compact" className="space-y-5">
              <h3 className="font-semibold">{variant}</h3>
              {buttonSizes.map(size => (
                <div key={size} className="space-y-2">
                  <p className="text-xs text-text-muted">{size} · 기본 / disabled / loading</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant={variant} size={size} onClick={notify(`${variant} ${size}`)}>버튼</Button>
                    <Button type="button" variant={variant} size={size} disabled>비활성</Button>
                    <Button type="button" variant={variant} size={size} loading>처리 중</Button>
                  </div>
                </div>
              ))}
            </Card>
          ))}
        </div>
        <Card padding="compact">
          <Button type="button" size="lg" fullWidth onClick={notify('fullWidth')}>로그인 · fullWidth / lg</Button>
        </Card>
      </Section>

      <Section id="inputs" title="Input / FormField · 기본 / 안내 / 오류">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-5">
            <h3 className="font-semibold">독립 Input</h3>
            <Input aria-label="기본 입력창" placeholder="텍스트를 입력하세요" />
            <Input aria-label="이메일 입력창" type="email" placeholder="name@example.com" />
            <Input aria-label="비활성 입력창" disabled defaultValue="비활성 입력값" />
            <Input aria-label="오류 입력창" invalid defaultValue="잘못된 입력값" />
          </Card>
          <Card className="space-y-5">
            <h3 className="font-semibold">라벨과 상태 메시지</h3>
            <FormField label="이메일" hint="학교 이메일을 입력하세요.">
              <Input type="email" placeholder="name@school.ac.kr" value={email} onChange={event => setEmail(event.target.value)} />
            </FormField>
            <FormField label="이름" hint="설명 문구 예시" error="이름을 입력해주세요.">
              <Input required placeholder="이름 입력" />
            </FormField>
            <FormField label="비활성 필드" hint="입력할 수 없는 상태입니다.">
              <Input disabled defaultValue="김상윤" />
            </FormField>
            <FormField label="비밀번호" hint="표시 버튼은 Input의 endAdornment 조합 예시입니다.">
              <Input
                type={showPassword ? 'text' : 'password'}
                defaultValue="preview-password"
                autoComplete="off"
                endAdornment={
                  <button
                    type="button"
                    aria-label="비밀번호 표시"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(value => !value)}
                    className="rounded-compact text-xs text-brand focus-visible:outline-2 focus-visible:outline-brand"
                  >{showPassword ? '숨김' : '표시'}</button>
                }
              />
            </FormField>
          </Card>
        </div>
      </Section>

      <Section id="cards" title="Card · variant / padding">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="space-y-4">
            <h3 className="font-semibold">로그인 카드 · default / content</h3>
            <FormField label="이메일"><Input type="email" placeholder="이메일 입력" /></FormField>
            <Button type="button" fullWidth size="lg" onClick={notify('로그인 카드')}>로그인</Button>
          </Card>
          <Card variant="classroom" className="space-y-3">
            <h3 className="font-semibold">자료구조 3주차 · classroom</h3>
            <p className="text-sm text-text-muted">왼쪽 강조선과 기본 padding 확인</p>
            <Badge variant="public">공개</Badge>
          </Card>
          {(['none', 'compact', 'content', 'list'] as const).map(padding => (
            <Card key={padding} padding={padding}>
              <div className="bg-brand-subtle text-sm leading-6">
                <h3 className="font-semibold">padding = {padding}</h3>
                <p>안쪽 색상 면의 시작 위치로 여백을 비교하세요.</p>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="badges" title="Badge · 확인된 variant">
        <Card padding="compact" className="flex flex-wrap items-center gap-5">
          {badgeExamples.map(([variant, label]) => (
            <div key={variant} className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{variant}</span>
              <Badge variant={variant}>{label}</Badge>
            </div>
          ))}
        </Card>
      </Section>

      <Section id="headers" title="Header · 공통 / 학생 / 교수">
        <HeaderExample label="auth · 공통 로그인 / 회원가입">
          <Header variant="auth" logoHref="#headers" />
        </HeaderExample>
        <HeaderExample label="brand · 학생">
          <Header logoHref="#headers" user={<HeaderUserInfo displayName="김상윤" onClick={notify('학생 사용자')} />} />
        </HeaderExample>
        <HeaderExample label="brand · 교수 / 사용자 disabled">
          <Header user={<HeaderUserInfo displayName="강현민 교수" disabled />} />
        </HeaderExample>
        <HeaderExample label="classroom · 학생 / 모바일에서 참여 정보 숨김">
          <Header
            variant="classroom"
            title="자료구조 3주차"
            desktopInfo={<span><strong>익명판다몽</strong><span className="text-text-muted">으로 참여 중</span></span>}
            actions={<HeaderAction onClick={notify('나가기')}>나가기</HeaderAction>}
          />
        </HeaderExample>
        <HeaderExample label="classroom · 교수 / 데스크톱 Figma 조합">
          <Header
            variant="classroom"
            title="자료구조 3주차"
            status={<span className="hidden md:inline-flex"><HeaderStatus>진행 중</HeaderStatus></span>}
            desktopInfo={<HeaderParticipantCount count={32} />}
            actions={<HeaderAction variant="danger" onClick={notify('수업 종료')}>수업 종료</HeaderAction>}
            mobileActions={null}
          />
          <p className="px-4 pt-3 text-xs text-text-muted">교수 모바일 디자인은 미확인: 이 예시의 모바일 표시 방식은 슬롯 검증용입니다.</p>
        </HeaderExample>
        <HeaderExample label="classroom · 긴 제목 / sticky 해제">
          <Header variant="classroom" sticky={false} title="아주 긴 강의실 제목이 좁은 화면에서 말줄임되는지 확인하는 예시" actions={<HeaderAction disabled>나가기</HeaderAction>} />
        </HeaderExample>
      </Section>
    </main>
  );
}

export function Preview() {
  const [width, setWidth] = useState<'auto' | 390 | 768 | 1440>('auto');
  if (new URLSearchParams(window.location.search).get('canvas') === '1') return <Gallery />;

  const canvasUrl = new URL(window.location.href);
  canvasUrl.search = '?canvas=1';
  canvasUrl.hash = '';
  return (
    <main className="min-h-screen space-y-4 bg-muted p-4 font-sans text-text">
      <h1 className="text-xl font-bold">공통 컴포넌트 미리보기 · 개발 전용</h1>
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="mb-2 text-sm text-text-muted">실제 iframe 뷰포트 폭</legend>
        {(['auto', 390, 768, 1440] as const).map(value => (
          <label key={value} className="inline-flex cursor-pointer items-center gap-2 rounded-compact border border-border bg-surface px-3 py-2 text-sm">
            <input type="radio" name="viewport" value={value} checked={width === value} onChange={() => setWidth(value)} />
            {value === 'auto' ? '자동' : `${value}px`}
          </label>
        ))}
      </fieldset>
      <p className="text-xs leading-5 text-text-muted">
        선택 폭이 창보다 크면 가로로 스크롤하세요. 화면 폭 변경은 입력값을 유지합니다.
        모바일 기기 에뮬레이션은 브라우저 개발자 도구를 사용하세요.
      </p>
      <a href={canvasUrl.href} target="_blank" rel="noreferrer" className="inline-block text-sm text-brand underline">미리보기만 새 탭에서 열기</a>
      <div className="overflow-x-auto rounded-compact border border-border bg-border p-2">
        <iframe
          title="SahmHoot 컴포넌트 상태 및 반응형 미리보기"
          src={canvasUrl.href}
          className="mx-auto block h-[75vh] min-h-[600px] border-0 bg-page"
          style={{ width: width === 'auto' ? '100%' : width }}
        />
      </div>
    </main>
  );
}
