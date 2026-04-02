/**
 * STT 파이프라인 통합 테스트
 * 1. OpenAI TTS로 테스트 오디오 생성
 * 2. /api/transcribe 엔드포인트 호출
 * 3. 결과 검증 (필터링, 맞춤법 검사)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { default: OpenAI, toFile } = require('openai');
const fs = require('fs');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERVER = 'http://localhost:5001';
const AUDIO_PATH = path.join(__dirname, '_test_audio.mp3');

// 한글+영어+문장부호 혼합 텍스트 (전처리 후 확인용)
const TEST_TEXT =
  '안녕하세요! 오늘 날씨가 정말 맑고 좋네요. 이것은 맞춤법 테스트입니다. ' +
  'Hello, world! This is a simple test. How are you today? ' +
  '감사합니다. 즐거운 하루 보내세요!';

// ANSI 색상
const c = {
  reset: '\x1b[0m',
  bold:  '\x1b[1m',
  green: '\x1b[32m',
  red:   '\x1b[31m',
  cyan:  '\x1b[36m',
  yellow:'\x1b[33m',
  gray:  '\x1b[90m',
};

function ok(msg)   { console.log(`${c.green}  ✓${c.reset} ${msg}`); }
function fail(msg) { console.log(`${c.red}  ✗${c.reset} ${msg}`); }
function info(msg) { console.log(`${c.cyan}  ●${c.reset} ${msg}`); }
function sep()     { console.log(`${c.gray}${'─'.repeat(60)}${c.reset}`); }

// ── 1. TTS로 테스트 오디오 생성 ─────────────────────────────────
async function createTestAudio() {
  info('OpenAI TTS로 테스트 오디오 생성 중...');
  info(`텍스트: "${TEST_TEXT}"`);

  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: TEST_TEXT,
    response_format: 'mp3',
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(AUDIO_PATH, buffer);

  const sizeKB = (buffer.length / 1024).toFixed(1);
  ok(`오디오 생성 완료: _test_audio.mp3 (${sizeKB} KB)`);
  return buffer;
}

// ── 2. 서버 /api/transcribe 호출 ─────────────────────────────────
async function callTranscribeAPI(audioBuffer) {
  info('서버 /api/transcribe 호출 중...');

  const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const formData = new FormData();
  formData.append('audio', blob, '_test_audio.mp3');

  const start = Date.now();
  const response = await fetch(`${SERVER}/api/transcribe`, {
    method: 'POST',
    body: formData,
  });
  const elapsed = Date.now() - start;

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API 오류 (${response.status}): ${data.error}`);
  }

  ok(`응답 수신 완료 (${elapsed}ms)`);
  return data.text;
}

// ── 3. 결과 검증 ─────────────────────────────────────────────────
function verifyResult(text) {
  const checks = [
    {
      name: '문장부호 제거 (., !, ?, ,)',
      pass: !/[.,!?;:'"()\-…]/.test(text),
      detail: () => `발견된 문장부호: ${text.match(/[.,!?;:'"()\-…]/g)?.join(' ')}`,
    },
    {
      name: '한글 보존',
      pass: /[\uAC00-\uD7A3]/.test(text),
      detail: () => '한글이 없음',
    },
    {
      name: '영어 보존',
      pass: /[a-zA-Z]/.test(text),
      detail: () => '영어가 없음',
    },
    {
      name: '다른 언어/특수문자 없음',
      pass: !/[^\uAC00-\uD7A3\u3131-\u314E\u314F-\u3163a-zA-Z0-9\s]/.test(text),
      detail: () => `이상 문자: ${text.match(/[^\uAC00-\uD7A3\u3131-\u314E\u314F-\u3163a-zA-Z0-9\s]/g)?.join(' ')}`,
    },
    {
      name: '텍스트 비어있지 않음',
      pass: text.trim().length > 0,
      detail: () => '결과 텍스트가 비어있음',
    },
  ];

  let allPass = true;
  for (const check of checks) {
    if (check.pass) {
      ok(check.name);
    } else {
      fail(`${check.name} → ${check.detail()}`);
      allPass = false;
    }
  }
  return allPass;
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${c.bold}${c.cyan}STT 파이프라인 통합 테스트${c.reset}\n`);

  // 서버 헬스 체크
  sep();
  console.log(`${c.bold}[1/3] 서버 연결 확인${c.reset}`);
  try {
    await fetch(SERVER);
    ok(`서버 응답 확인: ${SERVER}`);
  } catch {
    fail(`서버에 연결할 수 없습니다: ${SERVER}`);
    fail('npm run dev:server 가 실행 중인지 확인하세요.');
    process.exit(1);
  }

  // TTS 오디오 생성
  sep();
  console.log(`${c.bold}[2/3] 테스트 오디오 생성 (OpenAI TTS)${c.reset}`);
  let audioBuffer;
  try {
    audioBuffer = await createTestAudio();
  } catch (e) {
    fail(`TTS 생성 실패: ${e.message}`);
    process.exit(1);
  }

  // 트랜스크립션 + 검증
  sep();
  console.log(`${c.bold}[3/3] 트랜스크립션 파이프라인 테스트${c.reset}`);
  let result;
  try {
    result = await callTranscribeAPI(audioBuffer);
  } catch (e) {
    fail(`API 호출 실패: ${e.message}`);
    process.exit(1);
  }

  sep();
  console.log(`${c.bold}결과 검증${c.reset}`);
  const passed = verifyResult(result);

  sep();
  console.log(`${c.bold}최종 변환 결과:${c.reset}`);
  console.log(`${c.yellow}  "${result}"${c.reset}`);
  console.log(`${c.gray}  글자 수: ${result.length}자${c.reset}\n`);

  // 임시 파일 삭제
  if (fs.existsSync(AUDIO_PATH)) {
    fs.unlinkSync(AUDIO_PATH);
    info('임시 오디오 파일 삭제 완료');
  }

  sep();
  if (passed) {
    console.log(`\n${c.bold}${c.green}✓ 모든 테스트 통과${c.reset}\n`);
  } else {
    console.log(`\n${c.bold}${c.red}✗ 일부 테스트 실패 — 위 항목 확인 필요${c.reset}\n`);
    process.exit(1);
  }
}

main().catch((e) => {
  fail(`예상치 못한 오류: ${e.message}`);
  process.exit(1);
});
