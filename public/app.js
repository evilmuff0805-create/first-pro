/* ============================================
   STORYBOARD PRO - Application Logic
   ============================================ */

// ---- State ----
let uploadedImages = [];
let generatedScenes = [];
let currentInfo = {};
let generatedReferenceImages = {}; // { sceneIndex: imageUrl }

// ---- Image Upload ----
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const previewGrid = document.getElementById('previewGrid');

uploadArea.addEventListener('click', () => imageInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

imageInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    const remaining = 10 - uploadedImages.length;
    const filesToAdd = Array.from(files).slice(0, remaining);

    filesToAdd.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedImages.push({
                name: file.name,
                dataUrl: e.target.result
            });
            renderPreviews();
        };
        reader.readAsDataURL(file);
    });
}

function renderPreviews() {
    previewGrid.innerHTML = uploadedImages.map((img, i) => `
        <div class="preview-item">
            <img src="${img.dataUrl}" alt="${img.name}">
            <button class="preview-remove" onclick="removeImage(${i})">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderPreviews();
}

// ---- Mood Configurations ----
const MOOD_CONFIG = {
    premium: {
        nameKo: '프리미엄 / 럭셔리',
        nameEn: 'Premium & Luxury',
        colorPalette: 'deep blacks, warm golds, muted creams',
        lighting: 'dramatic rim lighting, soft key light, cinematic shadows',
        camera: 'slow tracking shots, smooth dolly movements, shallow depth of field',
        style: 'sleek, sophisticated, editorial-grade',
        music: '웅장한 오케스트라, 섬세한 피아노'
    },
    modern: {
        nameKo: '모던 / 미니멀',
        nameEn: 'Modern & Minimal',
        colorPalette: 'clean whites, soft grays, accent colors',
        lighting: 'flat even lighting, soft diffused light, bright and airy',
        camera: 'static wide shots, geometric framing, symmetrical composition',
        style: 'clean, minimal, structured',
        music: '미니멀 일렉트로닉, 앰비언트'
    },
    warm: {
        nameKo: '따뜻한 / 감성적',
        nameEn: 'Warm & Emotional',
        colorPalette: 'warm amber, soft oranges, earthy tones',
        lighting: 'golden hour, warm backlight, soft natural light',
        camera: 'handheld feel, intimate close-ups, slow motion',
        style: 'organic, authentic, heartfelt',
        music: '어쿠스틱 기타, 감성 피아노'
    },
    dynamic: {
        nameKo: '다이내믹 / 에너지',
        nameEn: 'Dynamic & Energetic',
        colorPalette: 'vivid saturated colors, high contrast, bold tones',
        lighting: 'hard directional light, colored gels, strobe effects',
        camera: 'fast cuts, whip pans, dynamic angles, low-angle shots',
        style: 'bold, impactful, energetic',
        music: '일렉트로닉 비트, 에너지틱 BGM'
    },
    nature: {
        nameKo: '자연 / 친환경',
        nameEn: 'Nature & Eco',
        colorPalette: 'lush greens, earth tones, sky blues',
        lighting: 'natural sunlight, dappled forest light, golden hour',
        camera: 'aerial wide shots, slow tracking through nature, macro details',
        style: 'organic, serene, grounded',
        music: '자연 사운드, 어쿠스틱'
    },
    tech: {
        nameKo: '테크 / 미래지향',
        nameEn: 'Tech & Futuristic',
        colorPalette: 'cool blues, neon accents, dark backgrounds',
        lighting: 'LED edge lighting, screen glow, futuristic light effects',
        camera: 'rotating product shots, zoom transitions, parallax movement',
        style: 'sleek, futuristic, innovative',
        music: '신스웨이브, 테크 사운드'
    },
    lifestyle: {
        nameKo: '라이프스타일',
        nameEn: 'Lifestyle',
        colorPalette: 'natural balanced colors, warm neutrals, lifestyle tones',
        lighting: 'soft natural light, window light, ambient indoor lighting',
        camera: 'casual handheld, following shots, candid moments',
        style: 'authentic, relatable, aspirational',
        music: '인디 팝, 라이프스타일 BGM'
    },
    cinematic: {
        nameKo: '시네마틱',
        nameEn: 'Cinematic',
        colorPalette: 'teal and orange, desaturated tones, film grain look',
        lighting: 'dramatic chiaroscuro, volumetric light, silhouettes',
        camera: 'anamorphic wide shots, slow crane movements, rack focus',
        style: 'filmic, dramatic, storytelling',
        music: '시네마틱 스코어, 앰비언트'
    }
};

// ---- Scene Templates by Duration ----
function getSceneTemplates(duration, mood, brand, product, description, keyMessage) {
    const moodCfg = MOOD_CONFIG[mood];
    const dur = parseInt(duration);

    let sceneCount;
    if (dur <= 15) sceneCount = 4;
    else if (dur <= 30) sceneCount = 6;
    else if (dur <= 60) sceneCount = 8;
    else if (dur <= 90) sceneCount = 10;
    else sceneCount = 12;

    const sceneStructure = buildBrandedSceneStructure(sceneCount, dur, moodCfg, brand, product, description, keyMessage);
    return sceneStructure;
}

function buildBrandedSceneStructure(count, totalDuration, moodCfg, brand, product, description, keyMessage) {
    const scenes = [];

    const storyBeats = [
        {
            type: 'OPENING',
            typeIcon: 'fa-play-circle',
            titleTemplate: `임팩트 있는 오프닝`,
            descTemplate: `시청자의 시선을 사로잡는 첫 장면. ${moodCfg.nameKo} 분위기의 비주얼로 시작하며, 브랜드 세계관에 진입하는 순간을 연출합니다.`,
            camera: 'Wide establishing shot → Slow zoom in',
            transition: 'Fade in from black',
            audio: '사운드 라이징, 분위기 설정',
            narration: ''
        },
        {
            type: 'CONTEXT',
            typeIcon: 'fa-eye',
            titleTemplate: `상황 설정 & 공감`,
            descTemplate: `타겟 오디언스가 공감할 수 있는 일상 속 상황이나 니즈를 보여줍니다. ${product}이(가) 필요한 순간을 자연스럽게 연출합니다.`,
            camera: 'Medium shot, eye-level',
            transition: 'Smooth cut',
            audio: 'BGM 시작, 내추럴 사운드',
            narration: '일상 속 순간을 담다'
        },
        {
            type: 'PRODUCT REVEAL',
            typeIcon: 'fa-gem',
            titleTemplate: `${product} 첫 등장`,
            descTemplate: `${brand}의 ${product}을(를) 처음으로 화면에 등장시킵니다. ${moodCfg.lighting}을(를) 활용하여 제품의 존재감을 극대화합니다.`,
            camera: 'Slow dolly push-in, shallow DOF',
            transition: 'Light flash / Motion blur transition',
            audio: 'BGM 빌드업, 임팩트 사운드',
            narration: ''
        },
        {
            type: 'FEATURE HIGHLIGHT',
            typeIcon: 'fa-star',
            titleTemplate: `핵심 기능 & USP`,
            descTemplate: `${product}의 핵심 기능과 차별점을 시각적으로 풀어냅니다. 클로즈업과 디테일 샷을 활용하여 제품의 강점을 부각합니다.`,
            camera: 'Close-up details, insert shots',
            transition: 'Match cut / Whip pan',
            audio: 'BGM 포인트, 효과음',
            narration: '핵심 가치를 보여주는 순간'
        },
        {
            type: 'EXPERIENCE',
            typeIcon: 'fa-hand-sparkles',
            titleTemplate: `사용 경험 & 감성`,
            descTemplate: `실제 사용 장면을 통해 ${product}이(가) 주는 경험과 감성을 전달합니다. 사용자의 표정과 반응으로 감성적 연결을 만듭니다.`,
            camera: 'Over-the-shoulder, reaction shots',
            transition: 'Cross dissolve',
            audio: 'BGM 감성 구간, 보이스오버',
            narration: '경험이 만드는 차이'
        },
        {
            type: 'BENEFIT',
            typeIcon: 'fa-check-circle',
            titleTemplate: `변화 & 베네핏`,
            descTemplate: `${product}을(를) 통해 달라진 모습이나 얻게 되는 가치를 보여줍니다. 비포/애프터 또는 라이프스타일 변화를 연출합니다.`,
            camera: 'Dynamic movement, tracking shot',
            transition: 'Speed ramp',
            audio: 'BGM 클라이맥스 빌드업',
            narration: ''
        },
        {
            type: 'SOCIAL PROOF',
            typeIcon: 'fa-users',
            titleTemplate: `다양한 활용 장면`,
            descTemplate: `다양한 상황과 사용자에 의해 ${product}이(가) 활용되는 모습을 빠른 컷으로 보여줍니다. 보편성과 다양성을 강조합니다.`,
            camera: 'Quick cuts montage, varied angles',
            transition: 'Jump cuts / Rhythmic editing',
            audio: 'BGM 에너지 상승',
            narration: ''
        },
        {
            type: 'CLIMAX',
            typeIcon: 'fa-bolt',
            titleTemplate: `클라이맥스 & 임팩트`,
            descTemplate: `영상의 감정적 정점. ${moodCfg.nameKo} 분위기를 극대화하며, 가장 임팩트 있는 비주얼과 메시지를 전달합니다.`,
            camera: 'Hero shot, dramatic angle',
            transition: 'Dramatic slow motion',
            audio: 'BGM 클라이맥스',
            narration: keyMessage || `${brand}의 가치를 완성하는 순간`
        },
        {
            type: 'KEY MESSAGE',
            typeIcon: 'fa-quote-right',
            titleTemplate: `핵심 메시지 전달`,
            descTemplate: `"${keyMessage || brand}" — 브랜드의 핵심 메시지를 텍스트와 비주얼로 강렬하게 전달합니다. 기억에 남는 카피와 함께 제품을 다시 한번 보여줍니다.`,
            camera: 'Slow push-in on text/product',
            transition: 'Fade / Light streak',
            audio: 'BGM 차분한 전환',
            narration: keyMessage || ''
        },
        {
            type: 'BRAND LOGO',
            typeIcon: 'fa-flag-checkered',
            titleTemplate: `브랜드 로고 & 엔딩`,
            descTemplate: `${brand} 로고와 제품 패키지샷으로 마무리. CTA(Call to Action)와 함께 브랜드 아이덴티티를 각인시킵니다. 해시태그나 웹사이트 URL을 포함합니다.`,
            camera: 'Center frame, static',
            transition: 'Elegant fade to brand color',
            audio: 'BGM 아웃트로, 사운드 로고',
            narration: ''
        },
        {
            type: 'BONUS',
            typeIcon: 'fa-plus-circle',
            titleTemplate: `추가 컷 / 비하인드`,
            descTemplate: `SNS 숏폼이나 비하인드 컷으로 활용 가능한 추가 장면. 메이킹 필름 느낌으로 친근함을 더합니다.`,
            camera: 'Casual handheld, BTS feel',
            transition: 'Cut to black',
            audio: '내추럴 사운드',
            narration: ''
        },
        {
            type: 'EXTRA',
            typeIcon: 'fa-film',
            titleTemplate: `확장 컷`,
            descTemplate: `다양한 채널에 맞게 편집 가능한 여분 컷. 인스타그램 릴스, 유튜브 숏츠 등 다양한 포맷에 활용합니다.`,
            camera: 'Varied',
            transition: 'Varied',
            audio: 'BGM 변형',
            narration: ''
        }
    ];

    let selectedBeats;
    if (count <= 4) {
        selectedBeats = [0, 2, 3, 9];
    } else if (count <= 6) {
        selectedBeats = [0, 1, 2, 3, 7, 9];
    } else if (count <= 8) {
        selectedBeats = [0, 1, 2, 3, 4, 7, 8, 9];
    } else if (count <= 10) {
        selectedBeats = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    } else {
        selectedBeats = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }

    const picked = selectedBeats.slice(0, count);
    const timings = distributeTime(picked.length, totalDuration);

    picked.forEach((beatIdx, i) => {
        const beat = storyBeats[beatIdx];
        scenes.push({
            sceneNumber: i + 1,
            type: beat.type,
            typeIcon: beat.typeIcon,
            title: beat.titleTemplate,
            description: beat.descTemplate,
            duration: timings[i],
            camera: beat.camera,
            transition: beat.transition,
            audio: beat.audio,
            narration: beat.narration,
            imageIndex: i < uploadedImages.length ? i : -1
        });
    });

    return scenes;
}

function distributeTime(sceneCount, totalDuration) {
    const weights = [];
    for (let i = 0; i < sceneCount; i++) {
        if (i === 0) weights.push(0.8);
        else if (i === sceneCount - 1) weights.push(0.7);
        else if (i === Math.floor(sceneCount / 2)) weights.push(1.3);
        else weights.push(1.0);
    }
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => {
        const t = (w / totalWeight) * totalDuration;
        return Math.max(1, Math.round(t * 10) / 10);
    });
}

// ---- Nano Banana Pro Prompt Generator ----
function generatePromptForScene(scene, mood, brand, product, sceneIndex, totalScenes) {
    const moodCfg = MOOD_CONFIG[mood];
    const sections = {};

    let subject = '';
    switch (scene.type) {
        case 'OPENING':
            subject = `A cinematic opening shot establishing a ${moodCfg.style} atmosphere. Abstract visual elements or an establishing wide shot that evokes the world of ${brand}. ${product ? `Subtle hint of ${product} in the environment.` : ''}`;
            break;
        case 'CONTEXT':
            subject = `A person in their daily life, showing a moment of need or aspiration. Natural, candid feel. The scene conveys relatability and the desire for something better, setting up the introduction of ${product} by ${brand}.`;
            break;
        case 'PRODUCT REVEAL':
            subject = `${product} by ${brand}, hero product shot. The product is the clear focal point, presented on a ${mood === 'premium' ? 'dark luxurious surface with reflections' : mood === 'modern' ? 'clean white minimal surface' : 'natural textured surface'}. Dramatic reveal moment.`;
            break;
        case 'FEATURE HIGHLIGHT':
            subject = `Close-up detail shot of ${product} by ${brand}, showcasing its key features and craftsmanship. Macro-level details visible. The shot emphasizes quality, innovation, and unique selling points.`;
            break;
        case 'EXPERIENCE':
            subject = `A person using ${product} by ${brand} in a real-life scenario. Genuine expression of satisfaction and delight. The interaction between user and product feels natural and aspirational.`;
            break;
        case 'BENEFIT':
            subject = `Visual metaphor showing transformation and improvement through ${product} by ${brand}. A before-and-after feeling conveyed through environment, mood, or the person's demeanor.`;
            break;
        case 'SOCIAL PROOF':
            subject = `Multiple diverse people using ${product} by ${brand} in various settings and situations. A montage-style composition showing universality and versatility of the product.`;
            break;
        case 'CLIMAX':
            subject = `The most dramatic and impactful hero shot of ${product} by ${brand}. Peak visual moment with maximum emotional impact. ${moodCfg.style} aesthetic at its highest expression.`;
            break;
        case 'KEY MESSAGE':
            subject = `${product} by ${brand} presented alongside elegant typography space for the key message. Clean composition that balances product and negative space for text overlay. Powerful and memorable visual.`;
            break;
        case 'BRAND LOGO':
            subject = `Clean, elegant end frame composition for ${brand}. ${product} shown in its final beauty shot with space for logo placement. ${mood === 'premium' ? 'Dark luxurious background' : 'Clean minimal background'} with refined finishing.`;
            break;
        default:
            subject = `A branded content shot for ${brand} ${product}, maintaining ${moodCfg.style} visual language throughout.`;
    }

    sections.subject = subject;
    sections.style = `${moodCfg.style} visual style, branded content quality, commercial production value, ${moodCfg.nameEn.toLowerCase()} mood`;
    sections.lighting = moodCfg.lighting;
    sections.color = moodCfg.colorPalette;
    sections.camera = scene.camera;
    sections.quality = 'ultra high resolution, 8K quality, professional commercial photography, advertising campaign quality, magazine editorial grade, sharp focus';
    sections.avoid = 'no text, no watermark, no logo overlay, no low quality, no blurry, no amateur look';

    return sections;
}

