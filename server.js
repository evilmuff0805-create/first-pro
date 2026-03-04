require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const multer = require('multer');

const ffmpeg = require('fluent-ffmpeg');
const Groq = require('groq-sdk');
const { spellCheckByDAUM } = require('hanspell');

const app = express();

// ── Middleware ──
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'default-secret'));

// ── Auth helpers ──
const AUTH_COOKIE = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function makeToken(password) {
  return crypto.createHmac('sha256', process.env.COOKIE_SECRET || 'default-secret')
    .update(password)
    .digest('hex');
}

function requireAuth(req, res, next) {
  const token = req.signedCookies[AUTH_COOKIE];
  const expected = makeToken(process.env.APP_PASSWORD || 'changeme');
  if (token === expected) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth routes (no auth required) ──
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  if (password === (process.env.APP_PASSWORD || 'changeme')) {
    const token = makeToken(password);
    res.cookie(AUTH_COOKIE, token, {
      signed: true,
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/auth-check', (req, res) => {
  const token = req.signedCookies[AUTH_COOKIE];
  const expected = makeToken(process.env.APP_PASSWORD || 'changeme');
  if (token === expected) return res.json({ ok: true });
  return res.status(401).json({ error: 'Unauthorized' });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

// ── Multer setup (disk storage, 200MB limit) ──
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, crypto.randomUUID() + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
});

// ── Groq client ──
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Helper: ffmpeg extract audio → mp3 ──
function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate('64k')
      .audioChannels(1)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

// ── Helper: ffmpeg split audio into chunks ──
function splitAudio(inputPath, chunkDir, chunkSeconds = 600) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration || 0;
      const chunks = [];
      let start = 0;
      let idx = 0;

      function nextChunk() {
        if (start >= duration) return resolve(chunks);
        const outPath = path.join(chunkDir, `chunk_${idx}.mp3`);
        ffmpeg(inputPath)
          .setStartTime(start)
          .setDuration(Math.min(chunkSeconds, duration - start))
          .noVideo()
          .audioCodec('libmp3lame')
          .audioBitrate('64k')
          .audioChannels(1)
          .output(outPath)
          .on('end', () => {
            chunks.push(outPath);
            start += chunkSeconds;
            idx++;
            nextChunk();
          })
          .on('error', (e) => reject(e))
          .run();
      }
      nextChunk();
    });
  });
}

// ── Helper: Groq Whisper STT ──
async function transcribeFile(filePath) {
  const result = await groq.audio.transcriptions.create({
    model: 'whisper-large-v3-turbo',
    file: fs.createReadStream(filePath),
    response_format: 'verbose_json',
  });
  const segments = (result.segments || []).map(s => ({
    start: s.start,
    end: s.end,
    text: s.text || '',
  }));
  return { text: result.text || '', language: result.language || '', segments };
}

// ── Helper: hanspell Promise wrapper (DAUM) ──
function checkSpell(text) {
  if (!text || text.trim().length === 0) return Promise.resolve([]);
  return new Promise((resolve) => {
    const allTypos = [];
    spellCheckByDAUM(text, 10000,
      (typos) => allTypos.push(...typos),
      () => resolve(allTypos),
      () => resolve(allTypos), // on error, return what we have
    );
  });
}

// ── Helper: apply typos to text ──
function applyCorrections(text, typos) {
  let corrected = text;
  const changes = [];
  for (const t of typos) {
    if (t.suggestions && t.suggestions.length > 0 && t.token !== t.suggestions[0]) {
      const before = corrected;
      corrected = corrected.replace(t.token, t.suggestions[0]);
      if (corrected !== before) {
        changes.push({ original: t.token, corrected: t.suggestions[0] });
      }
    }
  }
  return { corrected, changes };
}

// ── Helper: remove Whisper hallucination artifacts ──
const HALLUCINATION_PATTERNS = [
  /한글\s*자막\s*(by|제작|제공).*/gi,
  /자막\s*(by|제작|제공|:).*/gi,
  /번역\s*및\s*자막.*/gi,
  /구독과?\s*좋아요.*/gi,
  /subscribe\s*(and|&)?\s*like.*/gi,
  /thanks?\s*for\s*watching.*/gi,
  /please\s*(subscribe|like).*/gi,
  /subtitles?\s*(by|made|created|provided).*/gi,
  /자막\s*@.*/gi,
  /영상\s*제작.*/gi,
  /MBC\s*뉴스.*/gi,
  /KBS\s*뉴스.*/gi,
  /SBS\s*뉴스.*/gi,
  /YTN\s*뉴스.*/gi,
];

