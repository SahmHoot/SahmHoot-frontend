# 삼훗(SahmHoot) — 프론트엔드

수업 중 실시간 소통 서비스. 산학협력캡스톤디자인 I (2026-2), 팀 강육김권김.
점수·순위 없이 수강생 전체의 이해도를 실시간으로 확인하는 퀴즈·익명 채팅·이모지 반응 서비스입니다.

> 학생 화면은 Figma 와이어프레임을 바탕으로 구현되어 있습니다. 현재는 예시 데이터로 동작하며 인증·수업 API·실시간 서버 연결은 별도 연동이 필요합니다.

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

공통 개발환경과 학생 화면(08-a, 08-b, 09-a, 09-b, 09-c, 10)을 구현했습니다.

- 코드/QR 입장, 닉네임 변경, 대기 화면과 채팅 입력
- 답 선택/변경, 수동·자동 제출, 정답 표시와 문항별 결과
- 문제 모음집 복습 및 브라우저에 답안 저장
- 화면별 TSX/CSS 분리, 공통 컴포넌트와 수업 상태 훅 분리

다음 기능은 아직 구현하지 않았습니다:

- 로그인, 회원가입 및 JWT 인증
- 교수 화면 및 교수용 문제 모음집 편집
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

### 학생 화면 확인

학생 화면은 백엔드 없이도 확인할 수 있습니다. 기본 주소는 `/student`입니다.

| 주소 | 화면 |
|---|---|
| `/student` 또는 `/student/join` | 입장 코드 입력과 복습 목록 |
| `/student/join/482193` 또는 `/student/join?code=482193` | QR 링크를 통한 입장 코드 자동 입력 |
| `/student/room/482193` | 수업 참여 (먼저 해당 코드로 입장 필요) |
| `/student/review/stack-queue` | 스택·큐 복습 |
| `/student/review/complexity` | 복잡도 복습 |
| `/health` | 기존 백엔드 상태 확인 |

현재는 숫자 6자리 코드로 예시 수업에 입장합니다. 실제 존재하는 수업인지 검증하는 기능은 API 연동 시 추가합니다. 김상윤 계정, 수업명, 접속 인원, 채팅 초기 메시지와 반 정답률은 모두 예시입니다.

입장 후 12초 대기 → 문항별 15초 → 마감 1초 → 정답 표시 3초 → 다음 문항 → 결과 순서로 자동 진행됩니다. 수동 제출하면 답이 잠기며, 미선택 상태로 시간이 끝나면 미응답으로 처리됩니다. 실제 교수의 출제·마감 이벤트를 받는 동작은 아직 연결하지 않았습니다.

개발 서버에서는 수업 주소 뒤에 `?view=waiting`, `?view=question`, `?view=results`를 붙여 각 상태를 바로 확인할 수 있습니다. 이 미리보기는 배포 빌드에서는 적용되지 않습니다.

입장 닉네임은 현재 탭의 세션에 저장되며, 복습 답안은 로컬 브라우저에 저장됩니다. 퀴즈 도중 새로고침하면 진행 상태와 채팅은 초기화됩니다. 학생 코드는 `src/features/student`의 `screens`, `components`, `hooks`, `types`, `data`, `styles`에 나뉘어 있습니다.

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
- 브랜치: `main`(배포본) / `develop`(기본) / `feature/{이슈번호}-{영문}` / `fix/{이슈번호}-{영문}`
- 같은 이슈 작업은 두 레포에 같은 브랜치 이름을 씁니다.
- `main`·`develop` 직접 push 금지, PR 필수. 승인은 권장이고, 공통 영역 변경은 1명 확인 후 머지
- 커밋: `feat: 기능명 (#이슈번호)` (feat / fix / refactor / chore / docs)
- 자세한 규칙은 노션 07 개발 환경·컨벤션을 봅니다.
