# Lessons Learned

## 2026-03-02
- Naver 맞춤법 검사기는 공식 API 없음. passportKey 매일 변경 → 유지보수 불가. 다음+부산대(hanspell)가 안정적 대안.
- Whisper 로컬 실행은 Railway $5 플랜에서 RAM 부족. Groq 무료 API가 현실적.

## 2026-03-03
- multer v2에서 파일 크기 초과 시 미들웨어에서 에러를 던지므로, express 에러 핸들러가 아닌 래핑 함수로 잡아야 한다.
- Railway 배포 시 환경변수(GROQ_API_KEY, APP_PASSWORD, COOKIE_SECRET)는 대시보드에서 수동 설정 필요.