function formatPromptSections(sections) {
    return {
        full: `${sections.subject}\n\nStyle: ${sections.style}\nLighting: ${sections.lighting}\nColor palette: ${sections.color}\nCamera: ${sections.camera}\nQuality: ${sections.quality}\n\nAvoid: ${sections.avoid}`,
        subject: sections.subject,
        style: sections.style,
        lighting: sections.lighting,
        color: sections.color,
        camera: sections.camera,
        quality: sections.quality,
        avoid: sections.avoid
    };
}

// ============================================
//  STORYBOARD GENERATION
// ============================================

function generateStoryboard() {
    const brand = document.getElementById('brandName').value.trim();
    const product = document.getElementById('productName').value.trim();
    const duration = document.getElementById('videoDuration').value;
    const mood = document.getElementById('videoMood').value;
    const audience = document.getElementById('targetAudience').value.trim();
    const keyMessage = document.getElementById('keyMessage').value.trim();
    const description = document.getElementById('videoDescription').value.trim();

    if (!brand || !product) {
        showToast('브랜드명과 제품/서비스명은 필수 입력입니다.', 'error');
        return;
    }
    if (!description) {
        showToast('영상 설명을 입력해주세요.', 'error');
        return;
    }

    // Reset
    generatedReferenceImages = {};
    showLoading('스토리보드를 생성하고 있습니다...', '브랜디드 영상 컨셉에 맞게 구성 중');

    setTimeout(() => {
        const scenes = getSceneTemplates(duration, mood, brand, product, description, keyMessage);
        generatedScenes = scenes;
        currentInfo = { brand, product, duration, mood, audience, keyMessage, description };

        renderStoryboard(scenes, currentInfo);

        hideLoading();
        document.getElementById('outputSection').style.display = 'block';

        setTimeout(() => {
            document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, 1500);
}

// ============================================
//  RENDER STORYBOARD
// ============================================

function renderStoryboard(scenes, info) {
    const moodCfg = MOOD_CONFIG[info.mood];

    document.getElementById('storyboardSubtitle').textContent =
        `${info.brand} — ${info.product}`;

    document.getElementById('storyboardMeta').innerHTML = `
        <div class="meta-item"><i class="fas fa-clock"></i> <strong>${info.duration}초</strong></div>
        <div class="meta-item"><i class="fas fa-palette"></i> <strong>${moodCfg.nameKo}</strong></div>
        <div class="meta-item"><i class="fas fa-users"></i> <strong>${info.audience || '미지정'}</strong></div>
        <div class="meta-item"><i class="fas fa-bullhorn"></i> <strong>${info.keyMessage || '미지정'}</strong></div>
        <div class="meta-item"><i class="fas fa-film"></i> <strong>${scenes.length}씬</strong></div>
        <div class="meta-item"><i class="fas fa-calendar"></i> <strong>${new Date().toLocaleDateString('ko-KR')}</strong></div>
    `;

    // Scenes
    const container = document.getElementById('scenesContainer');
    container.innerHTML = scenes.map((scene, i) => {
        const hasUploadedImage = scene.imageIndex >= 0 && uploadedImages[scene.imageIndex];
        const hasGeneratedImage = generatedReferenceImages[i];
        const imageSrc = hasGeneratedImage || (hasUploadedImage ? uploadedImages[scene.imageIndex].dataUrl : null);

        const imageHtml = imageSrc
            ? `<img src="${imageSrc}" alt="Scene ${scene.sceneNumber}" onclick="openLightbox('${escapeAttr(imageSrc)}', 'Scene ${scene.sceneNumber}: ${escapeAttr(scene.title)}')">
               <div class="scene-visual-overlay"><span><i class="fas fa-search-plus"></i> 크게 보기</span></div>`
            : `<div class="scene-visual-placeholder">
                    <i class="fas fa-image"></i>
                    <span>Reference Image</span>
               </div>`;

        const generateBtnHtml = `
            <button class="scene-generate-single-btn" id="singleGenBtn_${i}" onclick="event.stopPropagation(); generateSingleImage(${i})">
                <i class="fas fa-wand-magic-sparkles"></i> 이미지 생성
            </button>`;

        return `
            <div class="scene-card" style="animation-delay: ${i * 0.1}s" id="sceneCard_${i}">
                <div class="scene-card-inner">
                    <div class="scene-visual ${imageSrc ? 'has-generated-image' : ''}" id="sceneVisual_${i}">
                        ${imageHtml}
                        <div class="scene-number-badge">SCENE ${String(scene.sceneNumber).padStart(2, '0')}</div>
                        <div class="scene-duration-badge"><i class="fas fa-clock"></i> ${scene.duration}s</div>
                        ${!hasGeneratedImage ? generateBtnHtml : ''}
                    </div>
                    <div class="scene-content">
                        <div class="scene-top-row">
                            <div class="scene-type">
                                <i class="fas ${scene.typeIcon}"></i>
                                ${scene.type}
                            </div>
                        </div>
                        <h3 class="scene-title">${scene.title}</h3>
                        <p class="scene-description">${scene.description}</p>
                        ${scene.narration ? `<div class="scene-narration">${scene.narration}</div>` : ''}
                        <div class="scene-details">
                            <div class="scene-detail-item">
                                <span class="scene-detail-label">카메라</span>
                                <span class="scene-detail-value">${scene.camera}</span>
                            </div>
                            <div class="scene-detail-item">
                                <span class="scene-detail-label">트랜지션</span>
                                <span class="scene-detail-value">${scene.transition}</span>
                            </div>
                            <div class="scene-detail-item">
                                <span class="scene-detail-label">오디오</span>
                                <span class="scene-detail-value">${scene.audio}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // ---- Nano Banana Pro Prompts ----
    const promptsContainer = document.getElementById('promptsContainer');
    const allPrompts = [];

    promptsContainer.innerHTML = scenes.map((scene, i) => {
        const promptSections = generatePromptForScene(scene, info.mood, info.brand, info.product, i, scenes.length);
        const formatted = formatPromptSections(promptSections);
        allPrompts.push({ scene: scene.sceneNumber, type: scene.type, prompt: formatted.full });

        const hasGenImg = generatedReferenceImages[i];
        const imgPreviewHtml = hasGenImg ? `
            <div class="prompt-card-image-preview">
                <img src="${hasGenImg}" alt="Generated">
                <span class="image-status"><i class="fas fa-check-circle"></i> AI 레퍼런스 이미지 생성 완료</span>
            </div>
        ` : '';

        const tags = [info.mood, scene.type.toLowerCase(), 'branded content', 'commercial', '8K'];

        return `
            <div class="prompt-card" id="promptCard_${i}">
                <div class="prompt-card-header">
                    <div class="prompt-scene-label">
                        <i class="fas fa-hashtag"></i>
                        Scene ${String(scene.sceneNumber).padStart(2, '0')} — ${scene.type}
                    </div>
                    <button class="prompt-copy-btn" onclick="copyPrompt(this, ${i})">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                ${imgPreviewHtml}
                <div class="prompt-body">
                    <div class="prompt-text" id="promptText_${i}">${escapeHtml(formatted.full)}</div>
                    <div class="prompt-tags">
                        ${tags.map(t => `<span class="prompt-tag">${t}</span>`).join('')}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    promptsContainer.innerHTML += `
        <div class="copy-all-section">
            <button class="copy-all-btn" onclick="copyAllPrompts()">
                <i class="fas fa-clipboard-list"></i>
                전체 프롬프트 복사
            </button>
        </div>
    `;

    window._allPrompts = allPrompts;
}

// ============================================
//  AI REFERENCE IMAGE GENERATION (Canvas-based)
// ============================================

// Color palettes per mood
const MOOD_PALETTES = {
    premium: {
        gradients: [['#1a1a2e','#16213e','#0f3460'], ['#2d132c','#4a1942','#2b1055'], ['#1a1a2e','#2d2d44','#3d3d5c']],
        accent: '#c8a96e', overlay: 'rgba(200,169,110,0.15)'
    },
    modern: {
        gradients: [['#f8f9fa','#e9ecef','#dee2e6'], ['#edf2fb','#d7e3fc','#c1d3fe'], ['#f0f4f8','#d9e2ec','#bcccdc']],
        accent: '#3d5a80', overlay: 'rgba(61,90,128,0.1)'
    },
    warm: {
        gradients: [['#ffecd2','#fcb69f','#ff9a76'], ['#f6d365','#fda085','#fed6b1'], ['#ffeaa7','#fdcb6e','#e17055']],
        accent: '#e17055', overlay: 'rgba(225,112,85,0.12)'
    },
    dynamic: {
        gradients: [['#0f0c29','#302b63','#24243e'], ['#200122','#6f0000','#200122'], ['#1a0530','#3a0d5e','#1a0530']],
        accent: '#e94560', overlay: 'rgba(233,69,96,0.15)'
    },
    nature: {
        gradients: [['#134e5e','#1a6b4f','#71b280'], ['#093028','#237a57','#6dbc6e'], ['#0b486b','#3b8d99','#6baa75']],
        accent: '#71b280', overlay: 'rgba(113,178,128,0.12)'
    },
    tech: {
        gradients: [['#0c0c1d','#1a1a3e','#0d0d2b'], ['#000428','#004e92','#000428'], ['#0f0f23','#1a2980','#0f0f23']],
        accent: '#00d2ff', overlay: 'rgba(0,210,255,0.1)'
    },
    lifestyle: {
        gradients: [['#ffecd2','#f5cba7','#d4a574'], ['#fdfcfb','#e2d1c3','#c9b18c'], ['#f8f4f0','#e8ddd4','#d4c5b3']],
        accent: '#d4a574', overlay: 'rgba(212,165,116,0.12)'
    },
    cinematic: {
        gradients: [['#141e30','#243b55','#1a2a3a'], ['#0f2027','#203a43','#2c5364'], ['#1c1c1c','#2d3436','#1c1c1c']],
        accent: '#e6a756', overlay: 'rgba(230,167,86,0.12)'
    }
};

// Scene-specific visual elements
const SCENE_VISUALS = {
    'OPENING': { icon: '\u25B6', shapes: 'radial', text: 'OPENING' },
    'CONTEXT': { icon: '\u25CB', shapes: 'horizontal', text: 'CONTEXT' },
    'PRODUCT REVEAL': { icon: '\u2666', shapes: 'center-spotlight', text: 'REVEAL' },
    'FEATURE HIGHLIGHT': { icon: '\u2605', shapes: 'grid', text: 'FEATURE' },
    'EXPERIENCE': { icon: '\u2764', shapes: 'wave', text: 'EXPERIENCE' },
    'BENEFIT': { icon: '\u2713', shapes: 'diagonal', text: 'BENEFIT' },
    'SOCIAL PROOF': { icon: '\u2637', shapes: 'multi-circle', text: 'SOCIAL' },
    'CLIMAX': { icon: '\u26A1', shapes: 'burst', text: 'CLIMAX' },
    'KEY MESSAGE': { icon: '\u275D', shapes: 'center-text', text: 'MESSAGE' },
    'BRAND LOGO': { icon: '\u2B23', shapes: 'center-logo', text: 'BRAND' },
    'BONUS': { icon: '\u002B', shapes: 'scattered', text: 'BONUS' },
    'EXTRA': { icon: '\u2026', shapes: 'minimal', text: 'EXTRA' }
};

function generateCanvasImage(sceneType, mood, sceneNumber, brand, product) {
    return new Promise(resolve => {
        const canvas = document.createElement('canvas');
        canvas.width = 912;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const palette = MOOD_PALETTES[mood] || MOOD_PALETTES.premium;
        const visual = SCENE_VISUALS[sceneType] || SCENE_VISUALS['OPENING'];
        const gradientColors = palette.gradients[sceneNumber % palette.gradients.length];

        // Background gradient
        const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bgGrad.addColorStop(0, gradientColors[0]);
        bgGrad.addColorStop(0.5, gradientColors[1]);
        bgGrad.addColorStop(1, gradientColors[2]);
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Noise texture overlay
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 12;
            imageData.data[i] += noise;
            imageData.data[i + 1] += noise;
            imageData.data[i + 2] += noise;
        }
        ctx.putImageData(imageData, 0, 0);

        // Draw scene-specific shapes
        ctx.globalAlpha = 0.08;
        drawSceneShapes(ctx, visual.shapes, canvas.width, canvas.height, palette.accent);
        ctx.globalAlpha = 1;

        // Cinematic letterbox bars
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvas.width, 28);
        ctx.fillRect(0, canvas.height - 28, canvas.width, 28);

        // Vignette effect
        const vignetteGrad = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, canvas.width * 0.25,
            canvas.width / 2, canvas.height / 2, canvas.width * 0.7
        );
        vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Accent light streak
        ctx.globalAlpha = 0.06;
        const streakGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
        streakGrad.addColorStop(0, 'transparent');
        streakGrad.addColorStop(0.3, palette.accent);
        streakGrad.addColorStop(0.7, palette.accent);
        streakGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = streakGrad;
        ctx.fillRect(0, canvas.height * 0.38, canvas.width, canvas.height * 0.24);
        ctx.globalAlpha = 1;

        // Center scene type badge
        const isDark = mood !== 'modern' && mood !== 'warm' && mood !== 'lifestyle';

        // Large icon
        ctx.globalAlpha = 0.12;
        ctx.font = '120px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = palette.accent;
        ctx.fillText(visual.icon, canvas.width / 2, canvas.height / 2 - 20);
        ctx.globalAlpha = 1;

        // Scene type label
        ctx.font = '600 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '4px';
        ctx.fillStyle = palette.accent;
        ctx.globalAlpha = 0.7;
        ctx.fillText(`SCENE ${String(sceneNumber).padStart(2, '0')}`, canvas.width / 2, canvas.height / 2 + 40);
        ctx.globalAlpha = 1;

        // Scene type text
        ctx.font = '700 28px Inter, sans-serif';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(30,30,40,0.75)';
        ctx.fillText(visual.text, canvas.width / 2, canvas.height / 2 + 72);

        // Product name at bottom
        ctx.font = '300 13px Inter, sans-serif';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(30,30,40,0.35)';
        ctx.fillText(`${brand} \u2014 ${product}`, canvas.width / 2, canvas.height - 46);

        // Film frame marks (corners)
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(30,30,40,0.15)';
        ctx.lineWidth = 1;
        const m = 32;
        const l = 20;
        // Top-left
        ctx.beginPath(); ctx.moveTo(m, m + l); ctx.lineTo(m, m); ctx.lineTo(m + l, m); ctx.stroke();
        // Top-right
        ctx.beginPath(); ctx.moveTo(canvas.width - m - l, m); ctx.lineTo(canvas.width - m, m); ctx.lineTo(canvas.width - m, m + l); ctx.stroke();
        // Bottom-left
        ctx.beginPath(); ctx.moveTo(m, canvas.height - m - l); ctx.lineTo(m, canvas.height - m); ctx.lineTo(m + l, canvas.height - m); ctx.stroke();
        // Bottom-right
        ctx.beginPath(); ctx.moveTo(canvas.width - m - l, canvas.height - m); ctx.lineTo(canvas.width - m, canvas.height - m); ctx.lineTo(canvas.width - m, canvas.height - m - l); ctx.stroke();

        // Aspect ratio indicator
        ctx.font = '500 9px Inter, sans-serif';
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(30,30,40,0.25)';
        ctx.textAlign = 'right';
        ctx.fillText('16:9', canvas.width - 40, 18);

        resolve(canvas.toDataURL('image/jpeg', 0.92));
    });
}

function drawSceneShapes(ctx, shapeType, w, h, accent) {
    ctx.fillStyle = accent;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;

    switch (shapeType) {
        case 'radial':
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(w / 2, h / 2, 60 + i * 50, 0, Math.PI * 2);
                ctx.stroke();
            }
            break;
        case 'horizontal':
            for (let i = 0; i < 8; i++) {
                const y = (h / 9) * (i + 1);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
            break;
        case 'center-spotlight':
            const spotGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 200);
            spotGrad.addColorStop(0, accent);
            spotGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = spotGrad;
            ctx.fillRect(0, 0, w, h);
            break;
        case 'grid':
            for (let x = 0; x < w; x += 60) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
            }
            for (let y = 0; y < h; y += 60) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
            }
            break;
        case 'wave':
            ctx.beginPath();
            for (let x = 0; x < w; x += 2) {
                ctx.lineTo(x, h / 2 + Math.sin(x * 0.02) * 60);
            }
            ctx.stroke();
            ctx.beginPath();
            for (let x = 0; x < w; x += 2) {
                ctx.lineTo(x, h / 2 + Math.sin(x * 0.02 + 1) * 40);
            }
            ctx.stroke();
            break;
        case 'diagonal':
            for (let i = -10; i < 20; i++) {
                ctx.beginPath();
                ctx.moveTo(i * 80, 0);
                ctx.lineTo(i * 80 + h, h);
                ctx.stroke();
            }
            break;
        case 'multi-circle':
            for (let i = 0; i < 12; i++) {
                const cx = Math.random() * w;
                const cy = Math.random() * h;
                ctx.beginPath();
                ctx.arc(cx, cy, 30 + Math.random() * 60, 0, Math.PI * 2);
                ctx.stroke();
            }
            break;
        case 'burst':
            for (let i = 0; i < 24; i++) {
                const angle = (i / 24) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(w / 2, h / 2);
                ctx.lineTo(w / 2 + Math.cos(angle) * 300, h / 2 + Math.sin(angle) * 300);
                ctx.stroke();
            }
            break;
        case 'center-text':
            ctx.fillStyle = accent;
            ctx.beginPath();
            ctx.moveTo(w / 2 - 100, h / 2 - 1);
            ctx.lineTo(w / 2 + 100, h / 2 - 1);
            ctx.lineTo(w / 2 + 100, h / 2 + 1);
            ctx.lineTo(w / 2 - 100, h / 2 + 1);
            ctx.fill();
            break;
        case 'center-logo':
            // Draw rounded rect manually for compatibility
            const rx = w / 2 - 80, ry = h / 2 - 50, rw = 160, rh = 100, rr = 8;
            ctx.beginPath();
            ctx.moveTo(rx + rr, ry);
            ctx.lineTo(rx + rw - rr, ry);
            ctx.arcTo(rx + rw, ry, rx + rw, ry + rr, rr);
            ctx.lineTo(rx + rw, ry + rh - rr);
            ctx.arcTo(rx + rw, ry + rh, rx + rw - rr, ry + rh, rr);
            ctx.lineTo(rx + rr, ry + rh);
            ctx.arcTo(rx, ry + rh, rx, ry + rh - rr, rr);
            ctx.lineTo(rx, ry + rr);
            ctx.arcTo(rx, ry, rx + rr, ry, rr);
            ctx.closePath();
            ctx.stroke();
            break;
        default:
            break;
    }
}

