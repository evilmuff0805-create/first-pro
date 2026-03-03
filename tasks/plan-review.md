# Audio-to-Text + 맞춤법 교정 웹앱 — 설계 검토 문서

> 작성일: 2026-03-02
> 상태: 승인됨

---

## 앱 목적

가족 내부용 비공개 앱. 오디오/영상 파일 업로드 → 텍스트 변환(STT) → 자동 맞춤법 교정 → 다운로드.
기존 Express.js 프로젝트(Storyboard Pro)를 완전히 새 앱으로 교체. Railway $5/월 배포.

---

## 1. 기술 스택 최종 선정

### STT 엔진: Groq Whisper API (무료)

| 항목 | 내용 |
|------|------|
| 선정 이유 | 완전 무료, 오픈소스 Whisper 기반, 이미 openai SDK 유사 방식 |
| 모델 | `whisper-large-v3-turbo` |
| 가격 | **$0** (무료 티어: 28,800초/일 = 480분/일) |
| 한국어 품질 | Whisper large-v3 수준 |
| 처리 속도 | 실시간 대비 ~40배 빠름 |
| 파일 제한 | 25MB per request → 서버에서 청크 분할 처리 |

**탈락 대안:**
- OpenAI Whisper API: $0.006/분 유료 (Groq와 동일 모델인데 비용 발생)
- Naver Clova: 별도 Naver Cloud 계정 필요, 추가 설정 복잡
- Whisper 로컬: Railway $5 플랜 RAM 부족 (medium=1.7GB, large=3GB)
- Hugging Face Inference: 느리고 불안정

### 맞춤법 교정: hanspell (다음 + 부산대 맞춤법 검사기) — 무료

| 항목 | 내용 |
|------|------|
| 선정 이유 | **완전 무료**, Node.js 직접 사용, 다음(Daum)+부산대(PNU) 이중 검사 |
| 패키지 | `hanspell` npm (v0.9.7) |
| 검사 엔진 | `spellCheckByDAUM()` + `spellCheckByPNU()` |
| 가격 | **$0** |
| 한국어 품질 | 띄어쓰기, 문법, 맞춤법 교정 가능 |
| 텍스트 제한 | ~300단어 또는 1000자/요청 (내장 청크 처리) |
| 월 비용 | **$0** |

**동작 방식:**
- 다음(Daum) 맞춤법 검사기와 부산대 맞춤법 검사기의 웹 서비스에 HTTP 요청
- 공식 API가 아닌 리버스 엔지니어링 기반 (py-hanspell과 동일 방식)
- 두 엔진 결과를 병합하여 더 정확한 교정 제공

**주의사항:**
- 패키지 최종 업데이트: ~3년 전 (안정적이나 유지보수 없음)
- 콜백 기반 API → Promise 래퍼 필요
- 요청 간 딜레이 권장 (100~500ms, 서비스 부하 방지)
- 대용량 텍스트는 자동 분할 처리됨 (1000자 단위)

**탈락 대안:**
- GPT-4o-mini: 품질 우수하나 유료 ($0.50~2.00/월) → 무료 운영 목표에 부적합
- py-hanspell (Naver): passportKey 매일 변경 → 매우 불안정, 유지보수 불가
- LanguageTool: 한국어 미지원
- Naver 맞춤법 검사기 직접 호출: 공식 API 없음, IP 차단 위험

### 대용량 파일 처리 전략

- 클라이언트: 200MB까지 파일 선택 허용
- 서버: `multer` + disk storage (메모리 아닌 디스크에 저장)
- Whisper 25MB 제한 해결: `ffmpeg`로 오디오 추출 후 청크 분할 → 각 청크 Groq 전송 → 결과 병합
- Railway: 임시 파일 → 처리 완료 후 즉시 삭제

---

## 2. 프로젝트 구조

