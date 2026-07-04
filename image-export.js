/**
 * 이미지 내보내기 전용 모듈
 * HTML2Canvas를 사용한 고품질 이미지 내보내기
 */

// 이미지 내보내기 설정
const ImageExportConfig = {
    quality: {
        scale: 2,                    // 고해상도 (2배)
        format: 'png',               // PNG 포맷
        backgroundColor: '#ffffff',   // 흰색 배경
        useCORS: true,               // CORS 허용
        allowTaint: false,           // 보안 설정
        logging: false               // 로그 비활성화
    },
    // A3 가로 비율 (420mm × 297mm = 1.414:1)
    aspectRatio: 1.414,
    // 기본 크기 설정 (A3 가로)
    defaultSize: {
        width: 2000,    // A3 가로 기준
        height: 1414    // A3 세로 기준
    }
};

/**
 * HTML2Canvas 라이브러리 로드 확인 및 동적 로드
 */
async function ensureHTML2Canvas() {
    if (typeof html2canvas !== 'undefined') {
        console.log('✅ HTML2Canvas 이미 로드됨');
        return true;
    }

    console.log('🔄 HTML2Canvas 동적 로드 시작...');
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => {
            console.log('✅ HTML2Canvas 로드 완료');
            resolve(true);
        };
        script.onerror = () => {
            console.error('❌ HTML2Canvas 로드 실패');
            reject(new Error('HTML2Canvas 로드 실패'));
        };
        document.head.appendChild(script);
    });
}

/**
 * html-to-image 라이브러리 로드 (SVG 직렬화 방식 — 브라우저 엔진이 직접 래스터화)
 */
async function ensureHtmlToImage() {
    if (typeof htmlToImage !== 'undefined') return true;
    const cdns = [
        'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js',
        'https://unpkg.com/html-to-image@1.11.13/dist/html-to-image.min.js'
    ];
    for (const url of cdns) {
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = url;
                script.onload = resolve;
                script.onerror = () => reject(new Error('로드 실패: ' + url));
                document.head.appendChild(script);
            });
            if (typeof htmlToImage !== 'undefined') return true;
        } catch (e) { console.warn(e.message); }
    }
    throw new Error('html-to-image 로드 실패(모든 CDN)');
}

/**
 * 파일명 생성 함수
 */
function generateImageFilename(prefix = '표') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${prefix}-A3가로-${year}${month}${day}-${hours}${minutes}.png`;
}

/**
 * 진행 상태 표시
 */
function showProgress(message, show = true) {
    const existingProgress = document.getElementById('imageExportProgress');
    if (existingProgress) {
        existingProgress.remove();
    }

    if (!show) return;

    const progressDiv = document.createElement('div');
    progressDiv.id = 'imageExportProgress';
    progressDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        z-index: 10000;
        font-family: 'Malgun Gothic', sans-serif;
        font-size: 16px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    progressDiv.innerHTML = `
        <div style="margin-bottom: 10px;">
            <div style="
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto;
            "></div>
        </div>
        <div>${message}</div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    document.body.appendChild(progressDiv);
}

/**
 * 테이블을 A4 가로 비율로 조정하여 이미지로 내보내기
 */
async function exportTableAsImage(tableSelector, titleSelector = null, filenamePrefix = '표') {
    try {
        console.log('📸 이미지 내보내기 시작:', filenamePrefix);
        
        // 1. HTML2Canvas 라이브러리 확인
        showProgress('라이브러리 로딩 중...');
        await ensureHTML2Canvas();

        // 2. 테이블 요소 찾기
        const table = document.querySelector(tableSelector);
        if (!table) {
            throw new Error(`테이블을 찾을 수 없습니다: ${tableSelector}`);
        }
        console.log('✅ 테이블 발견:', table);

        // 3. 제목 요소 찾기 (선택적)
        let title = null;
        if (titleSelector) {
            title = document.querySelector(titleSelector);
            console.log('✅ 제목 요소:', title);
        }

        // 4. 캡처할 영역 결정
        let captureElement;
        if (title && table.parentElement) {
            // 제목과 테이블을 포함하는 공통 부모 찾기
            let parent = title.parentElement;
            while (parent && !parent.contains(table)) {
                parent = parent.parentElement;
            }
            captureElement = parent || table.parentElement || table;
        } else {
            captureElement = table.parentElement || table;
        }

        console.log('✅ 캡처 영역:', captureElement);

        // 5. 스크롤 영역까지 모두 보이도록 임시 확장 (브라우저 렌더링 그대로 캡처)
        showProgress('화면 캡처 준비 중...');
        const expanded = expandForFullCapture(captureElement);

        // 6. 화면 캡처
        showProgress('이미지 생성 중...');
        // 이수모형인 경우 화살표 렌더링을 위해 추가 대기
        const waitTime = (filenamePrefix === '이수모형') ? 5500 : 1500;
        await new Promise(resolve => setTimeout(resolve, waitTime)); // 렌더링 대기

        // 확장 후 실제 콘텐츠 전체 크기 (스크롤로 가려졌던 부분 포함)
        const fullW = Math.max(captureElement.scrollWidth, captureElement.offsetWidth);
        const fullH = Math.max(captureElement.scrollHeight, captureElement.offsetHeight);
        console.log(`📐 전체 캡처 크기: ${fullW}×${fullH}`);

        // 1순위: html-to-image(SVG 직렬화 → 브라우저 엔진이 직접 그림, 화면과 동일)
        // 실패 시: html2canvas 폴백
        let canvas;
        try {
            await ensureHtmlToImage();
            canvas = await htmlToImage.toCanvas(captureElement, {
                backgroundColor: ImageExportConfig.quality.backgroundColor,
                pixelRatio: ImageExportConfig.quality.scale,
                width: fullW,
                height: fullH
            });
            console.log('✅ 캡처 엔진: html-to-image');
        } catch (engineErr) {
            console.warn('⚠️ html-to-image 실패 → html2canvas 폴백:', engineErr);
            await ensureHTML2Canvas();
            canvas = await html2canvas(captureElement, {
                backgroundColor: ImageExportConfig.quality.backgroundColor,
                scale: ImageExportConfig.quality.scale,
                useCORS: ImageExportConfig.quality.useCORS,
                allowTaint: ImageExportConfig.quality.allowTaint,
                logging: ImageExportConfig.quality.logging,
                width: fullW,
                height: fullH,
                windowWidth: fullW,
                windowHeight: fullH,
                scrollX: 0,
                scrollY: 0
            });
            console.log('✅ 캡처 엔진: html2canvas(폴백)');
        }

        // 7. 원본 스타일 복원
        restoreExpanded(expanded);
        
        // 7.5. 화살표 스타일 복원 (이수모형인 경우)
        if (filenamePrefix === '이수모형') {
            restoreArrowsAfterCapture();
        }

        // 8. 이미지 다운로드
        showProgress('파일 저장 중...');
        const filename = generateImageFilename(filenamePrefix);
        downloadCanvasAsImage(canvas, filename);

        // 9. 완료
        setTimeout(() => showProgress('', false), 1000);
        console.log('✅ 이미지 내보내기 완료:', filename);

    } catch (error) {
        console.error('❌ 이미지 내보내기 오류:', error);
        showProgress('', false);
        alert(`이미지 내보내기 중 오류가 발생했습니다:\n${error.message}`);
    }
}

/**
 * 스크롤로 가려진 영역까지 모두 보이도록 임시 확장.
 * 레이아웃/폰트/배율은 건드리지 않아 브라우저에 보이는 모습 그대로 캡처된다.
 */
