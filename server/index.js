const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { default: OpenAI, toFile } = require('openai');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─── Multer 설정 ─────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (Whisper 최대)
  fileFilter: (_req, file, cb) => {
    if (/\.(mp3|wav|m4a|webm)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. (mp3, wav, m4a, webm 지원)'));
    }
  },
});

// ─── OpenAI 클라이언트 ────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── 영어 맞춤법 검사기 (서버 시작 시 1회 로딩) ──────────────────────────────
let englishSpeller = null;
require('dictionary-en')((err, dict) => {
  if (err) {
    console.warn('영어 사전 로딩 실패:', err.message);
    return;
  }
  const nspell = require('nspell');
  englishSpeller = nspell(dict);
  console.log('영어 맞춤법 검사기 로딩 완료');
});

// ─── 텍스트 처리: 문장부호로 문장 분리 → 줄바꿈 구분, 한글·영어·숫자 보존 ──
function filterText(text) {
  return text
    .split(/[.!?。！？…]+\s*/)          // 문장 끝 부호 기준으로 분리 (부호 제거)
    .map((s) =>
      s
        .replace(/[^\uAC00-\uD7A3\u3131-\u314E\u314F-\u3163a-zA-Z0-9\s]/g, ' ') // 나머지 특수문자 제거
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s.length > 0)
    .join('\n');                         // 문장 사이를 줄바꿈으로 연결
}

// ─── SRT 세그먼트용 필터: 문장 분리 없이 특수문자만 제거 ──────────────────
function filterSegmentText(text) {
  return text
    .replace(/[^\uAC00-\uD7A3\u3131-\u314E\u314F-\u3163a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── 한글 맞춤법 검사 (네이버 한스펠) ────────────────────────────────────────
function koreanSpellCheck(text) {
  return new Promise((resolve) => {
    try {
      const { spellCheckByNaver } = require('hanspell');
      const corrections = [];
      const timer = setTimeout(() => resolve(text), 9000);

      spellCheckByNaver(
        text,
        7000,
        (data) => corrections.push(...data),
        () => {
          clearTimeout(timer);
          let corrected = text;
          corrections.forEach(({ token, suggestions }) => {
            if (suggestions && suggestions.length > 0) {
              // 단어 단위로만 교체 (부분 문자열 교체 방지)
              const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              corrected = corrected.replace(new RegExp(escaped, 'g'), suggestions[0]);
            }
          });
          resolve(corrected);
        },
        () => {
          clearTimeout(timer);
          resolve(text);
        }
      );
    } catch (e) {
      console.warn('한글 맞춤법 검사 오류:', e.message);
      resolve(text);
    }
  });
}

// ─── 영어 맞춤법 검사 (nspell) ───────────────────────────────────────────────
function englishSpellCheck(text) {
  if (!englishSpeller) return text;
  try {
    // 공백 포함 토큰 단위로 분리해 처리
    const tokens = text.split(/(\s+)/);
    const corrected = tokens.map((token) => {
      if (/^\s+$/.test(token)) return token;
      // 영문만 포함된 부분 추출
      const letters = token.replace(/[^a-zA-Z]/g, '');
      if (!letters || letters.length < 2) return token;
      if (englishSpeller.correct(letters)) return token;
      const suggestions = englishSpeller.suggest(letters);
      if (suggestions.length > 0) {
        return token.replace(letters, suggestions[0]);
      }
      return token;
    });
    return corrected.join('');
  } catch (e) {
    console.warn('영어 맞춤법 검사 오류:', e.message);
    return text;
  }
}

// ─── 긴 세그먼트 분할 ────────────────────────────────────────────────────────
function splitLongSegment(text, maxChars) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let splitIndex = -1;

    for (let j = Math.min(maxChars, remaining.length) - 1; j >= maxChars * 0.4; j--) {
      if ('.!?,。！？，'.includes(remaining[j])) {
        splitIndex = j + 1;
        break;
      }
    }

    if (splitIndex === -1) {
      for (let j = Math.min(maxChars, remaining.length) - 1; j >= maxChars * 0.3; j--) {
        if (remaining[j] === ' ') {
          splitIndex = j + 1;
          break;
        }
      }
    }

    if (splitIndex === -1) {
      splitIndex = maxChars;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

function rebalanceSegments(segments) {
  const MAX_CHARS = 30;
  const MIN_CHARS = 5;
  const result = [];

  for (let i = 0; i < segments.length; i++) {
    let seg = { ...segments[i] };

    if (seg.text.length < MIN_CHARS && i + 1 < segments.length) {
      const next = segments[i + 1];
      segments[i + 1] = {
        start: seg.start,
        end: next.end,
        text: seg.text + ' ' + next.text,
      };
      continue;
    }

    if (seg.text.length > MAX_CHARS) {
      const chunks = splitLongSegment(seg.text, MAX_CHARS);
      const totalDuration = seg.end - seg.start;
      const totalChars = seg.text.length;

      let currentStart = seg.start;
      for (const chunk of chunks) {
        const chunkDuration = (chunk.length / totalChars) * totalDuration;
        result.push({
          start: currentStart,
          end: currentStart + chunkDuration,
          text: chunk.trim(),
        });
        currentStart += chunkDuration;
      }
      continue;
    }

    result.push(seg);
  }

  return result.filter(seg => seg.text.trim().length > 0);
}

// ─── 메인 API: POST /api/transcribe ──────────────────────────────────────────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '오디오 파일을 선택해주세요.' });
  }

  try {
    // 1단계: Whisper API 로 음성 → 텍스트
    const audioFile = await toFile(req.file.buffer, req.file.originalname, {
      type: req.file.mimetype,
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
    });

    let text = transcription.text;

    // 2단계: 한글 맞춤법 검사 (문장부호 있는 상태에서 교정이 더 정확)
    text = await koreanSpellCheck(text);

    // 3단계: 영어 맞춤법 검사
    text = englishSpellCheck(text);

    // 4단계: 한글·영어·숫자 외 문자 제거 + 문장부호 제거
    text = filterText(text);

    // 5단계: SRT 세그먼트 처리 (타임스탬프 보존, 영어 맞춤법 + 문자 필터만 적용)
    const rawSegments = (transcription.segments || [])
      .map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: filterSegmentText(englishSpellCheck(seg.text)),
      }))
      .filter((seg) => seg.text.length > 0);

    const segments = rebalanceSegments(rawSegments);

    res.json({ text, segments });
  } catch (error) {
    console.error('변환 오류:', error);
    res.status(500).json({ error: error.message || '변환 중 오류가 발생했습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