```
first-pro/
├── server.js              ← 수정: 전체 백엔드 (인증, 업로드, STT, 교정 API)
├── package.json           ← 수정: 새 의존성 추가
├── .env                   ← 생성: 환경변수 (API 키, 비밀번호)
├── .gitignore             ← 수정: .env, uploads/ 추가
├── public/
│   ├── index.html         ← 교체: 새 UI (로그인 + 메인)
│   ├── app.js             ← 교체: 새 프론트엔드 로직
│   └── style.css          ← 교체: 새 스타일
├── uploads/               ← 생성: 임시 파일 저장 (gitignore)
├── tasks/
│   ├── plan-review.md     ← 이 파일
│   ├── todo.md            ← 작업 추적
│   └── lessons.md         ← 교훈 기록
├── CLAUDE.md
└── .claude/
```

**삭제 예정 (public/과 중복):**
- `/index.html` (루트)
- `/app.js` (루트)
- `/style.css` (루트)

---

## 3. 추가할 의존성

```json
{
  "multer": "^1.4.5-lts.1",
  "dotenv": "^16.4.0",
  "fluent-ffmpeg": "^2.1.3",
  "cookie-parser": "^1.4.7",
  "uuid": "^11.0.0",
  "groq-sdk": "^0.9.0",
  "hanspell": "^0.9.7"
}
```

**제거할 의존성:**
```json
{
  "openai": "^6.22.0"    // GPT-4o-mini 제거 → hanspell 무료 교정으로 대체
}
```

**시스템 의존성 (Railway nixpacks):**
- `ffmpeg` — 오디오 추출 및 분할에 필수

---

## 4. 백엔드 API 설계

### 인증 API
```
POST /api/login       { password }  → 쿠키 세트 (성공) / 401
GET  /api/auth-check               → 200 / 401
POST /api/logout                   → 쿠키 삭제
```
- 환경변수 `APP_PASSWORD`로 가족 공용 비밀번호 관리
- 서명된 쿠키로 세션 유지 (httpOnly, 7일 만료)

### STT API
```
POST /api/transcribe  multipart(audio, max 200MB)
                      → { transcription, language, duration }
```
처리: multer 저장 → ffmpeg 변환 → 청크 분할 → Groq Whisper → 병합 → 파일 삭제

### 교정 API
```
POST /api/correct     { text, language? }
                      → { original, corrected, changes[] }
```
처리 흐름:
1. 텍스트를 1000자 단위로 분할
2. hanspell `spellCheckByDAUM()` + `spellCheckByPNU()` 병렬 호출
3. 두 엔진 결과 병합 (다음 결과 우선, PNU로 보완)
4. 각 교정 항목: { token, suggestions, type(맞춤법/띄어쓰기/문법) }
5. 원본 텍스트에 교정 적용 → corrected 텍스트 생성
6. changes 배열: 변경 전/후 목록 반환

### 통합 파이프라인
```
POST /api/process     multipart(audio)
                      → { transcription, corrected, changes[], language, duration }
```

---

## 5. UI 설계

### 화면 1: 로그인
```
┌─────────────────────────────┐
│      Audio to Text          │
│   ┌───────────────────┐     │
│   │ 비밀번호 입력       │     │
│   └───────────────────┘     │
│   [ 로그인 ]                 │
└─────────────────────────────┘
```

### 화면 2: 메인
```
┌─────────────────────────────────────────┐
│  Audio to Text                [로그아웃] │
├─────────────────────────────────────────┤
│  ┌─── 파일 업로드 ─────────────────┐    │
│  │  오디오/영상 파일 끌어놓기       │    │
│  │  또는 클릭하여 선택 (최대 200MB)│    │
│  └──────────────────────────────────┘   │
│  [ 변환 시작 ]                           │
│                                         │
│  [████████░░░░] STT 변환 중... 52%      │
│                                         │
│  ┌── 원본 텍스트 ──┬── 교정 텍스트 ──┐  │
│  │ 정리 하겠습니다  │ 정리하겠습니다  │  │
│  └────────────────┴────────────────┘  │
│  변경사항: 3건                           │
│  • "정리 하겠습니다" → "정리하겠습니다"   │
│                                         │
│  [ 복사 ]  [ TXT 다운로드 ]              │
└─────────────────────────────────────────┘
```

**UI 특징:**
- 다크 테마 (기존 패턴 참고)
- 드래그 앤 드롭 업로드
- 진행률 표시
- 원본 vs 교정 diff 하이라이트
- 변환 이력 localStorage 저장

---

## 6. 인증 설계

