/* ── Audio-to-Text App ── */

// ── DOM refs ──
const $ = (sel) => document.querySelector(sel);
const loginScreen = $('#loginScreen');
const mainScreen = $('#mainScreen');
const loginForm = $('#loginForm');
const passwordInput = $('#passwordInput');
const loginError = $('#loginError');
const logoutBtn = $('#logoutBtn');

const dropZone = $('#dropZone');
const fileInput = $('#fileInput');
const fileInfo = $('#fileInfo');
const fileName = $('#fileName');
const fileSize = $('#fileSize');
const fileClear = $('#fileClear');
const startBtn = $('#startBtn');

const progressSection = $('#progressSection');
const progressFill = $('#progressFill');
const progressText = $('#progressText');

const resultSection = $('#resultSection');
const correctedText = $('#correctedText');
const originalText = $('#originalText');
const diffView = $('#diffView');
const changesSummary = $('#changesSummary');
const changesCount = $('#changesCount');
const changesList = $('#changesList');
const copyBtn = $('#copyBtn');
const downloadBtn = $('#downloadBtn');

const historySection = $('#historySection');
const historyList = $('#historyList');

let selectedFile = null;

// ── Auth ──
async function checkAuth() {
  try {
    const res = await fetch('/api/auth-check');
    if (res.ok) showMain();
    else showLogin();
  } catch { showLogin(); }
}

function showLogin() {
  loginScreen.hidden = false;
  mainScreen.hidden = true;
}

function showMain() {
  loginScreen.hidden = true;
  mainScreen.hidden = false;
  loadHistory();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const pw = passwordInput.value.trim();
  if (!pw) return;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      passwordInput.value = '';
      showMain();
    } else {
      loginError.textContent = '비밀번호가 틀렸습니다';
      loginError.hidden = false;
    }
  } catch {
    loginError.textContent = '서버 연결 실패';
    loginError.hidden = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  showLogin();
});

// ── File selection ──
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function selectFile(file) {
  const MAX = 200 * 1024 * 1024;
  if (file.size > MAX) {
    alert('파일 크기가 200MB를 초과합니다');
    return;
  }
  selectedFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatSize(file.size);
  fileInfo.hidden = false;
  startBtn.disabled = false;
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  fileInfo.hidden = true;
  startBtn.disabled = true;
}

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => { if (fileInput.files.length) selectFile(fileInput.files[0]); });
fileClear.addEventListener('click', clearFile);

// ── Processing ──
function showProgress(pct, text) {
  progressSection.hidden = false;
  progressFill.style.width = pct + '%';
  progressText.textContent = text;
}

function showError(msg) {
  resultSection.hidden = false;
  correctedText.value = '';
  originalText.value = '';
  diffView.innerHTML = '';
  changesSummary.hidden = true;
  // Reuse the corrected tab to show the error
  correctedText.value = '오류가 발생했습니다:\n\n' + msg;
  activateTab('corrected');
}

startBtn.addEventListener('click', async () => {
  if (!selectedFile) return;

  startBtn.disabled = true;
  resultSection.hidden = true;
  showProgress(10, '파일 업로드 중...');

  const form = new FormData();
  form.append('audio', selectedFile);

  try {
    showProgress(20, '파일 업로드 중...');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10min

    const res = await fetch('/api/process', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 401) { showLogin(); return; }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 413) throw new Error(err.error || '파일 크기가 200MB를 초과합니다');
      throw new Error(err.error || '처리 중 오류가 발생했습니다');
    }

    showProgress(90, '결과 처리 중...');
    const data = await res.json();
    showResult(data);
    addHistory(selectedFile.name, data);
    clearFile();
  } catch (err) {
    const msg = err.name === 'AbortError'
      ? '요청 시간이 초과되었습니다 (10분). 더 작은 파일로 시도해주세요.'
      : err.message;
    showError(msg);
  } finally {
    progressSection.hidden = true;
    startBtn.disabled = false;
  }
});

// ── Result display ──
function showResult(data) {
  resultSection.hidden = false;
  originalText.value = data.transcription || '';
  correctedText.value = data.corrected || data.transcription || '';

  // Changes
  const changes = data.changes || [];
  if (changes.length > 0) {
    changesSummary.hidden = false;
    changesCount.textContent = changes.length;
    changesList.innerHTML = changes.map(c =>
      `<li>"${esc(c.original)}" → "${esc(c.corrected)}"</li>`
    ).join('');
  } else {
    changesSummary.hidden = true;
  }

  // Diff view
  buildDiff(data.transcription || '', data.corrected || data.transcription || '');

  // Activate corrected tab
  activateTab('corrected');
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function buildDiff(orig, corrected) {
  // Simple word-level diff
  const origWords = orig.split(/(\s+)/);
  const corrWords = corrected.split(/(\s+)/);
  let html = '';
  const max = Math.max(origWords.length, corrWords.length);
  for (let i = 0; i < max; i++) {
    const o = origWords[i] || '';
    const c = corrWords[i] || '';
    if (o === c) {
      html += esc(c);
    } else {
      if (o) html += `<span class="diff-del">${esc(o)}</span>`;
      if (c) html += `<span class="diff-ins">${esc(c)}</span>`;
    }
  }
  diffView.innerHTML = html || '<span style="color:var(--text-dim)">변경사항 없음</span>';
}

// ── Tabs ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
});

function activateTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $('#tabCorrected').hidden = name !== 'corrected';
  $('#tabOriginal').hidden = name !== 'original';
  $('#tabDiff').hidden = name !== 'diff';
}

// ── Copy & Download ──
copyBtn.addEventListener('click', () => {
  const text = correctedText.value;
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = '복사됨!';
    setTimeout(() => { copyBtn.textContent = '복사'; }, 1500);
  });
});

downloadBtn.addEventListener('click', () => {
  const text = correctedText.value;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'transcription.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});

// ── History (localStorage) ──
function loadHistory() {
  const items = JSON.parse(localStorage.getItem('att_history') || '[]');
  if (items.length === 0) { historySection.hidden = true; return; }
  historySection.hidden = false;
  historyList.innerHTML = items.slice(0, 10).map(h =>
    `<li><span>${esc(h.name)}</span><span class="history-time">${h.time}</span></li>`
  ).join('');
}

function addHistory(name, data) {
  const items = JSON.parse(localStorage.getItem('att_history') || '[]');
  items.unshift({ name, time: new Date().toLocaleString('ko-KR'), chars: (data.corrected || '').length });
  localStorage.setItem('att_history', JSON.stringify(items.slice(0, 20)));
  loadHistory();
}

// ── Init ──
checkAuth();