function expandForFullCapture(root) {
    const saved = [];
    const expandOne = (el) => {
        const cs = getComputedStyle(el);
        const scrollable = (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') &&
            (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1 ||
             cs.overflow === 'hidden' || cs.overflowX === 'auto' || cs.overflowY === 'auto' ||
             cs.overflowX === 'scroll' || cs.overflowY === 'scroll');
        if (!scrollable) return;
        saved.push({
            el: el,
            overflow: el.style.overflow,
            overflowX: el.style.overflowX,
            overflowY: el.style.overflowY,
            height: el.style.height,
            maxHeight: el.style.maxHeight,
            width: el.style.width,
            maxWidth: el.style.maxWidth,
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop
        });
        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.overflowY = 'visible';
        el.style.height = 'auto';
        el.style.maxHeight = 'none';
        el.style.maxWidth = 'none';
        el.scrollLeft = 0;
        el.scrollTop = 0;
    };
    expandOne(root);
    root.querySelectorAll('div').forEach(expandOne);
    return saved;
}

// 복제본의 캔버스에 원본 픽셀을 옮겨 그린다 (cloneNode 는 캔버스 내용을 복사하지 않음)
function copyCanvasPixels(srcRoot, dstRoot) {
    const src = srcRoot.querySelectorAll('canvas');
    const dst = dstRoot.querySelectorAll('canvas');
    for (let i = 0; i < src.length && i < dst.length; i++) {
        try {
            if (!src[i].width || !src[i].height) continue;
            dst[i].width = src[i].width;
            dst[i].height = src[i].height;
            dst[i].getContext('2d').drawImage(src[i], 0, 0);
        } catch (e) { /* tainted 등은 무시 */ }
    }
}

// 인쇄/이미지용 문서에서 이동 화살표를 '그 문서의 셀 실좌표'로 다시 그린다.
// (표 열이 비균등하게 늘어나므로 원본 비트맵을 확대하는 방식으로는 위치가 안 맞음)
function syncArrowCanvasesToTable(root) {
    const tbl = root.querySelector('.curriculum-table');
    if (!tbl) return;
    const cv = root.querySelector('#moveArrowsCanvas');
    if (!cv) return;
    const hov = root.querySelector('#moveArrowsHoverCanvas');
    if (hov) hov.style.display = 'none';
    cv.style.display = '';
    cv.style.position = 'absolute';
    cv.style.left = tbl.offsetLeft + 'px';
    cv.style.top = tbl.offsetTop + 'px';
    cv.style.width = tbl.offsetWidth + 'px';
    cv.style.height = tbl.offsetHeight + 'px';
    cv.width = tbl.offsetWidth;
    cv.height = tbl.offsetHeight;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const cvRect = cv.getBoundingClientRect();
    const kx = cvRect.width / (cv.width || 1), ky = cvRect.height / (cv.height || 1);
    const toLocal = function (r) { return { left: (r.left - cvRect.left) / kx, top: (r.top - cvRect.top) / ky, w: r.width / kx, h: r.height / ky }; };
    function edge(rect, c, t) {
        const dx = t.x - c.x, dy = t.y - c.y;
        if (!dx && !dy) return c;
        const sx = dx !== 0 ? (rect.w / 2) / Math.abs(dx) : Infinity;
        const sy = dy !== 0 ? (rect.h / 2) / Math.abs(dy) : Infinity;
        const k = Math.min(sx, sy);
        return { x: c.x + dx * k, y: c.y + dy * k };
    }
    root.querySelectorAll('.course-block.ghost[data-course-id]').forEach(function (g) {
        const id = g.dataset.courseId;
        const cur = [].slice.call(root.querySelectorAll('.course-block[data-course-id]')).find(function (b) {
            return b !== g && !b.classList.contains('ghost') && b.dataset.courseId === id;
        });
        if (!cur) return;
        const a = toLocal(g.getBoundingClientRect());
        const b = toLocal(cur.getBoundingClientRect());
        if (!a.w || !b.w) return;
        const ac = { x: a.left + a.w / 2, y: a.top + a.h / 2 };
        const bc = { x: b.left + b.w / 2, y: b.top + b.h / 2 };
        const p1 = edge(a, ac, bc), p2 = edge(b, bc, ac);
        ctx.save();
        ctx.strokeStyle = '#8a94a6';
        ctx.fillStyle = '#8a94a6';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        // 화면 스타일처럼 곡선(2차 베지어)으로: 진행 방향의 수직으로 살짝 휨
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const bow = Math.min(46, dist * 0.22);
        const cxp = (p1.x + p2.x) / 2 - (dy / dist) * bow;
        const cyp = (p1.y + p2.y) / 2 + (dx / dist) * bow;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cxp, cyp, p2.x, p2.y);
        ctx.stroke();
        // 화살촉은 곡선 끝의 접선 방향(제어점→끝점)
        const ang = Math.atan2(p2.y - cyp, p2.x - cxp), ah = 8;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(p2.x, p2.y);
        ctx.lineTo(p2.x - ah * Math.cos(ang - 0.45), p2.y - ah * Math.sin(ang - 0.45));
        ctx.lineTo(p2.x - ah * Math.cos(ang + 0.45), p2.y - ah * Math.sin(ang + 0.45));
        ctx.closePath(); ctx.fill();
        ctx.restore();
    });
}
function hideArrowCanvases(root) {
    root.querySelectorAll('#moveArrowsCanvas, #moveArrowsHoverCanvas').forEach(function (c) { c.style.display = 'none'; });
}

function restoreExpanded(saved) {
    saved.forEach(function (s) {
        s.el.style.overflow = s.overflow;
        s.el.style.overflowX = s.overflowX;
        s.el.style.overflowY = s.overflowY;
        s.el.style.height = s.height;
        s.el.style.maxHeight = s.maxHeight;
        s.el.style.width = s.width;
        s.el.style.maxWidth = s.maxWidth;
        s.el.scrollLeft = s.scrollLeft;
        s.el.scrollTop = s.scrollTop;
    });
}

/**
 * 요소를 A3 가로 비율로 임시 조정 (개선된 버전)
 */
function adjustElementForA3(element) {
    const originalStyles = {
        element: element,
        width: element.style.width,
        height: element.style.height,
        transform: element.style.transform,
        transformOrigin: element.style.transformOrigin,
        overflow: element.style.overflow,
        position: element.style.position,
        fontSize: element.style.fontSize
    };

    // 현재 크기 확인
    const rect = element.getBoundingClientRect();
    const currentWidth = rect.width;
    const currentHeight = rect.height;
    const currentRatio = currentWidth / currentHeight;

    console.log(`📐 원본 크기: ${currentWidth.toFixed(0)}×${currentHeight.toFixed(0)} (비율: ${currentRatio.toFixed(2)})`);

    // A3 가로 비율 적용 - 실제 콘텐츠 크기에 맞춘 조정
    const aspectRatio = ImageExportConfig.aspectRatio;
    let targetWidth, targetHeight;

    // 실제 콘텐츠 높이 측정 (스크롤 높이 사용)
    const actualHeight = element.scrollHeight;
    console.log(`📏 실제 콘텐츠 높이: ${actualHeight}px (현재 표시: ${currentHeight}px)`);
    
    // 실제 콘텐츠 높이를 기준으로 A3 비율 계산
    targetHeight = actualHeight + 40; // 여백 최소화 (40px만 추가)
    targetWidth = targetHeight * aspectRatio;
    
    // 최소 크기 보장
    if (targetWidth < 1200) {
        targetWidth = 1200;
        targetHeight = targetWidth / aspectRatio;
    }

    console.log(`📐 조정된 크기: ${targetWidth.toFixed(0)}×${targetHeight.toFixed(0)} (A3 비율: ${aspectRatio.toFixed(2)})`);

    // 일관된 스케일 팩터 적용 (모든 요소에 동일)
    const scaleFactor = 1.15; // 20%에서 15%로 조정하여 화살표와 일치
    
    // 스타일 적용
    element.style.width = `${targetWidth}px`;
    element.style.height = `${targetHeight}px`;
    element.style.overflow = 'visible'; // 콘텐츠가 잘리지 않도록
    element.style.position = 'relative';
    element.style.fontSize = '15px'; // 글씨 크기 적당히 증가
    element.style.transform = `scale(${scaleFactor})`; // 일관된 스케일 팩터
    element.style.transformOrigin = 'top left';
    
    // 테이블 내부 요소들의 폰트 크기도 증가
    const tables = element.querySelectorAll('table');
    const cellFontSizes = [];
    tables.forEach((table, tableIndex) => {
        const cells = table.querySelectorAll('td, th');
        cellFontSizes[tableIndex] = [];
        cells.forEach((cell, cellIndex) => {
            const computedStyle = window.getComputedStyle(cell);
            cellFontSizes[tableIndex][cellIndex] = cell.style.fontSize || computedStyle.fontSize;
            cell.style.fontSize = '13px'; // 셀 글씨 크기 적당히 증가
        });
    });
    
    // 원본 스타일에 셀 폰트 크기 정보 저장
    originalStyles.cellFontSizes = cellFontSizes;
    originalStyles.scaleFactor = scaleFactor; // 스케일 팩터 저장

    return originalStyles;
}

/**
 * 원본 스타일 복원
 */
function restoreOriginalStyles(originalStyles) {
    if (!originalStyles || !originalStyles.element) return;
    
    const element = originalStyles.element;
    element.style.width = originalStyles.width;
    element.style.height = originalStyles.height;
    element.style.transform = originalStyles.transform;
    element.style.transformOrigin = originalStyles.transformOrigin;
    element.style.overflow = originalStyles.overflow;
    element.style.position = originalStyles.position;
    element.style.fontSize = originalStyles.fontSize;
    
    // 테이블 셀 폰트 크기 복원
    if (originalStyles.cellFontSizes) {
        const tables = element.querySelectorAll('table');
        tables.forEach((table, tableIndex) => {
            const cells = table.querySelectorAll('td, th');
            cells.forEach((cell, cellIndex) => {
                if (originalStyles.cellFontSizes[tableIndex] && originalStyles.cellFontSizes[tableIndex][cellIndex]) {
                    cell.style.fontSize = originalStyles.cellFontSizes[tableIndex][cellIndex];
                }
            });
        });
    }
    
    console.log('🔄 원본 스타일 복원 완료');
}