async function generateAllReferenceImages() {
    if (!generatedScenes.length) return;

    const btn = document.getElementById('generateImagesBtn');
    btn.classList.add('generating');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';

    const total = generatedScenes.length;
    let completed = 0;

    showLoading(
        'AI 레퍼런스 이미지를 생성하고 있습니다...',
        `씬별 비주얼 컨셉을 기반으로 레퍼런스 이미지 생성 중 (${total}씬)`,
        true, total
    );

    for (let i = 0; i < total; i++) {
        const scene = generatedScenes[i];
        showSceneLoading(i, true);
        updateProgress(completed, total, `Scene ${i + 1}: ${scene.type} 이미지 생성 중...`);

        try {
            const dataUrl = await generateCanvasImage(
                scene.type, currentInfo.mood, scene.sceneNumber, currentInfo.brand, currentInfo.product
            );
            generatedReferenceImages[i] = dataUrl;
            updateSceneVisual(i, dataUrl);
            updatePromptCardWithImage(i, dataUrl);
        } catch (err) {
            console.error(`Scene ${i + 1} generation failed:`, err);
            showSceneError(i);
        }

        showSceneLoading(i, false);
        completed++;
        updateProgress(completed, total, completed === total ? '모든 이미지 생성 완료!' : `Scene ${i + 2} 준비 중...`);

        // Small delay for visual effect
        await new Promise(r => setTimeout(r, 300));
    }

    hideLoading();
    showToast(`${completed}개의 레퍼런스 이미지가 생성되었습니다!`, 'success');

    btn.classList.remove('generating');
    btn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i> AI 레퍼런스 이미지 재생성';
}