```
공유 비밀번호 + 서명된 쿠키
1. 비밀번호 입력
2. POST /api/login → APP_PASSWORD와 비교
3. 성공 시 서명된 쿠키 설정 (httpOnly, 7일)
4. 이후 요청은 쿠키로 자동 인증
5. 로그아웃 시 쿠키 삭제
```

---

## 7. 200MB 파일 처리 흐름

```
[클라이언트]                    [서버]                     [Groq API]
    │                            │                             │
    │── POST /api/transcribe ──→ │                             │
    │   (200MB mp4)              │                             │
    │                            │── multer → /uploads/        │
    │                            │── ffmpeg: 오디오 추출        │
    │                            │   200MB mp4 → ~15MB mp3    │
    │                            │── 25MB 이하? → 직접 전송    │
    │                            │── 25MB 초과? → 청크 분할   │
    │                            │   (10분 단위)               │
    │                            │── 청크 1 ──────────────── →│
    │                            │←─ 텍스트 1 ─────────────── │
    │                            │── 청크 2 ──────────────── →│
    │                            │←─ 텍스트 2 ─────────────── │
    │                            │── 텍스트 병합               │
    │                            │── 임시 파일 삭제             │
    │←── { transcription } ────  │                             │
```

---

## 8. 환경변수

```
GROQ_API_KEY=gsk_...         # Groq Whisper STT (무료, groq.com)
APP_PASSWORD=...             # 가족 공용 비밀번호
COOKIE_SECRET=...            # 쿠키 서명 시크릿
PORT=3000
```
> OpenAI API 키 불필요 — 맞춤법 교정은 hanspell (다음+부산대) 무료 서비스 사용

---

## 9. 비용 분석 (월간)

| 항목 | 최소 (10시간/월) | 최대 (20시간/월) |
|------|:---:|:---:|
| Railway 호스팅 | $5.00 | $5.00 |
| Groq Whisper STT | **$0** | **$0** |
| hanspell 맞춤법 교정 | **$0** | **$0** |
| **합계** | **$5.00** | **$5.00** |

**API 비용 = $0!**
- Groq 무료 티어: 28,800초/일 = 480분/일 → 사실상 무제한
- hanspell: 다음+부산대 무료 서비스
- OpenAI API 키 불필요 → 완전 무료 운영 (Railway 호스팅비만 발생)

---

## 10. MVP 개발 순서 (3일)

### Day 1: 인프라 + 인증
1. 의존성 설치 (multer, dotenv, fluent-ffmpeg, cookie-parser, uuid, groq-sdk, hanspell) + openai 제거
2. .env, .gitignore 정비
3. tasks/ 파일 생성
4. server.js 재작성 (인증 미들웨어, 기본 라우팅)
5. 로그인 API + UI 구현

### Day 2: STT + 교정
6. 파일 업로드 API (multer + disk storage)
7. ffmpeg 오디오 추출 로직
8. 청크 분할 로직 (25MB 제한 대응)
9. Groq Whisper 호출 + 텍스트 병합
10. 업로드 UI (드래그앤드롭, 진행률)
11. hanspell 교정 API (다음+부산대 이중 검사, Promise 래퍼)
12. diff 비교 로직 + 결과 UI

### Day 3: 완성도 + 배포
13. 복사/다운로드 기능
14. 변환 이력 (localStorage)
15. 에러 처리 UX
16. Railway 배포 설정 (ffmpeg nixpacks)
17. 테스트 및 검증

### 향후 확장
- 실시간 진행률 (SSE)
- Naver Clova STT 옵션
- 다국어 UI

---

## 11. 검증 체크리스트

- [ ] `node server.js` → http://localhost:3000 접속
- [ ] 비밀번호 로그인/로그아웃 동작
- [ ] 1MB 오디오 파일 업로드 + 텍스트 변환
- [ ] 50MB, 200MB 대용량 파일 처리
- [ ] 한국어/영어 STT 정확도 확인
- [ ] 의도적 오타 텍스트로 교정 품질 확인
- [ ] TXT 다운로드 동작
- [ ] Railway 배포 → ffmpeg 설치 확인
- [ ] 인증 없이 API 접근 차단 확인
