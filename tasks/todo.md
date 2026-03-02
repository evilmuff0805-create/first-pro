# Audio-to-Text 웹앱 — 개발 작업 추적

## 수락 기준
- 로그인: 가족 공용 비밀번호로 접속, 쿠키 기반 세션 유지
- 업로드: 오디오/영상 200MB까지 업로드 가능
- STT: Groq Whisper API로 텍스트 변환 (한국어/영어/다국어)
- 교정: hanspell(다음+부산대)로 맞춤법 자동 교정
- 결과: 원본 vs 교정 비교, 복사/다운로드
- 배포: Railway $5/월, API 비용 $0

---

## Day 1: 인프라 + 인증

- [x] 의존성 설치 (multer, dotenv, fluent-ffmpeg, cookie-parser, uuid, groq-sdk, hanspell) + openai 제거
- [x] .env 생성, .gitignore 업데이트
- [x] 루트 중복 파일 삭제 (index.html, app.js, style.css)
- [x] server.js 재작성 (인증 미들웨어 + 기본 라우팅)
- [x] 로그인 UI (public/index.html + style.css)
- [x] 로그인 프론트엔드 로직 (public/app.js)
- [x] 검증: 서버 실행 + 로그인/로그아웃 동작 확인

### Day 1 검증 결과
- 서버 기동: OK (port 3000)
- auth-check 쿠키 없이: 401 OK
- 틀린 비밀번호: 401 OK
- 올바른 비밀번호: 200 + 쿠키 세팅 OK
- 쿠키 인증: 200 OK
- 정적 HTML 서빙: 200 OK

## Day 2: STT + 교정

- [x] ffmpeg 설치 (로컬: apt-get, Railway: nixpacks.toml)
- [x] 파일 업로드 API (multer v2 + disk storage, 200MB)
- [x] ffmpeg 오디오 추출 (video → mp3 64kbps mono)
- [x] 오디오 청크 분할 (25MB 초과 시 10분 단위)
- [x] Groq Whisper STT 호출 (`whisper-large-v3-turbo`) + 텍스트 병합
- [x] hanspell 교정 (DAUM 맞춤법 검사, Promise 래퍼)
- [x] /api/process 통합 파이프라인 (업로드→추출→STT→교정→응답)
- [x] 업로드 UI (드래그앤드롭 — Day 1에서 구현)
- [x] diff 비교 로직 + 결과 UI (Day 1에서 구현)

### Day 2 검증 결과
- hanspell DAUM: "잘모르겠습니다"→"잘 모르겠습니다", "띄어 쓰기도"→"띄어쓰기도" OK
- /api/process 인증 없이: 401 OK
- /api/process 파일 없이: 400 OK
- /api/process 파일 있음: 파이프라인 실행됨 (Groq API 키 플레이스홀더라 연결 실패, 실제 키로 교체 시 정상 작동 예상)
- ffmpeg 영상→오디오 추출: OK (ffprobe + libmp3lame)
- 임시 파일 정리: try/finally로 보장

## Day 3: 완성도 + 배포

- [ ] 텍스트 복사/다운로드 기능
- [ ] 변환 이력 (localStorage)
- [ ] 에러 처리 UX
- [ ] Railway 배포 설정
- [ ] 최종 검증

---

## Working Notes
- hanspell: 콜백 기반 → Promise 래퍼 필요, 1000자/요청 제한
- Groq Whisper: 25MB/요청, 28800초/일 무료
- Railway: 임시 파일은 ephemeral, ffmpeg nixpacks 필요