/**
 * Canvas를 이미지 파일로 다운로드
 */
function downloadCanvasAsImage(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png', 1.0);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('💾 이미지 다운로드 완료:', filename);
}

/**
 * 이미지 캡처 전에 화살표를 최상위에 다시 그리기
 */
async function redrawArrowsForCapture() {
    console.log('🎯 캡처용 화살표 다시 그리기 시작...');
    
    try {
        // 기존 캔버스들을 최상위로 이동
        const canvases = document.querySelectorAll('#curriculumTab canvas');
        canvases.forEach((canvas, index) => {
            canvas.style.zIndex = (10000 + index).toString();
            canvas.style.position = 'absolute';
            canvas.style.pointerEvents = 'none';
        });
        
        // 화살표 데이터가 있으면 다시 그리기
        if (typeof window.drawMoveArrows === 'function' && window.movedCoursesForGhost) {
            console.log('🔄 drawMoveArrows 함수로 화살표 다시 그리기');
            window.drawMoveArrows(window.movedCoursesForGhost);
        } else if (typeof window.drawArrowsWithAnimation === 'function') {
            console.log('🔄 drawArrowsWithAnimation 함수로 화살표 다시 그리기');
            window.drawArrowsWithAnimation();
        } else if (typeof window.drawMovedCourseArrows === 'function') {
            console.log('🔄 drawMovedCourseArrows 함수로 화살표 다시 그리기');
            window.drawMovedCourseArrows();
        }
        
        // 캔버스 위치 재조정
        await repositionCanvasesForCapture();
        
        // 화살표 렌더링을 위해 충분히 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('✅ 캡처용 화살표 다시 그리기 완료');
        
    } catch (error) {
        console.error('❌ 화살표 다시 그리기 오류:', error);
    }
}

/**
 * 캡처용 캔버스 위치 재조정
 */
async function repositionCanvasesForCapture() {
    console.log('📍 캔버스 위치 재조정 시작...');
    
    try {
        // 이수모형 테이블 컨테이너 찾기
        const curriculumTable = document.querySelector('.curriculum-table');
        const tableContainer = curriculumTable?.parentElement;
        
        if (!tableContainer) {
            console.log('❌ 테이블 컨테이너를 찾을 수 없음');
            return;
        }
        
        // 모든 화살표 캔버스 찾기
        const canvases = [
            document.getElementById('moveArrowsCanvas'),
            document.getElementById('moveArrowsHoverCanvas'),
            ...document.querySelectorAll('#curriculumTab canvas')
        ].filter(canvas => canvas !== null);
        
        console.log(`📍 찾은 캔버스 개수: ${canvases.length}`);
        
        // 테이블 컨테이너의 실제 크기와 위치 확인
        const containerRect = tableContainer.getBoundingClientRect();
        const tableRect = curriculumTable.getBoundingClientRect();
        
        console.log('📏 컨테이너 크기:', {
            width: containerRect.width,
            height: containerRect.height,
            left: containerRect.left,
            top: containerRect.top
        });
        
        // 각 캔버스의 크기와 위치를 테이블에 맞게 조정
        canvases.forEach((canvas, index) => {
            // 캔버스 크기를 테이블 크기에 맞춤
            canvas.width = tableRect.width;
            canvas.height = tableRect.height;
            
            // 캔버스 스타일 조정
            canvas.style.width = `${tableRect.width}px`;
            canvas.style.height = `${tableRect.height}px`;
            canvas.style.position = 'absolute';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.zIndex = (10000 + index).toString();
            canvas.style.pointerEvents = 'none';
            
            console.log(`📍 캔버스 ${index} 조정 완료:`, {
                width: canvas.width,
                height: canvas.height,
                zIndex: canvas.style.zIndex
            });
        });
        
        // 컨테이너를 상대적 위치로 설정
        tableContainer.style.position = 'relative';
        
        console.log('✅ 캔버스 위치 재조정 완료');
        
    } catch (error) {
        console.error('❌ 캔버스 위치 재조정 오류:', error);
    }
}

/**
 * 이미지 캡처 후에 화살표 스타일 복원
 */
function restoreArrowsAfterCapture() {
    console.log('🔄 캡처 후 화살표 스타일 복원...');
    
    try {
        // 모든 화살표 관련 캔버스 복원
        const canvases = [
            document.getElementById('moveArrowsCanvas'),
            document.getElementById('moveArrowsHoverCanvas'),
            ...document.querySelectorAll('#curriculumTab canvas')
        ].filter(canvas => canvas !== null);
        
        canvases.forEach(canvas => {
            // 원래 스타일로 복원 (이수모형 탭의 기본 설정)
            canvas.style.zIndex = canvas.id.includes('Hover') ? '1000' : '1';
            canvas.style.position = 'absolute';
            canvas.style.pointerEvents = 'none';
            canvas.style.top = '0';
            canvas.style.left = '0';
        });
        
        // 화살표 다시 그리기 (원래 위치로)
        if (typeof window.drawMoveArrows === 'function' && window.movedCoursesForGhost) {
            window.drawMoveArrows(window.movedCoursesForGhost);
        }
        
        console.log('✅ 화살표 스타일 복원 완료');
        
    } catch (error) {
        console.error('❌ 화살표 스타일 복원 오류:', error);
    }
}

/**
 * 이수모형 전용 화살표 포함 내보내기
 */
async function exportCurriculumWithArrows() {
    try {
        console.log('📸 이수모형 화살표 포함 내보내기 시작');
        
        // 1. HTML2Canvas 라이브러리 확인
        showProgress('라이브러리 로딩 중...');
        await ensureHTML2Canvas();

        // 2. 이수모형 탭 전체를 캡처 영역으로 설정
        const curriculumTab = document.getElementById('curriculum');
        if (!curriculumTab) {
            throw new Error('이수모형 탭을 찾을 수 없습니다');
        }

        // 3. 캔버스를 임시로 인라인 스타일로 강제 위치 조정
        showProgress('화살표 위치 조정 중...');
        const canvasAdjustments = await forceCanvasInlinePositioning();

        // 4. 캡처 영역을 A3 비율로 조정
        showProgress('화면 캡처 준비 중...');
        const originalStyles = adjustElementForA3(curriculumTab);

        // 4.5. A3 조정 후 캔버스 위치 재동기화
        await resynchronizeCanvasAfterA3Adjustment(canvasAdjustments);

        // 5. 화살표 위치 최종 검증 및 수정
        await finalizeArrowPositioning(canvasAdjustments);

        // 6. 충분한 렌더링 대기 (조정된 대기시간)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 6. HTML2Canvas 옵션 최적화하여 캡처
        showProgress('이미지 생성 중...');
        const canvas = await html2canvas(curriculumTab, {
            backgroundColor: ImageExportConfig.quality.backgroundColor,
            scale: ImageExportConfig.quality.scale,
            useCORS: true,
            allowTaint: true, // tainted 캔버스도 허용
            logging: false, // 로깅 비활성화로 성능 향상
            canvas: null, // 자동 캔버스 생성
            foreignObjectRendering: false, // 외부 객체 렌더링 비활성화
            removeContainer: true, // 컨테이너 정리로 안정성 향상
            ignoreElements: (element) => {
                // 호버 캔버스 제외
                if (element.id === 'moveArrowsHoverCanvas') {
                    console.log('🚫 호버 캔버스 제외:', element.id);
                    return true;
                }
                
                // 빈 캔버스나 문제가 있는 요소들 제외
                if (element.tagName === 'CANVAS') {
                    if (element.width === 0 || element.height === 0) {
                        console.log('🚫 빈 캔버스 제외:', element.id);
                        return true;
                    }
                    // vis-network 캔버스 제외 (tainted 원인)
                    if (element.style.touchAction === 'none' || element.style.userSelect === 'none') {
                        console.log('🚫 vis-network 캔버스 제외:', element.id);
                        return true;
                    }
                }
                return element.classList.contains('dropdown') || 
                       element.classList.contains('button') ||
                       element.id === 'imageExportProgress';
            }
        });

        // 7. 원본 스타일 복원
        restoreOriginalStyles(originalStyles);
        restoreCanvasPositioning(canvasAdjustments);

        // 8. 이미지 다운로드
        showProgress('파일 저장 중...');
        const filename = generateImageFilename('이수모형');
        downloadCanvasAsImage(canvas, filename);

        // 9. 완료
        setTimeout(() => showProgress('', false), 1000);
        console.log('✅ 이수모형 화살표 포함 내보내기 완료:', filename);

    } catch (error) {
        console.error('❌ 이수모형 내보내기 오류:', error);
        showProgress('', false);
        alert(`이미지 내보내기 중 오류가 발생했습니다:\n${error.message}`);
    }
}

/**
 * 캔버스를 인라인 스타일로 강제 위치 조정 (개선된 버전)
 */