async function generateSingleImage(sceneIndex) {
    const btn = document.getElementById(`singleGenBtn_${sceneIndex}`);
    if (!btn) return;
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 생성 중...';
    showSceneLoading(sceneIndex, true);

    const scene = generatedScenes[sceneIndex];

    try {
        const dataUrl = await generateCanvasImage(
            scene.type, currentInfo.mood, scene.sceneNumber, currentInfo.brand, currentInfo.product
        );
        generatedReferenceImages[sceneIndex] = dataUrl;
        updateSceneVisual(sceneIndex, dataUrl);
        updatePromptCardWithImage(sceneIndex, dataUrl);
        showToast(`Scene ${sceneIndex + 1} 이미지가 생성되었습니다!`, 'success');
    } catch (err) {
        console.error(`Scene ${sceneIndex + 1} failed:`, err);
        showToast(`Scene ${sceneIndex + 1} 이미지 생성 실패`, 'error');
        showSceneError(sceneIndex);
    }

    showSceneLoading(sceneIndex, false);
}

// ============================================
//  UI UPDATE HELPERS
// ============================================

function updateSceneVisual(index, imgSrc) {
    const visual = document.getElementById(`sceneVisual_${index}`);
    if (!visual) return;

    const scene = generatedScenes[index];
    visual.classList.add('has-generated-image');
    visual.innerHTML = `
        <img src="${imgSrc}" alt="Scene ${scene.sceneNumber}" onclick="openLightbox('${escapeAttr(imgSrc)}', 'Scene ${scene.sceneNumber}: ${escapeAttr(scene.title)}')">
        <div class="scene-visual-overlay"><span><i class="fas fa-search-plus"></i> 크게 보기</span></div>
        <div class="scene-number-badge">SCENE ${String(scene.sceneNumber).padStart(2, '0')}</div>
        <div class="scene-duration-badge"><i class="fas fa-clock"></i> ${scene.duration}s</div>
    `;
}

