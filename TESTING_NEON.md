> 현재는 개인 계정별 여행을 분리합니다. 회원가입·로그인·교차 계정 접근 차단은 [PERSONAL_ACCOUNTS.md](PERSONAL_ACCOUNTS.md)를 확인하세요. 아래는 기존 Neon 전환 시점의 검증 기록입니다.

> 현재 버전은 로컬 개발용으로 인증을 제거했습니다. 메인·API 직접 접근, 비밀 파일 차단, 기존 계산·트랜잭션을 포함해 자동 테스트 14개가 통과했습니다.

# Neon 연결 검증 결과

2026-10-28, 사용자 설정의 Neon production / neondb / public에 실제 연결해 검증했습니다. 연결 문자열·비밀번호는 출력하지 않았습니다.

## 실제 DB

- 네 테이블의 BIGINT GENERATED ALWAYS AS IDENTITY, 컬럼 타입, 외래 키를 읽기 전용 쿼리로 확인했습니다.
- 기존 테이블을 유지한 채 members.position, trips.legacy_id 및 중복 방지 인덱스를 추가했습니다. 기존 부담 금액은 다시 쓰지 않았습니다.
- 실제 Express API로 여행을 생성하고 trips·members 행을 직접 조회했습니다.
- 3인 식사 30,000원 + 2인 KTX 96,000원을 저장해 expenses 2행, expense_splits 5행을 확인했습니다. 총 부담액 58,000 / 58,000 / 10,000원과 정산을 확인했습니다.
- 참여자 이름 수정 후 ID·지출·부담 금액·송금 안내가 유지됨을 확인했습니다.
- 연결된 참여자 삭제 제한, 참여자 추가·삭제, 동시 수정 충돌 차단을 확인했습니다.
- 지출 금액·카테고리·부담자 수정과 분배금 갱신을 확인했습니다. 10,001원은 3,334 / 3,334 / 3,333원으로 저장됩니다.
- 새로운 서버 조회로 데이터 복원을 확인했습니다.
- 지출 삭제 시 expense_splits 삭제, 여행 삭제 시 해당 여행의 관련 행만 삭제됨을 확인했습니다.
- 기존 UUID 여행의 BIGINT ID 매핑, 카테고리 없는 지출의 기타 처리, 반복 가져오기 건너뛰기를 확인했습니다.
- 트랜잭션 도중 고의 오류를 발생시켜 INSERT가 롤백됨을 확인했습니다.
- 고유 이름의 QA 행만 정리했습니다. 테스트 전후 네 테이블의 원래 행 전체를 해시로 비교해 동일함을 확인했습니다. Identity 시퀀스는 정상적으로 증가하므로 테스트 후 ID에 빈 구간이 있을 수 있습니다. 시퀀스는 되돌리지 않았습니다.

## 실제 브라우저

별도 Edge 테스트 프로필에서 로컬 Express 서버와 실제 Neon을 연결했습니다. 사용자 브라우저 localStorage는 접근·변경하지 않았습니다.

- 여행 생성 → DB BIGINT ID 대시보드 이동
- 지출 등록·카테고리 저장 → 목록·정산 반영
- 92,000원 3인 분배: 30,667 / 30,667 / 30,666원
- 기존 수정 모달·참여자 이름 변경·연결된 참여자 삭제 차단
- 지출 수정·삭제, 여행 삭제 및 새로고침 후 재조회
- 기존 브라우저 여행 가져오기 취소/확인과 localStorage 원본 유지
- Neon 연결 오류 응답을 모의해 오류 안내와 다시 불러오기 확인
- 390px 모바일 / 1280px 데스크톱 가로 넘침 및 기존 카드·컬러·카테고리 선택창 확인. 캡처를 직접 확인했습니다.
- 브라우저 테스트에서 생성한 QA 행도 삭제하고 원래 여행 목록이 동일함을 확인했습니다.

## 로컬 자동 검사

`npm.cmd test`: 총 14개 통과. 기존 계산·저장 호환성·여행 관리에 쓰기 요청 방어, 비밀 파일 차단, 오류 원문 비공개, 트랜잭션 롤백, DB 저장 분배금 보존 검사를 추가했습니다.

`npm.cmd run build` 및 변경 JavaScript의 구문 검사 통과. 빌드는 브라우저 자산만 public으로 복사합니다.

## 아직 검증하지 않은 항목

GitHub 연결과 실제 Vercel 배포는 이번 작업에서 실행하지 않았습니다. Vercel 프로젝트에 환경변수를 등록한 후 배포 URL의 HTTPS·CRUD 확인이 필요합니다. 설정 방법은 NEON_SETUP.md에 있습니다.

## 주요 변경 파일

- `server.js`, `server/database.js`, `server/store.js`, `server/errors.js`: Express API, TLS 연결, 검증·트랜잭션·안전한 SQL
- `js/api-storage.js`: Neon API 저장소 및 확인 후 localStorage 가져오기
- `js/app.js`, `js/trip-management.js`: 기존 UI를 비동기 API에 연결
- `js/calculations.js`: DB의 share_amount를 정산에 사용, 신규 분배 알고리즘 유지
- `index.html`: 저장 위치 안내 문구만 수정. styles.css는 변경하지 않음
- `migrations/001-preserve-order-and-import.sql`: 비파괴 추가 컬럼·인덱스
- `scripts/build.mjs`, `scripts/database.mjs`: 배포 자산·DB 검사·로컬 환경변수 안내
- `package.json`, `package-lock.json`, `vercel.json`, `.gitignore`, `.env.example`: 실행·배포 구성과 비밀 파일 제외
- `tests/server.test.js`, `scripts/qa-neon.mjs`, `scripts/qa-browser-neon.mjs`: 자동 및 실제 DB·브라우저 검증
- `README.md`, `NEON_SETUP.md`, `TESTING_NEON.md`: 실행·설정·검증 문서