async function forceCanvasInlinePositioning() {
    console.log('📍 캔버스 인라인 스타일 강제 조정 시작');
    
    const adjustments = [];
    
    try {
        // 이수모형 테이블과 관련 캔버스들 찾기
        const curriculumTable = document.querySelector('.curriculum-table');
        const tableContainer = curriculumTable?.closest('.table-container, .table-responsive, #curriculum');
        
        if (!curriculumTable || !tableContainer) {
            console.log('❌ 테이블 또는 컨테이너를 찾을 수 없음');
            return adjustments;
        }

        // 테이블의 실제 위치 계산 (스케일 적용 전)
        const tableRect = curriculumTable.getBoundingClientRect();
        const containerRect = tableContainer.getBoundingClientRect();
        
        console.log('📏 테이블 위치:', {
            table: { x: tableRect.left, y: tableRect.top, w: tableRect.width, h: tableRect.height },
            container: { x: containerRect.left, y: containerRect.top, w: containerRect.width, h: containerRect.height }
        });

        // 모든 화살표 관련 캔버스 찾기 (중복 제거)
        const uniqueCanvases = new Map(); // ID를 키로 사용하여 중복 제거
        
        // 직접 ID로 찾기 (호버 캔버스 제외)
        [document.getElementById('moveArrowsCanvas')] // moveArrowsHoverCanvas 제외
            .forEach(canvas => {
                if (canvas && canvas.tagName === 'CANVAS') {
                    uniqueCanvases.set(canvas.id, canvas);
                }
            });
        
        // 추가 검색으로 찾기 (이미 있는 것은 제외)
        document.querySelectorAll('#curriculum canvas').forEach(canvas => {
            if (canvas && canvas.tagName === 'CANVAS' && canvas.id && !uniqueCanvases.has(canvas.id)) {
                uniqueCanvases.set(canvas.id, canvas);
            }
        });
        
        // 유효한 캔버스만 필터링
        const canvases = Array.from(uniqueCanvases.values()).filter(canvas => {
            // 빈 캔버스 제외
            if (canvas.width === 0 || canvas.height === 0) {
                console.log(`⚠️ 빈 캔버스 제외: ${canvas.id}, 크기: ${canvas.width}x${canvas.height}`);
                return false;
            }
            
            // vis-network 캔버스 제외 (tainted 원인)
            if (canvas.style.touchAction === 'none' || canvas.style.userSelect === 'none') {
                console.log(`⚠️ vis-network 캔버스 제외: ${canvas.id}`);
                return false;
            }
            
            return true;
        });

        console.log(`🔍 발견된 캔버스: ${canvases.length}개`);

        // 각 캔버스를 테이블 위치에 정확히 맞춤
        canvases.forEach((canvas, index) => {
            // 기존 스타일 백업
            const originalStyle = {
                position: canvas.style.position,
                top: canvas.style.top,
                left: canvas.style.left,
                width: canvas.style.width,
                height: canvas.style.height,
                zIndex: canvas.style.zIndex,
                transform: canvas.style.transform,
                transformOrigin: canvas.style.transformOrigin
            };
            adjustments.push({ canvas, originalStyle });

            // 테이블과 완전히 동일한 크기와 위치로 강제 설정
            const offsetTop = tableRect.top - containerRect.top;
            const offsetLeft = tableRect.left - containerRect.left;
            const scaleFactor = 1.15; // adjustElementForA3와 동일한 스케일 팩터

            canvas.style.position = 'absolute';
            canvas.style.top = `0px`; // 컨테이너 기준 0,0에서 시작
            canvas.style.left = `0px`;
            canvas.style.width = `${tableRect.width}px`;
            canvas.style.height = `${tableRect.height}px`;
            canvas.style.zIndex = (20000 + index).toString();
            canvas.style.transform = `scale(${scaleFactor})`; // 테이블과 정확히 동일한 스케일
            canvas.style.transformOrigin = 'top left'; // 테이블과 동일한 기준점
            
            // 캔버스 해상도를 스케일 전 테이블 크기로 설정 (더 정확한 동기화)
            const unscaledWidth = tableRect.width / scaleFactor;
            const unscaledHeight = tableRect.height / scaleFactor;
            canvas.width = unscaledWidth;
            canvas.height = unscaledHeight;
            
            console.log(`📍 캔버스 ${index} 조정:`, {
                id: canvas.id,
                position: `${offsetLeft}, ${offsetTop}`,
                size: `${tableRect.width} x ${tableRect.height}`,
                zIndex: canvas.style.zIndex
            });
        });

        // 컨테이너 position 설정
        if (tableContainer.style.position !== 'relative') {
            tableContainer.style.position = 'relative';
        }

        // 화살표 다시 그리기 (초기 스케일 적용)
        if (typeof window.drawMoveArrows === 'function' && window.movedCoursesForGhost) {
            console.log('🔄 화살표 다시 그리기', window.movedCoursesForGhost.length, '개 이동된 과목');
            
            // 기존 캔버스 내용 지우기
            canvases.forEach((canvas, index) => {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    console.log(`📏 캔버스 ${index} (${canvas.id}) 내용 지우기 완료`);
                }
            });
            
            // 디버깅: 재렌더링 전 상태 확인
            console.log('🔍 재렌더링 전 상태:');
            debugCanvasTableAlignment();
            
            // 리사이즈 시와 동일한 처리: renderCurriculumTable 호출하여 화살표 재정렬
            if (typeof window.renderCurriculumTable === 'function') {
                console.log('🔄 이수모형표 재렌더링 (페이지 확대축소와 동일한 메커니즘)');
                window.renderCurriculumTable();
                
                // renderCurriculumTable 완료 후 추가 대기 (디바운스와 동일)
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 디버깅: 재렌더링 후 상태 확인
                console.log('🔍 재렌더링 후 상태:');
                debugCanvasTableAlignment();
                
                // 화살표가 비어있다면 강제로 다시 그리기
                const mainCanvas = canvases.find(c => c.id === 'moveArrowsCanvas');
                if (mainCanvas) {
                    const ctx = mainCanvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
                    const hasContent = imageData.data.some(pixel => pixel !== 0);
                    if (!hasContent && typeof window.drawMoveArrows === 'function') {
                        console.log('🔧 빈 캔버스 발견 - drawMoveArrows 직접 호출');
                        window.drawMoveArrows(window.movedCoursesForGhost);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
                console.log('✅ 이수모형표 재렌더링 완료 - 화살표 자동 재정렬됨');
            } else {
                // 대체 방법: 기존 화살표 그리기
                drawMoveArrowsForExport(window.movedCoursesForGhost, canvases);
            }
            
            // 그리기 완료 확인
            setTimeout(() => {
                canvases.forEach((canvas, index) => {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const hasContent = imageData.data.some(pixel => pixel !== 0);
                        console.log(`📊 캔버스 ${index} (${canvas.id}) 내용 여부:`, hasContent);
                    }
                });
            }, 100);
        } else {
            console.log('⚠️ 화살표 그리기 함수 또는 데이터가 없음');
        }

        console.log('✅ 캔버스 인라인 조정 완료');
        return adjustments;

    } catch (error) {
        console.error('❌ 캔버스 조정 오류:', error);
        return adjustments;
    }
}

/**
 * A3 조정 후 캔버스 위치 재동기화 (개선된 버전)
 */