function updatePromptCardWithImage(index, imgSrc) {
    const card = document.getElementById(`promptCard_${index}`);
    if (!card) return;

    // Check if already has preview
    const existing = card.querySelector('.prompt-card-image-preview');
    if (existing) existing.remove();

    const header = card.querySelector('.prompt-card-header');
    const previewDiv = document.createElement('div');
    previewDiv.className = 'prompt-card-image-preview';
    previewDiv.innerHTML = `
        <img src="${imgSrc}" alt="Generated" onclick="openLightbox('${escapeAttr(imgSrc)}', 'AI Generated Reference')">
        <span class="image-status"><i class="fas fa-check-circle"></i> AI 레퍼런스 이미지 생성 완료</span>
    `;
    header.insertAdjacentElement('afterend', previewDiv);
}

function showSceneLoading(index, show) {
    const visual = document.getElementById(`sceneVisual_${index}`);
    if (!visual) return;

    const existing = visual.querySelector('.scene-visual-loading');
    if (show && !existing) {
        const loader = document.createElement('div');
        loader.className = 'scene-visual-loading';
        loader.innerHTML = `<div class="mini-spinner"></div><span>AI 이미지 생성 중...</span>`;
        visual.appendChild(loader);
    } else if (!show && existing) {
        existing.remove();
    }
}

