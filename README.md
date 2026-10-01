# 삼훗(SahmHoot) — 프론트엔드

수업 중 실시간 소통 서비스. 산학협력캡스톤디자인 I (2026-2), 팀 강육김권김.
점수·순위 없이 수강생 전체의 이해도를 실시간으로 확인하는 퀴즈·익명 채팅·이모지 반응 서비스입니다.

> 현재 초기 설정 단계입니다. 실행 방법은 프로젝트 뼈대가 올라온 뒤 추가됩니다.

## 기술 스택

| 항목 | 버전 |
|---|---|
| Node | 24 |
| React | 19 |
| 빌드 | Vite |
| 언어 | TypeScript |
| API 호출 | Axios |
| 스타일 | Tailwind CSS 4 |
| 라우팅 | React Router |
| 실시간 | @stomp/stompjs |

## 현재 범위

이번 Skeleton은 공통 Frontend 개발환경 구축만을 목적으로 합니다.

다음 기능은 아직 구현하지 않았습니다:

- 로그인, 회원가입 및 JWT 인증
- 교수/학생 Home 화면
- Room, QuestionSet, Quiz, Result 화면
- 실제 STOMP/WebSocket 연결
- Chat, Reaction 기능

각 기능은 담당자가 feature 브랜치에서 구현합니다.

## 로컬 설치 및 실행

### 필요 환경

- Node.js 24
- npm
- Backend (로컬 8080 포트)

### 1. Frontend 설치

```bash
npm install
```

### 2. Backend 실행 (별도 터미널)

Backend는 http://localhost:8080에서 실행 중이어야 합니다.

```bash
cd ../SahmHoot-backend
./gradlew bootRun
```

Backend 실행 확인:

```bash
curl http://localhost:8080/api/health
```

### 3. Frontend 개발 서버 실행

```bash
npm run dev
```

브라우저: http://localhost:5173

### 4. Build 검증

```bash
npm run build
```

## Vite Proxy 설정

로컬 개발 시 Vite Proxy를 통해 Backend와 통신합니다:

| 경로 | 대상 |
|---|---|
| `/api` | `http://localhost:8080` |
| `/ws` | `ws://localhost:8080` |

Frontend 코드는 `http://localhost:8080`을 직접 호출하지 않고 `/api`로 요청합니다.

## 개발 규칙

- **Component**: PascalCase
- **변수/함수**: camelCase
- **기능별 코드**: `features/{기능명}` 아래 관리
- **공통 코드**: `shared` 아래 관리
- **API 요청**: `shared/api/client`의 Axios 클라이언트 사용
- **페이지**: `pages` 디렉토리 관리
- **Secret**: `.env`에 넣고 `.gitignore` 처리
- **Push**: main/develop에 직접 push 금지, PR 필수

## 디렉토리 구조

```text
src/
├── app/              (앱 레벨 설정)
├── pages/            (페이지 컴포넌트)
├── features/         (기능별 코드)
│   ├── auth/
│   ├── user/
│   ├── room/
│   ├── quiz/
│   └── questionset/
├── shared/           (공통 코드)
│   ├── api/          (Axios 클라이언트)
│   ├── stomp/        (WebSocket 설정)
│   ├── components/   (공통 컴포넌트)
│   ├── hooks/        (공통 훅)
│   └── types/        (공통 타입)
├── App.tsx
└── main.tsx
```

## Backend 연동 확인

### Frontend Root 화면

http://localhost:5173에 접속하면 다음 화면이 표시됩니다:

```
SahmHoot Frontend
Backend Status: UP
```

또는 연결 실패 시:

```
SahmHoot Frontend
Backend Status: ERROR
```

### Network 확인

브라우저 개발자 도구 > Network 탭에서:

```
GET /api/health
Status: 200
Response: {"status":"UP"}
```

이 요청이 Vite Proxy를 통해 Backend로 전달되는지 확인합니다.

## 관련 링크

- 백엔드 레포: https://github.com/SahmHoot/SahmHoot-backend
- DB 레포: https://github.com/SahmHoot/db-schema
- 설계 문서(노션): https://app.notion.com/p/3e1136463d9381cc9790e16a2dd637bd
- 개발 환경·컨벤션: https://app.notion.com/p/3e4136463d938199a3e2f8cf7e4547d5
- 와이어프레임(Figma): https://www.figma.com/design/SUp5dpVNfMF96iK3Vd1nuv

## 협업 규칙

- 이슈는 백엔드 레포에 모읍니다. 프론트 PR에서는 `SahmHoot/SahmHoot-backend#번호`로 참조합니다.
- 브랜치: `main`(배포본) / `develop`(기본) / `feature/{이슈번호}-{영문}` / `fix/{이슈번호}-{영문}`
- 같은 이슈 작업은 두 레포에 같은 브랜치 이름을 씁니다.
- `main`·`develop` 직접 push 금지, PR 필수. 승인은 권장이고, 공통 영역 변경은 1명 확인 후 머지
- 커밋: `feat: 기능명 (#이슈번호)` (feat / fix / refactor / chore / docs)
- 자세한 규칙은 노션 07 개발 환경·컨벤션을 봅니다.