async function resynchronizeCanvasAfterA3Adjustment(adjustments) {
    console.log('🔄 A3 조정 후 캔버스 재동기화 시작');
    
    try {
        // 조정된 테이블 위치 다시 계산
        const curriculumTable = document.querySelector('.curriculum-table');
        const tableContainer = curriculumTable?.closest('.table-container, .table-responsive, #curriculum');
        
        if (!curriculumTable || !tableContainer) {
            console.log('❌ 테이블 재조정 실패');
            return;
        }

        const tableRect = curriculumTable.getBoundingClientRect();
        const containerRect = tableContainer.getBoundingClientRect();
        const scaleFactor = 1.15; // 일관된 스케일 팩터 사용
        
        console.log('📏 A3 조정 후 테이블 위치:', {
            table: { x: tableRect.left, y: tableRect.top, w: tableRect.width, h: tableRect.height },
            container: { x: containerRect.left, y: containerRect.top, w: containerRect.width, h: containerRect.height },
            scaleFactor
        });

        // 각 캔버스 위치를 새로운 테이블 위치에 맞게 완벽하게 재동기화
        adjustments.forEach(({ canvas }, index) => {
            const offsetTop = tableRect.top - containerRect.top;
            const offsetLeft = tableRect.left - containerRect.left;

            canvas.style.top = `0px`; // 컨테이너 기준 0,0에서 시작
            canvas.style.left = `0px`;
            canvas.style.width = `${tableRect.width}px`;
            canvas.style.height = `${tableRect.height}px`;
            canvas.style.transform = `scale(${scaleFactor})`; // 테이블과 정확히 동일한 스케일
            canvas.style.transformOrigin = 'top left'; // 테이블과 동일한 기준점
            
            // 캔버스 해상도를 스케일 전 크기로 정확히 설정
            const unscaledWidth = tableRect.width / scaleFactor;
            const unscaledHeight = tableRect.height / scaleFactor;
            canvas.width = unscaledWidth;
            canvas.height = unscaledHeight;
            
            console.log(`🔄 캔버스 ${index} 재동기화:`, {
                id: canvas.id,
                position: `${offsetLeft}, ${offsetTop}`,
                displaySize: `${tableRect.width} x ${tableRect.height}`,
                canvasSize: `${unscaledWidth} x ${unscaledHeight}`,
                scaleFactor
            });
        });

        // 화살표 다시 그리기 (스케일 팩터 적용)
        if (typeof window.drawMoveArrows === 'function' && window.movedCoursesForGhost) {
            console.log('🎯 A3 조정 후 화살표 재그리기 (스케일 적용)');
            
            // 캔버스 내용 지우기
            adjustments.forEach(({ canvas }) => {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    console.log(`📏 캔버스 ${canvas.id} 내용 지우기 완료`);
                }
            });
            
            // 디버깅: A3 조정 후 재렌더링 전 상태
            console.log('🔍 A3 조정 후 재렌더링 전 상태:');
            debugCanvasTableAlignment();
            
            // 리사이즈 시와 동일한 처리: renderCurriculumTable 호출
            if (typeof window.renderCurriculumTable === 'function') {
                console.log('🔄 A3 조정 후 이수모형표 재렌더링');
                window.renderCurriculumTable();
                
                // renderCurriculumTable 완료 후 추가 대기 (디바운스와 동일)
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // 디버깅: A3 조정 후 재렌더링 후 상태
                console.log('🔍 A3 조정 후 재렌더링 후 상태:');
                debugCanvasTableAlignment();
                
                // 화살표가 비어있다면 강제로 다시 그리기
                const mainCanvas = adjustments.find(a => a.canvas.id === 'moveArrowsCanvas')?.canvas;
                if (mainCanvas) {
                    const ctx = mainCanvas.getContext('2d');
                    const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
                    const hasContent = imageData.data.some(pixel => pixel !== 0);
                    if (!hasContent && typeof window.drawMoveArrows === 'function') {
                        console.log('🔧 A3 조정 후 빈 캔버스 발견 - drawMoveArrows 직접 호출');
                        window.drawMoveArrows(window.movedCoursesForGhost);
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
                console.log('✅ A3 조정 후 이수모형표 재렌더링 완료 - 화살표 자동 재정렬됨');
            } else {
                // 대체 방법: 기존 화살표 그리기
                drawMoveArrowsForExport(window.movedCoursesForGhost, adjustments.map(a => a.canvas));
            }
        }

        console.log('✅ A3 조정 후 캔버스 재동기화 완료');
        
    } catch (error) {
        console.error('❌ A3 조정 후 재동기화 오류:', error);
    }
}

/**
 * 화살표 위치 최종 조정 및 검증
 */
async function finalizeArrowPositioning(adjustments) {
    console.log('🎯 화살표 위치 최종 조정 시작');
    
    try {
        // 테이블과 캔버스의 현재 상태 확인
        const curriculumTable = document.querySelector('.curriculum-table');
        const tableContainer = curriculumTable?.closest('.table-container, .table-responsive, #curriculum');
        
        if (!curriculumTable || !tableContainer) {
            console.log('❌ 최종 조정 실패: 테이블을 찾을 수 없음');
            return;
        }

        // 현재 테이블과 캔버스의 동기화 상태 검증
        const tableRect = curriculumTable.getBoundingClientRect();
        const scaleFactor = 1.15;
        
        adjustments.forEach(({ canvas }, index) => {
            // 캔버스가 정확한 위치와 크기를 갖는지 재확인
            const canvasRect = canvas.getBoundingClientRect();
            const expectedWidth = tableRect.width;
            const expectedHeight = tableRect.height;
            
            // 크기가 맞지 않으면 재조정
            if (Math.abs(canvasRect.width - expectedWidth) > 5 || 
                Math.abs(canvasRect.height - expectedHeight) > 5) {
                
                console.log(`🔧 캔버스 ${index} 크기 재조정 필요:`, {
                    current: { w: canvasRect.width, h: canvasRect.height },
                    expected: { w: expectedWidth, h: expectedHeight }
                });
                
                // 크기 재조정
                canvas.style.width = `${expectedWidth}px`;
                canvas.style.height = `${expectedHeight}px`;
                
                const unscaledWidth = expectedWidth / scaleFactor;
                const unscaledHeight = expectedHeight / scaleFactor;
                canvas.width = unscaledWidth;
                canvas.height = unscaledHeight;
            }
        });
        
        // 모든 캔버스 내용 지우고 최종 화살표 그리기
        adjustments.forEach(({ canvas }) => {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        });
        
        // 최종 화살표 렌더링
        if (typeof window.drawMoveArrows === 'function' && window.movedCoursesForGhost) {
            console.log('🎯 최종 화살표 렌더링 실행');
            
            // 1차: renderCurriculumTable로 정확한 위치 계산
            if (typeof window.renderCurriculumTable === 'function') {
                window.renderCurriculumTable();
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            // 2차: drawMoveArrows로 화살표 직접 그리기
            window.drawMoveArrows(window.movedCoursesForGhost);
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 3차: 결과 검증
            const mainCanvas = adjustments.find(a => a.canvas.id === 'moveArrowsCanvas')?.canvas;
            if (mainCanvas) {
                const ctx = mainCanvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
                const hasContent = imageData.data.some(pixel => pixel !== 0);
                console.log('🎯 최종 화살표 렌더링 검증:', hasContent ? '성공' : '실패');
                
                if (!hasContent) {
                    // 마지막 시도: 화살표 강제 다시 그리기
                    console.log('🔧 화살표 강제 재렌더링 시도');
                    window.drawMoveArrows(window.movedCoursesForGhost);
                }
            }
        }
        
        console.log('✅ 화살표 위치 최종 조정 완료');
        
    } catch (error) {
        console.error('❌ 최종 화살표 조정 오류:', error);
    }
}

/**
 * 캔버스 위치 복원 (개선된 버전)
 */
function restoreCanvasPositioning(adjustments) {
    console.log('🔄 캔버스 위치 복원 시작');
    
    adjustments.forEach(({ canvas, originalStyle }) => {
        Object.assign(canvas.style, originalStyle);
    });
    
    // 화살표 원래대로 다시 그리기
    if (typeof window.drawMoveArrows === 'function' && window.movedCoursesForGhost) {
        setTimeout(() => {
            window.drawMoveArrows(window.movedCoursesForGhost);
        }, 100);
    }
    
    console.log('✅ 캔버스 위치 복원 완료');
}

/**
 * 디버깅용: 캔버스와 테이블 위치 상세 분석
 */
function debugCanvasTableAlignment() {
    console.log('\n🔍 === 캔버스-테이블 위치 디버깅 시작 ===');
    
    const curriculumTable = document.querySelector('.curriculum-table');
    const tableContainer = curriculumTable?.closest('.table-container, .table-responsive, #curriculum');
    const canvas = document.getElementById('moveArrowsCanvas');
    
    if (curriculumTable && tableContainer && canvas) {
        const tableRect = curriculumTable.getBoundingClientRect();
        const containerRect = tableContainer.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        
        console.log('📐 위치 분석:');
        console.log('  테이블:', {
            x: tableRect.left, y: tableRect.top,
            w: tableRect.width, h: tableRect.height,
            transform: window.getComputedStyle(curriculumTable).transform
        });
        console.log('  컨테이너:', {
            x: containerRect.left, y: containerRect.top,
            w: containerRect.width, h: containerRect.height,
            position: window.getComputedStyle(tableContainer).position
        });
        console.log('  캔버스:', {
            x: canvasRect.left, y: canvasRect.top,
            w: canvasRect.width, h: canvasRect.height,
            style: {
                position: canvas.style.position,
                top: canvas.style.top,
                left: canvas.style.left,
                transform: canvas.style.transform,
                zIndex: canvas.style.zIndex
            },
            actual: { width: canvas.width, height: canvas.height }
        });
        
        // 위치 차이 계산
        const offsetX = canvasRect.left - tableRect.left;
        const offsetY = canvasRect.top - tableRect.top;
        console.log('  🎯 위치 차이:', { offsetX, offsetY });
        
        // 샘플 셀 위치 확인
        const sampleCell = document.getElementById('curriculum-cell-1-1');
        if (sampleCell) {
            const cellRect = sampleCell.getBoundingClientRect();
            console.log('  샘플 셀 (1-1):', {
                x: cellRect.left, y: cellRect.top,
                w: cellRect.width, h: cellRect.height,
                relative_to_table: {
                    x: cellRect.left - tableRect.left,
                    y: cellRect.top - tableRect.top
                }
            });
        }
    }
    
    console.log('🔍 === 캔버스-테이블 위치 디버깅 완료 ===\n');
}

/**
 * 이미지 내보내기 전용 화살표 그리기 함수 (완전히 새로운 접근법)
 * 캔버스 좌표계에 맞춘 전용 화살표 그리기
 */
function drawMoveArrowsForExport(movedCoursesForGhost, canvases) {
    if (!movedCoursesForGhost || movedCoursesForGhost.length === 0 || !canvases.length) {
        console.log('⚠️ 화살표 데이터 또는 캔버스가 없음');
        return;
    }
    
    console.log(`🎯 내보내기 전용 화살표 그리기: ${movedCoursesForGhost.length}개 이동 과목`);
    
    // 첫 번째 캔버스 사용 (일반적으로 moveArrowsCanvas)
    const canvas = canvases.find(c => c.id === 'moveArrowsCanvas') || canvases[0];
    if (!canvas) {
        console.log('❌ 유효한 캔버스를 찾을 수 없음');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.log('❌ 캔버스 컨텍스트를 가져올 수 없음');
        return;
    }
    
    // 테이블 컨테이너 찾기
    const curriculumTable = document.querySelector('.curriculum-table');
    const tableContainer = curriculumTable?.closest('.table-container, .table-responsive, #curriculum');
    
    if (!curriculumTable || !tableContainer) {
        console.log('❌ 테이블 컨테이너를 찾을 수 없음');
        return;
    }
    
    // 캔버스와 테이블의 크기 비율 계산
    const tableRect = curriculumTable.getBoundingClientRect();
    const containerRect = tableContainer.getBoundingClientRect();
    
    // 스케일 팩터 가져오기
    const scaleFactor = window.getTableScaleFactor ? window.getTableScaleFactor() : 1;
    
    console.log('📏 내보내기 화살표 그리기 상세 정보:', {
        canvas: { w: canvas.width, h: canvas.height },
        canvasStyle: { w: canvas.style.width, h: canvas.style.height },
        table: { w: tableRect.width, h: tableRect.height },
        container: { w: containerRect.width, h: containerRect.height },
        scaleFactor: scaleFactor
    });
    
    // 각 이동된 과목에 대해 화살표 그리기
    movedCoursesForGhost.forEach((moveInfo, index) => {
        const originalCellId = getCurriculumCellId(moveInfo.initialCourse);
        const newCellId = getCurriculumCellId(moveInfo.currentCourse);
        
        if (originalCellId !== newCellId) {
            const originalCell = document.getElementById(originalCellId);
            const newCell = document.getElementById(newCellId);
            
            if (originalCell && newCell) {
                drawArrowBetweenCellsForExport(ctx, canvas, containerRect, originalCell, newCell, index, moveInfo, scaleFactor);
            }
        }
    });
    
    console.log('✅ 내보내기 전용 화살표 그리기 완료');
}

/**
 * 이미지 내보내기 전용 화살표 그리기 (단일 화살표)
 */
function drawArrowBetweenCellsForExport(ctx, canvas, containerRect, fromCell, toCell, index, moveInfo, scaleFactor) {
    if (!ctx || !canvas || !containerRect) {
        return;
    }
    
    // 고스트 블럭과 현재 교과목 블럭 찾기
    const targetCourseId = moveInfo.currentCourse.id;
    
    // 고스트 블럭들 중에서 해당 교과목의 고스트 블럭 찾기
    const ghostBlocks = fromCell.querySelectorAll('.course-block.ghost');
    let fromGhostBlock = null;
    
    ghostBlocks.forEach(block => {
        if (block.dataset.courseId && block.dataset.courseId === String(targetCourseId)) {
            fromGhostBlock = block;
        }
    });
    
    // 현재 위치의 블럭 찾기
    const allBlocksInCell = toCell.querySelectorAll('.course-block:not(.ghost)');
    let toCurrentBlock = null;
    
    allBlocksInCell.forEach(block => {
        if (block.dataset.courseId && block.dataset.courseId === String(targetCourseId)) {
            toCurrentBlock = block;
        }
    });
    
    if (!fromGhostBlock || !toCurrentBlock) {
        console.log(`⚠️ 블록을 찾을 수 없음: ghost=${!!fromGhostBlock}, current=${!!toCurrentBlock}`);
        return;
    }
    
    // 블록의 화면 좌표 가져오기
    const fromRect = fromGhostBlock.getBoundingClientRect();
    const toRect = toCurrentBlock.getBoundingClientRect();
    
    // 컨테이너 기준 상대 좌표로 변환
    const fromCenterX = fromRect.left + fromRect.width / 2 - containerRect.left;
    const fromCenterY = fromRect.top + fromRect.height / 2 - containerRect.top;
    const toCenterX = toRect.left + toRect.width / 2 - containerRect.left;
    const toCenterY = toRect.top + toRect.height / 2 - containerRect.top;
    
    // 화살표 시작점과 끝점 계산 (블록 테두리)
    const fromEdge = getRectEdgePointForExport(
        fromRect.left - containerRect.left,
        fromRect.top - containerRect.top,
        fromRect.width,
        fromRect.height,
        toCenterX, toCenterY
    );
    const toEdge = getRectEdgePointForExport(
        toRect.left - containerRect.left,
        toRect.top - containerRect.top,
        toRect.width,
        toRect.height,
        fromCenterX, fromCenterY
    );
    
    // 캔버스 좌표로 변환 (스케일 팩터 적용)
    const canvasScaleX = canvas.width / (containerRect.width / scaleFactor);
    const canvasScaleY = canvas.height / (containerRect.height / scaleFactor);
    
    const fromX = (fromEdge.x / scaleFactor) * canvasScaleX;
    const fromY = (fromEdge.y / scaleFactor) * canvasScaleY;
    const toX = (toEdge.x / scaleFactor) * canvasScaleX;
    const toY = (toEdge.y / scaleFactor) * canvasScaleY;
    
    console.log(`🎯 화살표 ${index} 좌표 계산:`, {
        scaleFactor,
        canvasScale: { x: canvasScaleX.toFixed(3), y: canvasScaleY.toFixed(3) },
        from: { x: fromX.toFixed(1), y: fromY.toFixed(1) },
        to: { x: toX.toFixed(1), y: toY.toFixed(1) }
    });
    
    // 유효성 검사
    if (isNaN(fromX) || isNaN(fromY) || isNaN(toX) || isNaN(toY) ||
        fromX < 0 || fromY < 0 || toX < 0 || toY < 0 ||
        fromX > canvas.width || fromY > canvas.height || 
        toX > canvas.width || toY > canvas.height) {
        console.log(`⚠️ 화살표 ${index} 좌표가 캔버스 범위를 벗어남`);
        return;
    }
    
    // 화살표 그리기
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance < 10) {
        console.log(`⚠️ 화살표 ${index} 거리가 너무 짧음: ${distance.toFixed(1)}px`);
        return;
    }
    
    // 곡선 화살표 그리기
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    
    // 곡선 제어점 계산
    const isVertical = Math.abs(deltaY) > Math.abs(deltaX);
    let cp1X, cp1Y, cp2X, cp2Y;
    
    if (isVertical) {
        // 수직 곡선
        const controlOffset = Math.abs(deltaY) * 0.4;
        cp1X = fromX;
        cp1Y = fromY + (deltaY > 0 ? controlOffset : -controlOffset);
        cp2X = toX;
        cp2Y = toY - (deltaY > 0 ? controlOffset : -controlOffset);
    } else {
        // 수평 곡선
        const controlOffset = Math.abs(deltaX) * 0.4;
        cp1X = fromX + (deltaX > 0 ? controlOffset : -controlOffset);
        cp1Y = fromY;
        cp2X = toX - (deltaX > 0 ? controlOffset : -controlOffset);
        cp2Y = toY;
    }
    
    ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, toX, toY);
    
    // 화살표 스타일 설정
    ctx.strokeStyle = 'rgba(189, 189, 189, 0.9)';
    ctx.lineWidth = Math.max(1, canvas.width / 800); // 캔버스 크기에 비례
    ctx.setLineDash([Math.max(3, canvas.width / 200), Math.max(4, canvas.width / 150)]);
    ctx.stroke();
    
    // 화살표 머리 그리기
    const angle = Math.atan2(toY - cp2Y, toX - cp2X);
    const arrowSize = Math.max(8, canvas.width / 100);
    const arrowAngle = Math.PI / 6;
    
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - arrowSize * Math.cos(angle - arrowAngle),
        toY - arrowSize * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
        toX - arrowSize * Math.cos(angle + arrowAngle),
        toY - arrowSize * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fillStyle = 'rgba(189, 189, 189, 0.9)';
    ctx.fill();
    
    ctx.setLineDash([]); // 점선 리셋
}