function showSceneError(index) {
    const visual = document.getElementById(`sceneVisual_${index}`);
    if (!visual) return;
    const existing = visual.querySelector('.scene-visual-loading');
    if (existing) existing.remove();

    // Restore the generate button
    const scene = generatedScenes[index];
    if (!generatedReferenceImages[index]) {
        const btn = document.getElementById(`singleGenBtn_${index}`);
        if (btn) {
            btn.classList.remove('loading');
            btn.innerHTML = '<i class="fas fa-redo"></i> 재시도';
        }
    }
}

// ---- Lightbox ----
function openLightbox(imgSrc, caption) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.onclick = (e) => { if (e.target === overlay || e.target.classList.contains('lightbox-close')) overlay.remove(); };
    overlay.innerHTML = `
        <button class="lightbox-close"><i class="fas fa-times"></i></button>
        <img src="${imgSrc}" alt="Lightbox">
        <div class="lightbox-info">${caption}</div>
    `;
    document.body.appendChild(overlay);

    // ESC to close
    const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
}

// ---- Loading Helpers ----
function showLoading(title, subtitle, showProgress = false, total = 0) {
    const overlay = document.getElementById('loadingOverlay');
    document.getElementById('loadingTitle').textContent = title;
    document.getElementById('loadingSubtitle').textContent = subtitle;

    const progressEl = document.getElementById('loadingProgress');
    if (showProgress) {
        progressEl.style.display = 'block';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = `0 / ${total} 씬 완료`;
    } else {
        progressEl.style.display = 'none';
    }

    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function updateLoadingText(title, subtitle) {
    document.getElementById('loadingTitle').textContent = title;
    document.getElementById('loadingSubtitle').textContent = subtitle;
}

function updateProgress(completed, total, text) {
    const pct = Math.round((completed / total) * 100);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = text || `${completed} / ${total} 씬 완료`;
}

// ---- Utility Functions ----
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttr(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function copyPrompt(btn, index) {
    const textEl = document.getElementById(`promptText_${index}`);
    const text = textEl.textContent;

    navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            btn.classList.remove('copied');
        }, 2000);
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
            btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            btn.classList.remove('copied');
        }, 2000);
    });
}

function copyAllPrompts() {
    if (!window._allPrompts) return;

    const fullText = window._allPrompts.map(p =>
        `=== Scene ${String(p.scene).padStart(2, '0')} — ${p.type} ===\n\n${p.prompt}`
    ).join('\n\n' + '='.repeat(60) + '\n\n');

    navigator.clipboard.writeText(fullText).then(() => {
        showToast('전체 프롬프트가 복사되었습니다!', 'success');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = fullText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('전체 프롬프트가 복사되었습니다!', 'success');
    });
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- Toast Notification ----
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    Object.assign(toast.style, {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 24px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#fff',
        background: type === 'error' ? '#e05252' : type === 'success' ? '#52c87a' : '#4a9ee0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        animation: 'fadeInUp 0.3s ease',
        fontFamily: 'Inter, sans-serif'
    });

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- PDF Export ----
function exportPDF() {
    showToast('인쇄 대화상자를 열고 "PDF로 저장"을 선택하세요.', 'info');
    setTimeout(() => window.print(), 500);
}
