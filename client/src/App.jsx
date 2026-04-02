import { useState, useRef, useCallback } from 'react';

const STEPS = [
  { label: '파일 업로드' },
  { label: 'AI 변환 중' },
  { label: '맞춤법 검사' },
  { label: '완료' },
];

const ACCEPTED_TYPES = /\.(mp3|wav|m4a|webm)$/i;

const FONTS = [
  { label: '나눔고딕',       value: 'NanumGothic' },
  { label: '맑은 고딕',     value: 'Malgun Gothic' },
  { label: '굴림',          value: 'Gulim' },
  { label: '돋움',          value: 'Dotum' },
  { label: 'Arial',         value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
];

const DEFAULT_ASS_STYLE = {
  fontName: 'NanumGothic',
  fontSize: 48,
  primaryColor: '#ffffff',
  outlineColor: '#000000',
  outline: 2,
  shadow: 2,
  alignment: 2, // 2=하단, 5=중앙, 8=상단
};

// CSS 미리보기용 다방향 text-shadow 아웃라인
function buildPreviewShadow(outline, outlineColor, shadow) {
  const parts = [];
  const o = Number(outline);
  if (o > 0) {
    const c = outlineColor;
    parts.push(
      `${o}px 0 0 ${c}`,  `-${o}px 0 0 ${c}`,
      `0 ${o}px 0 ${c}`,  `0 -${o}px 0 ${c}`,
      `${o}px ${o}px 0 ${c}`,  `-${o}px ${o}px 0 ${c}`,
      `${o}px -${o}px 0 ${c}`, `-${o}px -${o}px 0 ${c}`,
    );
  }
  const s = Number(shadow);
  if (s > 0) {
    parts.push(`${o + s}px ${o + s}px ${s * 2}px rgba(0,0,0,0.75)`);
  }
  return parts.join(', ');
}

export default function App() {
  const [status, setStatus] = useState('idle'); // idle | processing | done | error
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [segments, setSegments] = useState([]);
  const [showAssPanel, setShowAssPanel] = useState(false);
  const [assStyle, setAssStyle] = useState({ ...DEFAULT_ASS_STYLE });
  const fileInputRef = useRef(null);

  // ─── 파일 처리 메인 로직 ───────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!ACCEPTED_TYPES.test(file.name)) {
      setError('mp3, wav, m4a, webm 파일만 지원합니다.');
      setStatus('error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('파일 크기는 25MB 이하여야 합니다.');
      setStatus('error');
      return;
    }

    setFileName(file.name);
    setStatus('processing');
    setError('');
    setResult('');
    setSegments([]);
    setStep(0);
    setProgress(15);

    const formData = new FormData();
    formData.append('audio', file);

    try {
      setTimeout(() => { setStep(1); setProgress(40); }, 400);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      setStep(2);
      setProgress(80);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '변환에 실패했습니다.');
      }

      setStep(3);
      setProgress(100);

      setTimeout(() => {
        setResult(data.text);
        setSegments(data.segments || []);
        setStatus('done');
      }, 400);
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }, []);

  // ─── 드래그 앤 드롭 ────────────────────────────────────────────────────────
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  // ─── 복사 / 다운로드 / 초기화 ─────────────────────────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'transcript';
    a.download = `${baseName}_transcribed.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setStatus('idle');
    setFileName('');
    setResult('');
    setSegments([]);
    setError('');
    setStep(0);
    setProgress(0);
    setShowAssPanel(false);
  };

  // ─── SRT 다운로드 ─────────────────────────────────────────────────────────
  const toSrtTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  };

  const handleSrtDownload = () => {
    const srtContent = segments
      .map((seg, i) => `${i + 1}\n${toSrtTime(seg.start)} --> ${toSrtTime(seg.end)}\n${seg.text}`)
      .join('\n\n');
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'transcript';
    a.download = `${baseName}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── ASS 다운로드 ─────────────────────────────────────────────────────────
  const cssColorToAss = (hex) => {
    const r = hex.slice(1, 3).toUpperCase();
    const g = hex.slice(3, 5).toUpperCase();
    const b = hex.slice(5, 7).toUpperCase();
    return `&H00${b}${g}${r}`;
  };

  const toAssTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const cs = Math.round((seconds % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const handleAssDownload = () => {
    const { fontName, fontSize, primaryColor, outlineColor, outline, shadow, alignment } = assStyle;
    const primaryAss  = cssColorToAss(primaryColor);
    const outlineAss  = cssColorToAss(outlineColor);

    const lines = [
      '[Script Info]',
      'ScriptType: v4.00+',
      'PlayResX: 1920',
      'PlayResY: 1080',
      'ScaledBorderAndShadow: yes',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      `Style: Default,${fontName},${fontSize},${primaryAss},&H000000FF,${outlineAss},&H00000000,0,0,0,0,100,100,0,0,1,${outline},${shadow},${alignment},10,10,30,1`,
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      ...segments.map(seg =>
        `Dialogue: 0,${toAssTime(seg.start)},${toAssTime(seg.end)},Default,,0,0,0,,${seg.text.trim()}`
      ),
    ];

    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    const baseName = fileName.replace(/\.[^.]+$/, '') || 'transcript';
    a.download = `${baseName}.ass`;
    a.click();
    URL.revokeObjectURL(url);
    setShowAssPanel(false);
  };

  const alignmentPositionStyle = {
    2: { bottom: '8%',  top: 'auto',  transform: 'translateX(-50%)' },
    5: { top: '50%',    bottom: 'auto', transform: 'translateX(-50%) translateY(-50%)' },
    8: { top: '8%',     bottom: 'auto', transform: 'translateX(-50%)' },
  }[assStyle.alignment];

  // ─── 렌더 ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* 헤더 */}
      <header className="header">
        <div className="header-icon">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="#8b5cf6" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="19" x2="12" y2="23" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
            <line x1="8" y1="23" x2="16" y2="23" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <h1>STT 변환기</h1>
        <p>오디오 파일을 텍스트로 변환합니다</p>
      </header>

      <main className="main">

        {/* ── 업로드 영역 ── */}
        {status === 'idle' && (
          <div
            className={`upload-area${isDragging ? ' dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.webm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div className={`upload-icon-wrap${isDragging ? ' bounce' : ''}`}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="upload-title">
              {isDragging ? '여기에 놓으세요' : '파일을 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="upload-sub">mp3 · wav · m4a · webm &nbsp;|&nbsp; 최대 25MB</p>
          </div>
        )}

        {/* ── 처리 중 ── */}
        {status === 'processing' && (
          <div className="card processing-card">
            <div className="steps-row">
              {STEPS.map((s, i) => (
                <div key={i} className={`step-item${i < step ? ' done' : i === step ? ' active' : ''}`}>
                  <div className="step-dot">
                    {i < step
                      ? <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      : i + 1
                    }
                  </div>
                  <span className="step-label">{s.label}</span>
                  {i < STEPS.length - 1 && <div className={`step-line${i < step ? ' done' : ''}`} />}
                </div>
              ))}
            </div>

            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="processing-status">
              <span className="spinner" />
              <span>{STEPS[step]?.label}...</span>
            </div>

            {fileName && (
              <p className="processing-file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
                  <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {fileName}
              </p>
            )}
          </div>
        )}

        {/* ── 결과 ── */}
        {status === 'done' && (
          <div className="card result-card">
            <div className="result-header">
              <div className="result-meta">
                <span className="badge badge-success">
                  <svg width="12" height="12" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  변환 완료
                </span>
                {fileName && <span className="file-chip">{fileName}</span>}
              </div>
              <div className="action-row">
                <button
                  className={`btn btn-primary${copied ? ' btn-success' : ''}`}
                  onClick={handleCopy}
                >
                  {copied
                    ? <><svg width="14" height="14" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg> 복사됨</>
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.8" /></svg> 복사</>
                  }
                </button>
                <button className="btn btn-secondary" onClick={handleDownload}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  다운로드
                </button>
                {segments.length > 0 && (
                  <>
                    <button className="btn btn-secondary" onClick={handleSrtDownload}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                        <line x1="6" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        <line x1="6" y1="14" x2="18" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      SRT 다운로드
                    </button>
                    <button className="btn btn-secondary btn-ass" onClick={() => setShowAssPanel(true)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M6 14 Q8 10 10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        <path d="M13 14 Q15 10 17 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        <line x1="9" y1="14" x2="12.5" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      ASS 다운로드
                    </button>
                  </>
                )}
                <button className="btn btn-ghost" onClick={handleReset}>
                  다시 변환
                </button>
              </div>
            </div>
            <div className="result-body">
              <p className="result-text">{result || '(변환된 텍스트가 없습니다)'}</p>
            </div>
            <div className="result-footer">
              <span className="char-count">{result.length.toLocaleString()}자</span>
            </div>
          </div>
        )}

        {/* ── 에러 ── */}
        {status === 'error' && (
          <div className="card error-card">
            <div className="error-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="1.5" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1" fill="#ef4444" />
              </svg>
            </div>
            <p className="error-title">오류가 발생했습니다</p>
            <p className="error-msg">{error}</p>
            <button className="btn btn-ghost" onClick={handleReset}>다시 시도</button>
          </div>
        )}

      </main>

      {/* ── ASS 스타일 설정 패널 ── */}
      {showAssPanel && (
        <div className="ass-overlay" onClick={e => e.target === e.currentTarget && setShowAssPanel(false)}>
          <div className="ass-panel">

            <div className="ass-panel-header">
              <h2 className="ass-panel-title">ASS 자막 스타일 설정</h2>
              <button className="ass-panel-close" onClick={() => setShowAssPanel(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="ass-panel-body">
              <div className="style-form">

                <div className="style-row">
                  <label className="style-label">폰트</label>
                  <select
                    className="style-select"
                    value={assStyle.fontName}
                    onChange={e => setAssStyle(s => ({ ...s, fontName: e.target.value }))}
                  >
                    {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                <div className="style-row">
                  <label className="style-label">글자 크기</label>
                  <div className="style-number-wrap">
                    <input
                      type="number"
                      className="style-number"
                      min="12"
                      max="120"
                      value={assStyle.fontSize}
                      onChange={e => setAssStyle(s => ({ ...s, fontSize: Math.min(120, Math.max(12, Number(e.target.value))) }))}
                    />
                    <span className="style-unit">px</span>
                  </div>
                </div>

                <div className="style-row">
                  <label className="style-label">글자 색상</label>
                  <div className="style-color-wrap">
                    <input
                      type="color"
                      className="style-color"
                      value={assStyle.primaryColor}
                      onChange={e => setAssStyle(s => ({ ...s, primaryColor: e.target.value }))}
                    />
                    <span className="style-color-hex">{assStyle.primaryColor.toUpperCase()}</span>
                  </div>
                </div>

                <div className="style-row">
                  <label className="style-label">테두리 색상</label>
                  <div className="style-color-wrap">
                    <input
                      type="color"
                      className="style-color"
                      value={assStyle.outlineColor}
                      onChange={e => setAssStyle(s => ({ ...s, outlineColor: e.target.value }))}
                    />
                    <span className="style-color-hex">{assStyle.outlineColor.toUpperCase()}</span>
                  </div>
                </div>

                <div className="style-row">
                  <label className="style-label">
                    테두리 두께
                    <span className="style-val">{assStyle.outline}</span>
                  </label>
                  <input
                    type="range"
                    className="style-range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={assStyle.outline}
                    onChange={e => setAssStyle(s => ({ ...s, outline: Number(e.target.value) }))}
                  />
                </div>

                <div className="style-row">
                  <label className="style-label">
                    그림자 깊이
                    <span className="style-val">{assStyle.shadow}</span>
                  </label>
                  <input
                    type="range"
                    className="style-range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={assStyle.shadow}
                    onChange={e => setAssStyle(s => ({ ...s, shadow: Number(e.target.value) }))}
                  />
                </div>

                <div className="style-row">
                  <label className="style-label">위치</label>
                  <div className="style-align-btns">
                    {[['상단', 8], ['중앙', 5], ['하단', 2]].map(([label, val]) => (
                      <button
                        key={val}
                        className={`style-align-btn${assStyle.alignment === val ? ' active' : ''}`}
                        onClick={() => setAssStyle(s => ({ ...s, alignment: val }))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* 미리보기 */}
              <div className="ass-preview">
                <div className="preview-label">미리보기</div>
                <div className="preview-screen">
                  <span
                    className="preview-text"
                    style={{
                      fontFamily: assStyle.fontName,
                      fontSize: `${Math.max(12, Math.round(assStyle.fontSize * 0.36))}px`,
                      color: assStyle.primaryColor,
                      textShadow: buildPreviewShadow(
                        assStyle.outline * 0.36,
                        assStyle.outlineColor,
                        assStyle.shadow * 0.36,
                      ),
                      ...alignmentPositionStyle,
                    }}
                  >
                    자막 미리보기 · Preview Text
                  </span>
                </div>
              </div>
            </div>

            <div className="ass-panel-footer">
              <button className="btn btn-ghost" onClick={() => setAssStyle({ ...DEFAULT_ASS_STYLE })}>
                초기화
              </button>
              <div className="ass-panel-footer-right">
                <button className="btn btn-ghost" onClick={() => setShowAssPanel(false)}>취소</button>
                <button className="btn btn-primary" onClick={handleAssDownload}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  ASS 다운로드
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