/**
 * 이미지 내보내기 전용 직사각형 테두리 점 계산
 */
function getRectEdgePointForExport(rectX, rectY, rectWidth, rectHeight, targetX, targetY) {
    const centerX = rectX + rectWidth / 2;
    const centerY = rectY + rectHeight / 2;
    
    const dx = targetX - centerX;
    const dy = targetY - centerY;
    
    if (Math.abs(dx) > Math.abs(dy)) {
        // 좌우 테두리
        const x = dx > 0 ? rectX + rectWidth : rectX;
        const y = centerY + dy * (rectWidth / 2) / Math.abs(dx);
        return { x, y };
    } else {
        // 상하 테두리
        const x = centerX + dx * (rectHeight / 2) / Math.abs(dy);
        const y = dy > 0 ? rectY + rectHeight : rectY;
        return { x, y };
    }
}

/**
 * getCurriculumCellId 헬퍼 함수 (원본에서 복사)
 */
function getCurriculumCellId(course) {
    if (!course) return null;
    const semester = course.semester || course.학기 || 1;
    const grade = course.grade || course.학년 || 1;
    return `curriculum-cell-${grade}-${semester}`;
}

/**
 * 각 탭별 내보내기 함수들
 */

// 수행평가매트릭스 내보내기
async function exportMatrixAsImage() {
    await exportTableAsImage('#matrixTable', '#matrixTitle', '수행평가매트릭스');
}

