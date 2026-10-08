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

## 교수 화면 미리보기

`feat/professor-dashboard` 브랜치의 교수 화면은 개발 서버에서
`http://localhost:5173/professor`로 확인할 수 있습니다.
기본 주소 `http://localhost:5173/`로 접속해도 교수 홈으로 이동합니다.

- `src/app/ProfessorRoutes.tsx`: 교수 화면 공통 레이아웃과 라우팅
- `src/app/ProfessorRoutes.css`: 공통 레이아웃, 본문 이동 링크, 저장 알림 스타일
- `src/features/professor/styles/professor-common.css`: 교수 화면 공통 색상·폰트·접근성 스타일
- `src/features/professor/screens/`: 홈, 수업 개설, 문제 세트 목록·편집, 수업 진행, 결과 화면
- `src/features/professor/components/`: 헤더, 채팅, 입장 코드, 학생 반응, 모달 등 재사용 UI
- `src/features/professor/hooks/useProfessorDashboard.ts`: 수업·채팅·퀴즈 상태와 타이머 관리
- `src/features/professor/dashboard-storage.ts`: 문제 세트 로컬 저장소 읽기와 검증

각 화면과 UI 컴포넌트는 같은 이름의 TSX와 CSS를 나란히 관리합니다.
TSX에서는 CSS 클래스와 화면 상태를 연결하고, 배치·색상·폰트·반응형 스타일은
해당 CSS에서 수정합니다. CSS의 `@apply`는 프로젝트의 Tailwind 스타일을 사용합니다.
공통 색상·폰트·접근성 스타일은 `src/features/professor/styles/professor-common.css`에 있습니다.

| Figma | 화면 파일 | 스타일 파일 |
|---|---|---|
| 03 | `screens/ProfessorHome.tsx` | `screens/ProfessorHome.css` |
| 04 | `screens/CreateRoom.tsx` | `screens/CreateRoom.css` |
| 05 | `screens/QuizSetList.tsx` | `screens/QuizSetList.css` |
| 06 | `screens/QuizSetEditor.tsx` | `screens/QuizSetEditor.css` |
| 07-a | `screens/ProfessorRoom.tsx` | `screens/ProfessorRoom.css` |
| 07-b | `components/QuizQuestion.tsx` | `components/QuizQuestion.css` |
| 07-c | `screens/QuizResults.tsx` | `screens/QuizResults.css` |

표의 경로는 `src/features/professor/` 아래 기준입니다.
`ProfessorRoom`은 대기·진행 상태에 맞춰 `QuizQuestion`을 표시합니다.
헤더·채팅·입장 코드·모달 등 공통 UI도 같은 방식으로 CSS 파일을 따로 둡니다.

- `/professor/create`: 수업 방 개설
- `/professor/sets`: 문제 세트 목록 및 편집
- `/professor/room`: 수업 대기, 채팅, 퀴즈 진행
- `/professor/room/results`: 퀴즈 종료 후 결과

Figma의 교수용 7개 화면을 바탕으로 만든 프론트엔드 프로토타입입니다.
문제 세트는 현재 브라우저의 로컬 저장소에 저장되고, 수업 및 채팅 상태는
새로고침하면 초기 예시 상태로 돌아갑니다. 입장 코드, QR, 접속 인원,
반응, 응답 통계는 디자인의 예시 데이터이며 인증, Room/Quiz API 및
STOMP 연결은 아직 연동하지 않았습니다.

퀴즈는 선택한 세트의 첫 문항부터 설정 시간 동안 진행하고, 문항 사이에
3초 대기 후 다음 문항으로 이동합니다. 마지막 문항이 끝나면 결과 화면을 엽니다.

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
