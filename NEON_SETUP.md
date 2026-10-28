> 개인별 여행 기록은 이제 간단 회원가입·로그인으로 분리됩니다. [PERSONAL_ACCOUNTS.md](PERSONAL_ACCOUNTS.md)를 먼저 확인하세요.

# TripSplit Neon 저장소 연결

기존 HTML/CSS/JavaScript와 Stitch 화면은 유지합니다. 이제 여행과 지출은 서버 API를 통해 Neon에 저장됩니다. localStorage는 확인 후 가져오기를 위한 읽기 용도로만 사용하며 자동 삭제·자동 업로드하지 않습니다.

## 환경변수와 로컬 실행

Node.js 22 이상을 사용합니다. 프로젝트 루트 `.env`에 다음 변수를 설정하세요. 실제 연결 문자열은 GitHub·채팅·프런트엔드 파일에 넣지 마세요.

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=verify-full
PORT=3000
```

Windows에서 파일명이 `.env.txt`가 되지 않도록 확장자를 확인하세요. 변수 이름은 `DATABASE_URL`입니다. `.env.local`도 지원하며 `.env`보다 우선합니다.

```powershell
npm.cmd install
npm.cmd run db:check
npm.cmd start
```

http://localhost:3000 에 접속하면 TripSplit 소개 화면이 열립니다. 간단 회원가입 후 본인의 여행을 저장할 수 있습니다. 로컬 서버는 127.0.0.1에 바인딩합니다.

3000 포트를 예전 정적 서버가 사용하고 있다면 VS Code 터미널에서 해당 서버를 Ctrl+C로 종료한 뒤 새 서버를 실행하세요. 임시로 `PORT=3001`을 사용해도 됩니다. Live Server 또는 `file://`로 열면 서버 API를 사용할 수 없으므로 반드시 Node 서버 주소로 접속하세요.

## 기존 스키마 보존

실제 Neon에서 네 테이블의 BIGINT GENERATED ALWAYS AS IDENTITY와 외래 키를 확인했습니다. ID는 DB가 생성하며 JavaScript에서 큰 ID가 반올림되지 않도록 문자열로 전달합니다.

추가한 컬럼은 다음 두 개입니다. 기존 테이블·행·ID·지출 부담 금액은 삭제하거나 재생성하지 않았습니다.

- `members.position INTEGER`: 참여자 등록 순서를 저장하여 1원 나머지를 일관되게 배분합니다. 기존 참여자의 순서는 ID 순으로 초기화합니다. 이미 저장된 지출의 `share_amount`는 그대로 정산에 사용합니다.
- `trips.legacy_id TEXT`와 고유 인덱스: 기존 브라우저 여행 ID를 기록하여 동일 여행의 반복 가져오기를 건너뜁니다. 새 여행은 이 값이 NULL입니다.

다른 Neon 브랜치나 새 환경에서 같은 부가 설정이 필요하면 `npm.cmd run db:prepare`를 한 번 실행하세요. SQL은 `migrations/001-preserve-order-and-import.sql`에 있으며 재실행해도 기존 설정을 덮어쓰지 않습니다. 웹 요청 중 임의로 테이블을 생성하거나 스키마를 수정하지 않습니다.

금액은 기존 INTEGER 컬럼에 맞춰 지출당 1~2,147,483,647원 정수로 제한합니다. DB 조회 시 부담 금액의 합계도 검증합니다.

## API

쓰기 요청은 `X-Requested-With: TripSplit` 헤더가 필요하며, 외부 출처 CORS는 허용하지 않습니다. 변경·삭제 요청은 조회된 여행의 `revision`을 `If-Match` 헤더로 보내 동시 수정 충돌을 감지합니다.