// 이수모형 내보내기
async function exportCurriculumAsImage() {
    // 특별한 이수모형 전용 내보내기 함수 사용
    await exportCurriculumWithArrows();
}

// 공통가치대응 내보내기
async function exportCommonValuesAsImage() {
    await exportTableAsImage('.common-values-table', '#commonValuesTitle', '공통가치대응');
}

/**
 * =========================================================
 * PDF 내보내기 (브라우저 인쇄 엔진 사용 — 벡터 텍스트, 완전한 렌더링 충실도)
 * - 대상 영역만 A3 가로로 인쇄. 스크롤로 가려진 영역 포함(확장 후 인쇄).
 * - 인쇄 대화상자에서 '대상: PDF로 저장'을 선택하면 PDF 파일로 저장된다.
 * =========================================================
 */
function exportTableAsPDF(tableSelector, titleSelector, filenamePrefix) {
    try {
        const table = document.querySelector(tableSelector);
        if (!table) throw new Error('테이블을 찾을 수 없습니다: ' + tableSelector);
        let captureElement = table.parentElement || table;
        const title = titleSelector ? document.querySelector(titleSelector) : null;
        if (title) {
            let parent = title.parentElement;
            while (parent && !parent.contains(table)) parent = parent.parentElement;
            captureElement = parent || captureElement;
        }

        const A3_RATIO = 1.414;
        const PAGE_W = 1500, PAGE_H = 1036; // A3 가로 인쇄영역 내 안전 크기

        // ---------- 미리보기 팝업 ----------
        const old = document.getElementById('pdfPreviewModal');
        if (old) old.remove();
        const modal = document.createElement('div');
        modal.id = 'pdfPreviewModal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;';
        const PRE_W = Math.min(900, window.innerWidth - 80);
        const preScale = PRE_W / PAGE_W;
        const PRE_H = Math.round(PAGE_H * preScale);
        modal.innerHTML =
            '<div style="background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.35);padding:16px 18px;max-width:' + (PRE_W + 40) + 'px;">' +
            '  <div style="display:flex;align-items:center;gap:14px;margin-bottom:10px;">' +
            '    <b style="font-size:15px;color:#2c3e50;">미리보기</b>' +
            '    <span style="flex:1"></span>' +
            '    <span style="font-size:13px;color:#555;display:inline-flex;align-items:center;gap:6px;">표 글자 크기' +
            '      <button id="pdfFontMinus" class="btn btn-sm" style="padding:2px 10px;font-size:14px;">−</button>' +
            '      <b id="pdfFontVal" style="min-width:34px;text-align:center;font-size:13px;color:#2c3e50;">원본</b>' +
            '      <button id="pdfFontPlus" class="btn btn-sm" style="padding:2px 10px;font-size:14px;">＋</button>' +
            '    </span>' +
            '    <button id="pdfGo" class="btn btn-primary" style="padding:6px 16px;">인쇄 / PDF 저장</button>' +
            '    <button id="pdfSaveImg" class="btn btn-secondary" style="padding:6px 14px;">이미지 저장</button>' +
            '    <button id="pdfCancel" class="btn btn-secondary" style="padding:6px 12px;">닫기</button>' +
            '  </div>' +
            '  <div id="pdfPreviewWrap" style="width:' + PRE_W + 'px;height:' + PRE_H + 'px;background:#e8ebf0;border:1px solid #d3d8e0;border-radius:6px;overflow:hidden;position:relative;">' +
            '    <div id="pdfPreviewMsg" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888;font-size:14px;">미리보기 생성 중…</div>' +
            '  </div>' +
            '</div>';
        document.body.appendChild(modal);

        let iframe = null;

        function destroyIframe() { if (iframe) { iframe.remove(); iframe = null; } }
        function closeModal() { destroyIframe(); modal.remove(); }
        modal.querySelector('#pdfCancel').onclick = closeModal;
        modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

        // ---------- 인쇄 문서 생성 (폰트 크기 지정 가능) ----------
        function build(fontPx) {
            destroyIframe();
            const msg = modal.querySelector('#pdfPreviewMsg');
            if (msg) msg.style.display = 'flex';

            const expanded = expandForFullCapture(captureElement);
            const clone = captureElement.cloneNode(true);
            restoreExpanded(expanded);

            let headHtml = '';
            document.querySelectorAll('link[rel="stylesheet"], style').forEach(function (n) { headHtml += n.outerHTML; });
            const fontCss = fontPx ?
                ('#pdfRoot table,#pdfRoot th,#pdfRoot td{font-size:' + fontPx + 'px !important}' +
                 '#pdfRoot .course-block,#pdfRoot .course-block-title{font-size:' + fontPx + 'px !important}' +
                 '#pdfRoot .course-block-info,#pdfRoot .course-credits-text{font-size:' + Math.max(8, fontPx - 2) + 'px !important}' +
                 '#pdfRoot .matrix-header-bar h3,#pdfRoot h3{font-size:' + (fontPx + 5) + 'px !important}' +
                 '#pdfRoot .matrix-header-bar span{font-size:' + Math.max(9, fontPx - 1) + 'px !important}') : '';

            iframe = document.createElement('iframe');
            // 처음부터 미리보기 래퍼 안에 생성 (iframe 을 나중에 옮기면 리로드되어 내용이 사라짐)
            iframe.style.cssText = 'position:absolute;left:0;top:0;width:2000px;height:1400px;border:0;visibility:hidden;pointer-events:none;background:#fff;';
            (modal.querySelector('#pdfPreviewWrap') || document.body).appendChild(iframe);
            const doc = iframe.contentDocument;
            doc.open();
            doc.write('<!DOCTYPE html><html><head><meta charset="utf-8">' +
                '<base href="' + location.href.split('#')[0] + '">' +
                '<title>' + filenamePrefix + '-' + new Date().toISOString().slice(0, 10) + '</title>' +
                headHtml +
                '<style>' +
                '@page{size:A3 landscape;margin:10mm}' +
                'html,body{margin:0!important;padding:0!important;background:#fff!important;width:auto!important;overflow:visible!important}' +
                '*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;visibility:visible!important}' +
                '.map-ctrls,.vm-toggle{display:none!important}' +
                '.table-container{max-height:none!important;height:auto!important;min-height:0!important;overflow:visible!important;margin:0!important;padding:0!important;box-shadow:none!important;border:0!important}' +
                'div[data-map-ov]{overflow:visible!important;height:auto!important;max-height:none!important}' +
                '.matrix-table,.curriculum-table,.common-values-table,.matrix-extra-table{width:100%!important;min-width:0!important}' +
                '.vis-network{display:none!important}' +
                'th,td{background-clip:padding-box!important;position:static!important}' +
                'thead th{z-index:auto!important}' +
                fontCss +
                '</style></head><body></body></html>');
            doc.close();

            // head 의 외부 스크립트가 파서를 블로킹하므로, 문서 load 후에 조립한다
            function assemble() {
            if (!doc.body) { setTimeout(assemble, 120); return; }
            const imported = doc.importNode(clone, true);
            imported.id = 'pdfRoot';
            imported.style.width = '1500px';
            doc.body.style.width = '1500px';
            doc.body.appendChild(imported);
            copyCanvasPixels(captureElement, imported); // 화살표 등 캔버스 내용 이식
            hideArrowCanvases(imported); // 크기 측정 오염 방지 (동기화는 맞춤 후)

            setTimeout(function () {
                function setW(w) { imported.style.width = w + 'px'; doc.body.style.width = w + 'px'; void imported.offsetHeight; }
                function measure() { return { w: Math.max(imported.scrollWidth, imported.offsetWidth), h: Math.max(imported.scrollHeight, imported.offsetHeight) }; }
                let m = measure();
                for (let pass = 0; pass < 4; pass++) {
                    const wantW = Math.max(Math.round(m.h * A3_RATIO), 800);
                    if (Math.abs(wantW - m.w) <= Math.max(40, m.w * 0.03)) break;
                    setW(wantW); m = measure();
                }
                const scale = Math.min(PAGE_W / Math.max(m.w, 1), PAGE_H / Math.max(m.h, 1));
                const page = doc.createElement('div');
                page.id = 'pdfPage';
                page.style.cssText = 'width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;overflow:hidden;position:relative;page-break-inside:avoid;background:#fff;';
                const fitBox = doc.createElement('div');
                fitBox.style.cssText = 'transform:scale(' + scale + ');transform-origin:top left;width:' + m.w + 'px;' +
                    'position:absolute;left:' + Math.max(0, (PAGE_W - m.w * scale) / 2) + 'px;top:' + Math.max(0, (PAGE_H - m.h * scale) / 2) + 'px;';
                page.appendChild(fitBox);
                fitBox.appendChild(imported);
                doc.body.appendChild(page);

                // 조립 후 실측 재맞춤: 폰트 확대 등으로 실제 크기가 예측과 다르면 배율·위치 보정
                void imported.offsetHeight;
                const m2 = { w: Math.max(imported.scrollWidth, imported.offsetWidth), h: Math.max(imported.scrollHeight, imported.offsetHeight) };
                const scale2 = Math.min(PAGE_W / Math.max(m2.w, 1), PAGE_H / Math.max(m2.h, 1));
                fitBox.style.width = m2.w + 'px';
                fitBox.style.transform = 'scale(' + scale2 + ')';
                fitBox.style.left = Math.max(0, (PAGE_W - m2.w * scale2) / 2) + 'px';
                fitBox.style.top = Math.max(0, (PAGE_H - m2.h * scale2) / 2) + 'px';

                // 화살표 캔버스를 최종 표 크기·위치에 동기화
                syncArrowCanvasesToTable(imported);

                // ---------- 미리보기에 표시 (이동 없이 스타일만 전환) ----------
                if (msg) msg.style.display = 'none';
                iframe.style.cssText =
                    'position:absolute;left:0;top:0;width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;border:0;' +
                    'transform:scale(' + preScale + ');transform-origin:top left;visibility:visible;pointer-events:none;background:#fff;';
                if (window.__pdfDebugSkipPrint) { window.__pdfIframe = iframe; }
            }, 250);
            } // assemble 끝
            if (doc.readyState === 'complete') assemble();
            else iframe.addEventListener('load', assemble, { once: true });
            // 외부 스크립트 지연 대비 안전망
            setTimeout(function () { if (!doc.getElementById('pdfRoot')) assemble(); }, 2500);
        }

        let curFont = null; // null = 원본
        let fontDeb = null;
        function setFont(px) {
            curFont = px;
            modal.querySelector('#pdfFontVal').textContent = px ? (px + 'px') : '원본';
            clearTimeout(fontDeb);
            fontDeb = setTimeout(function () { build(curFont); }, 350);
        }
        modal.querySelector('#pdfFontPlus').onclick = function () { setFont(Math.min(28, (curFont || 14) + 1)); };
        modal.querySelector('#pdfFontMinus').onclick = function () { setFont(Math.max(8, (curFont || 14) - 1)); };
        modal.querySelector('#pdfGo').onclick = function () {
            if (!iframe) return;
            try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) { console.error(e); }
        };
        modal.querySelector('#pdfSaveImg').onclick = async function () {
            const btn = this;
            btn.disabled = true; const orig = btn.textContent; btn.textContent = '생성 중…';
            let host = null, fstyle = null;
            try {
                await ensureHtmlToImage();
                // 미리보기와 동일한 A3 페이지를 부모 문서 오프스크린에 조립해 캡처
                const expanded = expandForFullCapture(captureElement);
                const clone2 = captureElement.cloneNode(true);
                restoreExpanded(expanded);
                clone2.id = 'pdfImgRoot';

                if (curFont) {
                    fstyle = document.createElement('style');
                    fstyle.textContent =
                        '#pdfImgRoot table,#pdfImgRoot th,#pdfImgRoot td{font-size:' + curFont + 'px !important}' +
                        '#pdfImgRoot .course-block,#pdfImgRoot .course-block-title{font-size:' + curFont + 'px !important}' +
                        '#pdfImgRoot .course-block-info,#pdfImgRoot .course-credits-text{font-size:' + Math.max(8, curFont - 2) + 'px !important}' +
                        '#pdfImgRoot .matrix-header-bar h3,#pdfImgRoot h3{font-size:' + (curFont + 5) + 'px !important}' +
                        '#pdfImgRoot .matrix-header-bar span{font-size:' + Math.max(9, curFont - 1) + 'px !important}';
                    document.head.appendChild(fstyle);
                }
                fstyle = fstyle || null;
                const extra = document.createElement('style');
                extra.textContent =
                    '#pdfImgHost .map-ctrls,#pdfImgHost .vm-toggle,#pdfImgHost .vis-network{display:none!important}' +
                    '#pdfImgHost .table-container{max-height:none!important;height:auto!important;min-height:0!important;overflow:visible!important;margin:0!important;padding:0!important;box-shadow:none!important;border:0!important}' +
                    '#pdfImgHost th,#pdfImgHost td{background-clip:padding-box!important;position:static!important}' +
                    '#pdfImgHost .matrix-table,#pdfImgHost .curriculum-table,#pdfImgHost .common-values-table,#pdfImgHost .matrix-extra-table{width:100%!important;min-width:0!important}';
                document.head.appendChild(extra);

                host = document.createElement('div');
                host.id = 'pdfImgHost';
                host.style.cssText = 'position:fixed;left:-100000px;top:0;background:#fff;';
                const page2 = document.createElement('div');
                page2.style.cssText = 'width:' + PAGE_W + 'px;height:' + PAGE_H + 'px;overflow:hidden;position:relative;background:#fff;';
                const fit2 = document.createElement('div');
                fit2.style.cssText = 'transform-origin:top left;position:absolute;';
                clone2.style.width = '1500px';
                fit2.appendChild(clone2); page2.appendChild(fit2); host.appendChild(page2);
                document.body.appendChild(host);
                copyCanvasPixels(captureElement, clone2); // 화살표 등 캔버스 내용 이식
                hideArrowCanvases(clone2);

                function setW2(w) { clone2.style.width = w + 'px'; void clone2.offsetHeight; }
                function meas2() { return { w: Math.max(clone2.scrollWidth, clone2.offsetWidth), h: Math.max(clone2.scrollHeight, clone2.offsetHeight) }; }
                let m = meas2();
                for (let pass = 0; pass < 4; pass++) {
                    const wantW = Math.max(Math.round(m.h * A3_RATIO), 800);
                    if (Math.abs(wantW - m.w) <= Math.max(40, m.w * 0.03)) break;
                    setW2(wantW); m = meas2();
                }
                const sc2 = Math.min(PAGE_W / Math.max(m.w, 1), PAGE_H / Math.max(m.h, 1));
                fit2.style.width = m.w + 'px';
                fit2.style.transform = 'scale(' + sc2 + ')';
                fit2.style.left = Math.max(0, (PAGE_W - m.w * sc2) / 2) + 'px';
                fit2.style.top = Math.max(0, (PAGE_H - m.h * sc2) / 2) + 'px';
                syncArrowCanvasesToTable(clone2);

                const canvas = await htmlToImage.toCanvas(page2, { backgroundColor: '#ffffff', pixelRatio: 2 });
                downloadCanvasAsImage(canvas, generateImageFilename(filenamePrefix));
                extra.remove();
            } catch (e) {
                console.error(e);
                alert('이미지 저장 오류: ' + e.message);
            }
            if (host) host.remove();
            if (fstyle) fstyle.remove();
            btn.disabled = false; btn.textContent = orig;
        };

        build(null);
    } catch (e) {
        alert('PDF 내보내기 오류: ' + e.message);
    }
}

async function exportMatrixAsPDF() { exportTableAsPDF('#matrixTable', '#matrixTitle', '수행평가매트릭스'); }
async function exportCurriculumAsPDF() { exportTableAsPDF('.curriculum-table', '#curriculumTitle', '이수모형'); }
async function exportCommonValuesAsPDF() { exportTableAsPDF('.common-values-table', '#commonValuesTitle', '공통가치대응'); }

// 전역 스코프에 함수들 노출
window.exportMatrixAsImage = exportMatrixAsImage;
window.exportCurriculumAsImage = exportCurriculumAsImage;
window.exportCommonValuesAsImage = exportCommonValuesAsImage;
window.exportMatrixAsPDF = exportMatrixAsPDF;
window.exportCurriculumAsPDF = exportCurriculumAsPDF;
window.exportCommonValuesAsPDF = exportCommonValuesAsPDF;

console.log('🖼️ 이미지 내보내기 모듈이 로드되었습니다.');
console.log('📐 A3 가로 비율 (1.414:1)로 고품질 PNG 이미지를 생성합니다.');