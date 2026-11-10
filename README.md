# 삼훗(SahmHoot) — 프론트엔드

수업 중 실시간 소통 서비스. 산학협력캡스톤디자인 I (2026-2), 팀 강육김권김.
점수·순위 없이 수강생 전체의 이해도를 실시간으로 확인하는 퀴즈·익명 채팅·이모지 반응 서비스입니다.

> 로그인·회원가입, 교수 및 학생 화면은 Figma 와이어프레임을 바탕으로 구현되어 있습니다. 로그인·회원가입은 백엔드 인증 API에 연결되어 있고, 수업 화면은 아직 예시 데이터로 동작하며 수업 API·실시간 서버 연결은 별도 연동이 필요합니다.

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

공통 개발환경, 로그인·회원가입, 교수 화면 및 학생 화면(08-a, 08-b, 09-a, 09-b, 09-c, 10)을 구현했습니다.

- 로그인·회원가입 입력 화면과 비밀번호 입력 UX
- 로그인·회원가입 API 연동, JWT 토큰 저장·요청 헤더 첨부·401 처리·로그아웃·로그인 후 원래 주소 복귀
- 교수 수업 개설, 문제 세트 편집, 퀴즈 진행 및 결과 화면
- 코드/QR 입장, 닉네임 변경, 대기 화면과 채팅 입력
- 답 선택/변경, 수동·자동 제출, 정답 표시와 문항별 결과
- 문제 모음집 복습 및 브라우저에 답안 저장
- 화면별 TSX/CSS 분리, 공통 컴포넌트와 수업 상태 훅 분리

다음 기능은 아직 구현하지 않았습니다:

- 실제 수업 입장·문제·답안·결과 API 연동
- 실제 STOMP/WebSocket 연결
- 다른 사용자와 채팅·이모지 반응 공유

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

### 공통 화면 경로

기본 주소 `/`는 로그인 상태이면 역할별 홈(`/professor` 또는 `/student`)으로, 아니면 로그인 화면으로 이동합니다. `/professor/*`는 교수 계정으로 로그인해야 열립니다. `/student/*`와 `/join/*`은 역할과 관계없이 로그인하면 열립니다(교수도 다른 교수의 수업에 QR로 참여할 수 있음, ACC-06). 로그인하지 않고 접속하면 로그인 후 그 주소로 돌아옵니다.

| 주소 | 화면 |
|---|---|
| `/` 또는 `/login` | 로그인 |
| `/signup` | 회원가입 |
| `/professor` | 교수 홈 |
| `/student` | 학생 수업 입장 |
| `/join/482193` | 교수 화면에 표시되는 QR 입장 주소 |
| `/health` | 백엔드 상태 확인 |

`App.tsx`는 공통 경로를 관리하고, `ProfessorRoutes`와 `StudentRoutes`는 각 영역의 하위 경로를 관리합니다. 잘못된 학생 경로는 `/student`, 그 밖의 알 수 없는 주소는 `/login`으로 이동합니다.

### 프론트 화면 이동 미리보기

`npm run dev`로 실행하면 로그인 화면에 **화면 미리보기 모드**가 표시됩니다.
이메일을 비워 두고 교수 또는 학생을 선택한 뒤 로그인 버튼을 누르면 계정 없이 해당 화면으로 이동합니다.
이메일을 입력하면 실제 계정으로 로그인합니다. 미리보기는 토큰을 저장하지 않으며, 이 이동 동작과 미리보기 안내는 배포 빌드에서 제외됩니다.

- 교수: 로그인 → 교수 홈 → 수업 개설 → 수업 대기 → 퀴즈 시작 → 결과 확인 → 결과 닫기 또는 수업 종료
- 학생: 로그인 → 코드 입력 → 수업 대기 → 답안 제출 → 결과 확인 → 이 문제 복습하기 → 복습 완료
- 교수·학생 홈의 계정 메뉴에서 로그아웃할 수 있습니다.
- 문제 세트의 취소 버튼은 수정 내용이 있으면 확인 창을 표시합니다. 수업 개설 화면에서도 취소 또는 교수 홈으로 돌아갈 수 있습니다.
- 학생 수업의 나가기 버튼과 홈 로고는 나가기 확인 창을 표시합니다. 교수 고정 공지는 같은 수업의 대기·진행·결과 화면 사이에서 유지됩니다.

배포 빌드에는 미리보기가 없고 실제 계정으로만 로그인합니다.