function removeHallucinations(text) {
  let cleaned = text;
  for (const pat of HALLUCINATION_PATTERNS) {
    cleaned = cleaned.replace(pat, '');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function filterHallucinatedSegments(segments) {
  return segments.filter(seg => {
    const t = seg.text.trim();
    if (!t) return false;
    for (const pat of HALLUCINATION_PATTERNS) {
      pat.lastIndex = 0;
      if (pat.test(t) && t.replace(pat, '').trim().length === 0) return false;
    }
    return true;
  }).map(seg => ({
    ...seg,
    text: removeHallucinations(seg.text),
  })).filter(seg => seg.text.trim().length > 0);
}

// ── Helper: cleanup temp files ──
function cleanup(...paths) {
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) fs.rmSync(p, { recursive: true });
        else fs.unlinkSync(p);
      }
    } catch { /* ignore */ }
  }
}

// ── POST /api/process — full pipeline ──
app.post('/api/process', requireAuth, (req, res, next) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: '파일 크기가 200MB를 초과합니다' });
      }
      return res.status(400).json({ error: err.message || '파일 업로드 실패' });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  const uploadedPath = req.file.path;
  const chunkDir = path.join(UPLOADS, crypto.randomUUID() + '_chunks');
  let audioPath = uploadedPath;
  const tempFiles = [uploadedPath, chunkDir];

  try {
    // Step 1: Extract audio if video
    const mime = req.file.mimetype || '';
    if (mime.startsWith('video/')) {
      audioPath = uploadedPath + '.mp3';
      tempFiles.push(audioPath);
      await extractAudio(uploadedPath, audioPath);
    }

    // Step 2: Check size and split if needed
    const fileSize = fs.statSync(audioPath).size;
    const MAX_CHUNK = 25 * 1024 * 1024; // 25MB
    let texts = [];
    let allSegments = [];
    let detectedLang = '';
    const CHUNK_SEC = 600; // must match splitAudio default

    if (fileSize <= MAX_CHUNK) {
      // Direct transcription
      const result = await transcribeFile(audioPath);
      texts.push(result.text);
      allSegments.push(...result.segments);
      detectedLang = result.language;
    } else {
      // Split into chunks
      fs.mkdirSync(chunkDir, { recursive: true });
      const chunks = await splitAudio(audioPath, chunkDir, CHUNK_SEC);
      for (let i = 0; i < chunks.length; i++) {
        const result = await transcribeFile(chunks[i]);
        texts.push(result.text);
        const offset = i * CHUNK_SEC;
        for (const seg of result.segments) {
          allSegments.push({ start: seg.start + offset, end: seg.end + offset, text: seg.text });
        }
        if (!detectedLang) detectedLang = result.language;
      }
    }

    const rawText = texts.join(' ').trim();

    // Step 2.5: Remove Whisper hallucination artifacts
    const transcription = removeHallucinations(rawText);
    allSegments = filterHallucinatedSegments(allSegments);

    // Step 3: Spell correction (Korean only)
    let corrected = transcription;
    let changes = [];
    if (detectedLang === 'ko' || /[\uAC00-\uD7A3]/.test(transcription)) {
      try {
        const typos = await checkSpell(transcription);
        const result = applyCorrections(transcription, typos);
        corrected = result.corrected;
        changes = result.changes;
      } catch {
        // spell check failed, return uncorrected
      }
    }

    res.json({ transcription, corrected, changes, language: detectedLang, segments: allSegments });
  } catch (err) {
    console.error('Process error:', err.message);
    res.status(500).json({ error: err.message || 'Processing failed' });
  } finally {
    cleanup(...tempFiles);
  }
});

// ── Static files (served for all non-API routes) ──
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Audio-to-Text server running on port ${PORT}`);
});
server.timeout = 10 * 60 * 1000; // 10 min for large file processing
server.keepAliveTimeout = 10 * 60 * 1000;