| 경로 | 역할 |
| --- | --- |
| `GET /api/trips` | 여행·참여자·지출·저장된 부담 금액 조회 |
| `POST /api/trips` | 여행과 참여자 생성, DB ID 반환 |
| `PUT /api/trips/:id` | 여행 기본 정보·참여자 수정, 연결된 참여자 삭제 차단 |
| `DELETE /api/trips/:id` | 부담 금액 → 지출 → 참여자 → 여행 순서로 삭제 |
| `POST /api/trips/:id/expenses` | 지출과 계산된 expense_splits 저장 |
| `PUT /api/trips/:id/expenses/:expenseId` | 지출 ID 유지, 부담 금액 전체 재계산·갱신 |
| `DELETE /api/trips/:id/expenses/:expenseId` | 대상 지출과 부담 금액 삭제 |
| `POST /api/import` | 확인한 localStorage 여행 묶음 가져오기, 기존 가져오기 ID 건너뛰기 |

여러 테이블의 변경은 같은 PostgreSQL 연결의 BEGIN/COMMIT/ROLLBACK으로 처리합니다. 수정 시 여행 행을 잠그고 revision을 확인합니다. 모든 사용자 값은 `$1` 등의 파라미터로 바인딩합니다. DB 연결 문자열과 드라이버 오류 원문은 로그·응답으로 내보내지 않습니다.

## 기존 브라우저 데이터 가져오기

1. 기존 여행이 저장된 **같은 브라우저·같은 출처(호스트와 포트)**에서 새 Node 앱을 엽니다. `localhost`와 `127.0.0.1`, 서로 다른 포트는 저장소가 다릅니다.
2. 내 여행 목록에서 **기존 브라우저 여행 가져오기**를 누릅니다.
3. 개수와 보존 안내를 읽고 확인하면 업로드됩니다. 취소하면 DB를 변경하지 않습니다.
4. 동일한 원본 여행 ID는 다시 올리지 않습니다. 이미 가져온 여행은 건너뛰며 DB 내용을 덮어쓰지 않습니다. 원본 localStorage도 유지합니다.

기존 브라우저 여행 ID와 참여자·지출 ID는 Neon의 새 BIGINT ID로 연결 변환합니다. 모든 가져오기는 하나의 트랜잭션이므로 실패 시 일부 여행만 저장되지 않습니다. 가져온 뒤에는 Neon을 원본으로 사용하세요. 가져오기는 양방향 동기화가 아닙니다.

## 배포

1. GitHub에 커밋하기 전에 `.env`, `.env.local`, `node_modules`, `.qa-browser`가 추적되지 않는지 확인합니다. `.gitignore`에 제외 규칙이 있습니다.
2. Vercel에서 GitHub 저장소를 Import하고 **Express** 프로젝트로 설정합니다. `vercel.json`과 `npm run build`가 브라우저 파일만 `public/`으로 복사합니다. 서버 파일·환경변수·SQL은 이 폴더에 복사하지 않습니다.
3. Vercel Settings → Environment Variables에 `DATABASE_URL`을 등록합니다. Preview에는 별도 Neon 브랜치를 권장합니다. PORT는 Vercel에서 필요하지 않습니다.
4. 공개 배포 전에 데이터 보호를 위한 접근 제어를 먼저 설정하세요. 현재는 개인 계정 인증과 소유자 검사를 적용합니다.

소개 페이지는 공개하고 여행 API는 개인 계정으로 보호합니다. Vercel 등에 공개 배포하기 전에는 API 조회·수정·삭제를 보호하는 접근 제어가 필요합니다.

참고: [Vercel Express 배포](https://vercel.com/docs/frameworks/backend/express), [node-postgres 트랜잭션](https://node-postgres.com/features/transactions), [Neon 연결](https://neon.com/docs/get-started-with-neon/connect-neon).

## 검증

`npm.cmd test`는 네트워크 없이 계산·저장 호환성·오류·트랜잭션 동작을 확인합니다. 상세 실제 DB/브라우저 결과는 `TESTING_NEON.md`를 확인하세요.

실제 DB 검증 스크립트는 `scripts/qa-neon.mjs`이며 고유 QA 이름의 여행만 만들고 finally에서 해당 여행을 정리합니다. 실제 데이터가 있는 DB에서 무심코 실행하지 말고 검증 목적으로만 사용하세요. 과거 `tests/browser.mjs`, `categories-browser.mjs`, `management-browser.mjs`는 localStorage 버전용이며 Neon 통합 검증에는 사용하지 않습니다.