### 로그인과 토큰

- 로그인 토큰은 **로그인 상태 유지**(기본 체크)를 그대로 두면 localStorage(14일 유지), 체크를 해제하면 sessionStorage(탭을 닫으면 로그아웃)에 저장합니다. 체크를 해제한 로그인은 다른 탭이 쓰는 localStorage 토큰을 바꾸지 않습니다.
- `shared/api/client.ts`의 `apiClient`가 모든 요청에 `Authorization: Bearer` 헤더를 붙입니다. 기능 코드에서 따로 붙이지 않습니다.
- 토큰을 붙인 요청이 401 `UNAUTHORIZED`를 받으면 토큰을 지우고 로그인 화면으로 이동합니다. 로그인 실패(`INVALID_CREDENTIALS`)는 로그인 화면에 안내만 표시합니다.
- 저장된 토큰을 확인할 때(`/users/me`) 서버에 연결하지 못하면 로그아웃으로 처리하지 않습니다. 토큰과 현재 주소를 유지한 채 연결 안내와 **다시 시도** 버튼을 표시합니다.
- 로그인 사용자는 `features/auth/AuthProvider.tsx`의 `useAuth()`로 읽습니다.
- 로컬 확인용 계정: 백엔드를 `local` 프로파일과 `app.seed.enabled=true`로 실행하면 `professor@local.test`, `student1@local.test`(비밀번호 `Test1234!`)가 생성됩니다. 자세한 내용은 백엔드 README의 로컬 시드 데이터 항목을 따릅니다.

### 학생 화면 확인

학생 화면은 학생 계정으로 로그인하거나, 개발 서버의 화면 미리보기(학생)로 백엔드 없이 확인할 수 있습니다. 기본 주소는 `/student`입니다.

| 주소 | 화면 |
|---|---|
| `/student` 또는 `/student/join` | 입장 코드 입력과 복습 목록 |
| `/join/482193`, `/student/join/482193` 또는 `/student/join?code=482193` | QR 링크를 통한 입장 코드 자동 입력 |
| `/student/room/482193` | 수업 참여 (먼저 해당 코드로 입장 필요) |
| `/student/review/stack-queue` | 스택·큐 복습 |
| `/student/review/complexity` | 복잡도 복습 |
| `/health` | 기존 백엔드 상태 확인 |

현재는 숫자 6자리 코드로 예시 수업에 입장합니다. 실제 존재하는 수업인지 검증하는 기능은 API 연동 시 추가합니다. 김상윤 계정, 수업명, 접속 인원, 채팅 초기 메시지와 반 정답률은 모두 예시입니다.

수업 화면은 서버의 퀴즈 메시지를 따라 대기 → 문항 → 마감 후 3초 정답 확인 → 다음 문항 → 결과 → 대기 순서로 바뀝니다. 답은 고르는 즉시 제출되고 마감 전까지 바꿀 수 있습니다.

입장 닉네임은 현재 탭의 세션에 저장되며, 복습 답안은 로컬 브라우저에 저장됩니다. 퀴즈 도중 새로고침하면 서버 상태로 문항과 내 답을 복원합니다. 학생 코드는 `src/features/student`의 `screens`, `components`, `hooks`, `types`, `data`, `styles`에 나뉘어 있습니다.

### 4. Build 검증

```bash
npm run build
```

## 교수 화면 미리보기

`feat/professor-dashboard` 브랜치의 교수 화면은 개발 서버에서
`http://localhost:5173/professor`로 확인할 수 있습니다.
회원가입은 `/signup`, 교수 홈은 `/professor`에서 확인할 수 있습니다.
교수 계정으로 로그인하거나 화면 미리보기(교수)로 들어갑니다.

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

### Backend 상태 화면

http://localhost:5173/health에 접속하면 다음 화면이 표시됩니다:

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
- 브랜치: `main`(배포본) / `develop`(기본) / `feat/{이슈번호}-{영문}` / `fix/{이슈번호}-{영문}`
- 같은 이슈 작업은 두 레포에 같은 브랜치 이름을 씁니다.
- `main`·`develop` 직접 push 금지, PR 필수. 승인은 권장이고, 공통 영역 변경은 1명 확인 후 머지
- 커밋: `feat: 기능명 (#이슈번호)` (feat / fix / refactor / chore / docs)
- 자세한 규칙은 노션 07 개발 환경·컨벤션을 봅니다.
