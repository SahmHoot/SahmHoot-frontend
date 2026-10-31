# AGENTS.md — SahmHoot-frontend

삼훗은 교수와 학생이 같은 수업방에서 퀴즈를 풀고, 교수가 반 전체의 이해도를 확인하는 서비스다. **개인 점수·순위·성적은 만들지 않는다.** 이 저장소는 React 화면이다. 백엔드는 `SahmHoot-backend`, 로컬 DB는 `db-schema` 저장소에 있고, 세 저장소를 같은 부모 폴더에 나란히 둔다.

이 문서가 이 프로젝트의 기준이다. 외부 문서(노션 등)를 볼 수 없다고 가정하고 쓴다. 이 문서와 코드가 어긋나면 임의로 판단하지 말고 사용자에게 알린다.

## 환경 (이 버전에 맞춘다)

| 항목 | 값 | 기준 파일 |
|---|---|---|
| Node.js | 24 (`nvm use`) | `.nvmrc` |
| 패키지 매니저 | npm만 사용 (yarn·pnpm 금지) | `package-lock.json` |
| 스택 | React 19, TypeScript 5 (strict), Vite 6, Tailwind CSS 4, React Router 7, Axios, @stomp/stompjs 7 | `package.json` |
| 개발 서버 | 5173. `/api` → `localhost:8080`, `/ws` → `ws://localhost:8080` 프록시 | `vite.config.ts` |
| 형식 | UTF-8, LF, 들여쓰기 2칸 | `.editorconfig` |

## 명령

```bash
nvm use
npm ci                 # 잠금 파일 그대로 설치 (의존성을 추가하는 경우에만 npm install)
npm run dev            # http://localhost:5173 — 백엔드(8080)가 떠 있어야 API가 동작

npm run type-check
npm run lint
npm run build
```

- 로컬 개발에는 `.env`가 필요 없다. 백엔드 주소를 코드에 적지 말고 `/api`, `/ws` 상대 경로만 쓴다.
- 화면이 `ERROR`면 `curl http://localhost:8080/api/health`로 백엔드부터 확인한다.
- 자동 테스트 도구는 아직 없다. 검증은 위 3개 명령과 실제 화면 확인이다.

## 경계

### 항상 한다
- 작업을 끝내기 전에 `type-check`, `lint`, `build`를 실행하고, 실행하지 못했다면 못 했다고 말한다.
- 화면을 바꿨다면 백엔드와 함께 실행해 실제로 확인한다. 학생 화면은 모바일 폭 390px에서도 확인한다.
- 새 UI를 만들기 전에 `src/shared/components/`에 이미 있는지 찾는다.
- 수정하는 파일의 기존 스타일을 따른다.

### 먼저 사용자에게 확인한다
- 의존성 추가, `vite.config.ts`·ESLint·TypeScript 설정 변경
- API 요청·응답 타입이 백엔드 DTO와 다르게 보일 때
- JWT 토큰 보관·전송 방식 변경
- CI·배포 파일(`.github/workflows`, `deploy/`) 변경
- `src/shared/components/` 공통 컴포넌트의 모양·props 변경 (`ui-preview.html`에서도 확인)

### 절대 하지 않는다
- 컴포넌트에서 Axios 직접 호출. API 호출은 `features/*/api.ts` 또는 `shared/api`에서만 한다.
- 기능 코드에서 STOMP 클라이언트를 따로 만들기. `src/shared/stomp/` 모듈 하나만 쓴다.
- 백엔드 주소 하드코딩. `.env`, `.env.local` 커밋.
- 로그, PR 본문, 오류 출력에 비밀값을 남기는 일.
- `main`, `develop`에 직접 푸시.
- CSS 프레임워크·UI 라이브러리 추가. 스타일은 Tailwind와 `src/globals.css`로 한다.
- 요청받지 않은 리팩터링, 기능과 무관한 포맷 변경. (Prettier가 없어서 파일마다 세미콜론 스타일이 다르다.)

## 규칙

### 서버와 주고받는 규약
- 서버 데이터의 기준은 **백엔드 컨트롤러와 DTO**(`../SahmHoot-backend`)다. 타입과 필드 이름을 똑같이 맞추고, 없는 필드를 추측해서 만들지 않는다.
- **Figma 시안에는 옛 규칙이 남아 있다** (세트 단위 시간, `owner_id`, 방 삭제, 이메일 인증 테이블 등). Figma와 백엔드가 다르면 백엔드를 따르고 사용자에게 알린다.
- 오류 응답: `{ status, code, message, fieldErrors }`. `code`(예: `VALIDATION_FAILED`, `ROOM_CLOSED`)로 분기하고 `message` 문자열을 비교하지 않는다.
- 인증은 JWT.
- 실시간은 STOMP: 엔드포인트 `/ws`, 보낼 때 `/app/**`, 구독할 때 `/topic/**`·`/queue/**`, 개인 오류는 `/user/queue/errors`.

### 화면 동작
- 방 상태는 `OPEN/PLAYING/CLOSED`, 회차는 `READY/RUNNING/FINISHED/ABORTED`, 문항은 `READY/OPEN/CLOSED`다. 서버 값을 그대로 쓴다. `QUESTION`, `FEEDBACK`, `RESULT`, `ROOM_WAITING`은 프론트에서 파생한 화면 상태다.
- 답안은 **마감 전까지 바꿀 수 있다.** 제출했다고 선택지를 잠그지 않는다.
- 남은 시간은 **서버 시각 기준**이다. 브라우저 로컬 타이머만 믿지 않는다.
- 채팅 메시지는 1~300자다.
- 방 주인(교수)과 참가자(학생)는 화면이 다르다. 교수는 답안을 제출하지 않는다.

### 코드
- `src/main.tsx` 진입점, `src/App.tsx` 라우트, `src/pages/` 페이지, `src/features/{auth,user,room,questionset,quiz}/` 기능별 화면·훅·API, `src/shared/{api,stomp,components,hooks,types}/` 공통.
- 컴포넌트 파일·이름은 PascalCase(`RoomCard.tsx`), 훅은 `useXxx.ts`, 그 외는 camelCase.
- TypeScript strict다. `any`를 쓰지 않고 `noUnusedLocals` 위반을 남기지 않는다.

## Git·PR

- 브랜치: `develop`에서 `feat/{이슈번호}-{영문}` 또는 `fix/{이슈번호}-{영문}`. 백엔드와 같이 고칠 때는 두 저장소에서 같은 이름을 쓴다.
- 커밋 메시지: `type: 한국어 요약 (#이슈번호)`. type은 `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `style`.
- 이슈는 백엔드 저장소에 있다. PR 본문에 `close SahmHoot/SahmHoot-backend#번호`로 연결한다.
- PR은 400줄 이하를 목표로 하고, 화면이 바뀌면 스크린샷을 붙인다. `.github/pull_request_template.md`의 확인 표를 채운다.
- 머지는 GitHub의 "Create a merge commit"(일반 머지)으로 한다. Squash는 쓰지 않는다.

## 이 문서 관리

- 코드와 어긋난 줄은 그 변경을 하는 PR에서 같이 고친다.
- 같은 실수가 반복될 때만 규칙을 추가하고, 더 이상 맞지 않는 줄은 지운다.
