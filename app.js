// app.js

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyAK6GWqYbhv19jTgzVxzXNRdVODFtLMKCA",
    authDomain: "uosmatrix.firebaseapp.com",
    databaseURL: "https://uosmatrix-default-rtdb.firebaseio.com",
    projectId: "uosmatrix",
    storageBucket: "uosmatrix.firebasestorage.app",
    messagingSenderId: "208876542369",
    appId: "1:208876542369:web:a50a4d20468bfb4c8b13e0"
};


// 🔧 vis-network 폰트 호환성을 위한 전역 안전 함수
window.sanitizeVisNetworkFont = function(fontObj) {
    // 기본 vis-network 호환 폰트 속성
    const defaultFont = {
        color: '#343a40',
        size: 14,
        face: 'arial',
        background: 'none',
        strokeWidth: 0,
        strokeColor: '#ffffff'
    };
    
    if (!fontObj || typeof fontObj !== 'object') {
        return { ...defaultFont };
    }
    
    // vis-network이 요구하는 모든 속성을 명시적으로 설정
    return {
        color: (fontObj.color && typeof fontObj.color === 'string') ? fontObj.color : defaultFont.color,
        size: (fontObj.size && typeof fontObj.size === 'number' && fontObj.size > 0) ? fontObj.size : defaultFont.size,
        face: (fontObj.face && typeof fontObj.face === 'string') ? fontObj.face : defaultFont.face,
        background: (fontObj.background && typeof fontObj.background === 'string') ? fontObj.background : defaultFont.background,
        strokeWidth: (fontObj.strokeWidth && typeof fontObj.strokeWidth === 'number') ? fontObj.strokeWidth : defaultFont.strokeWidth,
        strokeColor: (fontObj.strokeColor && typeof fontObj.strokeColor === 'string') ? fontObj.strokeColor : defaultFont.strokeColor
    };
};

// 🛡️ vis-network DataSet 인터셉션 시스템 - 모든 노드 데이터를 자동으로 검증/수정
window.createSafeVisNetworkDataSet = function(initialData = []) {
    // 원본 DataSet 생성
    const dataSet = new vis.DataSet();
    
    // 노드 데이터 sanitization 함수
    const sanitizeNodeData = (nodeData) => {
        if (!nodeData || typeof nodeData !== 'object') return nodeData;
        
        const sanitizedData = { ...nodeData };
        
        // font 속성이 있으면 sanitize
        if (sanitizedData.font) {
            sanitizedData.font = window.sanitizeVisNetworkFont(sanitizedData.font);
        }
        
        return sanitizedData;
    };
    
    // 원본 메서드들 저장
    const originalAdd = dataSet.add.bind(dataSet);
    const originalUpdate = dataSet.update.bind(dataSet);
    const originalUpdateOnly = dataSet.updateOnly.bind(dataSet);
    
    // add 메서드 오버라이드
    dataSet.add = function(data, senderId) {
        let sanitizedData = data;
        
        if (Array.isArray(data)) {
            sanitizedData = data.map(sanitizeNodeData);
        } else if (data && typeof data === 'object') {
            sanitizedData = sanitizeNodeData(data);
        }
        
        return originalAdd(sanitizedData, senderId);
    };
    
    // update 메서드 오버라이드
    dataSet.update = function(data, senderId) {
        let sanitizedData = data;
        
        if (Array.isArray(data)) {
            sanitizedData = data.map(sanitizeNodeData);
        } else if (data && typeof data === 'object') {
            sanitizedData = sanitizeNodeData(data);
        }
        
        return originalUpdate(sanitizedData, senderId);
    };
    
    // updateOnly 메서드 오버라이드
    dataSet.updateOnly = function(data, senderId) {
        let sanitizedData = data;
        
        if (Array.isArray(data)) {
            sanitizedData = data.map(sanitizeNodeData);
        } else if (data && typeof data === 'object') {
            sanitizedData = sanitizeNodeData(data);
        }
        
        return originalUpdateOnly(sanitizedData, senderId);
    };
    
    // 초기 데이터가 있으면 추가
    if (initialData && initialData.length > 0) {
        dataSet.add(initialData);
    }
    
    return dataSet;
};

// 🔧 네트워크 생성 후 폰트 속성 일괄 검증 및 수정
// 🛡️ 네트워크 데이터 무결성 검증 및 복구 함수
window.validateNetworkDataIntegrity = function(network, autoRepair = true) {
    if (!network || !network.body || !network.body.data) {
        return false;
    }
    
    try {
        const nodes = network.body.data.nodes;
        const edges = network.body.data.edges;
        
        if (!nodes || !edges) {
            return false;
        }
        
        // 노드 무결성 검사
        const nodeIds = new Set();
        const invalidNodes = [];
        
        for (let nodeId of nodes.getIds()) {
            const node = nodes.get(nodeId);
            if (!node || node.id === undefined) {
                invalidNodes.push(nodeId);
            } else {
                nodeIds.add(node.id);
            }
        }
        
        // 손상된 노드 제거
        if (autoRepair && invalidNodes.length > 0) {
            nodes.remove(invalidNodes);
        }
        
        // 엣지 무결성 검사 및 복구
        const invalidEdges = [];
        
        for (let edgeId of edges.getIds()) {
            const edge = edges.get(edgeId);
            if (!edge || edge.from === undefined || edge.to === undefined) {
                invalidEdges.push(edgeId);
                continue;
            }
            
            // 엣지가 참조하는 노드 존재 여부 확인
            if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
                invalidEdges.push(edgeId);
            }
        }
        
        // 손상된 엣지 제거
        if (autoRepair && invalidEdges.length > 0) {
            edges.remove(invalidEdges);
        }
        
        const hasInvalidData = invalidNodes.length > 0 || invalidEdges.length > 0;
        
        if (hasInvalidData && !autoRepair) {
            return false;
        }
        
        // 무결성 검사 완료
        return true;
        
    } catch (error) {
        return false;
    }
};

window.validateAndFixNetworkFonts = function(network) {
    if (!network || !network.body || !network.body.data || !network.body.data.nodes) {
        return;
    }
    
    try {
        const allNodes = network.body.data.nodes.get();
        const nodesToUpdate = [];
        
        allNodes.forEach(node => {
            if (node.font) {
                const sanitizedFont = window.sanitizeVisNetworkFont(node.font);
                // 원래 폰트와 다르면 업데이트 필요
                if (JSON.stringify(node.font) !== JSON.stringify(sanitizedFont)) {
                    nodesToUpdate.push({
                        id: node.id,
                        font: sanitizedFont
                    });
                }
            }
        });
        
        // 일괄 업데이트
        if (nodesToUpdate.length > 0) {
            network.body.data.nodes.update(nodesToUpdate);
        }
    } catch (error) {
    }
};

// vis-network 오류 복구 시스템 제거 - vis-network 자체 처리에 맡김
window.setupNetworkErrorRecovery = function(network) {
    // 제거됨 - vis-network 자체 오류 처리 사용
};

// 전역 vis-network 오류 방지 시스템 제거 - vis-network 자체 처리에 맡김
window.setupGlobalVisNetworkErrorPrevention = function() {
    // 제거됨 - vis-network 자체 오류 처리 사용
};


// Firebase 초기화
let db;
let firebaseInitialized = false;
let isOnline = navigator.onLine;

// Firebase 초기화 및 데이터베이스 연결
function initializeFirebase() {
    try {
        if (typeof firebase !== 'undefined') {
            // Firebase 앱이 이미 초기화되었는지 확인
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            } else {
                firebase.app(); // 이미 초기화된 앱 사용
            }
            db = firebase.database();
            firebaseInitialized = true;
            
            // 연결 상태 모니터링
            const connectedRef = db.ref('.info/connected');
            connectedRef.on('value', function(snap) {
                if (snap.val() === true) {
                    isOnline = true;
                    showConnectionStatus('온라인', 'success');
                    // 온라인 상태가 되면 로컬 데이터를 Firebase와 동기화
                    syncLocalDataToFirebase();
                } else {
                    isOnline = false;
                    showConnectionStatus('오프라인', 'warning');
                }
            });
        } else {
            firebaseInitialized = false;
            showConnectionStatus('Firebase SDK 로드 실패', 'error');
        }
    } catch (error) {
        firebaseInitialized = false;
        showConnectionStatus('Firebase 초기화 실패', 'error');
    }
}

// 연결 상태 표시
function showConnectionStatus(status, type) {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'connectionStatus';
        statusDiv.style.position = 'fixed';
        statusDiv.style.top = '10px';
        statusDiv.style.right = '10px';
        statusDiv.style.padding = '8px 16px';
        statusDiv.style.borderRadius = '4px';
        statusDiv.style.zIndex = '10000';
        statusDiv.style.fontSize = '12px';
        statusDiv.style.fontWeight = 'bold';
        document.body.appendChild(statusDiv);
    }
    
    const element = document.getElementById('connectionStatus');
    element.textContent = `🌐 ${status}`;
    
    if (type === 'success') {
        element.style.backgroundColor = '#d4edda';
        element.style.color = '#155724';
        element.style.border = '1px solid #c3e6cb';
    } else if (type === 'warning') {
        element.style.backgroundColor = '#fff3cd';
        element.style.color = '#856404';
        element.style.border = '1px solid #ffeaa7';
    } else if (type === 'error') {
        element.style.backgroundColor = '#f8d7da';
        element.style.color = '#721c24';
        element.style.border = '1px solid #f5c6cb';
    }
    
    // 3초 후 자동으로 숨기기 (성공 상태는 제외)
    if (type !== 'success') {
        setTimeout(() => {
            if (element) element.style.display = 'none';
        }, 3000);
    }
}

// Firebase에 데이터 저장
async function saveDataToFirebase(path, data) {
    if (!firebaseInitialized || !isOnline) {
        return false;
    }
    
    try {
        await db.ref(path).set(data);
        return true;
    } catch (error) {
        return false;
    }
}

// Firebase에서 데이터 로드
async function loadDataFromFirebase(path) {
    if (!firebaseInitialized) {
        return null;
    }
    
    try {
        const snapshot = await db.ref(path).once('value');
        const data = snapshot.val();
        return data;
    } catch (error) {
        return null;
    }
}

// 메모리 데이터를 Firebase와 동기화
async function syncLocalDataToFirebase() {
    if (!firebaseInitialized || !isOnline) {
        return;
    }
    
    // 동기화 오버레이 표시
    const syncOverlay = document.getElementById('sync-loading-overlay');
    if (syncOverlay) syncOverlay.style.display = 'flex';

    
    try {
        // 메모리에 있는 버전 데이터 동기화
        if (versions && Object.keys(versions).length > 0) {
            // 각 버전을 개별적으로 저장
            for (const [versionName, versionData] of Object.entries(versions)) {
                await saveDataToFirebase(`versions/${versionName}`, versionData);
            }
            
            // 버전 목록 저장
            const versionList = Object.keys(versions);
            await saveDataToFirebase('versionList', versionList);
        }
        
        // 현재 버전 동기화
        if (currentVersion) {
            await saveDataToFirebase('currentVersion', currentVersion);
        }
        
        // 설정 데이터 동기화 (메모리에서)
        if (window.designSettings) {
            await saveDataToFirebase('settings/design', window.designSettings);
        }
        
        // 제목들 동기화 (DOM에서 직접)
        const matrixTitle = document.getElementById('matrixTitleText')?.textContent;
        if (matrixTitle) {
            await saveDataToFirebase('settings/matrixTitle', matrixTitle);
        }
        
        const curriculumTitle = document.getElementById('curriculumTitle')?.textContent;
        if (curriculumTitle) {
            await saveDataToFirebase('settings/curriculumTitle', curriculumTitle);
        }
        
        const commonValuesTitle = document.getElementById('commonValuesTitle')?.textContent;
        if (commonValuesTitle) {
            await saveDataToFirebase('settings/commonValuesTitle', commonValuesTitle);
        }
        
        showToast('데이터가 클라우드와 동기화되었습니다.');
        
    } catch (error) {
        showToast('클라우드 동기화에 실패했습니다.');
    } finally {
        // 동기화 오버레이 숨김
        if (syncOverlay) syncOverlay.style.display = 'none';
    }
}

// Firebase에서 모든 데이터 로드
async function loadAllDataFromFirebase() {
    if (!firebaseInitialized) {
        return false;
    }
    
    
    try {
        // 버전 목록 로드
        const versionList = await loadDataFromFirebase('versionList');
        if (versionList && Array.isArray(versionList)) {
            
            // 각 버전 데이터를 개별적으로 로드
            versions = {};
            for (const versionName of versionList) {
                const versionData = await loadDataFromFirebase(`versions/${versionName}`);
                if (versionData) {
                    versions[versionName] = versionData;
                }
            }
            
            // 로컬 스토리지 사용 안 함
        } else {
            // 기존 방식으로 전체 버전 데이터 로드 시도
            const firebaseVersions = await loadDataFromFirebase('versions');
            if (firebaseVersions) {
                versions = firebaseVersions;
            }
        }
        
        // 현재 버전 로드
        const firebaseCurrentVersion = await loadDataFromFirebase('currentVersion');
        if (firebaseCurrentVersion) {
            currentVersion = firebaseCurrentVersion;
        }
        
        // 버전 순서 로드
        const firebaseVersionOrder = await loadDataFromFirebase('versionOrder');
        if (firebaseVersionOrder && Array.isArray(firebaseVersionOrder)) {
            // versionOrder는 메모리에만 유지, localStorage 사용하지 않음
            window.versionOrder = firebaseVersionOrder;
        }
        
        // 설정 데이터 로드
        const firebaseDesignSettings = await loadDataFromFirebase('settings/design');
        if (firebaseDesignSettings) {
            designSettings = firebaseDesignSettings;
        }
        
        // 제목들은 버전 데이터에서 관리됨 - localStorage 사용하지 않음
        
        showToast('클라우드에서 데이터를 불러왔습니다.');
        return true;
        
    } catch (error) {
        showToast('클라우드 데이터 로드에 실패했습니다.');
        return false;
    }
}

// 전역 변수
let editingIndex = -1;

// 화살표 스타일 설정 (기본값: 'straight-curve')
let arrowStyle = 'straight-curve';
let filteredCourses = null;
let isEditMode = false;
let isEditModeMatrix = false;
let isEditModeCurriculum = false;
let showChangesModeMatrix = true; // 매트릭스 탭 보기 모드 (true: 변경사항 표시, false: 변경사항 적용)
let deletedCoursesData = {}; // 삭제된 과목들의 전체 데이터 저장 (속성 유지용)
let editingDeletedCourseId = null; // 현재 편집 중인 삭제된 과목의 ID
let designSettings = {
    tableBgColor: '#ffffff',
    headerBgColor: '#2c3e50',
    headerTextColor: '#ffffff',
    borderColor: '#dee2e6',
    fontSize: '14px',
    fontFamily: "'Noto Sans KR', sans-serif",
    rowHeight: '50px',
    cellPadding: '12px',
    borderWidth: '1px',
    hoverEffect: 'background'
};

// 정렬 관련 전역 변수
let currentSortColumn = null;
let currentSortDirection = 'asc';

// 매트릭스 필터링 관련 전역 변수
let filteredMatrixCourses = null;

// 교과목 데이터 (초기값)
let courses = [];

// 이수모형 버전 관리 변수


// 수행평가 매트릭스 데이터
// 구조: { "교과목명": [18개 컬럼의 값 배열] }
// 값 의미: 0=없음, 0.5=◐(부분), 1=●(완전)
// 컬럼 순서: 18개 수행평가 기준 (0~17 인덱스)
let matrixData = {};

// 수행평가 기준 배열
const performanceCriteria = [
    'PO1', 'PO2', 'PO3', 'PO4',  // 건축적 사고 (0-3)
    'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11',  // 설계 (4-10)
    'PO12', 'PO13', 'PO14', 'PO15', 'PO16',  // 기술 (11-15)
    'PO17', 'PO18'  // 실무 (16-17)
];

// --- 전역 변수 추가 ---
let curriculumCellTexts = {};

// 공통가치대응 편집 모드 전역 변수
let isEditModeCommonValues = false;

// 공통가치대응 셀 편집 중인지 확인하는 전역 변수
let isCommonValuesCellEditing = false;

// 전체 버전 관리 변수
let currentVersion = '기본';
let versions = {};

// 변경 이력 저장
let changeHistory = [];

// --- 실시간 변경 요약용 초기 상태 저장 변수 ---
let initialCourses = [];
let initialMatrixData = {};

// 전역 placeholder 추적 변수
let currentDragPlaceholder = null;

// 모든 placeholder 제거 함수
function clearAllPlaceholders() {
    // 모든 drag-preview-block 제거
    document.querySelectorAll('.drag-preview-block').forEach(block => {
        block.remove();
    });
    
    // 드래그 인디케이터 제거
    const indicator = document.querySelector('.drag-preview-indicator');
    if (indicator) {
        indicator.remove();
    }
    
    // 모든 블록 스타일 초기화
    document.querySelectorAll('.course-block').forEach(block => {
        block.style.transform = '';
        block.style.transition = '';
        block.style.boxShadow = '';
        block.style.opacity = '';
        block.style.border = '';
        block.style.background = '';
    });
    
    // 드롭 위치 데이터 및 initialized 플래그 초기화
    document.querySelectorAll('.block-wrap').forEach(wrap => {
        delete wrap.dataset.dropTarget;
        delete wrap.dataset.dropPosition;
        delete wrap.dataset.initialized;
    });
    
    currentDragPlaceholder = null;
}

// 학년학기 표시 형식 변환 함수
function formatYearSemester(yearSemester) {
    if (!yearSemester) return '';
    
    // 이미 간단한 형식인지 확인 (예: "4-1", "4-2", "4-1/2")
    if (yearSemester.match(/^\d+-(1|2|1\/2|계절|구분없음)$/)) {
        // "1,2"를 "1/2"로 변환
        if (yearSemester.includes('-1,2')) {
            return yearSemester.replace('-1,2', '-1/2');
        }
        return yearSemester;
    }
    
    // "학년" 포함 형식 변환 (예: "4학년-1학기" → "4-1")
    if (yearSemester.includes('학년')) {
        const yearMatch = yearSemester.match(/(\d+)학년/);
        if (yearMatch) {
            const year = yearMatch[1];
            if (yearSemester.includes('1학기')) {
                return `${year}-1`;
            } else if (yearSemester.includes('2학기')) {
                return `${year}-2`;
            } else if (yearSemester.includes('계절')) {
                return `${year}-계절`;
            } else if (yearSemester.includes('구분없음') || !yearSemester.includes('학기')) {
                return `${year}-1/2`;
            }
        }
    }
    
    // 기존 형식 (예: "1-1", "2-2", "3-계절" 등) 처리
    const parts = yearSemester.split('-');
    if (parts.length === 2) {
        const year = parts[0];
        const semester = parts[1];
        
        if (semester === '구분없음') {
            return `${year}-1/2`;
        } else if (semester === '1,2') {
            return `${year}-1/2`;
        }
    }
    
    return yearSemester;
}

// --- 실시간 변경 요약(diff) 함수 ---
function getCurrentDiffSummary() {
    const summary = [];
    // id 기준 매핑
    const initialMap = {};
    initialCourses.forEach(c => { if (c.id) initialMap[c.id] = c; });
    const currentMap = {};
    courses.forEach(c => { if (c.id) currentMap[c.id] = c; });
    // 추가: 현재에만 있는 id
    for (const id in currentMap) {
        if (!initialMap[id]) {
            summary.push({ type: '추가', course: currentMap[id] });
        }
    }
    // 삭제: 초기상태에만 있는 id (deletedCoursesData에서 최신 데이터 사용)
    for (const id in initialMap) {
        if (!currentMap[id]) {
            // deletedCoursesData에 저장된 최신 데이터가 있으면 사용, 없으면 initialMap 사용
            let courseData = deletedCoursesData[id] || initialMap[id];
            
            // deletedCoursesData에 없으면 추가하고 matrixValues 초기화
            if (!deletedCoursesData[id]) {
                courseData = JSON.parse(JSON.stringify(initialMap[id]));
                // 매트릭스 데이터 확인 및 초기화
                if (matrixData[courseData.courseName]) {
                    courseData.matrixValues = [...matrixData[courseData.courseName]];
                } else {
                    courseData.matrixValues = new Array(18).fill(0);
                }
                deletedCoursesData[id] = courseData;
                // localStorage에 저장
                localStorage.setItem('deletedCoursesData', JSON.stringify(deletedCoursesData));
            }
            
            summary.push({ type: '삭제', course: courseData });
        }
    }
    // 수정: id가 모두 있는 경우 속성 비교
    for (const id in currentMap) {
        if (initialMap[id]) {
            const before = initialMap[id];
            const after = currentMap[id];
            const fields = ['yearSemester','courseNumber','courseName','credits','category','isRequired','professor','description'];
            const changes = [];
            fields.forEach(field => {
                if ((before[field]||'') !== (after[field]||'')) {
                    changes.push({ field, before: before[field], after: after[field] });
                }
            });
            if (changes.length > 0) {
                summary.push({ type: '수정', course: after, changes });
            }
        }
    }
    
    // 매트릭스 변경사항 추가
    // 현재 courses에 있는 모든 과목의 매트릭스 데이터를 초기 데이터와 비교
    courses.forEach(course => {
        const courseName = course.courseName;
        const currentMatrix = matrixData[courseName] || new Array(18).fill(0);
        const initialMatrix = initialMatrixData[courseName] || new Array(18).fill(0);
        
        const matrixChanges = [];
        for (let i = 0; i < 18; i++) {
            if (currentMatrix[i] !== initialMatrix[i]) {
                const criteriaName = performanceCriteria[i];
                const oldValueText = (initialMatrix[i] === 1 || initialMatrix[i] === 2) ? '●' : 
                                    initialMatrix[i] === 0.5 ? '◐' : '없음';
                const newValueText = (currentMatrix[i] === 1 || currentMatrix[i] === 2) ? '●' : 
                                    currentMatrix[i] === 0.5 ? '◐' : '없음';
                
                matrixChanges.push({
                    field: criteriaName,
                    before: oldValueText,
                    after: newValueText,
                    colIndex: i,
                    oldValue: initialMatrix[i],
                    newValue: currentMatrix[i]
                });
            }
        }
        
        if (matrixChanges.length > 0) {
            // 이미 수정으로 등록된 과목인지 확인
            const existingModification = summary.find(item => 
                item.type === '수정' && item.course.id === course.id
            );
            
            if (existingModification) {
                // 기존 수정 항목에 매트릭스 변경사항 추가
                existingModification.matrixChanges = matrixChanges;
            }
            // 매트릭스만 변경된 경우는 따로 표시하지 않음 (확정 후에는 기록 불필요)
        }
    });
    
    // 정렬: 수정 → 추가 → 삭제 순서로 표시
    summary.sort((a, b) => {
        const typeOrder = { '수정': 1, '추가': 2, '삭제': 3 };
        const orderA = typeOrder[a.type] || 999;
        const orderB = typeOrder[b.type] || 999;
        
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        
        // 같은 타입 내에서는 교과목명 알파벳 순
        const nameA = a.course.courseName || '';
        const nameB = b.course.courseName || '';
        return nameA.localeCompare(nameB, 'ko-KR');
    });
    
    return summary;
}

function loadChangeHistory() {
    const saved = localStorage.getItem('changeHistory');
    if (saved) changeHistory = JSON.parse(saved);
}
function saveChangeHistory() {
    localStorage.setItem('changeHistory', JSON.stringify(changeHistory));
}

function addChangeHistory(type, courseName, changes) {
    const entry = {
        timestamp: new Date().toLocaleString('ko-KR'),
        type,
        courseName,
        changes
    };
    changeHistory.unshift(entry); // 최신순
    saveChangeHistory();
    renderChangeHistoryPanel();
}

// 교과목 수정/삭제/추가/이동 함수에 아래와 같이 삽입 예시:
// addChangeHistory('수정', course.courseName, [{field: '학점', before: 2, after: 3}]);

// 변경 이력 패널 토글
function toggleChangeHistoryPanel() {
    const panel = document.getElementById('changeHistoryPanel');
    if (panel.style.display === 'none' || panel.style.display === '') {
        panel.style.display = 'block';
        // 크기조절 자연스럽게: right 고정 해제, left 지정
        panel.style.right = 'auto';
        panel.style.left = 'calc(100vw - 440px)'; // 적당히 오른쪽에 위치
        renderChangeHistoryPanel();
    } else {
        panel.style.display = 'none';
    }
}

// 변경 이력 패널 렌더링
function renderChangeHistoryPanel() {
    const panelList = document.getElementById('changeHistoryPanelList');
    const actionsDiv = document.getElementById('changeHistoryActions');
    if (!panelList) return;
    
    let diffSummary = restoredVersionChangeHistory || getCurrentDiffSummary() || [];
    if (restoredVersionChangeHistory) {
        restoredVersionChangeHistory = null;
    }
    
    // tempMatrixChangeHistory의 임시 매트릭스 수정 항목들을 diffSummary 형식으로 변환하여 추가
    if (tempMatrixChangeHistory && tempMatrixChangeHistory.length > 0) {
        // 과목별로 그룹화
        const groupedByCourseName = {};
        tempMatrixChangeHistory.forEach(item => {
            if (!groupedByCourseName[item.courseName]) {
                groupedByCourseName[item.courseName] = {
                    courseName: item.courseName,
                    courseId: item.courseId,
                    changes: [],
                    timestamp: item.timestamp
                };
            }
            // 해당 과목의 변경사항 추가
            groupedByCourseName[item.courseName].changes.push(...item.changes);
            // 가장 최근 타임스탬프 사용
            if (item.timestamp > groupedByCourseName[item.courseName].timestamp) {
                groupedByCourseName[item.courseName].timestamp = item.timestamp;
            }
        });
        
        // 그룹화된 항목들을 diffSummary에 추가
        Object.values(groupedByCourseName).forEach(groupedItem => {
            const course = courses.find(c => c.courseName === groupedItem.courseName);
            if (course) {
                // 변경사항을 colIndex 기준으로 정렬 (PO 순서대로)
                groupedItem.changes.sort((a, b) => {
                    // colIndex가 있으면 그것으로 정렬
                    if (a.colIndex !== undefined && b.colIndex !== undefined) {
                        return a.colIndex - b.colIndex;
                    }
                    // field 이름으로 정렬 (PO1, PO2, ... PO18)
                    const aNum = parseInt(a.field.replace(/[^0-9]/g, ''));
                    const bNum = parseInt(b.field.replace(/[^0-9]/g, ''));
                    return aNum - bNum;
                });
                
                diffSummary.push({
                    type: '매트릭스 수정 (임시)',
                    course: course,
                    changes: groupedItem.changes,
                    timestamp: groupedItem.timestamp,
                    isTemp: true
                });
            }
        });
    }
    
    // 확정된 매트릭스 수정은 표시하지 않음 (주석 처리)
    // changeHistory의 매트릭스 수정 항목들은 표시하지 않음
    
    if (!diffSummary || diffSummary.length === 0) {
        panelList.innerHTML = "<li style='text-align:center; color:#888; padding:12px 0;'>변경 이력이 없습니다.</li>";
        // 확정 버튼 숨기기
        if (actionsDiv) actionsDiv.style.display = 'none';
        return;
    }
    
    // 변경사항이 있으면 확정 버튼 표시
    if (actionsDiv) actionsDiv.style.display = 'block';
    
    
    const fieldMap = {
        yearSemester: '학년학기',
        courseNumber: '과목번호',
        courseName: '교과목명',
        credits: '학점',
        category: '구분',
        isRequired: '필수여부',
        professor: '담당교수',
        description: '설명',
        '학년학기': '학년학기',
    };
    panelList.innerHTML = diffSummary.map((entry, idx) => {
        let summary = '';
        if (entry.type === '추가') {
            summary = `<b>${entry.course.courseName}</b> 추가 ${entry.course.yearSemester || ''}`;
        } else if (entry.type === '삭제') {
            summary = `<b>${entry.course.courseName}</b> 삭제`;
        } else if (entry.type === '매트릭스 수정 (임시)') {
            summary = `<b>${entry.course.courseName}</b> `;
            summary += entry.changes.map(c => {
                const field = c.field || '';
                const before = (c.before+"").length > 20 ? (c.before+"").slice(0,20)+"..." : c.before;
                const after = (c.after+"").length > 20 ? (c.after+"").slice(0,20)+"..." : c.after;
                return `<span style='color:#ff9800;'>${field}</span>: <span style='color:#888'>${before}</span>→<span style='color:#ff9800;'>${after}</span>`;
            }).join(', ');
        } else if (entry.type === '수정') {
            summary = `<b>${entry.course.courseName}</b> `;
            summary += entry.changes.map(c => {
                const field = fieldMap[c.field] || c.field;
                const before = (c.before+"").length > 12 ? (c.before+"").slice(0,12)+"..." : c.before;
                const after = (c.after+"").length > 12 ? (c.after+"").slice(0,12)+"..." : c.after;
                return `<span style='color:#1976d2;'>${field}</span>: <span style='color:#888'>${before}</span>→<span style='color:#1976d2'>${after}</span>`;
            }).join(', ');
        }
        const displayType = entry.type === '매트릭스 수정 (임시)' ? 'SPC' : entry.type;
        return `<li data-idx='${idx}'>
            <span class=\"change-history-type ${entry.type.replace(/[\s()]/g, '-')}\">${displayType}</span>
            <span class=\"change-history-summary\">${summary}</span>
            <button class='change-history-apply-btn' title='이 변경 적용'>&#10003;</button>
            <button class='change-history-delete-btn' title='이 변경 되돌리기'>&times;</button>
        </li>`;
    }).join('');
    
    // X(취소) 버튼 이벤트
    const delBtns = panelList.querySelectorAll('.change-history-delete-btn');
    delBtns.forEach(btn => {
        btn.onclick = function(e) {
            const idx = parseInt(btn.parentElement.getAttribute('data-idx'));
            handleChangeHistoryDelete(diffSummary[idx]);
        };
    });
    // ✔(적용) 버튼 이벤트
    const applyBtns = panelList.querySelectorAll('.change-history-apply-btn');
    applyBtns.forEach(btn => {
        btn.onclick = function(e) {
            const idx = parseInt(btn.parentElement.getAttribute('data-idx'));
            handleChangeHistoryApply(diffSummary[idx]);
        };
    });
}

// diff 항목 적용(확정) 처리
function handleChangeHistoryApply(entry) {
    if (!entry) return;
    
    // 공통가치대응 표의 셀 데이터 보존
    const currentCommonValuesData = collectCommonValuesTableData();
    
    if (entry.type === '수정') {
        // 수정: 해당 교과목의 변경 필드들을 after 값으로 확정
        const course = courses.find(c => c.id === entry.course.id);
        if (course) {
            entry.changes.forEach(c => {
                course[c.field] = c.after;
            });
        }
        
        // initialCourses에서 해당 교과목 찾기
        let initialCourse = initialCourses.find(c => c.id === entry.course.id);
        
        // initialCourses에 없으면 추가
        if (!initialCourse) {
            initialCourse = JSON.parse(JSON.stringify(entry.course));
            initialCourses.push(initialCourse);
        }
        
        // initialCourses의 해당 교과목도 after 값으로 업데이트
        entry.changes.forEach(c => {
            initialCourse[c.field] = c.after;
        });
        
    } else if (entry.type === '추가') {
        // 추가: 해당 교과목을 initialCourses에 추가(확정)
        const exists = initialCourses.find(c => c.id === entry.course.id);
        if (!exists) initialCourses.push(JSON.parse(JSON.stringify(entry.course)));
    } else if (entry.type === '삭제') {
        // 삭제: initialCourses에서 해당 교과목 제거(확정)
        const idx = initialCourses.findIndex(c => c.id === entry.course.id);
        if (idx !== -1) initialCourses.splice(idx, 1);
    } else if (entry.type === '매트릭스 수정 (임시)') {
        // 매트릭스 수정 (임시): 현재 매트릭스 데이터를 초기 데이터로 확정
        if (entry.course && entry.course.courseName) {
            if (!initialMatrixData[entry.course.courseName]) {
                initialMatrixData[entry.course.courseName] = new Array(18).fill(0);
            }
            // 현재 matrixData의 값을 initialMatrixData로 복사
            if (matrixData[entry.course.courseName]) {
                initialMatrixData[entry.course.courseName] = [...matrixData[entry.course.courseName]];
            }
        }
        // 임시 변경이력에서 해당 항목 제거
        tempMatrixChangeHistory = tempMatrixChangeHistory.filter(item => 
            !(item.courseId === entry.course.id)
        );
    }
    
    // changeHistory 배열은 사용하지 않음 (getCurrentDiffSummary()가 실시간으로 계산)
    
    // UI 갱신
    commonValuesCellTexts = currentCommonValuesData;
    renderChangeHistoryPanel();
    renderCurriculumTable();
    renderCourses();
    renderMatrix();  // 매트릭스 테이블도 즉시 갱신
    if (document.getElementById('commonValues')?.classList.contains('active')) {
        renderCommonValuesTable();
    }
    updateStats();
    
}

// diff 항목 삭제(되돌리기) 처리
function handleChangeHistoryDelete(entry) {
    if (!entry) return;
    
    // 공통가치대응 표의 셀 데이터 보존
    const currentCommonValuesData = collectCommonValuesTableData();
    
    if (entry.type === '수정') {
        // 수정: 해당 교과목의 변경 필드들을 before 값으로 롤백
        const course = courses.find(c => c.id === entry.course.id);
        if (course) {
            entry.changes.forEach(c => {
                course[c.field] = c.before;
            });
        }
    } else if (entry.type === '추가') {
        // 추가: 해당 교과목 삭제
        const idx = courses.findIndex(c => c.id === entry.course.id);
        if (idx !== -1) courses.splice(idx, 1);
    } else if (entry.type === '삭제') {
        // 삭제: 초기 상태의 교과목을 복원
        const orig = initialCourses.find(c => c.id === entry.course.id);
        if (orig) courses.push(JSON.parse(JSON.stringify(orig)));
    } else if (entry.type === '매트릭스 수정 (임시)') {
        // 매트릭스 수정 (임시): 해당 변경사항을 초기 값으로 되돌림
        if (entry.course && entry.course.courseName && entry.changes && entry.changes[0]) {
            const change = entry.changes[0];
            const colIndex = change.colIndex;
            const oldValue = change.oldValue;
            
            // matrixData를 원래 값으로 되돌림
            if (!matrixData[entry.course.courseName]) {
                matrixData[entry.course.courseName] = new Array(18).fill(0);
            }
            matrixData[entry.course.courseName][colIndex] = oldValue;
            
            // tempMatrixData도 되돌림
            if (tempMatrixData[entry.course.courseName]) {
                tempMatrixData[entry.course.courseName][colIndex] = oldValue;
            }
        }
        
        // 임시 변경이력에서 해당 항목 제거
        tempMatrixChangeHistory = tempMatrixChangeHistory.filter(item => 
            !(item.courseId === entry.course.id && 
              item.changes[0].colIndex === entry.changes[0].colIndex)
        );
    }
    
    // 공통가치대응 표의 셀 데이터 복원
    commonValuesCellTexts = currentCommonValuesData;
    
    renderChangeHistoryPanel();
    renderCurriculumTable();
    renderCourses();
    renderMatrix();  // 매트릭스 테이블 즉시 갱신
    // 공통가치대응 탭이 활성화된 경우에만 즉시 렌더링
    const commonValuesTab = document.getElementById('commonValues');
    if (commonValuesTab && commonValuesTab.classList.contains('active')) {
        renderCommonValuesTable();
    }
    updateStats();
}

// 모든 변경사항 확정
function confirmAllChanges() {
    if (!confirm('모든 변경사항을 확정하시겠습니까?\n확정 후에는 되돌릴 수 없습니다.')) {
        return;
    }
    
    // 매트릭스 변경사항은 changeHistory에 추가하지 않음 (확정 후에는 기록 불필요)
    
    // 현재 상태를 초기 상태로 설정
    initialCourses = JSON.parse(JSON.stringify(courses));
    ensureCourseIds(initialCourses);
    
    // 매트릭스 초기 상태도 현재 상태로 업데이트 (파란점을 검은점으로 변경)
    initialMatrixData = JSON.parse(JSON.stringify(matrixData));
    
    // 디버그: 확정 후 initialMatrixData와 matrixData가 같은지 확인
    window.matrixDebugLogged = false;  // 디버그 플래그 리셋
    console.log('확정 후 initialMatrixData:', initialMatrixData);
    console.log('확정 후 matrixData:', matrixData);
    console.log('두 데이터가 같은가?', JSON.stringify(initialMatrixData) === JSON.stringify(matrixData));
    
    // 임시 매트릭스 변경이력 초기화
    tempMatrixChangeHistory = [];
    
    // 임시 매트릭스 데이터 초기화
    tempMatrixData = {};
    
    // deletedCoursesData도 초기화
    deletedCoursesData = {};
    localStorage.removeItem('deletedCoursesData');
    
    // 모든 UI 요소 즉시 업데이트
    renderChangeHistoryPanel();
    renderCourses();
    
    // 매트릭스 테이블 업데이트
    renderMatrix();
    renderCurriculumTable();
    
    // 파란색 점들을 검은색으로 직접 변경
    setTimeout(() => {
        // 파란색 인라인 스타일을 가진 모든 요소 찾기
        const allMatrixMarks = document.querySelectorAll('.matrix-mark');
        allMatrixMarks.forEach(mark => {
            // 파란색 스타일이 있으면 제거
            if (mark.style.color === 'rgb(0, 123, 255)' || mark.style.color === '#007bff') {
                mark.style.color = '';  // 인라인 스타일 제거
                mark.classList.remove('matrix-mark-new');
                
                // 카테고리별 색상 클래스 확인 및 추가
                const cell = mark.closest('td');
                if (cell) {
                    const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
                    const colIndex = cellIndex - 5;  // 첫 5개 컬럼 제외
                    
                    let markClass = '';
                    if (colIndex >= 0 && colIndex <= 3) {
                        markClass = 'matrix-mark-thinking';
                    } else if (colIndex >= 4 && colIndex <= 10) {
                        markClass = 'matrix-mark-design';
                    } else if (colIndex >= 11 && colIndex <= 15) {
                        markClass = 'matrix-mark-tech';
                    } else if (colIndex >= 16 && colIndex <= 17) {
                        markClass = 'matrix-mark-practice';
                    }
                    
                    if (markClass && !mark.classList.contains(markClass)) {
                        mark.classList.add(markClass);
                    }
                }
            }
        });
        
        console.log('파란색 점 제거 완료');
    }, 100);
    
    // 공통가치대응 탭이 활성화된 경우에만 즉시 렌더링
    const commonValuesTab = document.getElementById('commonValues');
    if (commonValuesTab && commonValuesTab.classList.contains('active')) {
        renderCommonValuesTable();
    }
    updateStats();
    
    showToast('모든 변경사항이 확정되었습니다.');
}

// 모든 변경사항 초기화 (원래 상태로 되돌리기)
function resetAllChanges() {
    if (!confirm('모든 변경사항을 초기 상태로 되돌리시겠습니까?\n현재 변경사항은 모두 사라집니다.')) {
        return;
    }
    
    // 공통가치대응 표의 셀 데이터 보존
    const currentCommonValuesData = collectCommonValuesTableData();
    
    // 초기 상태로 복원
    courses = JSON.parse(JSON.stringify(initialCourses));
    ensureCourseIds(courses);
    
    // 매트릭스 데이터도 초기 상태로 복원
    matrixData = JSON.parse(JSON.stringify(initialMatrixData));
    
    // 임시 매트릭스 데이터 초기화
    tempMatrixData = {};
    
    // 임시 매트릭스 변경이력 초기화
    tempMatrixChangeHistory = [];
    
    // 공통가치대응 표의 셀 데이터 복원
    commonValuesCellTexts = currentCommonValuesData;
    
    // 변경이력 초기화
    changeHistory = [];
    saveChangeHistory();
    
    // UI 업데이트
    renderChangeHistoryPanel();
    renderCurriculumTable();
    renderCourses();
    renderMatrix();  // 매트릭스 테이블 즉시 반영
    // 공통가치대응 탭이 활성화된 경우에만 즉시 렌더링
    const commonValuesTab = document.getElementById('commonValues');
    if (commonValuesTab && commonValuesTab.classList.contains('active')) {
        renderCommonValuesTable();
    }
    updateStats();
    
    showToast('모든 변경사항이 초기 상태로 되돌려졌습니다.');
}

// 최근 버전 자동 선택 함수
function selectLatestVersion() {
    if (!versions || Object.keys(versions).length === 0) {
        currentVersion = '기본';
        return;
    }
    
    // 버전 목록에서 최신 버전 찾기
    const versionNames = Object.keys(versions);
    let latestVersion = '기본';
    let latestTimestamp = 0;
    
    versionNames.forEach(versionName => {
        const version = versions[versionName];
        if (version && version.metadata && version.metadata.timestamp) {
            if (version.metadata.timestamp > latestTimestamp) {
                latestTimestamp = version.metadata.timestamp;
                latestVersion = versionName;
            }
        }
    });
    
    // 최신 버전이 '기본'이 아니고 실제로 존재하는 경우에만 선택
    if (latestVersion !== '기본' && versions[latestVersion]) {
        currentVersion = latestVersion;
    } else {
        currentVersion = '기본';
    }
    
    // localStorage 업데이트
}

// 선택된 버전의 데이터를 메모리에 복원
function restoreSelectedVersionData() {
    if (typeof versions !== 'undefined' && currentVersion && versions[currentVersion]) {
        const v = versions[currentVersion];
        
        // 1. 교과목 관리 탭 데이터 복원
        if (v.coursesTab) {
            courses = v.coursesTab.courses || [];
            initialCourses = v.coursesTab.initialCourses || JSON.parse(JSON.stringify(courses));
        } else {
            // 기존 구조 호환성 (레거시 지원)
            courses = v.courses || [];
            initialCourses = v.initialCourses || JSON.parse(JSON.stringify(courses));
        }
        
        // 2. 수행평가 매트릭스 탭 데이터 복원 (깊은 복사 적용)
        if (v.matrixTab) {
            matrixData = v.matrixTab.matrixData ? 
                JSON.parse(JSON.stringify(v.matrixTab.matrixData)) : {};
            
            // 저장된 initialMatrixData가 있으면 복원, 없으면 현재 matrixData로 설정
            if (v.matrixTab.initialMatrixData) {
                initialMatrixData = JSON.parse(JSON.stringify(v.matrixTab.initialMatrixData));
            } else {
                // 이전 버전 호환성: initialMatrixData가 없으면 현재 데이터로 설정
                initialMatrixData = JSON.parse(JSON.stringify(matrixData));
            }
            
            if (v.matrixTab.matrixTitleText) {
                const titleElement = document.getElementById('matrixTitle');
                if (titleElement) {
                    titleElement.textContent = v.matrixTab.matrixTitleText;
                }
            }
            
            // matrixExtraTableData 복원 (깊은 복사 적용)
            if (v.matrixTab.matrixExtraTableData) {
                matrixExtraTableData = JSON.parse(JSON.stringify(v.matrixTab.matrixExtraTableData));
            } else {
                matrixExtraTableData = {};
            }
        } else {
            // 기존 구조 호환성 (깊은 복사 적용)
            matrixData = v.matrixData ? JSON.parse(JSON.stringify(v.matrixData)) : {};
            // 이전 버전 호환성: initialMatrixData가 없으면 현재 데이터로 설정
            initialMatrixData = JSON.parse(JSON.stringify(matrixData));
            
            // matrixExtraTableData 복원 (깊은 복사 적용)
            if (v.matrixExtraTableData) {
                matrixExtraTableData = JSON.parse(JSON.stringify(v.matrixExtraTableData));
            } else {
                matrixExtraTableData = {};
            }
        }
        
        // 3. 이수모형 탭 데이터 복원
        if (v.curriculumTab) {
            curriculumCellTexts = v.curriculumTab.curriculumCellTexts || {};
            if (v.curriculumTab.curriculumTitleText) {
                const titleElement = document.getElementById('curriculumTitle');
                if (titleElement) {
                    titleElement.textContent = v.curriculumTab.curriculumTitleText;
                }
            }
        } else {
            // 기존 구조 호환성
            curriculumCellTexts = v.curriculumCellTexts || {};
        }
        
        // 4. 공통가치대응 탭 데이터 복원
        if (v.commonValuesTab) {
            commonValuesCellTexts = v.commonValuesTab.commonValuesCellTexts || {};
            commonValuesCopiedBlocks = v.commonValuesTab.commonValuesCopiedBlocks || {};
            // 비교과 병합 텍스트 복원 추가
            extracurricularMergedTexts = v.commonValuesTab.extracurricularMergedTexts || [];
            if (v.commonValuesTab.commonValuesTitleText) {
                const titleElement = document.getElementById('commonValuesTitle');
                if (titleElement) {
                    titleElement.textContent = v.commonValuesTab.commonValuesTitleText;
                }
            }
        } else {
            // 기존 구조 호환성
            commonValuesCellTexts = v.commonValuesCellTexts || {};
            commonValuesCopiedBlocks = v.commonValuesCopiedBlocks || {};
            extracurricularMergedTexts = [];
        }
        
        // 공통 설정 복원
        if (v.settings) {
            designSettings = v.settings.designSettings || designSettings;
            // 변경이력 복원 추가
            changeHistory = v.settings.changeHistory || [];
        } else {
            // 기존 구조 호환성
            designSettings = v.designSettings || designSettings;
            // 변경이력 복원 추가 (레거시)
            changeHistory = v.changeHistory || [];
        }
        
    } else {
    }
    
    // 복원 후 curriculum 탭이 마지막 탭이면 diff가 올바르게 반영되도록 강제 showTab 호출
    const lastTab = 'courses';
    if (lastTab === 'curriculum') {
        setTimeout(() => {
            showTab('curriculum');
        }, 100);
    }
    // [추가] 변경이력 패널 즉시 갱신 및 변경이력 모달 자동 표시
    if (Array.isArray(changeHistory) && changeHistory.length > 0) {
        renderChangeHistoryPanel();
        // showChangeHistoryModal(); // 자동 팝업 제거
        // 변경이력이 있을 때 강제로 diff 갱신
        getCurrentDiffSummary();
    }
}

function showChangeHistoryModal() {
    // 모바일(≤768px)에서는 자동으로 열지 않는다. 좁은 화면을 덮어 방해가 되므로,
    // 사용자가 필요할 때 '변경 이력' 버튼으로 직접 열도록 한다. (데스크톱은 기존대로 자동 표시)
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        return;
    }
    // 변경이력 패널을 보이게 함
    const panel = document.getElementById('changeHistoryPanel');
    if (panel) {
        panel.style.display = 'block';
        // 변경이력 패널 내용 갱신
        if (typeof renderChangeHistoryPanel === 'function') {
            renderChangeHistoryPanel();
        }
    }
}

// 페이지 로드 시 이력 불러오기
loadChangeHistory();

// 디자인 설정 표시 함수
function updateDesignDisplay() {
    const designContainer = document.getElementById('designContainer');
    if (!designContainer) return;
    
    // designSettings이 있을 경우 설정 표시
    if (designSettings) {
        // 디자인 설정을 UI에 반영하는 로직
        Object.entries(designSettings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });
    }
}

// 페이지 초기화
function init() {
    console.log('init() 함수 시작');
    
    // Firebase 초기화
    initializeFirebase();
    
    // Firebase에서 데이터 로드 시도
    loadAllDataFromFirebase().then(firebaseLoaded => {
        if (firebaseLoaded) {
            console.log('Firebase 데이터 로드 성공');
            // Firebase 로드 성공 시 최근 버전 자동 선택
            selectLatestVersion();
        } else {
            console.log('Firebase 데이터 로드 실패 또는 오프라인');
        }
        
        // 동기화 완료 후 로컬 버전 로드
        loadAllVersions();
        
        // 선택된 버전의 데이터를 메모리에 복원
        restoreSelectedVersionData();
        
        // UI 초기화
        initializeUI();
        
        // 모든 렌더링 함수 호출
        renderCourses();
        renderMatrix();
        renderCurriculumTable();
        renderCommonValuesTable();
        updateStats();
        // updateDesignDisplay 함수 호출
        updateDesignDisplay();
        
        // 디자인 설정 적용
        if (designSettings) {
            if (designSettings.curriculum) {
                applyCurriculumColorScheme();
                updateCurriculumFontSize();
            }
        }
        
        // 버전 정보 표시
        if (typeof updateVersionDisplay === 'function') {
            updateVersionDisplay();
        } else {
            // 버전 표시 업데이트
            const versionElement = document.getElementById('currentVersion');
            if (versionElement) {
                versionElement.textContent = currentVersion || '기본';
            }
        }
        
        // 첫 탭 활성화 (커리큘럼 탭을 기본으로)
        showTab('curriculum');
        
        console.log('초기화 완료');
        if (window.hideCloudLoading) window.hideCloudLoading();
    }).catch(error => {
        console.error('Firebase 데이터 로드 중 오류:', error);
        
        // 오류 발생 시 로컬 데이터로 폴백
        loadAllVersions();
        restoreSelectedVersionData();
        initializeUI();
        
        // 모든 렌더링 함수 호출
        renderCourses();
        renderMatrix();
        renderCurriculumTable();
        renderCommonValuesTable();
        updateStats();
        showTab('curriculum');
        
        console.log('오프라인 모드로 초기화 완료');
        if (window.hideCloudLoading) window.hideCloudLoading();
    });

}
// UI 초기화 함수
function initializeUI() {
    // 제목들을 버전 데이터에서 복원
    if (versions[currentVersion]) {
        const matrixTitle = document.getElementById('matrixTitle');
        if (matrixTitle && versions[currentVersion].matrixTab?.matrixTitleText) {
            matrixTitle.textContent = versions[currentVersion].matrixTab.matrixTitleText;
        }
        
        const curriculumTitle = document.getElementById('curriculumTitle');
        if (curriculumTitle && versions[currentVersion].curriculumTab?.curriculumTitleText) {
            curriculumTitle.textContent = versions[currentVersion].curriculumTab.curriculumTitleText;
        }
        
        const commonValuesTitle = document.getElementById('commonValuesTitle');
        if (commonValuesTitle && versions[currentVersion].commonValuesTab?.commonValuesTitleText) {
            commonValuesTitle.textContent = versions[currentVersion].commonValuesTab.commonValuesTitleText;
        }
    }
    
    // id 보장
    ensureCourseIds(courses);

    // --- 최초 진입 시에만 초기 상태 저장 (버전 복원 후에는 덮어쓰지 않음) ---
    if (!Array.isArray(initialCourses) || initialCourses.length === 0) {
        initialCourses = JSON.parse(JSON.stringify(courses));
        ensureCourseIds(initialCourses);
    }
    
    // initialMatrixData가 비어있으면 현재 matrixData로 초기화
    if (!initialMatrixData || Object.keys(initialMatrixData).length === 0) {
        initialMatrixData = JSON.parse(JSON.stringify(matrixData));
    }
    
    // localStorage에서 deletedCoursesData 로드
    const savedDeletedCoursesData = localStorage.getItem('deletedCoursesData');
    if (savedDeletedCoursesData) {
        try {
            deletedCoursesData = JSON.parse(savedDeletedCoursesData);
            
            // 각 삭제된 과목의 matrixValues가 없으면 초기화
            for (const id in deletedCoursesData) {
                const course = deletedCoursesData[id];
                if (!course.matrixValues) {
                    // matrixData에서 과목명으로 찾아보기
                    if (matrixData[course.courseName]) {
                        course.matrixValues = [...matrixData[course.courseName]];
                    } else {
                        course.matrixValues = new Array(18).fill(0);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to parse deletedCoursesData:', e);
            deletedCoursesData = {};
        }
    }

    loadDesignSettings();

    renderCourses();
    renderMatrix();
    updateStats();
    drawChart();
    drawSubjectTypeChart();
    renderCurriculumTable(); // 이수모형표 렌더링 추가
    // 변경이력 diff 강제 초기화 및 이수모형표 재렌더링 (최초 로딩시 diff 반영 보장)
    getCurrentDiffSummary();
    renderCurriculumTable();
    setupCurriculumDropZones(); // 드롭 영역 설정 추가
    updateCurriculumFontSize(); // 이수모형 폰트 크기 초기화 추가
    renderMatrixExtraTable(); // matrix-extra-table 렌더링 추가
    
    // 공통가치대응 Value 컬럼 이벤트 시스템 초기화
    initializeValueColumnEvents();
    
    // 🔧 공통가치대응 데이터 구조 초기화 (기존 데이터 보존)
    const subjectTypes = ['설계', '디지털', '역사', '이론', '도시', '사회', '기술', '실무', '비교과'];
    subjectTypes.forEach(subjectType => {
        if (!commonValuesCopiedBlocks[subjectType]) {
            commonValuesCopiedBlocks[subjectType] = { value1: [], value2: [], value3: [] };
        } else {
            // 기존 데이터가 있는 경우, value1/2/3 속성만 확인하고 없으면 빈 배열로 초기화
            if (!commonValuesCopiedBlocks[subjectType].value1) {
                commonValuesCopiedBlocks[subjectType].value1 = [];
            }
            if (!commonValuesCopiedBlocks[subjectType].value2) {
                commonValuesCopiedBlocks[subjectType].value2 = [];
            }
            if (!commonValuesCopiedBlocks[subjectType].value3) {
                commonValuesCopiedBlocks[subjectType].value3 = [];
            }
        }
    });
    
    // 🔧 공통가치대응 탭 초기 렌더링 추가
    renderCommonValuesTable();
    
    // 이수모형 탭을 기본으로 시작
    showTab('curriculum');
    updateCurrentVersionDisplay();
    updateAllVersionLabels();
    updateVersionNavigationButtons();
    
    // 저장된 이수모형 글씨 크기 적용
    setTimeout(() => {
        updateCurriculumFontSize();
    }, 100);
    
    // 창 크기 변경 시 차트 재렌더링 및 이수모형 글씨 크기 유지 (디바운싱 적용)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.textContent === '분석 및 통계') {
                drawChart();
                drawSubjectTypeChart();
            }
            
            // 이수모형 탭의 글씨 크기 유지 및 화살표 재그리기
            if (activeTab && activeTab.textContent === '이수모형') {
                updateCurriculumFontSize();
                // 이동된 교과목이 있으면 화살표 재그리기
                const movedCoursesForGhost = getMovedCoursesForGhost();
                if (movedCoursesForGhost.length > 0) {
                    clearMoveArrows();
                    drawMoveArrows(movedCoursesForGhost);
        }
            }
        }, 250); // 디바운싱 시간을 250ms로 설정
    });
    

    // 만약 이수모형 탭이 활성화되어 있다면 diff 반영을 위해 한 번 더 showTab 호출
    setTimeout(() => {
        const curriculumTab = document.getElementById('curriculum');
        if (curriculumTab && curriculumTab.classList.contains('active')) {
            showTab('curriculum');
        }
    }, 200);

    // 모든 렌더링 및 데이터 복원 완료 후 오버레이 숨김
    const overlay = document.getElementById('cloud-loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

// 매트릭스 탭 수정모드 토글
function toggleEditMode() {
    isEditModeMatrix = !isEditModeMatrix;
    const button = document.getElementById('editModeToggle');
    const textSpan = document.getElementById('editModeText');
    if (button && textSpan) {
        if (isEditModeMatrix) {
            button.classList.add('active');
            textSpan.textContent = '수정모드';
        } else {
            button.classList.remove('active');
            textSpan.textContent = '일반모드';
        }
    }
    
    if (isEditModeMatrix) {
        enableCellEditing();
        addMatrixCellClickListeners();
        // matrix-extra-table 편집 모드 활성화
        toggleMatrixExtraTableEditMode();
        // 매트릭스 제목 편집 모드 활성화
        setMatrixTitleEditable(true);
    } else {
        disableCellEditing();
        // matrix-extra-table 편집 모드 비활성화
        toggleMatrixExtraTableEditMode();
        // 매트릭스 제목 편집 모드 비활성화
        setMatrixTitleEditable(false);
    }
}

// 교과목 관리 탭 수정모드 토글
function toggleEditModeCourses() {
    isEditMode = !isEditMode;
    const button = document.getElementById('editModeToggleCourses');
    const textSpan = document.getElementById('editModeTextCourses');
    
    if (isEditMode) {
        // 수정모드 활성화
        button.classList.add('active');
        textSpan.textContent = '수정모드';
        enableCellEditing();
    } else {
        // 수정모드 비활성화
        button.classList.remove('active');
        textSpan.textContent = '일반모드';
        disableCellEditing();
    }
}

// 셀 편집 활성화 (이벤트 리스너 중복 등록 방지)
function enableCellEditing() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        // matrix-extra-table은 별도 처리하므로 제외
        if (table.classList.contains('matrix-extra-table')) {
            return;
        }
        
        const cells = table.querySelectorAll('td');
        cells.forEach((cell, index) => {
            // 매트릭스 테이블의 데이터 셀(data-course-name 속성이 있는 셀)은 건드리지 않음
            // 이미 개별적으로 이벤트 리스너가 추가되어 있음
            if (cell.hasAttribute('data-course-name')) {
                return;
            }
            
            // onclick 속성이 이미 설정된 셀도 건드리지 않음
            if (cell.onclick) {
                return;
            }
            
            if (!cell.classList.contains('no-edit')) {
                cell.classList.add('editable-cell');
                
                // 이벤트 리스너 중복 등록 방지: 동일한 함수 참조 사용
                const existingHandler = cell._clickHandler;
                if (existingHandler) {
                    cell.removeEventListener('click', existingHandler);
                }
                
                // 새로운 핸들러 함수 생성 및 저장
                const clickHandler = function(event) {
                    handleCellClick(event);
                };
                cell._clickHandler = clickHandler;
                cell.addEventListener('click', clickHandler);
                
            } else {
            }
        });
    });
}

// 매트릭스 테이블에 직접 클릭 이벤트 추가 (더 이상 사용하지 않음)
function addMatrixCellClickListeners() {
    // 이 함수는 더 이상 사용하지 않습니다.
    // 매트릭스 셀에 직접 이벤트 리스너가 추가되므로 불필요합니다.
}

// 매트릭스 셀 직접 클릭 처리
function handleMatrixCellClickDirect(event) {
    if (!isEditModeMatrix) return;
    
    const cell = event.target;
    
    const originalContent = cell.innerHTML;
    const row = cell.closest('tr');
    
    // 실제 셀 인덱스 계산 (rowSpan 고려)
    const cells = Array.from(row.children);
    const cellIndex = cells.indexOf(cell);
    
    // 매트릭스 데이터 셀인지 확인 (6번째 셀부터)
    if (cellIndex < 5) {
        return;
    }
    
    // 과목명 찾기 (rowSpan 고려하여 실제 위치 계산)
    let courseName = '';
    let course = null;
    
    // 현재 행에서 과목명 셀 찾기
    const nameCell = row.querySelector('td:nth-child(4)');
    if (nameCell) {
        courseName = nameCell.textContent;
        course = courses.find(c => c.courseName === courseName);
    }
    
    
    if (!course) {
        return;
    }
    
    // 순환 편집: 빈 값 → ● → ◐ → 빈 값
    let currentValue = 0;
    if (originalContent.includes('●')) {
        currentValue = 1;
    } else if (originalContent.includes('◐')) {
        currentValue = 0.5;
    }
    
    
    let newMatrixValue = 0;
    let newDisplayContent = '';
    let markClass = '';
    
    // 실제 매트릭스 컬럼 인덱스 계산 (첫 5개 컬럼 제외)
    const matrixColIndex = cellIndex - 5;
    
    if (matrixColIndex >= 0 && matrixColIndex <= 3) {
        markClass = 'matrix-mark-thinking';
    } else if (matrixColIndex >= 4 && matrixColIndex <= 10) {
        markClass = 'matrix-mark-design';
    } else if (matrixColIndex >= 11 && matrixColIndex <= 15) {
        markClass = 'matrix-mark-tech';
    } else if (matrixColIndex >= 16 && matrixColIndex <= 17) {
        markClass = 'matrix-mark-practice';
    }
    
    if (currentValue === 0) {
        newMatrixValue = 1;
        newDisplayContent = `<span class="matrix-mark ${markClass}">●</span>`;
    } else if (currentValue === 1) {
        newMatrixValue = 0.5;
        newDisplayContent = `<span class="matrix-mark ${markClass}">◐</span>`;
    } else if (currentValue === 0.5) {
        newMatrixValue = 0;
        newDisplayContent = '';
    } else {
        newMatrixValue = 0;
        newDisplayContent = '';
    }
    
    
    // 매트릭스 데이터 업데이트
    if (matrixColIndex >= 0 && matrixColIndex < 18) {
        if (!matrixData[courseName]) {
            matrixData[courseName] = new Array(18).fill(0);
        }
        matrixData[courseName][matrixColIndex] = newMatrixValue;
    }
    
    // 셀 내용 업데이트
    cell.innerHTML = newDisplayContent;
    
    // 시각적 피드백 (임시로 배경색 변경)
    cell.style.backgroundColor = '#fff3cd';
    setTimeout(() => {
        cell.style.backgroundColor = '';
    }, 300);
    
    // 수정 내용 팝업 표시
    showToast(popupMessage);
    
    // 교과목 테이블 업데이트 (필요한 경우만)
    // renderCourses();
    
    // 매트릭스 테이블 다시 렌더링하지 않음
    // 셀만 업데이트했으므로 전체를 다시 그릴 필요 없음
    // renderMatrix();
    
}

// 간단한 매트릭스 셀 클릭 처리 (삭제된 과목 포함)
function handleMatrixCellClickSimple(cell) {
    if (!isEditModeMatrix) {
        return;
    }
    
    // 데이터 속성에서 정보 가져오기
    const courseName = cell.getAttribute('data-course-name');
    const colIndex = parseInt(cell.getAttribute('data-col-index'));
    const courseId = cell.getAttribute('data-course-id');
    const isDeleted = cell.getAttribute('data-is-deleted') === 'true';
    
    if (!courseName || colIndex === undefined) {
        return;
    }
    
    // 삭제된 과목이면 deletedCoursesData에서, 아니면 courses에서 찾기
    let course;
    if (isDeleted && courseId) {
        course = deletedCoursesData[courseId];
        
        // deletedCoursesData에 없으면 getCurrentDiffSummary에서 찾기
        if (!course) {
            const diffSummary = getCurrentDiffSummary();
            const deletedEntry = diffSummary.find(entry => 
                entry.type === '삭제' && entry.course && entry.course.id === courseId
            );
            if (deletedEntry) {
                course = deletedEntry.course;
                // deletedCoursesData에 추가
                deletedCoursesData[courseId] = course;
                if (!course.matrixValues && matrixData[course.courseName]) {
                    course.matrixValues = [...matrixData[course.courseName]];
                } else if (!course.matrixValues) {
                    course.matrixValues = new Array(18).fill(0);
                }
            }
        }
        
        if (!course) {
            return;
        }
    } else {
        course = courses.find(c => c.id === courseId || c.courseName === courseName);
        
        // 과목을 찾지 못한 경우 추가 시도
        if (!course && courseName) {
            // 과목명으로만 다시 시도
            course = courses.find(c => c.courseName === courseName);
        }
    }
    
    if (!course) {
        // 과목을 찾지 못한 경우 기본 과목 객체 생성
        if (courseName) {
            course = { 
                courseName: courseName, 
                id: courseId || courseName,
                matrixValues: new Array(18).fill(0)
            };
        } else {
            return;
        }
    }
    
    // 순환 편집: 빈 값 → ● → ◐ → 빈 값
    let currentValue = 0;
    
    // 삭제된 과목의 경우 deletedCoursesData에서 현재 값을 가져옴
    if (isDeleted && course.id && deletedCoursesData[course.id]) {
        // matrixValues가 없으면 초기화
        if (!deletedCoursesData[course.id].matrixValues) {
            deletedCoursesData[course.id].matrixValues = new Array(18).fill(0);
        }
        
        // 먼저 data-current-value 속성 확인
        const storedValue = cell.getAttribute('data-current-value');
        if (storedValue !== null) {
            currentValue = parseFloat(storedValue);
        } else {
            currentValue = deletedCoursesData[course.id].matrixValues[colIndex] || 0;
        }
    } else {
        // 일반 과목의 경우 cell의 내용에서 판단
        const originalContent = cell.innerHTML;
        console.log('originalContent:', originalContent);
        
        // matrix-mark-removed 클래스가 있으면 삭제된 상태로 간주 (값이 0)
        if (originalContent.includes('matrix-mark-removed')) {
            currentValue = 0;
        } else if (originalContent.includes('●')) {
            currentValue = 1;
        } else if (originalContent.includes('◐')) {
            currentValue = 0.5;
        } else {
            // data-current-value 속성도 확인
            const storedValue = cell.getAttribute('data-current-value');
            if (storedValue !== null) {
                currentValue = parseFloat(storedValue);
            }
        }
    }
    
    
    let newMatrixValue = 0;
    let newDisplayContent = '';
    let markClass = '';
    
    // 색상 결정 - 추가된/수정된 과목인지 확인
    const diffSummary = getCurrentDiffSummary();
    const courseDiff = diffSummary.find(entry => 
        entry.course && entry.course.id === course.id
    );
    const isAddedCourse = courseDiff && courseDiff.type === '추가';
    const isModifiedCourse = courseDiff && courseDiff.type === '수정';
    
    let colorStyle = '';
    
    // 삭제된 과목은 빨간색
    if (isDeleted) {
        colorStyle = 'style="color: #e74c3c;"';
    }
    // 추가된 과목은 녹색
    else if (isAddedCourse) {
        colorStyle = 'style="color: #27ae60;"';
    }
    // 수정된 과목은 검은색
    else if (isModifiedCourse) {
        colorStyle = 'style="color: #000000;"';
    }
    // 일반 과목은 카테고리별 색상
    else {
        if (colIndex >= 0 && colIndex <= 3) {
            markClass = 'matrix-mark-thinking';
        } else if (colIndex >= 4 && colIndex <= 10) {
            markClass = 'matrix-mark-design';
        } else if (colIndex >= 11 && colIndex <= 15) {
            markClass = 'matrix-mark-tech';
        } else if (colIndex >= 16 && colIndex <= 17) {
            markClass = 'matrix-mark-practice';
        }
    }
    
    // 초기 값 확인 (수정 흔적 표시용)
    let initialValue = 0;
    if (initialMatrixData[courseName] && initialMatrixData[courseName][colIndex] !== undefined) {
        initialValue = initialMatrixData[courseName][colIndex];
    }
    
    // 순환 토글: 빈 값(0) → ●(1) → ◐(0.5) → 빈 값(0)
    let popupMessage = '';
    let additionalClass = '';
    
    console.log('handleMatrixCellClickSimple - currentValue:', currentValue, 'courseName:', courseName, 'colIndex:', colIndex);
    
    if (currentValue === 0) {
        newMatrixValue = 1;  // ●
        
        // 초기에 값이 없었던 곳에 새로 추가된 점인지 확인
        if (initialValue === 0) {
            additionalClass = 'matrix-mark-new';  // 새로 추가된 점 - 파란색
        }
        
        newDisplayContent = colorStyle ? 
            `<span class="matrix-mark ${additionalClass}" ${colorStyle}>●</span>` : 
            `<span class="matrix-mark ${markClass} ${additionalClass}">●</span>`;
        popupMessage = `${course.courseName} - ${performanceCriteria[colIndex]}: ● (주요)`;
    } else if (currentValue === 1) {
        newMatrixValue = 0.5;  // ◐
        
        // 초기에 값이 없었던 곳에 새로 추가된 점인지 확인
        if (initialValue === 0) {
            additionalClass = 'matrix-mark-new';  // 새로 추가된 점 - 파란색
        }
        
        newDisplayContent = colorStyle ? 
            `<span class="matrix-mark ${additionalClass}" ${colorStyle}>◐</span>` : 
            `<span class="matrix-mark ${markClass} ${additionalClass}">◐</span>`;
        popupMessage = `${course.courseName} - ${performanceCriteria[colIndex]}: ◐ (보조)`;
    } else if (currentValue === 0.5) {
        newMatrixValue = 0;  // 빈 값
        
        // 초기에 값이 있었는데 삭제된 경우 회색으로 흔적 표시
        if (initialValue > 0) {
            const removedSymbol = (initialValue === 1 || initialValue === 2) ? '●' : '◐';
            newDisplayContent = `<span class="matrix-mark matrix-mark-removed" style="color: #999999;">${removedSymbol}</span>`;
            popupMessage = `${course.courseName} - ${performanceCriteria[colIndex]}: 삭제됨 (원래: ${removedSymbol})`;
        } else {
            newDisplayContent = '';
            popupMessage = `${course.courseName} - ${performanceCriteria[colIndex]}: 비어있음`;
        }
    } else {
        newMatrixValue = 0;  // 빈 값
        
        // 초기에 값이 있었는데 삭제된 경우 회색으로 흔적 표시
        if (initialValue > 0) {
            const removedSymbol = (initialValue === 1 || initialValue === 2) ? '●' : '◐';
            newDisplayContent = `<span class="matrix-mark matrix-mark-removed" style="color: #999999;">${removedSymbol}</span>`;
            popupMessage = `${course.courseName} - ${performanceCriteria[colIndex]}: 삭제됨 (원래: ${removedSymbol})`;
        } else {
            newDisplayContent = '';
            popupMessage = `${course.courseName} - ${performanceCriteria[colIndex]}: 비어있음`;
        }
    }
    
    
    // 매트릭스 데이터 업데이트
    if (colIndex >= 0 && colIndex < 18) {
        // 삭제된 과목인 경우 deletedCoursesData를 직접 업데이트
        if (isDeleted && course.id && deletedCoursesData[course.id]) {
            if (!deletedCoursesData[course.id].matrixValues) {
                // 기존 값이 없으면 새로 생성
                deletedCoursesData[course.id].matrixValues = new Array(18).fill(0);
            }
            deletedCoursesData[course.id].matrixValues[colIndex] = newMatrixValue;
            
            // localStorage에 저장
            localStorage.setItem('deletedCoursesData', JSON.stringify(deletedCoursesData));
        } else {
            // 일반 과목의 경우 기존 로직 사용
            // 임시 저장소에 먼저 저장
            if (!tempMatrixData[courseName]) {
                // 기존 데이터가 있으면 복사, 없으면 새로 생성
                tempMatrixData[courseName] = matrixData[courseName] ? 
                    [...matrixData[courseName]] : new Array(18).fill(0);
            }
            tempMatrixData[courseName][colIndex] = newMatrixValue;
            
            // 실제 데이터에도 반영
            if (!matrixData[courseName]) {
                matrixData[courseName] = new Array(18).fill(0);
            }
            matrixData[courseName][colIndex] = newMatrixValue;
        }
    }
    
    // 셀 내용 업데이트
    cell.innerHTML = newDisplayContent;
    
    // 시각적 피드백 (임시로 배경색 변경)
    cell.style.backgroundColor = '#fff3cd';
    setTimeout(() => {
        cell.style.backgroundColor = '';
    }, 300);
    
    // 셀의 속성 업데이트 (모든 과목에 대해)
    cell.setAttribute('data-current-value', newMatrixValue);
    
    // 삭제된 과목인 경우 변경사항이 지속되도록 확인
    
    // 매트릭스 변경이력 추가
    const criteriaName = performanceCriteria[colIndex];
    const oldValueText = (currentValue === 1 || currentValue === 2) ? '●' : currentValue === 0.5 ? '◐' : '없음';
    const newValueText = (newMatrixValue === 1 || newMatrixValue === 2) ? '●' : newMatrixValue === 0.5 ? '◐' : '없음';
    
    if (currentValue !== newMatrixValue) {
        // 초기값과 비교하여 실제 변경사항인지 확인
        const initialValue = initialMatrixData[course.courseName] ? 
            initialMatrixData[course.courseName][colIndex] : 0;
        
        // 초기값과 다른 경우에만 임시 변경이력에 추가
        if (newMatrixValue !== initialValue) {
            const tempEntry = {
                timestamp: new Date().toLocaleString('ko-KR'),
                type: '매트릭스 수정',
                courseName: course.courseName,
                courseId: course.id,
                changes: [{
                    field: criteriaName,
                    before: oldValueText,
                    after: newValueText,
                    colIndex: colIndex,
                    oldValue: currentValue,
                    newValue: newMatrixValue
                }]
            };
            
            // 같은 과목의 같은 컬럼에 대한 기존 임시 변경이력이 있으면 제거
            tempMatrixChangeHistory = tempMatrixChangeHistory.filter(item => 
                !(item.courseId === course.id && 
                  item.changes[0].colIndex === colIndex)
            );
            
            tempMatrixChangeHistory.unshift(tempEntry);
        } else {
            // 초기값으로 되돌아간 경우 임시 변경이력에서 제거
            tempMatrixChangeHistory = tempMatrixChangeHistory.filter(item => 
                !(item.courseId === course.id && 
                  item.changes[0].colIndex === colIndex)
            );
        }
        
        // 변경이력 패널 즉시 업데이트
        renderChangeHistoryPanel();
    }
    
    // 수정 내용 팝업 표시
    showToast(popupMessage);
    
    // 교과목 테이블 업데이트 (필요한 경우만)
    // renderCourses();
    
    // 매트릭스 테이블 다시 렌더링하지 않음
    // 셀만 업데이트했으므로 전체를 다시 그릴 필요 없음
    // renderMatrix();
    
}

// 셀 편집 비활성화 (이벤트 리스너 중복 등록 방지)
function disableCellEditing() {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const cells = table.querySelectorAll('td');
        cells.forEach(cell => {
            cell.classList.remove('editable-cell');
            
            // 저장된 핸들러 함수로 이벤트 리스너 제거
            const existingHandler = cell._clickHandler;
            if (existingHandler) {
                cell.removeEventListener('click', existingHandler);
                delete cell._clickHandler;
            }
        });
    });
    
    // 모든 편집 중인 셀을 원래 상태로 복원
    const editingCells = document.querySelectorAll('.editing-cell');
    editingCells.forEach(cell => {
        const originalContent = cell.getAttribute('data-original-content');
        if (originalContent !== null) {
            cell.innerHTML = originalContent;
            cell.classList.remove('editing-cell');
            cell.removeAttribute('data-original-content');
        }
    });
}

// 셀 클릭 처리
function handleCellClick(event) {
    const cell = event.target;
    if (cell.classList.contains('editing-cell')) return;
    
    // 매트릭스 테이블의 경우 순환 편집
    if (cell.closest('#matrixTable')) {
        // 매트릭스 편집 모드가 아니면 리턴
        if (!isEditModeMatrix) return;
        
        // 과목명 셀은 편집하지 않음
        const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
        if (cellIndex === 3) return; // 과목명 셀 (4번째)
        
        // 매트릭스 셀만 순환 편집
        if (cellIndex >= 5) { // 매트릭스 데이터 셀들 (6번째부터)
            // 삭제된 과목인 경우 handleMatrixCellClickSimple 사용
            const isDeleted = cell.getAttribute('data-is-deleted') === 'true';
            if (isDeleted) {
                handleMatrixCellClickSimple(cell);
            } else {
                handleMatrixCellClick(cell);
            }
            return;
        }
        return; // 매트릭스 테이블의 다른 셀들은 편집하지 않음
    }
    
    // 일반 테이블의 경우 isEditMode 체크
    if (!isEditMode) return;
    
    // 이미 편집 중인 다른 셀이 있다면 저장
    const currentEditingCell = document.querySelector('.editing-cell');
    if (currentEditingCell && currentEditingCell !== cell) {
        saveCellEdit(currentEditingCell);
    }
    
    // 일반 테이블 셀 편집 모드 시작
    startCellEdit(cell);
}

// 교과목 관리 셀 편집 시작
function startCellEdit(cell) {
    const originalContent = cell.innerHTML;
    cell.setAttribute('data-original-content', originalContent);
    cell.classList.add('editing-cell');
    
    // 편집 가능한 입력 필드 생성 (셀 전체 영역 사용)
    const input = document.createElement('input');
    input.type = 'text';
    input.value = cell.textContent.trim();
    input.className = 'cell-edit-input';
    

    
    // 입력 필드 이벤트 리스너
    input.addEventListener('blur', () => saveCellEdit(cell));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveCellEdit(cell);
        } else if (e.key === 'Escape') {
            cancelCellEdit(cell);
        }
    });
    
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
}

// 매트릭스 셀 클릭 처리 (임시 저장)
function handleMatrixCellClick(cell) {
    
    const originalContent = cell.innerHTML;
    const row = cell.closest('tr');
    
    // 실제 셀 인덱스 계산 (rowSpan 고려)
    const cells = Array.from(row.children);
    const cellIndex = cells.indexOf(cell);
    
    // 매트릭스 데이터 셀인지 확인 (6번째 셀부터)
    if (cellIndex < 5) {
        return;
    }
    
    // 과목명 찾기 (rowSpan 고려하여 실제 위치 계산)
    let courseName = '';
    let course = null;
    
    // 현재 행에서 과목명 셀 찾기
    const nameCell = row.querySelector('td:nth-child(4)');
    if (nameCell) {
        courseName = nameCell.textContent;
        course = courses.find(c => c.courseName === courseName);
    }
    
    
    if (!course) {
        return;
    }
    
    // 순환 편집: 빈 값 → ● → ◐ → 빈 값 (2점 제거)
    let currentValue = 0;
    if (originalContent.includes('●')) {
        currentValue = 1;
    } else if (originalContent.includes('◐')) {
        currentValue = 0.5;
    }
    
    
    let newMatrixValue = 0;
    let newDisplayContent = '';
    let markClass = '';
    
    // 실제 매트릭스 컬럼 인덱스 계산 (첫 5개 컬럼 제외)
    const matrixColIndex = cellIndex - 5;
    
    if (matrixColIndex >= 0 && matrixColIndex <= 3) {
        markClass = 'matrix-mark-thinking';
    } else if (matrixColIndex >= 4 && matrixColIndex <= 10) {
        markClass = 'matrix-mark-design';
    } else if (matrixColIndex >= 11 && matrixColIndex <= 15) {
        markClass = 'matrix-mark-tech';
    } else if (matrixColIndex >= 16 && matrixColIndex <= 17) {
        markClass = 'matrix-mark-practice';
    }
    
    // 순환 토글: 빈 값(0) → ●(1) → ◐(0.5) → 빈 값(0)
    if (currentValue === 0) {
        newMatrixValue = 1;  // ●
        newDisplayContent = `<span class="matrix-mark ${markClass}">●</span>`;
    } else if (currentValue === 1) {
        newMatrixValue = 0.5;  // ◐
        newDisplayContent = `<span class="matrix-mark ${markClass}">◐</span>`;
    } else if (currentValue === 0.5) {
        newMatrixValue = 0;  // 빈 값
        newDisplayContent = '';
    } else if (currentValue === 2) {
        // 기존 2점 데이터가 있으면 1점으로 변경
        newMatrixValue = 1;  // ●
        newDisplayContent = `<span class="matrix-mark ${markClass}">●</span>`;
    } else {
        newMatrixValue = 0;  // 빈 값
        newDisplayContent = '';
    }
    
    
    // 임시 매트릭스 데이터 업데이트
    if (matrixColIndex >= 0 && matrixColIndex < 18) {
        if (!tempMatrixData[courseName]) {
            // 기존 데이터가 있으면 복사, 없으면 새로 생성
            tempMatrixData[courseName] = matrixData[courseName] ? 
                [...matrixData[courseName]] : new Array(18).fill(0);
        }
        tempMatrixData[courseName][matrixColIndex] = newMatrixValue;
        
        // 실제 데이터에도 반영 (임시 데이터는 버전 저장 시 사용)
        if (!matrixData[courseName]) {
            matrixData[courseName] = new Array(18).fill(0);
        }
        matrixData[courseName][matrixColIndex] = newMatrixValue;
    }
    
    // 셀 내용 업데이트
    cell.innerHTML = newDisplayContent;
    
    // 시각적 피드백 (임시로 배경색 변경)
    cell.style.backgroundColor = '#fff3cd';
    setTimeout(() => {
        cell.style.backgroundColor = '';
    }, 300);
    
    // 매트릭스 변경이력 추가
    const criteriaName = performanceCriteria[matrixColIndex];
    const oldValueText = (currentValue === 2 || currentValue === 1) ? '●' : currentValue === 0.5 ? '◐' : '없음';
    const newValueText = (newMatrixValue === 2 || newMatrixValue === 1) ? '●' : newMatrixValue === 0.5 ? '◐' : '없음';
    
    if (currentValue !== newMatrixValue) {
        // 초기값과 비교하여 실제 변경사항인지 확인
        const initialValue = initialMatrixData[course.courseName] ? 
            initialMatrixData[course.courseName][matrixColIndex] : 0;
        
        // 초기값과 다른 경우에만 임시 변경이력에 추가
        if (newMatrixValue !== initialValue) {
            const tempEntry = {
                timestamp: new Date().toLocaleString('ko-KR'),
                type: '매트릭스 수정',
                courseName: course.courseName,
                courseId: course.id,
                changes: [{
                    field: criteriaName,
                    before: oldValueText,
                    after: newValueText,
                    colIndex: matrixColIndex,
                    oldValue: currentValue,
                    newValue: newMatrixValue
                }]
            };
            
            // 같은 과목의 같은 컬럼에 대한 기존 임시 변경이력이 있으면 제거
            tempMatrixChangeHistory = tempMatrixChangeHistory.filter(item => 
                !(item.courseId === course.id && 
                  item.changes[0].colIndex === matrixColIndex)
            );
            
            tempMatrixChangeHistory.unshift(tempEntry);
        } else {
            // 초기값으로 되돌아간 경우 임시 변경이력에서 제거
            tempMatrixChangeHistory = tempMatrixChangeHistory.filter(item => 
                !(item.courseId === course.id && 
                  item.changes[0].colIndex === matrixColIndex)
            );
        }
        
        // 변경이력 패널 즉시 업데이트
        renderChangeHistoryPanel();
    }
    
    showToast('변경사항이 임시 저장되었습니다. 버전 저장 버튼을 눌러주세요.');
}

// 키보드 단축키로 매트릭스 셀 편집
function handleMatrixKeyboardEdit(event) {
    if (!isEditMode) return;
    
    const activeElement = document.activeElement;
    if (!activeElement || !activeElement.closest('#matrixTable')) return;
    
    const cell = activeElement.closest('td');
    if (!cell) return;
    
    const cellIndex = Array.from(cell.parentNode.children).indexOf(cell);
    if (cellIndex < 5) return; // 매트릭스 데이터 셀만 처리
    
    switch(event.key) {
        case '0':
        case ' ':
            // 빈 값으로 설정
            setMatrixCellValue(cell, 0);
            break;
        case '1':
            // 완전 체크로 설정
            setMatrixCellValue(cell, 1);
            break;
        case '2':
        case '5':
            // 부분 체크로 설정
            setMatrixCellValue(cell, 0.5);
            break;
    }
}

// 매트릭스 셀 값 설정
function setMatrixCellValue(cell, value) {
    const row = cell.closest('tr');
    
    // 실제 셀 인덱스 계산 (rowSpan 고려)
    const cells = Array.from(row.children);
    const cellIndex = cells.indexOf(cell);
    
    // 매트릭스 데이터 셀인지 확인 (6번째 셀부터)
    if (cellIndex < 5) {
        return;
    }
    
    // 과목명 찾기 (rowSpan 고려하여 실제 위치 계산)
    let courseName = '';
    let course = null;
    
    // 현재 행에서 과목명 셀 찾기
    const nameCell = row.querySelector('td:nth-child(4)');
    if (nameCell) {
        courseName = nameCell.textContent;
        course = courses.find(c => c.courseName === courseName);
    }
    
    if (!course) return;
    
    let displayContent = '';
    let markClass = '';
    
    // 실제 매트릭스 컬럼 인덱스 계산 (첫 5개 컬럼 제외)
    const matrixColIndex = cellIndex - 5;
    
    if (matrixColIndex >= 0 && matrixColIndex <= 3) {
        markClass = 'matrix-mark-thinking';
    } else if (matrixColIndex >= 4 && matrixColIndex <= 10) {
        markClass = 'matrix-mark-design';
    } else if (matrixColIndex >= 11 && matrixColIndex <= 15) {
        markClass = 'matrix-mark-tech';
    } else if (matrixColIndex >= 16 && matrixColIndex <= 17) {
        markClass = 'matrix-mark-practice';
    }
    
    if (value === 1) {
        displayContent = `<span class="matrix-mark ${markClass}">●</span>`;
    } else if (value === 0.5) {
        displayContent = `<span class="matrix-mark ${markClass}">◐</span>`;
    }
    
    // 매트릭스 데이터 업데이트
    if (matrixColIndex >= 0 && matrixColIndex < 18) {
        // 임시 저장소에 먼저 저장
        if (!tempMatrixData[courseName]) {
            // 기존 데이터가 있으면 복사, 없으면 새로 생성
            tempMatrixData[courseName] = matrixData[courseName] ? 
                [...matrixData[courseName]] : new Array(18).fill(0);
        }
        tempMatrixData[courseName][matrixColIndex] = value;
        
        // 실제 데이터에도 반영 (임시 데이터는 버전 저장 시 사용)
        if (!matrixData[courseName]) {
            matrixData[courseName] = new Array(18).fill(0);
        }
        matrixData[courseName][matrixColIndex] = value;
    }
    
    cell.innerHTML = displayContent;
    renderCourses();
    renderMatrix();
}

// 셀 편집 저장
function saveCellEdit(cell) {
    const input = cell.querySelector('.cell-edit-input');
    if (!input) return;
    
    const newValue = input.value.trim();
    const originalContent = cell.getAttribute('data-original-content');
    
    // 값이 변경되었는지 확인
    if (newValue !== cell.textContent.trim()) {
        // 매트릭스 테이블의 경우 특별한 처리
        if (cell.closest('#matrixTable')) {
            handleMatrixCellEdit(cell, newValue, originalContent);
        } else {
            // 일반 테이블의 경우
            handleCourseTableEdit(cell, newValue, originalContent);
        }
    } else {
        cell.innerHTML = originalContent;
    }
    
    cell.classList.remove('editing-cell');
    cell.removeAttribute('data-original-content');
}

// 교과목 관리 셀 편집 처리 (임시 저장)
function handleCourseTableEdit(cell, newValue, originalContent) {
    const row = cell.closest('tr');
    const courseIndex = Array.from(row.parentNode.children).indexOf(row);
    const cellIndex = Array.from(row.children).indexOf(cell);
    
    // 필터링된 목록에서 원본 인덱스 찾기
    const list = filteredCourses || courses;
    const course = list[courseIndex];
    if (!course) {
        cell.innerHTML = originalContent;
        return;
    }
    
    // 원본 배열에서 해당 교과목 찾기
    const originalIndex = courses.findIndex(c => 
        c.courseName === course.courseName && 
        c.courseNumber === course.courseNumber
    );
    
    if (originalIndex === -1) {
        cell.innerHTML = originalContent;
        return;
    }
    
    // 임시 저장소에 교과목 데이터 복사 (없으면)
    if (tempCourses.length === 0) {
        tempCourses = JSON.parse(JSON.stringify(courses));
    }
    
    // 셀 위치에 따라 업데이트할 필드 결정
    switch(cellIndex) {
        case 0: // 학년-학기
            tempCourses[originalIndex].yearSemester = newValue;
            break;
        case 1: // 교과목번호
            tempCourses[originalIndex].courseNumber = newValue;
            break;
        case 2: // 과목명
            tempCourses[originalIndex].courseName = newValue;
            // 매트릭스 데이터도 임시 업데이트
            if (tempMatrixData[originalContent]) {
                tempMatrixData[newValue] = tempMatrixData[originalContent];
                delete tempMatrixData[originalContent];
            }
            break;
        case 3: // 담당교수
            tempCourses[originalIndex].professor = newValue;
            break;
        case 4: // 학점
            const credits = parseInt(newValue);
            if (isNaN(credits) || credits < 1) {
                cell.innerHTML = originalContent;
                alert('학점은 1 이상의 숫자여야 합니다.');
                return;
            }
            tempCourses[originalIndex].credits = credits;
            break;
        case 5: // 구분 (카테고리)
            if (!['건축적사고', '설계', '기술', '실무', '기타'].includes(newValue)) {
                cell.innerHTML = originalContent;
                alert('구분은 건축적사고, 설계, 기술, 실무, 기타 중 하나여야 합니다.');
                return;
            }
            tempCourses[originalIndex].category = newValue;
            break;
        case 6: // 필수여부
            if (!['필수', '선택'].includes(newValue)) {
                cell.innerHTML = originalContent;
                alert('필수여부는 필수 또는 선택이어야 합니다.');
                return;
            }
            tempCourses[originalIndex].isRequired = newValue;
            break;
        case 7: // 수행평가기준 (편집 불가)
            cell.innerHTML = originalContent;
            return;
        default:
            cell.innerHTML = originalContent;
            return;
    }
    
    // 성공 메시지
    cell.innerHTML = newValue;
    showToast('변경사항이 임시 저장되었습니다. 버전 저장 버튼을 눌러주세요.');
}

// 셀 편집 취소
function cancelCellEdit(cell) {
    const originalContent = cell.getAttribute('data-original-content');
    if (originalContent !== null) {
        cell.innerHTML = originalContent;
    }
    cell.classList.remove('editing-cell');
    cell.removeAttribute('data-original-content');
}
// 매트릭스 셀 편집 처리 (순환 편집)
function handleMatrixCellEdit(cell, newValue, originalContent) {
    const row = cell.closest('tr');
    const courseName = row.querySelector('td:nth-child(4)').textContent;
    const course = courses.find(c => c.courseName === courseName);
    
    if (!course) {
        cell.innerHTML = originalContent;
        return;
    }
    
    // 행/열 인덱스 계산
    const rowIndex = Array.from(row.parentNode.children).indexOf(row);
    const colIndex = Array.from(cell.parentNode.children).indexOf(cell) - 5; // 첫 5개 컬럼 제외
    
    // 순환 편집: 빈 값 → ● → ◐ → 빈 값
    let currentValue = 0;
    if (originalContent.includes('●')) {
        currentValue = 1;
    } else if (originalContent.includes('◐')) {
        currentValue = 0.5;
    }
    
    let newMatrixValue = 0;
    let newDisplayContent = '';
    
    if (currentValue === 0) {
        newMatrixValue = 1;
        newDisplayContent = '<span class="matrix-mark">●</span>';
    } else if (currentValue === 1) {
        newMatrixValue = 0.5;
        newDisplayContent = '<span class="matrix-mark">◐</span>';
    } else if (currentValue === 0.5) {
        newMatrixValue = 0;
        newDisplayContent = '';
    } else {
        newMatrixValue = 0;
        newDisplayContent = '';
    }
    
    // 매트릭스 셀 수정 로그 출력
    
    // 매트릭스 데이터 업데이트 (임시 저장소와 실제 데이터 모두 업데이트)
    if (colIndex >= 0 && colIndex < 18) {
        // 임시 저장소에 먼저 저장
        if (!tempMatrixData[courseName]) {
            // 기존 데이터가 있으면 복사, 없으면 새로 생성
            tempMatrixData[courseName] = matrixData[courseName] ? 
                [...matrixData[courseName]] : new Array(18).fill(0);
        }
        tempMatrixData[courseName][colIndex] = newMatrixValue;
        
        // 실제 데이터에도 반영
        if (!matrixData[courseName]) {
            matrixData[courseName] = new Array(18).fill(0);
        }
        matrixData[courseName][colIndex] = newMatrixValue;
    }
    
    cell.innerHTML = newDisplayContent;
    showToast('변경사항이 임시 저장되었습니다. 버전 저장 버튼을 눌러주세요.');
}

// 디자인 설정 업데이트
function updateTableDesign() {
    const tableBgColor = document.getElementById('tableBgColor').value;
    const headerBgColor = document.getElementById('headerBgColor').value;
    const headerTextColor = document.getElementById('headerTextColor').value;
    const borderColor = document.getElementById('borderColor').value;
    const fontSize = document.getElementById('fontSize').value + 'px';
    const fontFamily = document.getElementById('fontFamily').value;
    const rowHeight = document.getElementById('rowHeight').value + 'px';
    const cellPadding = document.getElementById('cellPadding').value + 'px';
    const borderWidth = document.getElementById('borderWidth').value + 'px';
    const hoverEffect = document.getElementById('hoverEffect').value;
    
    // 값 표시 업데이트
    document.getElementById('fontSizeValue').textContent = fontSize;
    document.getElementById('rowHeightValue').textContent = rowHeight;
    document.getElementById('cellPaddingValue').textContent = cellPadding;
    document.getElementById('borderWidthValue').textContent = borderWidth;
    
    // CSS 변수로 스타일 적용
    const style = document.documentElement.style;
    style.setProperty('--table-bg-color', tableBgColor);
    style.setProperty('--header-bg-color', headerBgColor);
    style.setProperty('--header-text-color', headerTextColor);
    style.setProperty('--border-color', borderColor);
    style.setProperty('--font-size', fontSize);
    style.setProperty('--font-family', fontFamily);
    style.setProperty('--row-height', rowHeight);
    style.setProperty('--cell-padding', cellPadding);
    style.setProperty('--border-width', borderWidth);
    
    // 호버 효과 적용
    applyHoverEffect(hoverEffect);
    
    // 설정 저장
    designSettings = {
        tableBgColor,
        headerBgColor,
        headerTextColor,
        borderColor,
        fontSize,
        fontFamily,
        rowHeight,
        cellPadding,
        borderWidth,
        hoverEffect
    };
}

// 호버 효과 적용
function applyHoverEffect(effect) {
    const tables = document.querySelectorAll('table');
    tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(row => {
            row.classList.remove('hover-shadow', 'hover-border', 'hover-none');
            if (effect === 'shadow') {
                row.classList.add('hover-shadow');
            } else if (effect === 'border') {
                row.classList.add('hover-border');
            } else if (effect === 'none') {
                row.classList.add('hover-none');
            }
        });
    });
}

// 디자인 설정 저장
function saveDesignSettings() {
    // localStorage 사용하지 않음 - 메모리에만 유지하고 버전 저장 시 Firebase에 저장됨
    // designSettings 객체는 이미 updateTableDesign()에서 업데이트됨
    
    showToast('디자인 설정이 저장되었습니다.');
}

// 디자인 설정 불러오기
function loadDesignSettings() {
    // localStorage 사용하지 않음 - Firebase에서만 로드
    // designSettings는 Firebase에서 로드되거나 기본값 사용
    applyDesignSettings();
}

// 디자인 설정 적용
function applyDesignSettings() {
    document.getElementById('tableBgColor').value = designSettings.tableBgColor;
    document.getElementById('headerBgColor').value = designSettings.headerBgColor;
    document.getElementById('headerTextColor').value = designSettings.headerTextColor;
    document.getElementById('borderColor').value = designSettings.borderColor;
    document.getElementById('fontSize').value = parseInt(designSettings.fontSize);
    document.getElementById('fontFamily').value = designSettings.fontFamily;
    document.getElementById('rowHeight').value = parseInt(designSettings.rowHeight);
    document.getElementById('cellPadding').value = parseInt(designSettings.cellPadding);
    document.getElementById('borderWidth').value = parseInt(designSettings.borderWidth);
    document.getElementById('hoverEffect').value = designSettings.hoverEffect;
    
    updateTableDesign();
}

// 디자인 설정 초기화
function resetDesignSettings() {
    if (confirm('기본 디자인으로 복원하시겠습니까?')) {
        designSettings = {
            tableBgColor: '#ffffff',
            headerBgColor: '#2c3e50',
            headerTextColor: '#ffffff',
            borderColor: '#dee2e6',
            fontSize: '14px',
            fontFamily: "'Noto Sans KR', sans-serif",
            rowHeight: '50px',
            cellPadding: '12px',
            borderWidth: '1px',
            hoverEffect: 'background'
        };
        applyDesignSettings();
        // localStorage.removeItem('designSettings'); // localStorage 사용하지 않음
        alert('기본 디자인으로 복원되었습니다.');
    }
}

// 디자인 설정 내보내기
function exportDesignSettings() {
    const dataStr = JSON.stringify(designSettings, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'design-settings.json';
    link.click();
    URL.revokeObjectURL(url);
}

// 디자인 설정 가져오기
function importDesignSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const settings = JSON.parse(e.target.result);
                    designSettings = settings;
                    applyDesignSettings();
                    alert('디자인 설정을 가져왔습니다.');
                } catch (error) {
                    alert('파일 형식이 올바르지 않습니다.');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

// 탭 전환
function showTab(tabName, event) {
    // 기존 탭 비활성화
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    const contents = document.querySelectorAll('.content');
    contents.forEach(content => content.classList.remove('active'));
    // 선택한 탭 활성화
    document.getElementById(tabName).classList.add('active');
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        // 이벤트 없이(프로그램/초기 로드) 호출돼도 해당 탭 버튼을 활성 표시한다.
        const activeBtn = [...document.querySelectorAll('.tabs .tab')]
            .find(b => (b.getAttribute('onclick') || '').includes("'" + tabName + "'"));
        if (activeBtn) activeBtn.classList.add('active');
    }

    // 탭 전환 시 수정모드 UI만 초기화 (임시 데이터는 유지)
    // resetAllEditModes() 대신 UI만 초기화하는 함수 호출
    resetEditModeUIOnly();

    // 공통가치대응 탭이면 테이블 렌더링
    if (tabName === 'commonValues') {
        // 제목 복원
        const titleElement = document.getElementById('commonValuesTitle');
        if (titleElement && versions[currentVersion]?.commonValuesTab?.commonValuesTitleText) {
            titleElement.textContent = versions[currentVersion].commonValuesTab.commonValuesTitleText;
        }
        // 셀 편집 중이 아닐 때만 테이블 렌더링
        if (!isCommonValuesCellEditing) {
        renderCommonValuesTable();
        }
        updateCommonValuesFontSize(); // 폰트 크기 동기화
        updateColorLegendCommonValues(); // 색상 범례 업데이트
        
        // 🌟 물리 효과 패널 표시 및 효과 재개
        const physicsPanel = document.getElementById('physicsControlPanel');
        if (physicsPanel) {
            physicsPanel.style.display = 'block';
        }
        if (window.physicsEffects) {
            window.physicsEffects.resumeEffects();
        }
        
        // 보기 모드 버튼 초기 상태 설정
        const button = document.getElementById('viewModeToggleCommonValues');
        const text = document.getElementById('viewModeTextCommonValues');
        if (button && text) {
            if (showChangesModeCommonValues) {
                text.textContent = '변경사항 표시';
                button.style.background = '#6c757d';
            } else {
                text.textContent = '변경사항 적용';
                button.style.background = '#28a745';
            }
        }
    } else {
        // 다른 탭에서는 물리 효과 패널 숨김
        const physicsPanel = document.getElementById('physicsControlPanel');
        if (physicsPanel) {
            physicsPanel.style.display = 'none';
        }
        
        // 물리 효과 일시 정지
        if (window.physicsEffects) {
            window.physicsEffects.pauseEffects();
        }
    }
    
    // 매트릭스 탭 클릭 시 제목 복원
    if (tabName === 'matrix') {
        const titleElement = document.getElementById('matrixTitle');
        if (titleElement && versions[currentVersion]?.matrixTab?.matrixTitleText) {
            titleElement.textContent = versions[currentVersion].matrixTab.matrixTitleText;
        }
        renderMatrix();
    }
    
    // 이수모형 탭 클릭 시 변경이력 처리
    if (tabName === 'curriculum') {
        // 변경이력이 있을 때만 모달 팝업 + 표 갱신
        if (Array.isArray(changeHistory) && changeHistory.length > 0) {
            getCurrentDiffSummary();
            showChangeHistoryModal();
            setTimeout(() => {
                renderCurriculumTable();
            }, 100);
        } else {
            getCurrentDiffSummary();
            renderCurriculumTable();
        }
        
        // 색상 기준 스위치 UI 동기화
        const slider = document.getElementById('toggleSliderCurriculum');
        const text = document.getElementById('colorModeTextCurriculum');
        updateColorLegendCurriculum(); // 색상 범례 업데이트
        if (slider && text) {
            if (colorModeBySubjectTypeCurriculum) {
                slider.style.left = '3px';
                slider.style.background = '#6c757d';
                text.textContent = '분야';
            } else {
                slider.style.left = '51px';
                slider.style.background = '#28a745';
                text.textContent = '구분';
            }
        }
        
        // 이동된 교과목이 있으면 화살표 그리기
        setTimeout(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const movedCoursesForGhost = getMovedCoursesForGhost();
                    if (movedCoursesForGhost.length > 0) {
                        clearMoveArrows();
                        drawMoveArrows(movedCoursesForGhost);
                    }
                });
            });
        }, 0);
        
        // ResizeObserver 초기화 (탭 전환 시 크기 변경 감지를 위해)
        initResizeObserver();
    }
    
    // 분석 탭 전환 시 차트 재렌더링
    if (tabName === 'analysis') {
        // 약간의 지연을 두어 DOM 렌더링 완료 후 차트 그리기
        setTimeout(() => {
            drawChart();
            drawSubjectTypeChart();
        }, 100);
    }
    
    // 마지막 탭 정보 저장
}

// 교과목 테이블 렌더링
function renderCourses() {
    const tbody = document.getElementById('coursesTableBody');
    tbody.innerHTML = '';
    
    // 필터가 적용된 경우 filteredCourses 사용, 아니면 전체 과목 + 삭제된 과목 표시
    let list;
    const diffSummary = getCurrentDiffSummary();
    const deletedCourses = diffSummary.filter(entry => entry.type === '삭제').map(entry => entry.course);
    
    if (filteredCourses !== null && filteredCourses !== undefined) {
        // 필터링이 적용된 경우 - filteredCourses에 이미 삭제된 교과목이 포함되어 있음
        list = filteredCourses;
    } else {
        // 필터링이 적용되지 않은 경우 - 현재 교과목 + 삭제된 교과목 모두 표시
        list = [...courses, ...deletedCourses];
    }
    
    list.forEach((course, idx) => {
        // 원본 배열에서의 인덱스 찾기
        const originalIndex = courses.findIndex(c => c.id === course.id);
        const isDeleted = deletedCourses.some(d => d.id === course.id); // 삭제된 과목인지 확인
        
        // 매트릭스 데이터 가져오기
        const matrixValues = matrixData[course.courseName] || new Array(18).fill(0);
        const performanceCriteria = getPerformanceCriteria(matrixValues);
        
        const row = tbody.insertRow();
        
        // 삭제된 과목인 경우 스타일 적용
        if (isDeleted) {
            row.classList.add('deleted-course-row');
        }
        
        // 변경 상태 확인
        const diffSummary = getCurrentDiffSummary();
        const courseDiff = diffSummary.find(diff => diff.course.id === course.id);
        let courseNameClass = '';
        let rowClass = '';
        if (courseDiff) {
            if (courseDiff.type === '추가') {
                courseNameClass = 'course-added';
                rowClass = 'added-course';
            } else if (courseDiff.type === '수정') {
                courseNameClass = 'course-modified';
                rowClass = 'modified-course';
            } else if (courseDiff.type === '삭제') {
                courseNameClass = 'course-deleted';
                rowClass = 'deleted-course';
            }
        } else if (isDeleted) {
            // 삭제된 교과목인 경우
            courseNameClass = 'course-deleted';
            rowClass = 'deleted-course';
        }
        
        // 행에 클래스 추가
        if (rowClass) {
            row.classList.add(rowClass);
        }
        
        row.innerHTML = `
            <td class="no-edit">${course.yearSemester}</td>
            <td class="no-edit">${course.courseNumber}</td>
            <td class="no-edit course-title-cell"><strong class="${courseNameClass}" ${!isDeleted ? `ondblclick="editCourse(${originalIndex})"` : ''}>${course.courseName}</strong></td>
            <td>${course.professor || '-'}</td>
            <td class="no-edit">${course.credits}</td>
            <td class="no-edit">
                <span class="category-badge badge-${getCategoryClass(course.category)}">${course.category}</span>
            </td>
            <td class="no-edit">
                <span class="subject-type-badge badge-${getSubjectTypeClass(course.subjectType)}">${course.subjectType}</span>
            </td>
            <td class="no-edit">${course.isRequired}</td>
            <td class="performance-criteria no-edit" title="${performanceCriteria.fullText}">${performanceCriteria.detailedText}</td>
            <td class="no-edit">
                ${!isDeleted ? `
                    <button class="btn btn-sm" onclick="editCourse(${originalIndex})" style="font-size: 12px; padding: 5px 10px;">수정</button>
                    <button class="btn btn-sm btn-secondary" onclick="deleteCourse(${originalIndex})" style="font-size: 12px; padding: 5px 10px;">삭제</button>
                ` : ''}
            </td>
        `;
        // 수행평가기준 컬럼에 HTML 적용
        const criteriaCell = row.querySelector('.performance-criteria');
        if (criteriaCell) {
            criteriaCell.innerHTML = performanceCriteria.detailedText;
        }
    });
    
    // 호버 효과 재적용
    if (designSettings.hoverEffect) {
        applyHoverEffect(designSettings.hoverEffect);
    }
    
    // 수정모드가 활성화되어 있다면 셀 편집 기능 활성화
    if (isEditMode) {
        enableCellEditing();
    }
    
    // 컬럼 리사이즈 기능 초기화
    initCoursesTableResize();
    
    // 정렬 이벤트 리스너 초기화 (한 번만)
    if (!window.sortListenersInitialized) {
        initSortListeners();
        window.sortListenersInitialized = true;
    }
}

// 카테고리별 클래스 반환
function getCategoryClass(category) {
    switch(category) {
        case '교양': return 'category-liberal';
        case '건축적사고': return 'category-thinking';
        case '설계': return 'category-design';
        case '기술': return 'category-tech';
        case '실무': return 'category-practice';
        case '기타': return 'category-etc';
        default: return '';
    }
}

// 교과목 필터링
function filterCourses() {
    // 체크박스 필터에서 선택된 값들 가져오기
    const selectedYears = [];
    document.querySelectorAll('input[name="yearFilter"]:checked').forEach(cb => {
        selectedYears.push(cb.value);
    });
    
    const selectedSemesters = [];
    document.querySelectorAll('input[name="semesterFilter"]:checked').forEach(cb => {
        selectedSemesters.push(cb.value);
    });
    
    const selectedCategories = [];
    document.querySelectorAll('input[name="categoryFilter"]:checked').forEach(cb => {
        selectedCategories.push(cb.value);
    });
    
    const selectedSubjectTypes = [];
    document.querySelectorAll('input[name="subjectTypeFilter"]:checked').forEach(cb => {
        selectedSubjectTypes.push(cb.value);
    });
    
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    
    // 변경 상태 필터
    const showAdded = document.getElementById('showAdded').checked;
    const showModified = document.getElementById('showModified').checked;
    const showDeleted = document.getElementById('showDeleted').checked;
    const showUnchanged = document.getElementById('showUnchanged').checked;
    
    // 현재 버전의 변경 사항 가져오기
    const diffSummary = getCurrentDiffSummary();
    
    // 모든 변경 상태 필터가 해제되어 있으면 빈 배열 반환
    if (!showAdded && !showModified && !showDeleted && !showUnchanged) {
        filteredCourses = [];
        renderCourses();
        updateStats();
        return;
    }
    
    // 현재 교과목들 필터링
    const currentFilteredCourses = courses.filter(course => {
        const [year, semester] = course.yearSemester.split('-');
        const matchesYear = selectedYears.length === 0 || selectedYears.includes(year);
        const matchesSemester = selectedSemesters.length === 0 || selectedSemesters.includes(semester);
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(course.category);
        const matchesSubjectType = selectedSubjectTypes.length === 0 || selectedSubjectTypes.includes(course.subjectType);
        const matchesSearch = !searchInput || 
            course.courseName.toLowerCase().includes(searchInput) ||
            course.professor.toLowerCase().includes(searchInput) ||
            course.courseNumber.toLowerCase().includes(searchInput);
        
        // 변경 상태 필터링
        const courseDiff = diffSummary.find(diff => diff.course.id === course.id);
        let matchesChangeStatus = false;
        if (courseDiff) {
            if (courseDiff.type === '추가' && showAdded) matchesChangeStatus = true;
            else if (courseDiff.type === '수정' && showModified) matchesChangeStatus = true;
        } else if (showUnchanged) {
            matchesChangeStatus = true;
        }
        
        return matchesYear && matchesSemester && matchesCategory && matchesSubjectType && matchesSearch && matchesChangeStatus;
    });
    
    // 삭제된 교과목들 필터링
    const deletedFilteredCourses = showDeleted ? diffSummary
        .filter(diff => diff.type === '삭제')
        .map(diff => diff.course)
        .filter(course => {
            const [year, semester] = course.yearSemester.split('-');
            const matchesYear = selectedYears.length === 0 || selectedYears.includes(year);
            const matchesSemester = selectedSemesters.length === 0 || selectedSemesters.includes(semester);
            const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(course.category);
            const matchesSubjectType = selectedSubjectTypes.length === 0 || selectedSubjectTypes.includes(course.subjectType);
            const matchesSearch = !searchInput || 
                course.courseName.toLowerCase().includes(searchInput) ||
                course.professor.toLowerCase().includes(searchInput) ||
                course.courseNumber.toLowerCase().includes(searchInput);
            
            return matchesYear && matchesSemester && matchesCategory && matchesSubjectType && matchesSearch;
        }) : [];
    
    // 현재 과목과 삭제된 과목을 합치기
    filteredCourses = [...currentFilteredCourses, ...deletedFilteredCourses];
    
    renderCourses();
    updateStats();
}

// 필터 초기화
function resetFilters() {
    // 체크박스 필터 초기화
    document.querySelectorAll('input[name="yearFilter"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="semesterFilter"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="categoryFilter"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="subjectTypeFilter"]').forEach(cb => cb.checked = false);
    
    // 필터 텍스트 업데이트
    document.getElementById('yearFilterText').textContent = '전체';
    document.getElementById('semesterFilterText').textContent = '전체';
    document.getElementById('categoryFilterText').textContent = '전체';
    document.getElementById('subjectTypeFilterText').textContent = '전체';
    
    document.getElementById('searchInput').value = '';
    
    // 변경 상태 체크박스 모두 체크
    document.getElementById('showAdded').checked = true;
    document.getElementById('showModified').checked = true;
    document.getElementById('showDeleted').checked = true;
    document.getElementById('showUnchanged').checked = true;
    
    filteredCourses = null;
    
    // 정렬 상태도 초기화
    currentSortColumn = null;
    currentSortDirection = 'asc';
    
    // 정렬 아이콘 초기화
    const table = document.getElementById('coursesTable');
    if (table) {
        const headers = table.querySelectorAll('th.sortable');
        headers.forEach(header => {
            header.classList.remove('asc', 'desc');
        });
    }
    
    // 화살표 초기화
    clearMoveArrows();
    
    // 필터 적용
    filterCourses();
}

// 교과목 수정
function editCourse(index) {
    editingIndex = index;
    const course = courses[index];
    const form = document.getElementById('courseForm');
    // 학년-학기 분리
    const parts = course.yearSemester.split('-');
    const year = parts[0];
    let semester = parts[1] || '';
    
    // "1/2" 또는 "1,2" 형식 처리
    if (semester === '1/2' || semester === '1,2') {
        semester = '구분없음';
    }
    
    form.year.value = year;
    form.semester.value = semester;
    form.courseNumber.value = course.courseNumber;
    form.courseName.value = course.courseName;
    form.credits.value = course.credits;
    form.category.value = course.category;
    form.subjectType.value = course.subjectType;
    form.isRequired.value = course.isRequired;
    form.professor.value = course.professor || '';
    form.description.value = course.description || '';
    // 모달 제목 항상 '교과목 수정'
    document.querySelector('.modal-header h2').textContent = '교과목 수정';
    // 수행평가기준 리스트 표시
    const matrixValues = matrixData[course.courseName] || new Array(18).fill(0);
    const criteriaNames = [
        '건축과 예술 및 과학기술', '세계 건축의 역사와 문화', '한국 건축과 전통', '건축과 사회',
        '형태 및 공간구성', '대지와 외부공간 계획', '안전 설계', '건축재료와 구성방법',
        '건물시스템 통합설계', '건축과 도시설계', '연구기반 종합설계', '구조원리',
        '구조시스템', '환경조절 시스템', '건축설비 시스템', '시공 및 건설관리',
        '프로젝트수행과 건축사무소운영', '건축사법과 건축법 및 관계법령'
    ];
    let listHtml = '<ul style="margin:0; padding-left:18px;">';
    let hasAny = false;
    matrixValues.forEach((value, idx) => {
        if (value > 0) {
            hasAny = true;
            if (value === 1) {
                listHtml += `<li><b>${idx+1}. ${criteriaNames[idx]}</b></li>`;
            } else {
                listHtml += `<li><span class='criteria-partial'>${idx+1}. ${criteriaNames[idx]}</span></li>`;
            }
        }
    });
    if (!hasAny) listHtml += '<li style="color:#bbb;">없음</li>';
    listHtml += '</ul>';
    const criteriaDiv = document.getElementById('coursePerformanceCriteria');
    if (criteriaDiv) criteriaDiv.innerHTML = listHtml;
    showModal();
}

// 교과목 삭제
function deleteCourse(index) {
    const course = courses[index];
    if (confirm(`'${course.courseName}' 과목을 정말 삭제하시겠습니까?`)) {
        // 공통가치대응 표의 셀 데이터 보존
        const currentCommonValuesData = collectCommonValuesTableData();
        
        // 삭제된 과목의 전체 데이터를 보존 (ID를 키로 사용)
        deletedCoursesData[course.id] = JSON.parse(JSON.stringify(course));
        
        // 매트릭스 데이터도 함께 저장
        if (matrixData[course.courseName]) {
            deletedCoursesData[course.id].matrixValues = [...matrixData[course.courseName]];
        } else {
            // 매트릭스 데이터가 없으면 빈 배열로 초기화
            deletedCoursesData[course.id].matrixValues = new Array(18).fill(0);
        }
        
        // localStorage에 저장
        localStorage.setItem('deletedCoursesData', JSON.stringify(deletedCoursesData));
        
        // 삭제 이력 기록
        addChangeHistory('삭제', course.courseName, Object.keys(course).map(k => ({field: k, before: course[k], after: ''})));
        courses.splice(index, 1);
        
        // 공통가치대응 표의 셀 데이터 복원
        commonValuesCellTexts = currentCommonValuesData;
        
        renderCourses();
        renderMatrix();
        // 셀 편집 중이 아닐 때만 테이블 렌더링
        if (!isCommonValuesCellEditing) {
        renderCommonValuesTable(); // 공통가치대응 탭도 즉시 갱신
        }
        updateStats();
        alert('교과목이 삭제되었습니다.');
        renderChangeHistoryPanel();
        
        // 화살표 즉시 업데이트
        setTimeout(() => {
            const movedCoursesForGhost = getMovedCoursesForGhost();
            drawMoveArrows(movedCoursesForGhost);
        }, 10);
    }
}

// 통계 업데이트
function updateStats() {
    // 삭제된 교과목과 고스트 블록을 제외한 활성 교과목만 필터링
    const activeCourses = courses.filter(course => {
        // 삭제된 교과목 제외
        const isDeleted = course.isDeleted === true;
        // 고스트 블록 제외 (원래 위치에서 이동된 교과목의 흔적)
        const isGhost = course.isGhost === true;
        return !isDeleted && !isGhost;
    });
    
    const categoryStats = {
        '교양': activeCourses.filter(c => c.category === '교양').length,
        '건축적사고': activeCourses.filter(c => c.category === '건축적사고').length,
        '설계': activeCourses.filter(c => c.category === '설계').length,
        '기술': activeCourses.filter(c => c.category === '기술').length,
        '실무': activeCourses.filter(c => c.category === '실무').length,
        '기타': activeCourses.filter(c => c.category === '기타').length
    };
    
    // 분석 및 통계 탭의 통계 업데이트
    const totalCreditsEl = document.getElementById('totalCredits');
    const requiredCoursesEl = document.getElementById('requiredCourses');
    const electiveCoursesEl = document.getElementById('electiveCourses');
    const designCoursesEl = document.getElementById('designCourses');
    const designRatioEl = document.getElementById('designRatio');
    
    if (totalCreditsEl) {
        const totalCredits = activeCourses.reduce((sum, course) => sum + course.credits, 0);
        totalCreditsEl.textContent = totalCredits;
    }
    
    if (requiredCoursesEl) {
        const requiredCount = activeCourses.filter(c => c.isRequired === '필수').length;
        requiredCoursesEl.textContent = requiredCount;
    }
    
    if (electiveCoursesEl) {
        const electiveCount = activeCourses.filter(c => c.isRequired === '선택').length;
        electiveCoursesEl.textContent = electiveCount;
    }
    
    if (designCoursesEl) {
        const designCount = activeCourses.filter(c => c.category === '설계').length;
        designCoursesEl.textContent = designCount;
    }
    
    if (designRatioEl) {
        const designCount = activeCourses.filter(c => c.category === '설계').length;
        const ratio = activeCourses.length > 0 ? Math.round((designCount / activeCourses.length) * 100) : 0;
        designRatioEl.textContent = ratio + '%';
    }
    
    drawChart();
    drawSubjectTypeChart();
}
// 매트릭스 테이블 렌더링 (카테고리별 그룹화 반영, 학년-학기 순 정렬)
function renderMatrix() {
    // 매트릭스 제목 업데이트 (편집 중이 아닐 때만)
    const titleElement = document.getElementById('matrixTitle');
    if (titleElement && titleElement.contentEditable !== 'true') {
        // 제목은 버전 데이터에서 가져옴
        const versionTitle = versions[currentVersion]?.matrixTab?.matrixTitleText;
        if (versionTitle) {
            titleElement.textContent = versionTitle;
        } else {
            titleElement.textContent = '수행평가 매트릭스';
        }
    }
    
    const tbody = document.getElementById('matrixTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // 필터링된 데이터 사용
    const coursesToRender = filteredMatrixCourses || courses;
    
    // 선택된 학년들 가져오기 (필터링용)
    const selectedYears = [];
    document.querySelectorAll('.matrix-filters input[type="checkbox"][value^="1"], .matrix-filters input[type="checkbox"][value^="2"], .matrix-filters input[type="checkbox"][value^="3"], .matrix-filters input[type="checkbox"][value^="4"], .matrix-filters input[type="checkbox"][value^="5"]').forEach(checkbox => {
        if (checkbox.checked) {
            selectedYears.push(checkbox.value);
        }
    });
    
    // 선택된 필수여부들 가져오기 (필터링용)
    const selectedRequired = [];
    document.querySelectorAll('.matrix-filters input[type="checkbox"][value="필수"], .matrix-filters input[type="checkbox"][value="선택"]').forEach(checkbox => {
        if (checkbox.checked) {
            selectedRequired.push(checkbox.value);
        }
    });
    
    // 삭제된 교과목들 가져오기
    const diffSummary = getCurrentDiffSummary();
    const deletedCourses = diffSummary.filter(entry => entry.type === '삭제').map(entry => entry.course);
    
    // 삭제된 교과목 필터가 선택되어 있는지 확인
    const showDeleted = document.querySelector('.matrix-filters input[value="deleted"]:checked') !== null;
    
    // 삭제된 교과목들도 필터링 적용
    // 단, 이미 coursesToRender에 있는 과목은 제외 (중복 방지)
    const courseIds = new Set(coursesToRender.map(c => c.id));
    const filteredDeletedCourses = showDeleted ? deletedCourses.filter(course => {
        // 이미 렌더링 목록에 있는 과목은 제외
        if (courseIds.has(course.id)) {
            return false;
        }
        const [year] = course.yearSemester.split('-');
        const yearMatch = selectedYears.length === 0 || selectedYears.includes(year);
        const requiredMatch = selectedRequired.length === 0 || selectedRequired.includes(course.isRequired);
        return yearMatch && requiredMatch;
    }) : [];
    
    // 현재 교과목들과 필터링된 삭제된 교과목들을 합치기
    const allCoursesToRender = [...coursesToRender, ...filteredDeletedCourses];
    
    const coursesByCategory = {
        '건축적사고': [],
        '설계': [],
        '기술': [],
        '실무': []
    };
    allCoursesToRender.forEach(course => {
        // 교양과목은 매트릭스에서 제외
        if (course.category === '교양') {
            return;
        }
        if (coursesByCategory[course.category]) {
            coursesByCategory[course.category].push(course);
        }
    });
    
    // 각 카테고리 내에서 학년-학기 순으로 정렬
    Object.keys(coursesByCategory).forEach(category => {
        coursesByCategory[category].sort((a, b) => {
            const [aYear, aSemester] = a.yearSemester.split('-');
            const [bYear, bSemester] = b.yearSemester.split('-');
            
            // 학년 비교
            if (aYear !== bYear) {
                return parseInt(aYear) - parseInt(bYear);
            }
            
            // 학기 비교 (1학기 < 2학기 < 계절학기)
            const semesterOrder = { '1': 1, '2': 2, '계절': 3 };
            return semesterOrder[aSemester] - semesterOrder[bSemester];
        });
    });
    
    // 변경사항 표시 모드에서만 이동된 과목 정보 수집
    let movedCoursesForMatrix = [];
    if (showChangesModeMatrix) {
        movedCoursesForMatrix = getMovedCoursesForMatrix();
    }
    
    Object.entries(coursesByCategory).forEach(([category, categoryCourses]) => {
        if (categoryCourses.length === 0) return;
        
        // 변경사항 적용 모드에서 실제 표시될 과목 수 계산
        let visibleCoursesCount = categoryCourses.length;
        if (!showChangesModeMatrix) {
            visibleCoursesCount = categoryCourses.filter(course => {
                const isDeleted = deletedCourses.some(deletedCourse => deletedCourse.id === course.id);
                return !isDeleted;
            }).length;
            
            // 표시할 과목이 없으면 카테고리 전체 건너뛰기
            if (visibleCoursesCount === 0) return;
        }
        
        let visibleIndex = 0;
        categoryCourses.forEach((course, index) => {
            // 삭제된 교과목인지 먼저 확인
            const isDeleted = deletedCourses.some(deletedCourse => deletedCourse.id === course.id);
            
            // 변경사항 적용 모드에서는 삭제된 과목 건너뛰기
            if (!showChangesModeMatrix && isDeleted) {
                return;
            }
            
            // 추가된 교과목인지 확인
            const courseDiff = diffSummary.find(diff => diff.course.id === course.id);
            const isAdded = courseDiff && courseDiff.type === '추가';
            
            const row = tbody.insertRow();
            const categoryClass = getCategoryClass(course.category);
            row.classList.add(`category-${categoryClass}`);
            if (course.isRequired === '필수') row.classList.add('major-required-row');
            row.setAttribute('data-course-id', course.id);

            // 카테고리 셀: 첫 번째 표시되는 행에만 실제 값
            if (visibleIndex === 0) {
                const categoryCell = row.insertCell();
                categoryCell.textContent = category;
                categoryCell.rowSpan = visibleCoursesCount;
                categoryCell.style.fontWeight = 'bold';
                categoryCell.style.textAlign = 'center';
                categoryCell.style.verticalAlign = 'middle';
            } else {
                // 숨김셀 추가
                const hiddenCell = row.insertCell();
                hiddenCell.style.display = 'none';
            }
            
            visibleIndex++;

            // 이하 기존과 동일하게 셀 추가
            const yearSemCell = row.insertCell();
            yearSemCell.textContent = course.yearSemester;
            const numCell = row.insertCell();
            numCell.textContent = course.courseNumber;
            const nameCell = row.insertCell();
            
            // 변경사항 표시 모드에서 이전 과목명 표시
            if (showChangesModeMatrix) {
                const initialCourse = initialCourses.find(ic => ic.id === course.id);
                if (initialCourse && initialCourse.courseName !== course.courseName) {
                    // 과목명이 변경된 경우
                    nameCell.innerHTML = `
                        <div style="line-height: 1.2;">${course.courseName}</div>
                        <div style="font-size: 10px; color: #999; margin-top: 1px; line-height: 1;">
                            (이전: ${initialCourse.courseName})
                        </div>
                    `;
                } else {
                    nameCell.textContent = course.courseName;
                }
            } else {
                nameCell.textContent = course.courseName;
            }
            
            nameCell.style.cursor = 'pointer';
            nameCell.title = ``;
            nameCell.addEventListener('mouseenter', (e) => showCourseTooltip(e, course));
            nameCell.addEventListener('mouseleave', hideCourseTooltip);
            nameCell.addEventListener('mousemove', moveCourseTooltip);
            
            // 삭제된 과목도 편집 가능하도록 수정
            nameCell.onclick = () => editCourseFromMatrix(course, isDeleted);
            nameCell.classList.add('no-edit');
            
            // 변경사항 표시 모드에서만 교과목 변경 상태에 따른 색상 적용
            if (showChangesModeMatrix) {
                if (courseDiff) {
                    if (courseDiff.type === '추가') {
                        nameCell.classList.add('course-added');
                    } else if (courseDiff.type === '삭제') {
                        nameCell.classList.add('course-deleted');
                    } else if (courseDiff.type === '수정') {
                        nameCell.classList.add('course-modified');
                    }
                } else if (isDeleted) {
                    // 삭제된 교과목 스타일 적용
                    nameCell.classList.add('course-deleted');
                    row.classList.add('deleted-course-row');
                }
            }
            const creditsCell = row.insertCell();
            creditsCell.textContent = course.credits;
            creditsCell.style.textAlign = 'center';

            // 매트릭스 데이터 셀들 추가
            // 삭제된 과목인 경우 deletedCoursesData에서 matrixValues를 가져옴
            let matrixValues;
            if (isDeleted && deletedCoursesData[course.id]) {
                // 삭제된 과목의 매트릭스 값이 없으면 초기화
                if (!deletedCoursesData[course.id].matrixValues) {
                    // 기존 matrixData에서 가져오거나 새로 생성
                    deletedCoursesData[course.id].matrixValues = matrixData[course.courseName] || new Array(18).fill(0);
                }
                matrixValues = deletedCoursesData[course.id].matrixValues;
            } else {
                matrixValues = matrixData[course.courseName] || new Array(18).fill(0);
            }
            matrixValues.forEach((value, colIndex) => {
                const cell = row.insertCell();
                let markClass = '';
                if (colIndex >= 0 && colIndex <= 3) {
                    markClass = 'matrix-mark-thinking';
                } else if (colIndex >= 4 && colIndex <= 10) {
                    markClass = 'matrix-mark-design';
                } else if (colIndex >= 11 && colIndex <= 15) {
                    markClass = 'matrix-mark-tech';
                } else if (colIndex >= 16 && colIndex <= 17) {
                    markClass = 'matrix-mark-practice';
                }
                
                // 초기값 확인 (삭제된 점 흔적 표시용)
                let initialValue = 0;
                if (initialMatrixData[course.courseName] && initialMatrixData[course.courseName][colIndex] !== undefined) {
                    initialValue = initialMatrixData[course.courseName][colIndex];
                }
                
                // 디버그: 변경된 셀 로그 (첫 번째만)
                if (value !== initialValue && !window.matrixDebugLogged) {
                    console.log(`렌더링 시점 - 과목: ${course.courseName}, 컬럼: ${colIndex}`);
                    console.log(`현재값: ${value}, 초기값: ${initialValue}`);
                    console.log(`showChangesModeMatrix: ${showChangesModeMatrix}`);
                    console.log(`파란색 표시 조건: ${showChangesModeMatrix && initialValue !== value}`);
                    window.matrixDebugLogged = true;
                }
                
                // 값이 0이고 초기값이 있었다면 회색으로 흔적 표시 (변경사항 표시 모드에서만)
                if (showChangesModeMatrix && value === 0 && initialValue > 0) {
                    const removedSymbol = (initialValue === 2 || initialValue === 1) ? '●' : '◐';
                    cell.innerHTML = `<span class="matrix-mark matrix-mark-removed" style="color: #999999; opacity: 0.4;">${removedSymbol}</span>`;
                }
                // 값 표시 로직 수정: 2점도 1점으로 표시, 1=●, 0.5=◐
                else if (value === 2 || value === 1) {
                    // 삭제된 과목은 빨간색으로 표시
                    if (isDeleted) {
                        cell.innerHTML = `<span class=\"matrix-mark\" style=\"color: #e74c3c;\">●</span>`;
                    }
                    // 새로 추가된 점은 파란색으로 표시 (변경사항 표시 모드에서만)
                    else if (showChangesModeMatrix && initialValue !== 1 && initialValue !== 2) {
                        cell.innerHTML = `<span class=\"matrix-mark matrix-mark-new\" style=\"color: #007bff;\">●</span>`;
                    }
                    // 추가된 과목은 녹색으로 표시 (변경사항 표시 모드에서만)
                    else if (showChangesModeMatrix && courseDiff && courseDiff.type === '추가') {
                        cell.innerHTML = `<span class=\"matrix-mark\" style=\"color: #27ae60;\">●</span>`;
                    } else {
                        cell.innerHTML = `<span class=\"matrix-mark ${markClass}\">●</span>`;
                    }
                } else if (value === 0.5) {
                    // 삭제된 과목은 빨간색으로 표시
                    if (isDeleted) {
                        cell.innerHTML = `<span class=\"matrix-mark\" style=\"color: #e74c3c;\">◐</span>`;
                    }
                    // 새로 추가된 점은 파란색으로 표시 (변경사항 표시 모드에서만)
                    else if (showChangesModeMatrix && initialValue !== 0.5) {
                        cell.innerHTML = `<span class=\"matrix-mark matrix-mark-new\" style=\"color: #007bff;\">◐</span>`;
                    }
                    // 추가된 과목은 녹색으로 표시 (변경사항 표시 모드에서만)
                    else if (showChangesModeMatrix && courseDiff && courseDiff.type === '추가') {
                        cell.innerHTML = `<span class=\"matrix-mark\" style=\"color: #27ae60;\">◐</span>`;
                    } else {
                        cell.innerHTML = `<span class=\"matrix-mark ${markClass}\">◐</span>`;
                    }
                } else {
                    cell.innerHTML = '';
                }
                cell.setAttribute('data-course-name', course.courseName);
                cell.setAttribute('data-col-index', colIndex);
                cell.setAttribute('data-course-id', course.id);
                cell.setAttribute('data-is-deleted', isDeleted ? 'true' : 'false');
                cell.setAttribute('data-current-value', value);
                
                // onclick 속성 직접 설정 - 모든 과목에 동일한 함수 사용
                cell.style.cursor = 'pointer';
                cell.onclick = function(e) {
                    if (isEditModeMatrix) {
                        // 모든 과목(삭제된 과목 포함)에 대해 handleMatrixCellClickSimple 사용
                        handleMatrixCellClickSimple(this);
                    }
                };
                const headerCell = document.querySelector(`#matrixTable thead tr:last-child th:nth-child(${colIndex + 6})`);
                if (headerCell && headerCell.style.width) {
                    cell.style.width = headerCell.style.width;
                    cell.style.minWidth = headerCell.style.minWidth;
                    cell.style.maxWidth = headerCell.style.maxWidth;
                }
            });
            // 전공필수여부 셀 추가
            const requiredCell = row.insertCell();
            if (course.isRequired === '필수') {
                // 삭제된 교과목인 경우 빨간색으로 표시
                if (isDeleted) {
                    requiredCell.innerHTML = '<span class="major-required-dot" style="color: #e74c3c;">●</span>';
                } else if (showChangesModeMatrix && isAdded) {
                    // 변경사항 표시 모드에서 추가된 교과목인 경우 녹색으로 표시
                    requiredCell.innerHTML = '<span class="major-required-dot matrix-mark-added">●</span>';
                } else {
                    requiredCell.innerHTML = '<span class="major-required-dot">●</span>';
                }
            } else {
                requiredCell.innerHTML = '';
            }
            requiredCell.style.textAlign = 'center';
            requiredCell.classList.add('no-edit');
            requiredCell.style.cursor = 'pointer';
            
            // 필수/선택 토글 핸들러 - 항상 설정하고 내부에서 편집모드 체크
            requiredCell.onclick = function() {
                // 편집 모드일 때만 토글 가능
                if (!isEditModeMatrix) return;
                
                course.isRequired = (course.isRequired === '필수') ? '선택' : '필수';
                
                // 삭제된 과목인 경우 deletedCoursesData도 업데이트
                if (isDeleted && deletedCoursesData[course.id]) {
                    deletedCoursesData[course.id].isRequired = course.isRequired;
                }
                
                // tempCourses에도 업데이트 (임시 저장)
                if (!isDeleted) {
                    const tempCourse = tempCourses.find(c => c.id === course.id);
                    if (tempCourse) {
                        tempCourse.isRequired = course.isRequired;
                    }
                }
                
                // 셀 내용만 업데이트
                if (course.isRequired === '필수') {
                    if (isDeleted) {
                            requiredCell.innerHTML = '<span class="major-required-dot" style="color: #e74c3c;">●</span>';
                        } else {
                            requiredCell.innerHTML = '<span class="major-required-dot">●</span>';
                        }
                    } else {
                        requiredCell.innerHTML = '';
                    }
                    
                    // 전체를 다시 그리지 않고 필요한 부분만 업데이트
                    // renderMatrix();
                    // renderCourses();
                    updateStats();
                    
                    // 임시 저장 메시지
                    showToast('변경사항이 임시 저장되었습니다. 버전 저장 버튼을 눌러주세요.');
                };
        });
    });
    
    // 변경사항 표시 모드에서는 고스트 행과 화살표 기능 일시 비활성화
    // (카테고리 그룹화와 충돌 문제로 인해)
    /*
    if (showChangesModeMatrix && movedCoursesForMatrix.length > 0) {
        // 추후 카테고리 구조를 고려한 고스트 행 구현 필요
    }
    */
    
    // 호버 효과 재적용
    if (designSettings.hoverEffect) {
        applyHoverEffect(designSettings.hoverEffect);
    }
    
    // 수정모드가 활성화되어 있다면 셀 편집 기능 활성화
    if (isEditMode) {
        enableCellEditing();
    }
}

// 차트 그리기
// 캔버스 폭에 맞춰 막대 배치를 계산한다.
// 데스크톱처럼 넉넉한 폭에서는 기존 값(baseMargin/minBar 등)을 그대로 사용하고,
// 모바일처럼 좁아 막대 전체 폭이 캔버스를 넘치는 경우에만 비율을 축소하여 잘림을 방지한다.
function computeBarLayout(canvasWidth, n, baseMargin, spacingRatio, minSpacing, minBar) {
    const sideMargin = baseMargin;
    const availableWidth = canvasWidth - sideMargin * 2;
    let barSpacing = Math.max(minSpacing, availableWidth * spacingRatio);
    let barWidth = Math.max(minBar, (availableWidth - (n - 1) * barSpacing) / n);
    let totalWidth = n * barWidth + (n - 1) * barSpacing;
    const minEdge = 14; // 좁은 화면에서 좌우 최소 여백
    const maxTotal = canvasWidth - minEdge * 2;
    if (totalWidth > maxTotal) {
        const scale = maxTotal / totalWidth; // 전체를 균일 축소해 캔버스 안에 맞춤
        barWidth *= scale;
        barSpacing *= scale;
        totalWidth = n * barWidth + (n - 1) * barSpacing;
    }
    const startX = (canvasWidth - totalWidth) / 2;
    // 라벨 폰트도 좁은 화면에서 축소(데스크톱 폭에서는 16px 유지)
    const labelFont = Math.max(10, Math.round(16 * Math.min(1, canvasWidth / 620)));
    return { startX, barWidth, barSpacing, totalWidth, labelFont };
}

function drawChart() {
    const canvas = document.getElementById('chartCanvas');
    if (!canvas) return;
    
    // 캔버스 크기 동적 조절 - 지연 실행으로 컨테이너 크기 확정 후 계산
    const container = canvas.parentElement;
    if (!container) return;
    
    // 컨테이너가 보이지 않는 경우 지연 실행
    if (container.offsetWidth === 0) {
        setTimeout(() => drawChart(), 100);
        return;
    }
    
    const containerWidth = container.clientWidth - 40; // 패딩 고려
    canvas.width = containerWidth;
    canvas.height = 400;
    
    const ctx = canvas.getContext('2d');
    const categories = ['건축적사고', '설계', '기술', '실무', '기타'];
    
    // 삭제된 교과목과 고스트 블록을 제외한 활성 교과목만 필터링
    const activeCourses = courses.filter(course => {
        const isDeleted = course.isDeleted === true;
        const isGhost = course.isGhost === true;
        return !isDeleted && !isGhost;
    });
    
    // 과목수와 학점수 계산
    const data = [
        activeCourses.filter(c => c.category === '건축적사고').length,
        activeCourses.filter(c => c.category === '설계').length,
        activeCourses.filter(c => c.category === '기술').length,
        activeCourses.filter(c => c.category === '실무').length,
        activeCourses.filter(c => c.category === '기타').length
    ];
    
    const creditsData = [
        activeCourses.filter(c => c.category === '건축적사고').reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0),
        activeCourses.filter(c => c.category === '설계').reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0),
        activeCourses.filter(c => c.category === '기술').reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0),
        activeCourses.filter(c => c.category === '실무').reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0),
        activeCourses.filter(c => c.category === '기타').reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0)
    ];
    
    const colors = ['#1976d2', '#d32f2f', '#f57c00', '#388e3c', '#7b1fa2'];
    const layout = computeBarLayout(canvas.width, data.length, 100, 0.05, 20, 60);
    const { startX, barWidth, barSpacing, labelFont } = layout;
    const valueFont = `bold ${labelFont}px "Noto Sans KR", sans-serif`;
    const maxHeight = 250;
    const maxValue = Math.max(...data, 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * maxHeight;
        const x = startX + index * (barWidth + barSpacing);
        const y = canvas.height - 100 - barHeight;

        ctx.fillStyle = colors[index];
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#2c3e50';
        ctx.font = valueFont;
        // 과목수와 학점수를 줄바꿈해서 표시
        const subjectText = `${value}과목`;
        const creditText = `(${creditsData[index]}학점)`;
        const subjectTextWidth = ctx.measureText(subjectText).width;
        const creditTextWidth = ctx.measureText(creditText).width;

        ctx.fillText(subjectText, x + barWidth/2 - subjectTextWidth/2, y - 25);
        ctx.fillText(creditText, x + barWidth/2 - creditTextWidth/2, y - 8);

        ctx.font = valueFont;
        const categoryText = categories[index];
        const categoryTextWidth = ctx.measureText(categoryText).width;
        ctx.fillText(categoryText, x + barWidth/2 - categoryTextWidth/2, canvas.height - 75);
    });
}

// 과목별분류 차트 그리기
function drawSubjectTypeChart() {
    const canvas = document.getElementById('subjectTypeChartCanvas');
    if (!canvas) return;
    
    // 캔버스 크기 동적 조절 - 지연 실행으로 컨테이너 크기 확정 후 계산
    const container = canvas.parentElement;
    if (!container) return;
    
    // 컨테이너가 보이지 않는 경우 지연 실행
    if (container.offsetWidth === 0) {
        setTimeout(() => drawSubjectTypeChart(), 100);
        return;
    }
    
    const containerWidth = container.clientWidth - 40; // 패딩 고려
    canvas.width = containerWidth;
    canvas.height = 400;
    
    const ctx = canvas.getContext('2d');
    
    // 삭제된 교과목과 고스트 블록을 제외한 활성 교과목만 필터링
    const activeCourses = courses.filter(course => {
        const isDeleted = course.isDeleted === true;
        const isGhost = course.isGhost === true;
        return !isDeleted && !isGhost;
    });
    
    // 과목별분류 목록 (실제 데이터에서 추출)
    const subjectTypes = [...new Set(activeCourses.map(c => c.subjectType))].filter(type => type && type.trim() !== '');
    const categories = subjectTypes.length > 0 ? subjectTypes : ['이론', '설계', '기술', '디지털', '역사', '사회', '도시', '실무'];
    
    // 과목수와 학점수 계산
    const data = categories.map(type => 
        activeCourses.filter(c => c.subjectType === type).length
    );
    
    const creditsData = categories.map(type => 
        activeCourses.filter(c => c.subjectType === type).reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0)
    );
    
    const colors = ['#1976d2', '#d32f2f', '#f57c00', '#388e3c', '#7b1fa2', '#c2185b', '#ff6f00', '#2e7d32', '#1565c0', '#d84315'];
    const layout = computeBarLayout(canvas.width, categories.length, 100, 0.03, 15, 50);
    const { startX, barWidth, barSpacing, labelFont } = layout;
    const valueFont = `bold ${labelFont}px "Noto Sans KR", sans-serif`;
    const maxHeight = 250;
    const maxValue = Math.max(...data, 1);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    data.forEach((value, index) => {
        const barHeight = (value / maxValue) * maxHeight;
        const x = startX + index * (barWidth + barSpacing);
        const y = canvas.height - 100 - barHeight;

        ctx.fillStyle = colors[index % colors.length];
        ctx.fillRect(x, y, barWidth, barHeight);

        ctx.fillStyle = '#2c3e50';
        ctx.font = valueFont;
        // 과목수와 학점수를 줄바꿈해서 표시
        const subjectText = `${value}과목`;
        const creditText = `(${creditsData[index]}학점)`;
        const subjectTextWidth = ctx.measureText(subjectText).width;
        const creditTextWidth = ctx.measureText(creditText).width;

        ctx.fillText(subjectText, x + barWidth/2 - subjectTextWidth/2, y - 25);
        ctx.fillText(creditText, x + barWidth/2 - creditTextWidth/2, y - 8);

        ctx.font = valueFont;
        // 긴 텍스트는 줄바꿈 처리
        const categoryText = categories[index];
        if (categoryText.length > 4) {
            const midPoint = Math.ceil(categoryText.length / 2);
            const firstLine = categoryText.substring(0, midPoint);
            const secondLine = categoryText.substring(midPoint);
            const firstLineWidth = ctx.measureText(firstLine).width;
            const secondLineWidth = ctx.measureText(secondLine).width;
            ctx.fillText(firstLine, x + barWidth/2 - firstLineWidth/2, canvas.height - 75);
            ctx.fillText(secondLine, x + barWidth/2 - secondLineWidth/2, canvas.height - 60);
        } else {
            const categoryTextWidth = ctx.measureText(categoryText).width;
            ctx.fillText(categoryText, x + barWidth/2 - categoryTextWidth/2, canvas.height - 75);
        }
    });

    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.min(50, startX), canvas.height - 100);
    ctx.lineTo(canvas.width - Math.min(50, startX), canvas.height - 100);
    ctx.stroke();
}

// 모달 관련 함수
function showModal() {
    document.getElementById('courseModal').style.display = 'block';
    document.body.classList.add('modal-open');
    // 모달 제목 항상 '교과목 수정'으로 고정
    document.querySelector('.modal-header h2').textContent = '교과목 수정';
}
function closeModal() {
    document.getElementById('courseModal').style.display = 'none';
    document.getElementById('courseForm').reset();
    document.querySelector('.modal-header h2').textContent = '교과목 추가';
    editingIndex = -1;
}

// X 버튼 클릭 시 확인 없이 닫기
function confirmCloseModal() {
    closeModal();
}

// 교과목 추가/수정 처리
function handleCourseSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const form = e.target;
    // 학년-학기 조합
    const year = formData.get('year');
    const semester = formData.get('semester');
    let yearSemesterDisplay = '';
    if (semester === '구분없음') {
        yearSemesterDisplay = `${year}-1/2`;
    } else if (semester === '계절') {
        yearSemesterDisplay = `${year}-계절`;
    } else {
        yearSemesterDisplay = `${year}-${semester}`;
    }
    const course = {
        yearSemester: yearSemesterDisplay,
        courseNumber: form.courseNumber.value,
        courseName: form.courseName.value,
        credits: parseInt(form.credits.value),
        category: form.category.value,
        subjectType: form.subjectType.value,
        isRequired: form.isRequired.value,
        professor: form.professor.value,
        description: form.description.value
    };
    
    // 삭제된 과목 편집 처리
    if (editingIndex === -999 && editingDeletedCourseId) {
        // 삭제된 과목의 데이터 업데이트
        const oldCourse = deletedCoursesData[editingDeletedCourseId];
        course.id = oldCourse.id; // ID 유지
        
        // 변경된 필드만 추출
        const changes = [];
        for (const key of Object.keys(course)) {
            if (course[key] !== oldCourse[key]) {
                changes.push({field: key, before: oldCourse[key], after: course[key]});
            }
        }
        
        // 삭제된 과목 데이터 업데이트
        deletedCoursesData[editingDeletedCourseId] = course;
        
        // 매트릭스 데이터도 함께 업데이트
        if (oldCourse.courseName !== course.courseName) {
            // 과목명이 변경된 경우
            if (matrixData[oldCourse.courseName]) {
                matrixData[course.courseName] = matrixData[oldCourse.courseName];
                // 이전 과목명의 데이터도 보존
            }
            // deletedCoursesData에도 매트릭스 데이터 업데이트
            if (deletedCoursesData[editingDeletedCourseId].matrixValues) {
                // 기존 매트릭스 값 유지
            } else if (matrixData[course.courseName]) {
                deletedCoursesData[editingDeletedCourseId].matrixValues = [...matrixData[course.courseName]];
            }
        }
        
        // 임시 저장소에도 저장 (버전 저장 시 반영되도록)
        localStorage.setItem('deletedCoursesData', JSON.stringify(deletedCoursesData));
        
        if (changes.length > 0) {
            addChangeHistory('수정(삭제된 과목)', oldCourse.courseName, changes);
        }
        
        // 렌더링 업데이트
        renderCourses();
        renderMatrix();
        renderCurriculumTable();
        if (!isCommonValuesCellEditing) {
            renderCommonValuesTable();
        }
        updateStats();
        closeModal();
        renderChangeHistoryPanel();
        
        showToast('삭제된 교과목이 수정되었습니다. 버전 저장 버튼을 눌러주세요.');
        editingIndex = -1;
        editingDeletedCourseId = null;
        return; // 여기서 함수 종료
    } 
    // 기존 course 객체가 있으면 id 복사
    else if (typeof editingIndex !== 'undefined' && editingIndex !== null && courses[editingIndex] && courses[editingIndex].id) {
        course.id = courses[editingIndex].id;
    } else if (!course.id) {
        course.id = generateUniqueId();
    }
    
    if (editingIndex === -1) {
        courses.push(course);
        // 새 교과목에 대한 매트릭스 데이터 초기화
        matrixData[course.courseName] = new Array(18).fill(0);
        // 추가 이력 기록
        addChangeHistory('추가', course.courseName, Object.keys(course).map(k => ({field: k, before: '', after: course[k]})));
        alert('교과목이 추가되었습니다.');
    } else if (editingIndex >= 0) {
        const oldCourse = courses[editingIndex];
        const oldCourseName = oldCourse.courseName;
        // 변경된 필드만 추출
        const changes = [];
        for (const key of Object.keys(course)) {
            if (course[key] !== oldCourse[key]) {
                changes.push({field: key, before: oldCourse[key], after: course[key]});
            }
        }
        if (changes.length > 0) {
            addChangeHistory('수정', oldCourse.courseName, changes);
        }
        courses[editingIndex] = course;
        // 과목명이 변경된 경우 매트릭스 데이터도 업데이트
        if (oldCourseName !== course.courseName) {
            if (matrixData[oldCourseName]) {
                matrixData[course.courseName] = matrixData[oldCourseName];
                // 이전 과목명의 데이터도 보존 (삭제하지 않음)
                // delete matrixData[oldCourseName];
            } else {
                matrixData[course.courseName] = new Array(18).fill(0);
            }
        }
        alert('교과목이 수정되었습니다.');
        editingIndex = -1;
    }
    resetFilters();
    renderCourses();
    renderMatrix();
    renderCurriculumTable(); // 이수모형표 업데이트 추가
    // 셀 편집 중이 아닐 때만 테이블 렌더링
    if (!isCommonValuesCellEditing) {
    renderCommonValuesTable(); // 공통가치대응표 업데이트 추가
    }
    updateStats();
    closeModal();
    renderChangeHistoryPanel();
    
    // 새로 생성된 교과목 블록에 현재 설정된 글씨 크기 적용
    setTimeout(() => {
        updateCurriculumFontSize();
        
        // 화살표 즉시 업데이트
        const movedCoursesForGhost = getMovedCoursesForGhost();
        drawMoveArrows(movedCoursesForGhost);
    }, 100);
}

// 컬럼 리사이즈 기능 초기화 (최소폭 제한 없이 텍스트에 맞게)
function initColumnResize() {
    const table = document.getElementById('matrixTable');
    if (!table) return;
    // 기존 리사이저 제거
    const existingResizers = table.querySelectorAll('.column-resizer');
    existingResizers.forEach(r => r.remove());
    const resizableHeaders = table.querySelectorAll('th.resizable');
    resizableHeaders.forEach((th, index) => {
        const resizer = document.createElement('div');
        resizer.className = 'column-resizer';
        th.appendChild(resizer);
        let startX = 0;
        let startWidth = 0;
        let currentTh = th;
        let isResizing = false;
        resizer.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            startX = e.pageX;
            startWidth = currentTh.offsetWidth;
            isResizing = true;
            document.body.classList.add('resizing');
            resizer.classList.add('active');
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        function handleMouseMove(e) {
            if (!isResizing) return;
            const diff = e.pageX - startX;
            const newWidth = Math.max(10, startWidth + diff); // 최소 10px
            // 해당 컬럼의 모든 셀 너비 조정
            const colIndex = Array.from(currentTh.parentNode.children).indexOf(currentTh);
            const allCells = table.querySelectorAll(`tbody tr td:nth-child(${colIndex + 1})`);
            allCells.forEach(cell => {
                cell.style.width = newWidth + 'px';
                cell.style.minWidth = 'unset';
                cell.style.maxWidth = 'unset';
            });
            currentTh.style.width = newWidth + 'px';
            currentTh.style.minWidth = 'unset';
            currentTh.style.maxWidth = 'unset';
        }
        function handleMouseUp() {
            isResizing = false;
            document.body.classList.remove('resizing');
            resizer.classList.remove('active');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    });
}

// 교과목 관리 테이블 컬럼 리사이즈 기능 초기화
function initCoursesTableResize() {
    const table = document.getElementById('coursesTable');
    if (!table) return;
    
    // 기존 리사이저 제거
    const existingResizers = table.querySelectorAll('.column-resizer');
    existingResizers.forEach(r => r.remove());
    
    const resizableHeaders = table.querySelectorAll('th.resizable');
    resizableHeaders.forEach((th, index) => {
        const resizer = document.createElement('div');
        resizer.className = 'column-resizer';
        th.appendChild(resizer);
        
        let startX = 0;
        let startWidth = 0;
        let currentTh = th;
        let isResizing = false;
        
        resizer.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            startX = e.pageX;
            startWidth = currentTh.offsetWidth;
            isResizing = true;
            document.body.classList.add('resizing');
            resizer.classList.add('active');
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
        
        function handleMouseMove(e) {
            if (!isResizing) return;
            const diff = e.pageX - startX;
            const newWidth = Math.max(50, startWidth + diff); // 최소 50px
            
            // 해당 컬럼의 모든 셀 너비 조정
            const colIndex = Array.from(currentTh.parentNode.children).indexOf(currentTh);
            const allCells = table.querySelectorAll(`tbody tr td:nth-child(${colIndex + 1})`);
            allCells.forEach(cell => {
                cell.style.width = newWidth + 'px';
                cell.style.minWidth = 'unset';
                cell.style.maxWidth = 'unset';
            });
            currentTh.style.width = newWidth + 'px';
            currentTh.style.minWidth = 'unset';
            currentTh.style.maxWidth = 'unset';
        }
        
        function handleMouseUp() {
            isResizing = false;
            document.body.classList.remove('resizing');
            resizer.classList.remove('active');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    });
}

// 모달 외부 클릭 시 닫기 - 외부 클릭 시 아무 반응 없음
window.onclick = function(event) {
    const modal = document.getElementById('courseModal');
    if (event.target === modal) {
        // 외부 클릭 시 아무 작업도 하지 않음
        // 모달을 닫지 않고 유지
        return;
    }
}

// 페이지 로드 시 초기화
window.onload = function() {
    console.log('페이지 로드 시작');
    
    // init() 함수를 먼저 호출하여 데이터 로드
    init();
    
    // 🛡️ 전역 vis-network 오류 방지 시스템 활성화
    if (typeof window.setupGlobalVisNetworkErrorPrevention === 'function') {
        window.setupGlobalVisNetworkErrorPrevention();
    }
    
    // 디버깅용 함수 - 삭제된 과목 데이터 확인
    window.checkDeletedCourses = function() {
        return deletedCoursesData;
    };
    
    // 디버깅용 함수 - 초기 매트릭스 데이터 확인
    window.checkInitialMatrixData = function() {
        console.log('initialMatrixData:', initialMatrixData);
        console.log('currentMatrixData:', matrixData);
        return initialMatrixData;
    };
    
    // 삭제된 과목의 매트릭스 셀 테스트
    window.testDeletedCourseClick = function() {
        const deletedCells = document.querySelectorAll('td[data-is-deleted="true"]');
        if (deletedCells.length > 0 && deletedCells[0].onclick) {
            deletedCells[0].onclick();
        }
    };
    
    // 삭제된 과목 데이터 복구
    window.fixDeletedCourses = function() {
        const diffSummary = getCurrentDiffSummary();
        const deletedCourses = diffSummary.filter(entry => entry.type === '삭제');
        
        deletedCourses.forEach(entry => {
            const course = entry.course;
            if (course && course.id) {
                if (!deletedCoursesData[course.id]) {
                    deletedCoursesData[course.id] = JSON.parse(JSON.stringify(course));
                }
                
                // matrixValues 확인 및 초기화
                if (!deletedCoursesData[course.id].matrixValues) {
                    if (matrixData[course.courseName]) {
                        deletedCoursesData[course.id].matrixValues = [...matrixData[course.courseName]];
                    } else {
                        deletedCoursesData[course.id].matrixValues = new Array(18).fill(0);
                    }
                }
            }
        });
        
        // localStorage에 저장
        localStorage.setItem('deletedCoursesData', JSON.stringify(deletedCoursesData));
        
        // 매트릭스 다시 렌더링
        renderMatrix();
        
        return deletedCoursesData;
    };
    
    // 교과목 추가/수정 폼 이벤트 리스너
    const courseForm = document.getElementById('courseForm');
    if (courseForm) {
        courseForm.addEventListener('submit', handleCourseSubmit);
    }
    
    // 키보드 이벤트 리스너 추가
    document.addEventListener('keydown', handleMatrixKeyboardEdit);
    
    // 탭 버튼 이벤트 리스너 - onclick과 중복되지 않도록 제거
    // (HTML에 이미 onclick이 있으므로 추가 리스너 불필요)
    
    // 필터 이벤트 리스너 - null 체크 추가
    const yearFilter = document.getElementById('yearFilter');
    if (yearFilter) yearFilter.addEventListener('change', filterCourses);
    
    const semesterFilter = document.getElementById('semesterFilter');
    if (semesterFilter) semesterFilter.addEventListener('change', filterCourses);
    
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) categoryFilter.addEventListener('change', filterCourses);
    
    const subjectTypeFilter = document.getElementById('subjectTypeFilter');
    if (subjectTypeFilter) subjectTypeFilter.addEventListener('change', filterCourses);
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('keyup', filterCourses);
    
    // 색상 범례 초기화 (페이지 로드 시)
    setTimeout(() => {
        if (typeof updateColorLegendCurriculum === 'function') {
            updateColorLegendCurriculum();
        }
        if (typeof updateColorLegendCommonValues === 'function') {
            updateColorLegendCommonValues();
        }
    }, 100);
    
    // 변경상태 필터 초기화 (모두 체크된 상태로 시작)
    const showAdded = document.getElementById('showAdded');
    if (showAdded) showAdded.checked = true;
    
    const showModified = document.getElementById('showModified');
    if (showModified) showModified.checked = true;
    
    const showDeleted = document.getElementById('showDeleted');
    if (showDeleted) showDeleted.checked = true;
    
    const showUnchanged = document.getElementById('showUnchanged');
    if (showUnchanged) showUnchanged.checked = true;
    initColumnResize();
    updateFontSize(); // 폰트 사이즈 초기화
    // 매트릭스 탭을 기본으로 표시
    showTab('matrix');
    
    // 화살표 스타일 설정 복원
    const arrowSelector = document.getElementById('arrowStyleSelector');
    if (arrowSelector) {
        arrowSelector.value = arrowStyle;
    }
    // 창 크기 변경 시 매트릭스 컬럼 폭 재조정
    window.addEventListener('resize', function() {
        if (document.getElementById('matrix').classList.contains('active')) {
            setTimeout(() => {
                initColumnResize();
            }, 100);
        }
    });
    // 최초 로딩 시 버전 버튼 숨김
    const verBtn1 = document.querySelector('button[onclick="showMatrixVersionSaveModal()"]');
    const verBtn2 = document.querySelector('button[onclick="showMatrixVersionManager()"]');
    if (verBtn1) verBtn1.style.display = 'none';
    if (verBtn2) verBtn2.style.display = 'none';
    // 최초 로딩 시 제목 불러오기
    const title = document.getElementById('matrixTitle');
    if (title) {
        // 제목은 버전 데이터에서 가져옴
        const versionTitle = versions[currentVersion]?.matrixTab?.matrixTitleText;
        if (versionTitle) title.textContent = versionTitle;
        // 초기 로드 시에는 편집 불가능 상태로만 설정 (이벤트 리스너 등록하지 않음)
        title.contentEditable = false;
    }
};
// 매트릭스에서 교과목 수정
function editCourseFromMatrix(course, isDeleted = false) {
    // 삭제된 과목인 경우 deletedCoursesData에서 찾기
    if (isDeleted) {
        // 삭제된 과목은 editingIndex를 -1로 설정하고 별도 플래그 사용
        editingIndex = -999; // 특수값으로 삭제된 과목 편집임을 표시
        editingDeletedCourseId = course.id;
    } else {
        // id 기준으로 editingIndex 찾기 (교과목명 변경에도 id 유지)
        editingIndex = courses.findIndex(c => c.id === course.id);
        editingDeletedCourseId = null;
    }
    const form = document.getElementById('courseForm');
    // 학년-학기 분리
    const parts = course.yearSemester.split('-');
    const year = parts[0];
    let semester = parts[1] || '';
    
    // "1/2" 또는 "1,2" 형식 처리
    if (semester === '1/2' || semester === '1,2') {
        semester = '구분없음';
    }
    
    form.year.value = year;
    form.semester.value = semester;
    form.courseNumber.value = course.courseNumber;
    form.courseName.value = course.courseName;
    form.credits.value = course.credits;
    form.category.value = course.category;
    form.subjectType.value = course.subjectType;
    form.isRequired.value = course.isRequired;
    form.professor.value = course.professor || '';
    form.description.value = course.description || '';
    // 수행평가기준 리스트 표시 (editCourse와 동일하게)
    const matrixValues = matrixData[course.courseName] || new Array(18).fill(0);
    const criteriaNames = [
        '건축과 예술 및 과학기술', '세계 건축의 역사와 문화', '한국 건축과 전통', '건축과 사회',
        '형태 및 공간구성', '대지와 외부공간 계획', '안전 설계', '건축재료와 구성방법',
        '건물시스템 통합설계', '건축과 도시설계', '연구기반 종합설계', '구조원리',
        '구조시스템', '환경조절 시스템', '건축설비 시스템', '시공 및 건설관리',
        '프로젝트수행과 건축사무소운영', '건축사법과 건축법 및 관계법령'
    ];
    let listHtml = '<ul style="margin:0; padding-left:18px;">';
    let hasAny = false;
    matrixValues.forEach((value, idx) => {
        if (value > 0) {
            hasAny = true;
            if (value === 1) {
                listHtml += `<li><b>${idx+1}. ${criteriaNames[idx]}</b></li>`;
            } else {
                listHtml += `<li><span class='criteria-partial'>${idx+1}. ${criteriaNames[idx]}</span></li>`;
            }
        }
    });
    if (!hasAny) listHtml += '<li style="color:#bbb;">없음</li>';
    listHtml += '</ul>';
    const criteriaDiv = document.getElementById('coursePerformanceCriteria');
    if (criteriaDiv) criteriaDiv.innerHTML = listHtml;
    document.querySelector('.modal-header h2').textContent = '교과목 수정';
    showModal();
}

// 전체 화면 토글
function toggleFullscreen() {
    const matrixContent = document.getElementById('matrix');
    const fullscreenText = document.getElementById('fullscreen-text');
    
    if (matrixContent.classList.contains('fullscreen-active')) {
        matrixContent.classList.remove('fullscreen-active');
        fullscreenText.textContent = '전체 화면';
    } else {
        matrixContent.classList.add('fullscreen-active');
        fullscreenText.textContent = '화면 축소';
    }
}

// Excel 내보내기 (실제 엑셀 파일로 내보내기, 표 구조 보존)

// 폰트 사이즈 조정 기능
let currentFontSize = 14;

function increaseFontSize() {
    if (currentFontSize < 20) {
        currentFontSize += 1;
        updateFontSize();
    }
}

function decreaseFontSize() {
    if (currentFontSize > 10) {
        currentFontSize -= 1;
        updateFontSize();
    }
}

function updateFontSize() {
    const matrixTable = document.getElementById('matrixTable');
    const extraTable = document.querySelector('.matrix-extra-table');
    const fontDisplay = document.getElementById('font-size-display');
    
    if (matrixTable) {
        matrixTable.style.fontSize = currentFontSize + 'px';
        // 헤더와 셀의 폰트 사이즈도 업데이트
        const headers = matrixTable.querySelectorAll('th');
        const cells = matrixTable.querySelectorAll('td');
        headers.forEach(header => {
            header.style.fontSize = currentFontSize + 'px';
        });
        cells.forEach(cell => {
            cell.style.fontSize = currentFontSize + 'px';
        });
    }
    // extra matrix table에도 동일하게 적용
    if (extraTable) {
        extraTable.style.fontSize = currentFontSize + 'px';
        const headers = extraTable.querySelectorAll('th');
        const cells = extraTable.querySelectorAll('td');
        headers.forEach(header => {
            header.style.fontSize = currentFontSize + 'px';
        });
        cells.forEach(cell => {
            cell.style.fontSize = currentFontSize + 'px';
        });
    }
    if (fontDisplay) {
        fontDisplay.textContent = currentFontSize + 'px';
    }
}

// ============================================================================
// PDF Export Utility Functions - 재사용 가능한 유틸리티 함수
// ============================================================================

/**
 * PDF 내보내기 설정 객체
 */
const PDFExportConfig = {
    quality: {
        scale: 3,           // 해상도 높임 (1-4) - 3으로 증가
        imageFormat: 'png', // png 또는 jpeg
        compression: 'SLOW' // FAST, SLOW, MEDIUM, NONE - 최고 품질
    },
    page: {
        format: 'a3',       // A3로 변경하여 적절한 크기
        orientation: 'landscape', // landscape, portrait
        margin: 15          // 페이지 여백 (mm) - 증가
    },
    ui: {
        showProgress: true, // 진행률 표시 여부
        autoClose: true,    // 완료 후 자동 닫기
        closeDelay: 800     // 자동 닫기 지연 시간 (ms) - 증가
    },
    font: {
        korean: true,       // 한글 폰트 지원
        family: 'Malgun Gothic, Noto Sans KR, sans-serif', // 한글 폰트
        size: {
            title: 16,      // 제목 크기
            header: 9,      // 헤더 크기
            body: 8,        // 본문 크기
            small: 7        // 작은 텍스트
        }
    },
    table: {
        autoWidth: true,    // 자동 너비 조정
        wrapText: true,     // 텍스트 자동 줄바꿈
        headerColor: [44, 62, 80],    // 헤더 배경색
        alternateRow: [248, 249, 250], // 교대로 나타나는 행 색상
        borderColor: [189, 195, 199]   // 테두리 색상
    }
};

/**
 * PDF 생성을 위한 로딩 UI 표시
 * @param {string} title - 탭 제목
 * @param {string} subtitle - 부제목
 * @returns {Object} 로딩 UI 요소와 메서드
 */
function createPDFLoadingUI(title, subtitle) {
    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'pdfExportMsg';
    loadingMsg.className = 'pdf-export-modal';
    loadingMsg.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #333 0%, #222 100%);
        color: white;
        padding: 25px;
        border-radius: 12px;
        z-index: 10000;
        text-align: center;
        min-width: 320px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    loadingMsg.innerHTML = `
        <div style="font-size:18px;margin-bottom:8px;font-weight:600">${title}</div>
        <div style="font-size:13px;opacity:0.9;margin-bottom:20px">${subtitle}</div>
        <div style="margin-top:15px">
            <div style="background:rgba(255,255,255,0.1);height:6px;border-radius:3px;overflow:hidden">
                <div id="pdfProgress" style="background:linear-gradient(90deg, #4CAF50, #45a049);height:100%;width:0%;transition:width 0.3s ease"></div>
            </div>
            <div id="pdfProgressText" style="margin-top:8px;font-size:12px;opacity:0.8">0%</div>
        </div>
        <div id="pdfErrorMsg" style="color:#ff6b6b;margin-top:10px;font-size:12px;display:none"></div>
    `;
    
    document.body.appendChild(loadingMsg);
    
    return {
        element: loadingMsg,
        updateProgress: (percent, text = null) => {
            const progressBar = document.getElementById('pdfProgress');
            const progressText = document.getElementById('pdfProgressText');
            if (progressBar) {
                progressBar.style.width = Math.min(percent, 100) + '%';
            }
            if (progressText) {
                progressText.textContent = text || `${Math.round(percent)}%`;
            }
        },
        showError: (message) => {
            const errorMsg = document.getElementById('pdfErrorMsg');
            if (errorMsg) {
                errorMsg.textContent = message;
                errorMsg.style.display = 'block';
            }
        },
        close: (delay = PDFExportConfig.ui.closeDelay) => {
            setTimeout(() => {
                if (loadingMsg && loadingMsg.parentNode) {
                    loadingMsg.style.opacity = '0';
                    loadingMsg.style.transition = 'opacity 0.3s';
                    setTimeout(() => loadingMsg.remove(), 300);
                }
            }, delay);
        }
    };
}

/**
 * HTML2Canvas 라이브러리 로드 보장
 * @returns {Promise<boolean>}
 */
function ensureHTML2Canvas() {
    return new Promise((resolve, reject) => {
        if (typeof html2canvas !== 'undefined') {
            resolve(true);
            return;
        }
        
        console.log('🔄 HTML2Canvas 동적 로드 시작...');
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = () => {
            console.log('✅ HTML2Canvas 로드 성공');
            resolve(true);
        };
        script.onerror = () => {
            reject(new Error('HTML2Canvas 라이브러리를 로드할 수 없습니다.'));
        };
        document.head.appendChild(script);
    });
}

/**
 * jsPDF 라이브러리 정규화 및 확인
 * @returns {boolean}
 */
function ensureJsPDF() {
    if (!window.jsPDF) {
        if (window.jspdf && window.jspdf.jsPDF) {
            window.jsPDF = window.jspdf.jsPDF;
        } else if (typeof jspdf !== 'undefined' && jspdf.jsPDF) {
            window.jsPDF = jspdf.jsPDF;
        }
    }
    return window.jsPDF !== undefined;
}

/**
 * HTML 요소를 PDF로 변환하는 공통 함수
 * @param {HTMLElement} element - 변환할 HTML 요소
 * @param {string} title - PDF 제목
 * @param {string} filename - 저장할 파일명
 * @param {Object} options - 추가 옵션
 * @returns {Promise<void>}
 */
async function convertElementToPDF(element, title, filename, options = {}) {
    const config = { ...PDFExportConfig, ...options };
    const loadingUI = config.ui.showProgress ? 
        createPDFLoadingUI('PDF 생성 중...', title) : null;
    
    try {
        // 1. 라이브러리 확인
        loadingUI?.updateProgress(10, '라이브러리 확인 중...');
        await ensureHTML2Canvas();
        
        if (!ensureJsPDF()) {
            throw new Error('jsPDF 라이브러리를 사용할 수 없습니다.');
        }
        
        // 2. 컨테이너 생성 (원본 비율 유지)
        loadingUI?.updateProgress(20, '컨텐츠 준비 중...');
        const container = document.createElement('div');
        
        // 원본 요소의 실제 크기와 비율 가져오기
        const originalRect = element.getBoundingClientRect();
        const originalWidth = originalRect.width;
        const originalHeight = originalRect.height;
        const aspectRatio = originalWidth / originalHeight;
        
        // 원본과 동일한 크기로 컨테이너 생성 (비율 정확히 유지)
        container.style.cssText = `
            background: #ffffff;
            padding: 20px;
            position: absolute;
            left: -9999px;
            width: ${originalWidth}px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // 제목 추가
        if (title) {
            const titleDiv = document.createElement('div');
            titleDiv.innerHTML = `<h1 style="text-align:center;margin:0 0 20px 0;font-size:28px;color:#000;font-weight:600">${title}</h1>`;
            container.appendChild(titleDiv);
        }
        
        // 요소 복사 (원본 비율과 스타일 유지)
        const elementClone = element.cloneNode(true);
        elementClone.style.width = '100%';
        elementClone.style.height = 'auto';
        
        // 원본의 계산된 스타일 복사
        const originalStyles = window.getComputedStyle(element);
        elementClone.style.fontFamily = originalStyles.fontFamily;
        elementClone.style.fontSize = originalStyles.fontSize;
        
        // 테이블인 경우 원본 레이아웃 유지
        if (elementClone.tagName === 'TABLE') {
            elementClone.style.tableLayout = originalStyles.tableLayout || 'auto';
        }
        
        container.appendChild(elementClone);
        document.body.appendChild(container);
        
        // 3. HTML2Canvas로 렌더링
        loadingUI?.updateProgress(40, '이미지 생성 중...');
        const canvas = await html2canvas(container, {
            scale: config.quality.scale,
            logging: false,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: container.scrollWidth,
            height: container.scrollHeight,
            windowWidth: container.scrollWidth,
            windowHeight: container.scrollHeight,
            onclone: (clonedDoc) => {
                // 클론된 문서에서 테이블 스타일 조정
                const tables = clonedDoc.querySelectorAll('table');
                tables.forEach(table => {
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                    // 테이블 레이아웃 자동으로 컬럼 폭 최적화
                    table.style.tableLayout = 'auto';
                });
                
                // 셀 스타일 - 개선된 디자인
                const cells = clonedDoc.querySelectorAll('td, th');
                cells.forEach(cell => {
                    if (!cell.style.border) {
                        cell.style.border = '1px solid #ddd';
                    }
                    // 셀 패딩 및 스타일 개선
                    cell.style.padding = '10px';
                    cell.style.height = 'auto';
                    cell.style.verticalAlign = 'middle';
                    cell.style.fontSize = '14px';
                    cell.style.lineHeight = '1.6';
                    
                    // 헤더 셀 강조
                    if (cell.tagName === 'TH') {
                        cell.style.backgroundColor = '#f8f9fa';
                        cell.style.fontWeight = 'bold';
                        cell.style.fontSize = '15px';
                    }
                });
                
                // 교과목 블록 - PDF에 최적화된 스타일
                const courseBlocks = clonedDoc.querySelectorAll('.course-block');
                courseBlocks.forEach(block => {
                    // PDF에서 컬럼 폭에 맞춤
                    block.style.display = 'flex';
                    block.style.flexDirection = 'column';
                    block.style.justifyContent = 'center';
                    block.style.alignItems = 'center';
                    block.style.width = '100%';
                    block.style.minWidth = '100px';
                    block.style.maxWidth = 'none';  // PDF에서는 최대 폭 제한 없음
                    block.style.padding = '4px 8px';
                    block.style.margin = '2px';
                });
                
                // 교과목 블록 제목 - 중앙 정렬
                const blockTitles = clonedDoc.querySelectorAll('.course-block-title');
                blockTitles.forEach(title => {
                    title.style.textAlign = 'center';
                    title.style.width = '100%';
                    title.style.display = 'block';
                });
                
                // 교과목 블록 정보 - 중앙 정렬
                const blockInfos = clonedDoc.querySelectorAll('.course-block-info');
                blockInfos.forEach(info => {
                    info.style.textAlign = 'center';
                    info.style.width = '100%';
                    info.style.display = 'flex';
                    info.style.justifyContent = 'center';
                    info.style.alignItems = 'center';
                });
            }
        });
        
        // 컨테이너 제거
        document.body.removeChild(container);
        
        // 4. PDF 생성
        loadingUI?.updateProgress(60, 'PDF 문서 생성 중...');
        const { jsPDF } = window;
        const imgData = canvas.toDataURL(`image/${config.quality.imageFormat}`);
        
        const doc = new jsPDF(
            config.page.orientation,
            'mm',
            config.page.format
        );
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = config.page.margin;
        
        // 단일 페이지에 맞게 이미지 크기 조정
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - (margin * 2);
        
        // 캔버스의 실제 비율
        const canvasRatio = canvas.width / canvas.height;
        // 페이지의 비율
        const pageRatio = availableWidth / availableHeight;
        
        let imgWidth, imgHeight;
        
        if (canvasRatio > pageRatio) {
            // 이미지가 페이지보다 더 넓음 - 너비에 맞춤
            imgWidth = availableWidth;
            imgHeight = imgWidth / canvasRatio;
        } else {
            // 이미지가 페이지보다 더 높음 - 높이에 맞춤
            imgHeight = availableHeight;
            imgWidth = imgHeight * canvasRatio;
        }
        
        // 중앙 정렬을 위한 위치 계산
        const xPosition = margin + (availableWidth - imgWidth) / 2;
        const yPosition = margin + (availableHeight - imgHeight) / 2;
        
        // 5. 단일 페이지에 이미지 추가
        loadingUI?.updateProgress(80, '페이지 생성 중...');
        doc.addImage(
            imgData,
            config.quality.imageFormat.toUpperCase(),
            xPosition,
            yPosition,
            imgWidth,
            imgHeight,
            undefined,
            config.quality.compression
        );
        
        const pageNumber = 1;
        
        // 6. 메타데이터 설정
        doc.setProperties({
            title: title || 'UOSARCH Export',
            subject: options.subject || 'UOSARCH Document',
            author: 'UOSARCH 교과목 관리 시스템',
            keywords: options.keywords || 'UOSARCH, PDF',
            creator: 'UOSARCH System v2.0'
        });
        
        // 7. 파일 저장
        loadingUI?.updateProgress(95, '파일 저장 중...');
        doc.save(filename);
        
        // 성공 메시지
        showToast('PDF 내보내기가 완료되었습니다. (이미지 방식)', 'success');
        
        // 8. 완료
        loadingUI?.updateProgress(100, '완료!');
        if (config.ui.autoClose) {
            loadingUI?.close();
        }
        
        return { success: true, pageCount: pageNumber };
        
    } catch (error) {
        console.error('PDF 생성 오류:', error);
        loadingUI?.showError(error.message);
        loadingUI?.close(3000);
        throw error;
    }
}

/**
 * 현재 날짜/시간 기반 파일명 생성
 * @param {string} prefix - 파일명 접두사
 * @returns {string}
 */
function generatePDFFilename(prefix) {
    const now = new Date();
    const dateStr = now.getFullYear() + 
                   String(now.getMonth() + 1).padStart(2, '0') + 
                   String(now.getDate()).padStart(2, '0') + '_' +
                   String(now.getHours()).padStart(2, '0') +
                   String(now.getMinutes()).padStart(2, '0');
    return `${prefix}_${dateStr}.pdf`;
}

// ============================================================================
// PDF Export Main Functions - 각 탭의 PDF 내보내기 함수
// ============================================================================

/**
 * PDF 드롭다운 토글 함수
 */




/**
 * HTML 테이블을 SVG로 변환
 * @param {HTMLTableElement} table - 변환할 테이블 엘리먼트
 * @returns {string} SVG 문자열
 */
function tableToSVG(table) {
    if (!table) return '';
    
    // 테이블 크기 계산
    const rows = table.querySelectorAll('tr');
    const cols = rows[0] ? rows[0].querySelectorAll('th, td').length : 0;
    const cellWidth = 80;
    const cellHeight = 30;
    const padding = 5;
    const fontSize = 12;
    
    // SVG 크기 설정
    const svgWidth = cols * cellWidth + 100;
    const svgHeight = rows.length * cellHeight + 150;
    
    // SVG 시작
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
`;
    svg += `<defs>
`;
    svg += `  <style>
`;
    svg += `    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
`;
    svg += `    text { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; }
`;
    svg += `    .header-text { font-weight: bold; fill: white; }
`;
    svg += `    .cell-text { fill: #333; }
`;
    svg += `    .checkmark { font-size: 16px; }
`;
    svg += `  </style>
`;
    svg += `</defs>
`;
    
    // 제목 추가
    const matrixTitle = document.getElementById('matrixTitle');
    const titleText = matrixTitle ? matrixTitle.textContent.trim() : '학생수행평가기준과 교과목 매트릭스 2025';
    
    // 제목 배경
    svg += `<rect x="0" y="0" width="${svgWidth}" height="60" fill="#2c3e50"/>\n`;
    
    // 제목 텍스트
    svg += `<text x="${svgWidth/2}" y="35" text-anchor="middle" font-size="20" font-weight="bold" fill="white">${titleText}</text>\n`;
    
    // 날짜 및 버전 정보
    const dateStr = new Date().toISOString().split('T')[0];
    const versionStr = currentVersion ? `Ver: ${currentVersion}` : '';
    svg += `<text x="${svgWidth - 20}" y="45" text-anchor="end" font-size="12" fill="#dcdcdc">${dateStr} ${versionStr}</text>\n`;
    
    // 테이블 그리기 시작 위치
    let startX = 50;
    let startY = 80;
    let currentY = startY;
    
    // 헤더 그리기
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    // 헤더 그리기
    if (thead) {
        const headerRows = thead.querySelectorAll('tr');
        
        headerRows.forEach((row, rowIndex) => {
            let currentX = startX;
            const cells = row.querySelectorAll('th');
            
            cells.forEach((cell, cellIndex) => {
                const text = cell.textContent.trim();
                const colspan = parseInt(cell.getAttribute('colspan') || 1);
                const rowspan = parseInt(cell.getAttribute('rowspan') || 1);
                const width = cellWidth * colspan;
                const height = cellHeight * rowspan;
                
                // 헤더 셀 배경
                svg += `<rect x="${currentX}" y="${currentY}" width="${width}" height="${height}" fill="#34495e" stroke="#2c3e50" stroke-width="1"/>\n`;
                
                // 헤더 텍스트
                const textX = currentX + width / 2;
                const textY = currentY + height / 2 + 4;
                svg += `<text x="${textX}" y="${textY}" text-anchor="middle" class="header-text" font-size="${fontSize}">${text}</text>\n`;
                
                currentX += width;
            });
            
            currentY += cellHeight;
        });
    }
    
    // 바디 그리기
    if (tbody) {
        const bodyRows = tbody.querySelectorAll('tr');
        bodyRows.forEach((row, rowIndex) => {
            let currentX = startX;
            const cells = row.querySelectorAll('td, th');
            const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8f9fa';
            
            cells.forEach((cell, cellIndex) => {
                const text = cell.textContent.trim();
                const isHeader = cell.tagName === 'TH';
                const isCheckmark = text === '○' || text === '●' || text === '◎';
                
                // 셀 배경
                const fillColor = isHeader ? '#e9ecef' : bgColor;
                svg += `<rect x="${currentX}" y="${currentY}" width="${cellWidth}" height="${cellHeight}" fill="${fillColor}" stroke="#dee2e6" stroke-width="0.5"/>\n`;
                
                // 텍스트 위치와 정렬
                let textAnchor = 'middle';
                let textX = currentX + cellWidth / 2;
                
                // 교과목명 열은 왼쪽 정렬
                if (cellIndex === 2 && !isHeader) {
                    textAnchor = 'start';
                    textX = currentX + padding;
                }
                
                const textY = currentY + cellHeight / 2 + 4;
                const textClass = isHeader ? 'header-text' : 'cell-text';
                const fontWeight = isHeader || cellIndex === 0 ? 'bold' : 'normal';
                const checkmarkClass = isCheckmark ? 'checkmark' : '';
                
                if (text) {
                    svg += `<text x="${textX}" y="${textY}" text-anchor="${textAnchor}" class="${textClass} ${checkmarkClass}" font-size="${fontSize}" font-weight="${fontWeight}">${text}</text>\n`;
                }
                
                currentX += cellWidth;
            });
            
            currentY += cellHeight;
        });
    }
    
    // SVG 닫기
    svg += '</svg>\n';
    
    return svg;
}

// 수동 테이블 그리기 함수 (autoTable 없을 때 사용)
function drawManualTable(doc, headers, tableData, margin, contentWidth, pageHeight) {
    let y = margin + 15;
    const fontSize = 6;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    
    // 헤더 그리기
    if (headers.length > 0) {
        doc.setFont('helvetica', 'bold');
        headers.forEach((headerRow) => {
            let x = margin;
            const cellHeight = 7;
            
            headerRow.forEach((cell) => {
                const cellWidth = contentWidth / headerRow.length;
                
                // 셀 테두리
                doc.setDrawColor(80, 80, 80);
                doc.rect(x, y, cellWidth, cellHeight);
                
                // 셀 텍스트
                doc.text(cell.content || '', x + cellWidth / 2, y + cellHeight / 2 + 2, { align: 'center' });
                x += cellWidth;
            });
            
            y += cellHeight;
        });
    }
    
    // 바디 그리기
    doc.setFont('helvetica', 'normal');
    tableData.forEach((row) => {
        let x = margin;
        const cellHeight = 6;
        
        // 페이지 넘김 체크
        if (y > pageHeight - margin - 10) {
            doc.addPage();
            y = margin;
            
            // 새 페이지에 헤더 다시 그리기
            if (headers.length > 0) {
                doc.setFont('helvetica', 'bold');
                headers.forEach((headerRow) => {
                    let headerX = margin;
                    const headerCellHeight = 7;
                    headerRow.forEach((cell) => {
                        const cellWidth = contentWidth / headerRow.length;
                        doc.setDrawColor(80, 80, 80);
                        doc.rect(headerX, y, cellWidth, headerCellHeight);
                        doc.setFillColor(245, 245, 245);
                        doc.rect(headerX, y, cellWidth, headerCellHeight, 'F');
                        doc.setTextColor(0, 0, 0);
                        const text = cell.content || '';
                        const textWidth = doc.getTextWidth(text);
                        const textX = headerX + (cellWidth - textWidth) / 2;
                        doc.text(text, textX, y + headerCellHeight / 2 + 1, { baseline: 'middle' });
                        headerX += cellWidth;
                    });
                    y += headerCellHeight;
                });
                doc.setFont('helvetica', 'normal');
            }
        }
        
        row.forEach((cell, cellIndex) => {
            const cellWidth = contentWidth / row.length;
            
            // 셀 테두리
            doc.setDrawColor(80, 80, 80);
            doc.rect(x, y, cellWidth, cellHeight);
            
            // 텍스트 추가
            doc.setTextColor(0, 0, 0);
            const cellText = cell.content || '';
            doc.text(cellText, x + 2, y + cellHeight / 2 + 1, { baseline: 'middle' });
            
            x += cellWidth;
        });
        
        y += cellHeight;
    });
}

// 이수모형 제목 편집 가능 여부 설정
function setCurriculumTitleEditable(editable) {
    setTitleEditable('curriculumTitle', editable, handleCurriculumTitleInput, tempCurriculumCellTexts, {}, '건축학전공 교과과정 이수모형');
}

// 이수모형 제목 입력 처리
function handleCurriculumTitleInput() {
    handleTitleInput('curriculumTitle', tempCurriculumCellTexts, '건축학전공 교과과정 이수모형');
}

// 이수모형 셀 편집 활성화
function enableCurriculumCellEditing() {
    // 이수모형 셀 편집 기능 활성화
    const curriculumCells = document.querySelectorAll('#curriculumTable td:not(.no-edit)');
    curriculumCells.forEach(cell => {
        cell.classList.add('editable-cell');
        cell.addEventListener('click', handleCurriculumCellClick);
    });
}

// 이수모형 셀 클릭 처리
function handleCurriculumCellClick(event) {
    if (!isEditModeCurriculum) return;
    
    const cell = event.target;
    if (cell.classList.contains('editing-cell')) return;
    
    startCurriculumCellEdit(cell);
}

// 이수모형 셀 편집 시작
function startCurriculumCellEdit(cell) {
    const originalContent = cell.innerHTML;
    cell.setAttribute('data-original-content', originalContent);
    cell.classList.add('editing-cell');
    
    const input = document.createElement('input');
    input.type = 'text';
    input.value = cell.textContent.trim();
    input.className = 'cell-edit-input';
    
    input.addEventListener('blur', () => saveCurriculumCellEdit(cell));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveCurriculumCellEdit(cell);
        } else if (e.key === 'Escape') {
            cancelCurriculumCellEdit(cell);
        }
    });
    
    cell.innerHTML = '';
    cell.appendChild(input);
    input.focus();
    input.select();
}

// 이수모형 셀 편집 저장
function saveCurriculumCellEdit(cell) {
    const input = cell.querySelector('.cell-edit-input');
    if (!input) return;
    
    const newValue = input.value.trim();
    const originalContent = cell.getAttribute('data-original-content');
    
    if (newValue !== cell.textContent.trim()) {
        // 이수모형 셀 데이터 업데이트
        const row = cell.closest('tr');
        const colIndex = Array.from(cell.parentNode.children).indexOf(cell);
        const rowIndex = Array.from(row.parentNode.children).indexOf(row);
        
        // curriculumCellTexts 업데이트
        const key = `${rowIndex}-${colIndex}`;
        if (newValue) {
            curriculumCellTexts[key] = newValue;
        } else {
            delete curriculumCellTexts[key];
        }
        
        cell.innerHTML = newValue;
        showToast('이수모형 셀이 수정되었습니다.');
    } else {
        cell.innerHTML = originalContent;
    }
    
    cell.classList.remove('editing-cell');
    cell.removeAttribute('data-original-content');
}

// 이수모형 셀 편집 취소
function cancelCurriculumCellEdit(cell) {
    const originalContent = cell.getAttribute('data-original-content');
    if (originalContent !== null) {
        cell.innerHTML = originalContent;
    }
    cell.classList.remove('editing-cell');
    cell.removeAttribute('data-original-content');
}

// 이수모형 셀 편집 비활성화
function disableCurriculumCellEditing() {
    const curriculumCells = document.querySelectorAll('#curriculumTable td.editable-cell');
    curriculumCells.forEach(cell => {
        cell.classList.remove('editable-cell');
        cell.removeEventListener('click', handleCurriculumCellClick);
    });
    
    // 편집 중인 셀들을 원래 상태로 복원
    const editingCells = document.querySelectorAll('#curriculumTable .editing-cell');
    editingCells.forEach(cell => {
        const originalContent = cell.getAttribute('data-original-content');
        if (originalContent !== null) {
            cell.innerHTML = originalContent;
            cell.classList.remove('editing-cell');
            cell.removeAttribute('data-original-content');
        }
    });

    const tableConfig = {
        startY: margin + 25,
        head: headers.length > 0 ? headers : undefined,
        body: tableData,
        styles: {
            font: 'helvetica',
            fontSize: 6,
            cellPadding: 1.5,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            textColor: [0, 0, 0],
            overflow: 'linebreak',
            cellWidth: 'auto',
            minCellHeight: 6,
            halign: 'left',
            valign: 'middle'
        },
        headStyles: {
            fillColor: [44, 62, 80],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 2,
            lineWidth: 0.1
        },
        bodyStyles: {
            fontSize: 6,
            valign: 'middle',
            cellPadding: 1.5,
            lineWidth: 0.05
        },
        alternateRowStyles: {
            fillColor: [248, 248, 248]
        },
        columnStyles: columnStyles,
        theme: 'grid',
        margin: { top: margin, right: margin, bottom: margin, left: margin },
        tableWidth: 'auto',
        showHead: 'everyPage',
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        willDrawCell: function(data) {
            // 셀 그리기 전 스타일 최적화
            if (data.cell.text && data.cell.text.length > 0) {
                let text = data.cell.text[0];
                
                // 긴 텍스트는 자동 줄바꿈 및 폰트 크기 조정
                if (text && text.length > 40) {
                    data.cell.styles.cellWidth = 'wrap';
                    data.cell.styles.fontSize = 5;
                } else if (text && text.length > 25) {
                    data.cell.styles.fontSize = 5.5;
                }
                
                // [Korean Text] 표시가 있는 셀 스타일
                if (text && (text.includes('[K]') || text.includes('[Korean Text]'))) {
                    data.cell.styles.textColor = [80, 80, 80];
                    data.cell.styles.fontStyle = 'italic';
                    // [K] 마커를 더 작게 표시
                    if (text.includes('[K]')) {
                        data.cell.styles.fontSize = Math.max(4, (data.cell.styles.fontSize || 6) - 1);
                    }
                }
                
                // 체크마크 처리 (○, ●, ◎)
                if (text === '○' || text === '●' || text === '◎') {
                    data.cell.styles.fontSize = 8;
                    data.cell.styles.halign = 'center';
                    data.cell.styles.fontStyle = 'normal';
                }
                
                // 숫자만 있는 셀은 중앙 정렬
                if (text && /^\d+(\.\d+)?$/.test(text)) {
                    data.cell.styles.halign = 'center';
                }
            }
        },
        didDrawCell: function(data) {
            // 셀 그린 후 추가 처리
            if (data.column.index === 0 && data.cell.section === 'body') {
                // 번호 컬럼 강조
                doc.setDrawColor(PDFExportConfig.table.borderColor[0], 
                               PDFExportConfig.table.borderColor[1], 
                               PDFExportConfig.table.borderColor[2]);
                doc.setLineWidth(0.2);
                doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
            }
        },
        didDrawPage: function(data) {
            // 페이지 번호 추가
            doc.setFontSize(PDFExportConfig.font.size.small);
            doc.setTextColor(128, 128, 128);
            const pageNumber = doc.getCurrentPageInfo().pageNumber;
            doc.text(`${pageNumber}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        }
    };
    
    // autoTable 플러그인 사용 (텍스트 렌더링)
    if (typeof doc.autoTable === 'function') {
        doc.autoTable(tableConfig);
        
        // 메타데이터 추가
        doc.setProperties({
            title: titleText,
            subject: '수행평가 매트릭스',
            author: 'UOSARCH',
            keywords: '수행평가, 매트릭스, 교과목',
            creator: 'UOSARCH 교과목 관리 시스템'
        });
    } else {
        // autoTable이 없는 경우 수동으로 텍스트 기반 테이블 그리기
        console.warn('autoTable 플러그인이 없습니다. 기본 테이블 렌더링을 사용합니다.');
        drawManualTable(doc, headers, tableData, margin, contentWidth, pageHeight);
    }
    
    // 파일명 생성 (개선된 명명 규칙)
    const filename = generatePDFFilename('수행평가매트릭스_벡터');
    
    // 최종 메타데이터 설정
    doc.setProperties({
        title: processKoreanText(titleText),
        subject: '교과목 수행평가 매트릭스',
        author: 'UOSARCH 교과목 관리 시스템',
        keywords: '수행평가, 매트릭스, 교과목, UOSARCH',
        creator: 'UOSARCH v2025'
    });
    
    // PDF 저장
    doc.save(filename);
    
    // 성공 메시지 표시
    showToast('벡터 PDF 내보내기 완료 - 한글은 [K] 또는 [Korean Text]로 표시됩니다.', 'warning');
    console.log('⚠️ 벡터 PDF 생성 완료 (한글 미지원)');
}

// 수동 테이블 그리기 함수 (autoTable 없을 때 사용)
function drawManualTable(doc, headers, tableData, margin, contentWidth, pageHeight) {
    let y = margin + 15;
    const fontSize = 6;
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    
    // 헤더 그리기
    if (headers.length > 0) {
        doc.setFont('helvetica', 'bold');
        headers.forEach((headerRow) => {
            let x = margin;
            const cellHeight = 7;
            
            headerRow.forEach((cell) => {
                const cellWidth = contentWidth / headerRow.length;
                
                // 셀 테두리
                doc.setDrawColor(80, 80, 80);
                doc.rect(x, y, cellWidth, cellHeight);
                
                // 헤더 배경
                doc.setFillColor(245, 245, 245);
                doc.rect(x, y, cellWidth, cellHeight, 'F');
                
                // 텍스트 추가
                doc.setTextColor(0, 0, 0);
                const text = cell.content || '';
                const textWidth = doc.getTextWidth(text);
                const textX = x + (cellWidth - textWidth) / 2;
                doc.text(text, textX, y + cellHeight / 2 + 1, { baseline: 'middle' });
                
                x += cellWidth;
            });
            y += cellHeight;
        });
    }
    
    // 바디 그리기
    doc.setFont('helvetica', 'normal');
    tableData.forEach((row) => {
        let x = margin;
        const cellHeight = 6;
        
        // 페이지 넘김 체크
        if (y > pageHeight - margin - 10) {
            doc.addPage();
            y = margin;
            
            // 새 페이지에 헤더 다시 그리기
            if (headers.length > 0) {
                doc.setFont('helvetica', 'bold');
                headers.forEach((headerRow) => {
                    let headerX = margin;
                    const headerCellHeight = 7;
                    headerRow.forEach((cell) => {
                        const cellWidth = contentWidth / headerRow.length;
                        doc.setDrawColor(80, 80, 80);
                        doc.rect(headerX, y, cellWidth, headerCellHeight);
                        doc.setFillColor(245, 245, 245);
                        doc.rect(headerX, y, cellWidth, headerCellHeight, 'F');
                        doc.setTextColor(0, 0, 0);
                        const text = cell.content || '';
                        const textWidth = doc.getTextWidth(text);
                        const textX = headerX + (cellWidth - textWidth) / 2;
                        doc.text(text, textX, y + headerCellHeight / 2 + 1, { baseline: 'middle' });
                        headerX += cellWidth;
                    });
                    y += headerCellHeight;
                });
                doc.setFont('helvetica', 'normal');
            }
        }
        
        row.forEach((cell, cellIndex) => {
            const cellWidth = contentWidth / row.length;
            
            // 셀 테두리
            doc.setDrawColor(80, 80, 80);
            doc.rect(x, y, cellWidth, cellHeight);
            
            // 텍스트 추가 (긴 텍스트 처리)
            doc.setTextColor(0, 0, 0);
            let cellText = cell.content || '';
            
            // 텍스트가 셀 너비를 초과하는 경우 줄바꿈
            const maxWidth = cellWidth - 2;
            const lines = doc.splitTextToSize(cellText, maxWidth);
            
            if (lines.length === 1) {
                // 한 줄인 경우
                const textY = y + cellHeight / 2 + 1;
                if (cellIndex === 0 || cell.styles?.halign === 'center') {
                    const textWidth = doc.getTextWidth(lines[0]);
                    const textX = x + (cellWidth - textWidth) / 2;
                    doc.text(lines[0], textX, textY, { baseline: 'middle' });
                } else {
                    doc.text(lines[0], x + 1, textY, { baseline: 'middle' });
                }
            } else {
                // 여러 줄인 경우
                let lineY = y + 2;
                const lineHeight = (cellHeight - 2) / Math.min(lines.length, 3);
                lines.slice(0, 3).forEach((line, i) => {
                    if (i === 2 && lines.length > 3) {
                        line = line.substring(0, line.length - 3) + '...';
                    }
                    doc.text(line, x + 1, lineY);
                    lineY += lineHeight;
                });
            }
            
            x += cellWidth;
        });
        
        y += cellHeight;
    });
}

// 이수모형 제목 편집 가능 여부 설정
function setCurriculumTitleEditable(editable) {
    setTitleEditable('curriculumTitle', editable, handleCurriculumTitleInput, tempCurriculumCellTexts, {}, '건축학전공 교과과정 이수모형');
}

// 이수모형 제목 입력 처리
function handleCurriculumTitleInput() {
    handleTitleInput('curriculumTitle', tempCurriculumCellTexts, '건축학전공 교과과정 이수모형');
}

// 이수모형 셀 편집 활성화
function enableCurriculumCellEditing() {
    const curriculumTable = document.querySelector('.curriculum-table');
    if (!curriculumTable) return;
    
    const cells = curriculumTable.querySelectorAll('td');
    cells.forEach(cell => {
        // 교과목 블록이 있는 셀은 편집 불가
        if (cell.querySelector('.course-block')) {
            return;
        }
        
        cell.classList.add('editable-cell');
        cell.addEventListener('click', handleCurriculumCellClick);
    });
}

// 이수모형 셀 편집 비활성화
function disableCurriculumCellEditing() {
    const curriculumTable = document.querySelector('.curriculum-table');
    if (!curriculumTable) return;
    
    const cells = curriculumTable.querySelectorAll('td');
    cells.forEach(cell => {
        cell.classList.remove('editable-cell');
        cell.removeEventListener('click', handleCurriculumCellClick);
        
        // 편집 중인 셀이 있다면 편집 취소
        if (cell.querySelector('input')) {
            cancelCurriculumCellEdit(cell);
        }
    });
}

// 이수모형 셀 클릭 처리
function handleCurriculumCellClick(event) {
    const cell = event.target;
    if (cell.classList.contains('editable-cell') && !cell.querySelector('input')) {
        startCurriculumCellEdit(cell);
    }
}

// 이수모형 셀 편집 시작
function startCurriculumCellEdit(cell) {
    const originalContent = cell.textContent;
    cell.setAttribute('data-original-content', originalContent);
    cell.classList.add('editing-cell');
    
    // textarea 생성 (셀 전체 영역 사용)
    const textarea = document.createElement('textarea');
    textarea.value = originalContent;
    textarea.className = 'cell-edit-textarea';
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.minHeight = '100%';
    textarea.style.maxHeight = '300px';
    textarea.style.boxSizing = 'border-box';
    textarea.style.overflow = 'auto';
    textarea.style.padding = '4px';
    textarea.style.margin = '0';
    textarea.style.borderRadius = '4px';
    textarea.style.border = '1.5px solid #bdbdbd';
    textarea.style.background = '#bdbdbd';
    textarea.style.fontSize = 'inherit';
    textarea.style.fontFamily = 'inherit';
    textarea.style.resize = 'none';
    textarea.style.outline = 'none';
    textarea.style.position = 'absolute';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.right = '0';
    textarea.style.bottom = '0';
    
    // autosize
    function autosize(el) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    }
    textarea.addEventListener('input', function() { autosize(textarea); });
    setTimeout(function() { autosize(textarea); }, 0);
    
    // 이벤트
    textarea.addEventListener('blur', () => saveCurriculumCellEdit(cell, textarea.value, originalContent));
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelCurriculumCellEdit(cell, originalContent);
        }
        // Enter는 줄바꿈만, 저장은 blur로
    });
    
    cell.innerHTML = '';
    cell.appendChild(textarea);
    textarea.focus();
    textarea.select();
}

function saveCurriculumCellEdit(cell, newValue, originalContent) {
    if (newValue !== originalContent) {
        // 줄바꿈 <br>로 변환
        cell.innerHTML = newValue.replace(/\r\n|\r|\n/g, '<br>');
        
        // 임시 저장소에 저장
        tempCurriculumCellTexts[cell.id] = newValue.replace(/\r\n|\r|\n/g, '\n');
        
        // 실제 데이터에도 반영 (임시 데이터는 버전 저장 시 사용)
        curriculumCellTexts[cell.id] = newValue.replace(/\r\n|\r|\n/g, '\n');
        
        showToast('변경사항이 임시 저장되었습니다. 버전 저장 버튼을 눌러주세요.');
    } else {
        cell.innerHTML = originalContent;
    }
    cell.classList.remove('editing-cell');
    cell.removeAttribute('data-original-content');
}

// 이수모형 셀 편집 취소
function cancelCurriculumCellEdit(cell, originalContent) {
    cell.textContent = originalContent;
}

// 이수모형 버전 라벨 업데이트 - 제거됨 (updateAllVersionLabels로 통합)

// 수행평가 기준 텍스트 생성
function getPerformanceCriteria(matrixValues) {
    const criteriaNames = [
        '건축과 예술 및 과학기술', '세계 건축의 역사와 문화', '한국 건축과 전통', '건축과 사회',
        '형태 및 공간구성', '대지와 외부공간 계획', '안전 설계', '건축재료와 구성방법',
        '건물시스템 통합설계', '건축과 도시설계', '연구기반 종합설계', '구조원리',
        '구조시스템', '환경조절 시스템', '건축설비 시스템', '시공 및 건설관리',
        '프로젝트수행과 건축사무소운영', '건축사법과 건축법 및 관계법령'
    ];
    
    const activeCriteria = [];
    matrixValues.forEach((value, index) => {
        if (value > 0) {
            const criteriaName = criteriaNames[index];
            // plain text로만 추가
            activeCriteria.push(`${index + 1}.${criteriaName}`);
        }
    });
    
    const shortText = activeCriteria.length > 0 ? `${activeCriteria.length}개 기준` : '없음';
    // fullText, detailedText는 plain text로 반환
    const fullText = activeCriteria.length > 0 ? activeCriteria.join(', ') : '할당된 수행평가 기준이 없습니다.';
    const detailedText = activeCriteria.length > 0 ? activeCriteria.join(', ') : '없음';
    
    return { shortText, fullText, detailedText };
}

// 페이지 로드 시 초기화 (중복 제거 - window.onload에서 처리함)

// 정렬 기능 처리
function handleSort(column) {
    const table = document.getElementById('coursesTable');
    const headers = table.querySelectorAll('th.sortable');
    
    // 기존 정렬 상태 제거
    headers.forEach(header => {
        header.classList.remove('asc', 'desc');
    });
    
    // 같은 컬럼을 클릭한 경우 방향 전환
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc';
    }
    
    // 데이터 정렬
    sortCourses(column, currentSortDirection);
    
    // 현재 정렬 상태 표시
    const currentHeader = table.querySelector(`th[data-sort="${column}"]`);
    if (currentHeader) {
        currentHeader.classList.add(currentSortDirection);
    }
    
    // 테이블 내용만 업데이트 (전체 렌더링 대신)
    updateTableContent();
}

// 테이블 내용만 업데이트 (성능 최적화)
function updateTableContent() {
    const tbody = document.getElementById('coursesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const list = filteredCourses || courses;
    
    list.forEach((course, idx) => {
        // 원본 배열에서의 인덱스 찾기
        const originalIndex = courses.findIndex(c => c === course);
        
        // 매트릭스 데이터 가져오기
        const matrixValues = matrixData[course.courseName] || new Array(18).fill(0);
        const performanceCriteria = getPerformanceCriteria(matrixValues);
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td class="no-edit">${course.yearSemester}</td>
            <td class="no-edit">${course.courseNumber}</td>
            <td><strong ondblclick="editCourse(${originalIndex})">${course.courseName}</strong></td>
            <td>${course.professor || '-'}</td>
            <td class="no-edit">${course.credits}</td>
            <td class="no-edit">
                <span class="category-badge badge-${getCategoryClass(course.category)}">${course.category}</span>
            </td>
            <td class="no-edit">
                <span class="subject-type-badge badge-${getSubjectTypeClass(course.subjectType)}">${course.subjectType}</span>
            </td>
            <td class="no-edit">${course.isRequired}</td>
            <td class="performance-criteria no-edit" title="${performanceCriteria.fullText}">${performanceCriteria.detailedText}</td>
            <td class="no-edit">
                <button class="btn btn-sm" onclick="editCourse(${originalIndex})" style="font-size: 12px; padding: 5px 10px;">수정</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteCourse(${originalIndex})" style="font-size: 12px; padding: 5px 10px;">삭제</button>
            </td>
        `;
    });
}

// 교과목 데이터 정렬
function sortCourses(column, direction) {
    const coursesToSort = filteredCourses || courses;
    
    // 정렬 전에 데이터 복사 (원본 배열 보호)
    const sortedCourses = [...coursesToSort];
    
    sortedCourses.sort((a, b) => {
        let aValue, bValue;
        
        switch (column) {
            case 'yearSemester':
                aValue = a.yearSemester;
                bValue = b.yearSemester;
                break;
            case 'courseNumber':
                aValue = a.courseNumber;
                bValue = b.courseNumber;
                break;
            case 'courseName':
                aValue = a.courseName;
                bValue = b.courseName;
                break;
            case 'professor':
                aValue = a.professor || '';
                bValue = b.professor || '';
                break;
            case 'credits':
                aValue = parseInt(a.credits);
                bValue = parseInt(b.credits);
                break;
            case 'category':
                aValue = a.category;
                bValue = b.category;
                break;
            case 'subjectType':
                aValue = a.subjectType;
                bValue = b.subjectType;
                break;
            case 'isRequired':
                aValue = a.isRequired;
                bValue = b.isRequired;
                break;
            case 'performanceCriteria':
                // 수행평가기준은 매트릭스 데이터 기반으로 정렬
                const aMatrix = matrixData[a.courseName] || new Array(18).fill(0);
                const bMatrix = matrixData[b.courseName] || new Array(18).fill(0);
                const aCount = aMatrix.filter(v => v > 0).length;
                const bCount = bMatrix.filter(v => v > 0).length;
                aValue = aCount;
                bValue = bCount;
                break;
            default:
                return 0;
        }
        
        // 문자열 비교
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        if (aValue < bValue) {
            return direction === 'asc' ? -1 : 1;
        } else if (aValue > bValue) {
            return direction === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    // 정렬된 결과를 filteredCourses에 저장
    if (filteredCourses) {
        filteredCourses.length = 0;
        filteredCourses.push(...sortedCourses);
    } else {
        // 전체 데이터를 정렬할 때는 임시로 filteredCourses 사용
        filteredCourses = sortedCourses;
    }
}

// 정렬 이벤트 리스너 초기화
function initSortListeners() {
    const table = document.getElementById('coursesTable');
    if (!table) return;
    
    const sortableHeaders = table.querySelectorAll('th.sortable');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function(e) {
            // 리사이즈 핸들러 클릭 시 정렬 방지
            if (e.target.classList.contains('column-resizer')) {
                return;
            }
            
            const column = this.getAttribute('data-sort');
            if (column) {
                handleSort(column);
            }
        });
    });
}
// 매트릭스 필터링
function filterMatrix() {
    // 선택된 학년들 가져오기
    const selectedYears = [];
    document.querySelectorAll('.matrix-filters input[type="checkbox"][value^="1"], .matrix-filters input[type="checkbox"][value^="2"], .matrix-filters input[type="checkbox"][value^="3"], .matrix-filters input[type="checkbox"][value^="4"], .matrix-filters input[type="checkbox"][value^="5"]').forEach(checkbox => {
        if (checkbox.checked) {
            selectedYears.push(checkbox.value);
        }
    });
    
    // 선택된 필수여부들 가져오기
    const selectedRequired = [];
    document.querySelectorAll('.matrix-filters input[type="checkbox"][value="필수"], .matrix-filters input[type="checkbox"][value="선택"]').forEach(checkbox => {
        if (checkbox.checked) {
            selectedRequired.push(checkbox.value);
        }
    });
    
    // 선택된 변경 상태들 가져오기
    const selectedChangeStatus = [];
    document.querySelectorAll('.matrix-filters input[type="checkbox"][value="added"], .matrix-filters input[type="checkbox"][value="modified"], .matrix-filters input[type="checkbox"][value="deleted"], .matrix-filters input[type="checkbox"][value="unchanged"]').forEach(checkbox => {
        if (checkbox.checked) {
            selectedChangeStatus.push(checkbox.value);
        }
    });
    
    // 현재 버전의 변경 사항 가져오기
    const diffSummary = getCurrentDiffSummary();
    
    // 모든 변경 상태 필터가 해제되어 있으면 빈 결과
    if (selectedChangeStatus.length === 0) {
        filteredMatrixCourses = [];
        const tbody = document.querySelector('#matrixTable tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="24" style="text-align: center; padding: 20px; color: #999;">필터 조건에 맞는 교과목이 없습니다.</td></tr>';
        }
        updateFontSize();
        return;
    }
    
    filteredMatrixCourses = courses.filter(course => {
        const [year] = course.yearSemester.split('-');
        
        // 학년 필터링: 선택된 학년이 없으면 모든 학년 표시, 있으면 선택된 학년만
        const yearMatch = selectedYears.length === 0 || selectedYears.includes(year);
        
        // 필수여부 필터링: 선택된 필수여부가 없으면 모든 과목 표시, 있으면 선택된 것만
        const requiredMatch = selectedRequired.length === 0 || selectedRequired.includes(course.isRequired);
        
        // 변경 상태 필터링
        let changeStatusMatch = false;
        const courseDiff = diffSummary.find(diff => diff.course.id === course.id);
        if (courseDiff) {
            if (courseDiff.type === '추가' && selectedChangeStatus.includes('added')) {
                changeStatusMatch = true;
            } else if (courseDiff.type === '수정' && selectedChangeStatus.includes('modified')) {
                changeStatusMatch = true;
            }
        } else if (selectedChangeStatus.includes('unchanged')) {
            // 변경사항이 없는 경우
            changeStatusMatch = true;
        }
        
        return yearMatch && requiredMatch && changeStatusMatch;
    });
    
    // 삭제된 교과목 필터링
    const deletedCourses = diffSummary.filter(entry => entry.type === '삭제').map(entry => entry.course);
    if (selectedChangeStatus.includes('deleted')) {
        deletedCourses.forEach(deletedCourse => {
            const [year] = deletedCourse.yearSemester.split('-');
            const yearMatch = selectedYears.length === 0 || selectedYears.includes(year);
            const requiredMatch = selectedRequired.length === 0 || selectedRequired.includes(deletedCourse.isRequired);
            
            if (yearMatch && requiredMatch) {
                filteredMatrixCourses.push(deletedCourse);
            }
        });
    }
    
    renderMatrix();
    updateFontSize(); // 필터 적용 후 글씨 크기 재적용
}

// 매트릭스 필터 초기화
function resetMatrixFilters() {
    // 모든 체크박스 해제
    document.querySelectorAll('.matrix-filters input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // 변경 상태 체크박스는 다시 체크
    document.querySelectorAll('.matrix-filters input[value="added"], .matrix-filters input[value="modified"], .matrix-filters input[value="deleted"], .matrix-filters input[value="unchanged"]').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    filteredMatrixCourses = null;
    renderMatrix();
    updateFontSize(); // 필터 초기화 후 글씨 크기 재적용
}

// =========================
// 매트릭스 버전 관리 기능
// =========================

let currentMatrixVersion = '기본';



// 토스트 메시지 함수
function showToast(msg, type = 'info') {
    let toast = document.getElementById('globalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.position = 'fixed';
        toast.style.top = '50%';
        toast.style.left = '50%';
        toast.style.transform = 'translate(-50%, -50%)';
        toast.style.color = '#fff';
        toast.style.padding = '18px 36px';
        toast.style.borderRadius = '10px';
        toast.style.fontSize = '16px';
        toast.style.zIndex = 9999;
        toast.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
        toast.style.display = 'none';
        toast.style.maxWidth = '600px';
        toast.style.whiteSpace = 'pre-line';
        toast.style.textAlign = 'left';
        toast.style.lineHeight = '1.4';
        document.body.appendChild(toast);
    }
    
    // 타입에 따른 스타일 설정
    switch(type) {
        case 'success':
            toast.style.background = 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)';
            break;
        case 'error':
            toast.style.background = 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)';
            break;
        case 'warning':
            toast.style.background = 'linear-gradient(135deg, #d35400 0%, #e67e22 100%)';
            break;
        default: // info
            toast.style.background = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
    }
    
    // 긴 메시지의 경우 줄바꿈을 유지
    toast.innerHTML = msg;
    toast.style.display = 'block';
    
    // 메시지 길이에 따라 표시 시간 조정
    const displayTime = msg.length > 100 ? 5000 : 3000;
    
    setTimeout(() => { 
        toast.style.display = 'none'; 
    }, displayTime);
}

// ============================================
// 제목 편집 공통 함수
// ============================================

// 공통 제목 편집 함수
function setTitleEditable(titleId, editable, handleInputFn, tempStorageObj, tempDataObj, defaultTitle) {
    const titleElement = document.getElementById(titleId);
    if (!titleElement) return;
    
    if (editable) {
        // 편집 모드로 설정
        titleElement.contentEditable = true;
        titleElement.style.border = '2px solid #007bff';
        titleElement.style.padding = '8px';
        titleElement.style.borderRadius = '4px';
        titleElement.style.backgroundColor = '#f8f9fa';
        titleElement.style.cursor = 'text';
        titleElement.focus();
        
        // 원본 제목 저장
        if (!titleElement.getAttribute('data-original-title')) {
            titleElement.setAttribute('data-original-title', titleElement.textContent);
        }
        
        // 편집 모드 시작 시 임시 저장소 초기화 (매트릭스 탭만 해당)
        if (titleId === 'matrixTitle' && Object.keys(tempDataObj).length === 0) {
            Object.assign(tempDataObj, matrixData);
        }
        
        // 기존 리스너 제거 후 새로 등록
        titleElement.removeEventListener('blur', handleInputFn);
        titleElement.removeEventListener('keydown', handleTitleKeydown);
        
        // 편집 완료 이벤트 리스너 추가
        titleElement.addEventListener('blur', handleInputFn);
        titleElement.addEventListener('keydown', handleTitleKeydown);
        
    } else {
        // 일반 모드로 설정
        titleElement.contentEditable = false;
        titleElement.style.border = '';
        titleElement.style.padding = '';
        titleElement.style.borderRadius = '';
        titleElement.style.backgroundColor = '';
        titleElement.style.cursor = '';
        
        // 이벤트 리스너 제거
        titleElement.removeEventListener('blur', handleInputFn);
        titleElement.removeEventListener('keydown', handleTitleKeydown);
    }
    
    // 키다운 이벤트 핸들러 (내부 함수)
    function handleTitleKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.target.textContent = e.target.getAttribute('data-original-title');
            e.target.blur();
        }
    }
}

// 공통 제목 입력 처리 함수
function handleTitleInput(titleId, tempStorageObj, defaultTitle) {
    const titleElement = document.getElementById(titleId);
    if (!titleElement) return;
    
    const newTitle = titleElement.textContent.trim();
    const originalTitle = titleElement.getAttribute('data-original-title') || '';
    
    if (newTitle && newTitle !== originalTitle) {
        // 제목 변경사항을 임시 저장소에 저장
        if (!tempStorageObj._titleChanged) {
            tempStorageObj._titleChanged = true;
            tempStorageObj._oldTitle = originalTitle;
            tempStorageObj._newTitle = newTitle;
        } else {
            tempStorageObj._newTitle = newTitle;
        }
        
        // 현재 버전에 메모리에만 저장 (버전 저장 시 Firebase에 저장됨)
        if (versions[currentVersion]) {
            if (titleId === 'matrixTitle') {
                if (!versions[currentVersion].matrixTab) {
                    versions[currentVersion].matrixTab = {};
                }
                versions[currentVersion].matrixTab.matrixTitleText = newTitle;
            } else if (titleId === 'curriculumTitle') {
                if (!versions[currentVersion].curriculumTab) {
                    versions[currentVersion].curriculumTab = {};
                }
                versions[currentVersion].curriculumTab.curriculumTitleText = newTitle;
            } else if (titleId === 'commonValuesTitle') {
                if (!versions[currentVersion].commonValuesTab) {
                    versions[currentVersion].commonValuesTab = {};
                }
                versions[currentVersion].commonValuesTab.commonValuesTitleText = newTitle;
            }
        }
        
        // data-original-title 업데이트
        titleElement.setAttribute('data-original-title', newTitle);
        
        showToast('제목이 저장되었습니다.');
    }
    
    // 편집 모드 비활성화
    const setEditableFn = titleId === 'matrixTitle' ? setMatrixTitleEditable :
                          titleId === 'curriculumTitle' ? setCurriculumTitleEditable :
                          titleId === 'commonValuesTitle' ? setCommonValuesTitleEditable : null;
    
    if (setEditableFn) {
        setEditableFn(false);
    }
}

// ============================================
// 탭별 제목 편집 함수 (공통 함수 활용)
// ============================================

// 매트릭스 제목 인라인 편집 (수정모드에서만)
function setMatrixTitleEditable(editable) {
    setTitleEditable('matrixTitle', editable, handleMatrixTitleInput, tempMatrixData, tempMatrixData, '수행평가 매트릭스');
}

// 제목 변경 시 저장
function handleMatrixTitleInput() {
    handleTitleInput('matrixTitle', tempMatrixData, '수행평가 매트릭스');
}

// ... existing code ...


// ... existing code ...

// ... existing code ...
function updateAnalysisStats() {
    // 삭제된 교과목과 고스트 블록을 제외한 활성 교과목만 필터링
    const activeCourses = courses.filter(course => {
        const isDeleted = course.isDeleted === true;
        const isGhost = course.isGhost === true;
        return !isDeleted && !isGhost;
    });
    
    // 총학점
    const totalCredits = activeCourses.reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0);
    // 전공필수과목
    const requiredCourses = activeCourses.filter(c => c.isRequired === '필수' && c.category !== '교양').length;
    // 전공선택과목
    const electiveCourses = activeCourses.filter(c => c.isRequired === '선택' && c.category !== '교양').length;
    // 설계과목
    const designCourses = activeCourses.filter(c => c.category === '설계').length;
    // 설계과목 비율
    const designRatio = activeCourses.length > 0 ? ((designCourses / activeCourses.length) * 100).toFixed(1) + '%' : '0%';
    
    // 학년별 교과목 분포 계산
    const yearDistribution = {};
    activeCourses.forEach(course => {
        const [year, semester] = course.yearSemester.split('-');
        const key = `${year}-${semester}`;
        if (!yearDistribution[key]) {
            yearDistribution[key] = { count: 0, credits: 0 };
        }
        yearDistribution[key].count++;
        yearDistribution[key].credits += parseInt(course.credits) || 0;
    });
    
    // 학년별 합계 계산
    const yearTotals = {};
    for (let year = 1; year <= 5; year++) {
        yearTotals[year] = { count: 0, credits: 0 };
        for (let semester = 1; semester <= 2; semester++) {
            const key = `${year}-${semester}`;
            if (yearDistribution[key]) {
                yearTotals[year].count += yearDistribution[key].count;
                yearTotals[year].credits += yearDistribution[key].credits;
            }
        }
        // 계절학기 추가
        const summerKey = `${year}-계절`;
        if (yearDistribution[summerKey]) {
            yearTotals[year].count += yearDistribution[summerKey].count;
            yearTotals[year].credits += yearDistribution[summerKey].credits;
        }
    }
    
    // DOM에 반영
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('totalCredits', totalCredits);
    set('requiredCourses', requiredCourses);
    set('electiveCourses', electiveCourses);
    set('designCourses', designCourses);
    set('designRatio', designRatio);
    
    // 학년별 교과목 분포 표 업데이트
    const updateYearDistributionTable = () => {
        const tbody = document.querySelector('#analysis .table-container table tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            const year = index + 1;
            const cells = row.querySelectorAll('td');
            
            // 1학기
            const semester1Key = `${year}-1`;
            const semester1Data = yearDistribution[semester1Key] || { count: 0, credits: 0 };
            cells[1].textContent = semester1Data.count > 0 ? `${semester1Data.count}과목 (${semester1Data.credits}학점)` : '-';
            
            // 2학기
            const semester2Key = `${year}-2`;
            const semester2Data = yearDistribution[semester2Key] || { count: 0, credits: 0 };
            cells[2].textContent = semester2Data.count > 0 ? `${semester2Data.count}과목 (${semester2Data.credits}학점)` : '-';
            
            // 계절학기
            const summerKey = `${year}-계절`;
            const summerData = yearDistribution[summerKey] || { count: 0, credits: 0 };
            cells[3].textContent = summerData.count > 0 ? `${summerData.count}과목 (${summerData.credits}학점)` : '-';
            
            // 합계
            const totalData = yearTotals[year];
            cells[4].textContent = totalData.count > 0 ? `${totalData.count}과목 (${totalData.credits}학점)` : '-';
        });
    };
    
    updateYearDistributionTable();
    
    // 차트들 업데이트
    drawChart();
    drawSubjectTypeChart();
}
// 주요 렌더링 후 updateAnalysisStats 호출
const origRenderCourses = renderCourses;
renderCourses = function() { origRenderCourses.apply(this, arguments); updateAnalysisStats(); };
const origRenderMatrix = renderMatrix;
renderMatrix = function() { origRenderMatrix.apply(this, arguments); updateAnalysisStats(); };
// 페이지 최초 로딩 시에도 호출
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAnalysisStats);
} else {
    updateAnalysisStats();
}
// ... existing code ...

// 이수모형표에 교과목 배치 (삭제 diff 교과목도 별도로 배치)
function renderCurriculumTable() {
    // 이수모형 제목 업데이트 (편집 중이 아닐 때만)
    const titleElement = document.getElementById('curriculumTitle');
    if (titleElement && titleElement.contentEditable !== 'true') {
        // localStorage 사용 안 함 - 버전 데이터에서 가져오기
        const versionTitle = versions[currentVersion]?.curriculumTab?.curriculumTitleText;
        if (versionTitle) {
            titleElement.textContent = versionTitle;
        } else {
            titleElement.textContent = '건축학전공 교과과정 이수모형';
        }
    }
    
    // 화살표 초기화
    clearMoveArrows();
    
    // 기존 블록들과 화살표 제거
    const cells = document.querySelectorAll('[id^="cell-"]');
    cells.forEach(cell => {
        cell.innerHTML = '';
    });
    
    // 기존 화살표 제거 (레거시)
    const existingArrows = document.querySelectorAll('.move-arrow');
    existingArrows.forEach(arrow => arrow.remove());
    
    const diffSummary = getCurrentDiffSummary();
    const movedCoursesForGhost = []; // 이동된 교과목 저장용
    
    // 현재 교과목들 배치
    courses.forEach(course => {
        const cellId = getCurriculumCellId(course);
        const cell = document.getElementById(cellId);
        if (cell) {
            const block = createCourseBlock(course, false, false); // 일반 교과목
            // 여러 블럭이 들어가는 셀은 block-wrap으로 감싸서 추가
            // (셀에 이미 block-wrap이 있으면 그 안에 추가, 없으면 새로 생성)
            let blockWrap = cell.querySelector('.block-wrap');
            if (!blockWrap) {
                blockWrap = document.createElement('div');
                blockWrap.className = 'block-wrap';
                cell.appendChild(blockWrap);
            }
            blockWrap.appendChild(block);
            
            // 학년학기가 변경된 교과목인지 확인
            const courseChange = diffSummary.find(entry => 
                entry.course && entry.course.id === course.id && entry.type === '수정'
            );
            
            if (courseChange) {
                const yearSemesterChange = courseChange.changes.find(c => c.field === 'yearSemester');
                const isRequiredChange = courseChange.changes.find(c => c.field === 'isRequired');
                const categoryChange = courseChange.changes.find(c => c.field === 'category');
                
                // 학년학기 변경, 필수여부 변경, 또는 분야 변경이 있는 경우
                if (yearSemesterChange || isRequiredChange || categoryChange) {
                    const oldCourse = { ...course };
                    courseChange.changes.forEach(change => {
                        oldCourse[change.field] = change.before;
                    });
                    
                    // 학년학기 변경이 있는 경우 해당 값도 복원
                    if (yearSemesterChange) {
                        oldCourse.yearSemester = yearSemesterChange.before;
                    }
                    
                    movedCoursesForGhost.push({
                        initialCourse: oldCourse,
                        currentCourse: course
                    });
                }
            }
        }
    });
    
    


    // 삭제된 교과목들 배치 (변경사항 표시 모드에서만)
    if (showChangesModeCurriculum) {
        const deletedCourses = diffSummary.filter(entry => entry.type === '삭제');
        deletedCourses.forEach(entry => {
            const course = entry.course;
            const cellId = getCurriculumCellId(course);
            const cell = document.getElementById(cellId);
            if (cell) {
                let blockWrap = cell.querySelector('.block-wrap');
                if (!blockWrap) {
                    blockWrap = document.createElement('div');
                    blockWrap.className = 'block-wrap';
                    cell.appendChild(blockWrap);
                }
                const block = createCourseBlock(course, true, false); // 삭제된 교과목
                blockWrap.appendChild(block);
            }
        });
    }
    
    // 고스트 블럭 생성 (변경사항 표시 모드에서만)
    if (showChangesModeCurriculum) {
        movedCoursesForGhost.forEach((moveInfo, index) => {
            const initialCellId = getCurriculumCellId(moveInfo.initialCourse);
            const initialCell = document.getElementById(initialCellId);
            if (initialCell) {
                let blockWrap = initialCell.querySelector('.block-wrap');
                if (!blockWrap) {
                    blockWrap = document.createElement('div');
                    blockWrap.className = 'block-wrap';
                    initialCell.appendChild(blockWrap);
                }
                const ghostBlock = createCourseBlock(moveInfo.initialCourse, false, true);
                blockWrap.appendChild(ghostBlock);
            }
        });
    }
    // 학점 합계 계산 및 표시
    calculateAndDisplayCredits();
    
    // 모든 교과목 블록의 드래그 가능 여부 업데이트
    updateAllCourseBlocksDraggable();
    
    // block-wrap 드래그 이벤트 연결
    setupBlockWrapDragEvents();
    
    // 화살표 그리기 (DOM 렌더링이 확실히 끝난 뒤 실행) - 변경사항 표시 모드에서만
    if (showChangesModeCurriculum) {
        setTimeout(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    drawMoveArrows(movedCoursesForGhost);
                });
            });
        }, 0);
    }
    
    // 교과목 블록 배치 후 셀 텍스트 복원 (교과목 블록이 없는 셀들만)
    let restoredCellCount = 0;
    cells.forEach(cell => {
        if (curriculumCellTexts[cell.id]) {
            const savedContent = curriculumCellTexts[cell.id];
            if (savedContent && savedContent.trim() !== '') {
                // 교과목 블록이 없는 셀만 텍스트 복원
                const courseBlocks = cell.querySelectorAll('.course-block');
                if (courseBlocks.length === 0) {
                    // 줄바꿈을 <br>로 변환하여 표시
                    cell.innerHTML = savedContent.replace(/\n/g, '<br>');
                    restoredCellCount++;
                } else {
                    // 교과목 블록이 있는 셀의 경우, 블록 뒤에 텍스트 추가
                    const textContent = savedContent.replace(/\n/g, '<br>');
                    if (textContent.trim() !== '') {
                        cell.innerHTML += textContent;
                        restoredCellCount++;
                    }
                }
            }
        }
    });
    
    // 수정모드가 활성화되어 있다면 셀 편집 기능 다시 설정
    const editModeButton = document.getElementById('editModeToggleCurriculum');
    if (editModeButton && editModeButton.classList.contains('active')) {
        enableCurriculumCellEditing();
    }
    
    // 생성된 모든 교과목 블록에 현재 설정된 글씨 크기 적용
    setTimeout(() => {
        const allCourseBlocks = document.querySelectorAll('.course-block');
        allCourseBlocks.forEach(block => {
            block.style.fontSize = currentCurriculumFontSize + 'px';
            
            const title = block.querySelector('.course-block-title');
            const info = block.querySelector('.course-block-info');
            
            if (title) {
                title.style.fontSize = currentCurriculumFontSize + 'px';
            }
            if (info) {
                info.style.fontSize = (currentCurriculumFontSize - 2) + 'px';
            }
        });
    }, 50);
}

// 학점 합계 계산 및 표시
function calculateAndDisplayCredits() {
    // 삭제된 교과목과 고스트 블록을 제외한 활성 교과목만 필터링
    const activeCourses = courses.filter(course => {
        const isDeleted = course.isDeleted === true;
        const isGhost = course.isGhost === true;
        return !isDeleted && !isGhost;
    });
    
    // 학년-학기별 전체 학점 합계 계산
    const creditSums = {};
    
    activeCourses.forEach(course => {
        let [year, semester] = course.yearSemester.split('-');
        if (semester === '계절') semester = '2'; // 계절학기는 2학기로 취급
        const key = `${year}-${semester}`;
        if (!creditSums[key]) {
            creditSums[key] = { required: 0, elective: 0, total: 0 };
        }
        const credits = parseInt(course.credits) || 0;
        creditSums[key].total += credits;
        if (course.isRequired === '필수' && course.category !== '교양') {
            creditSums[key].required += credits;
        } else if (course.isRequired === '선택' && course.category !== '교양') {
            creditSums[key].elective += credits;
        }
    });
    
    // 이수모형표 업데이트
    const curriculumTable = document.querySelector('.curriculum-table');
    if (curriculumTable) {
        const rows = curriculumTable.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td');
            if (!firstCell) return;
            
            const cells = row.querySelectorAll('td');
            
            // 각 행의 과목들 학점 합계 계산
            let rowTotal = 0;
            cells.forEach((cell) => {
                // 실제로 교과목 블록이 들어가는 셀만 계산 (rowspan 등으로 인덱스가 달라져도 무관)
                if (cell.querySelector('.course-block')) {
                    const courseBlocks = cell.querySelectorAll('.course-block');
                    courseBlocks.forEach(block => {
                        // 고스트 블록과 삭제된 블록은 제외
                        if (block.classList.contains('ghost') || block.classList.contains('deleted')) {
                            return;
                        }
                        const courseName = block.dataset.courseName;
                        const course = activeCourses.find(c => c.courseName === courseName);
                        if (course) {
                            rowTotal += parseInt(course.credits) || 0;
                        }
                    });
                }
            });
            
            // 마지막 셀(학점열)에 행의 총 학점 표시
            const lastCell = cells[cells.length - 1];
            if (lastCell) {
                lastCell.textContent = rowTotal > 0 ? rowTotal : '';
            }
            
            // 전공필수 소계 행에 학점 표시
            if (firstCell.textContent.includes('개설 전공필수 소계')) {
                let requiredTotal = 0;
                let requiredCount = 0;
                cells.forEach((cell, index) => {
                    if (index >= 1) { // 2번째 셀부터 (colspan="3" 고려)
                        const year = Math.floor((index - 1) / 2) + 1;
                        const semester = (index - 1) % 2 + 1;
                        const key = `${year}-${semester}`;
                        // 교양을 제외한 전공필수만 합산 (삭제된 교과목과 고스트 블록 제외)
                        const credits = activeCourses.filter(c => {
                            let [y, s] = c.yearSemester.split('-');
                            if (s === '계절') s = '2';
                            return `${y}-${s}` === key && c.isRequired === '필수' && c.category !== '교양';
                        }).reduce((sum, c) => sum + (parseInt(c.credits) || 0), 0);
                        cell.textContent = credits > 0 ? credits : '';
                        requiredTotal += credits;
                        const semesterCourses = activeCourses.filter(c => {
                            let [y, s] = c.yearSemester.split('-');
                            if (s === '계절') s = '2';
                            return `${y}-${s}` === key && c.isRequired === '필수' && c.category !== '교양';
                        });
                        requiredCount += semesterCourses.length;
                    }
                });
                if (lastCell) {
                    if (requiredTotal > 0) {
                        lastCell.textContent = `${requiredTotal}(${requiredCount}과목)`;
                    } else {
                        lastCell.textContent = '';
                    }
                }
            }
            
            // 전공선택 소계 행에 학점 표시
            if (firstCell.textContent.includes('개설 전공선택 소계')) {
                let electiveTotal = 0;
                let electiveCount = 0;
                cells.forEach((cell, index) => {
                    if (index >= 1) { // 2번째 셀부터 (colspan="3" 고려)
                        const year = Math.floor((index - 1) / 2) + 1;
                        const semester = (index - 1) % 2 + 1;
                        const key = `${year}-${semester}`;
                        const credits = creditSums[key]?.elective || 0;
                        cell.textContent = credits > 0 ? credits : '';
                        electiveTotal += credits;
                        if (credits > 0) {
                            const semesterCourses = activeCourses.filter(c => 
                                c.yearSemester === key && c.isRequired === '선택'
                            );
                            electiveCount += semesterCourses.length;
                        }
                    }
                });
                
                if (lastCell) {
                    if (electiveTotal > 0) {
                        lastCell.textContent = `${electiveTotal}(${electiveCount}과목)`;
                    } else {
                        lastCell.textContent = '';
                    }
                }
            }
            
            // 졸업 최저이수학점 행에 전체 학점 표시
            if (firstCell.textContent.includes('졸업 최저이수학점')) {
                let totalCredits = 0;
                let totalCourses = 0;
                
                // 전체 학점과 과목 수 계산
                Object.keys(creditSums).forEach(key => {
                    totalCredits += creditSums[key].total;
                    const semesterCourses = activeCourses.filter(c => c.yearSemester === key);
                    totalCourses += semesterCourses.length;
                });
                
                // 각 학년-학기별 전체 학점 표시
                cells.forEach((cell, index) => {
                    if (index >= 1) { // 2번째 셀부터 (colspan="3" 고려)
                        const year = Math.floor((index - 1) / 2) + 1;
                        const semester = (index - 1) % 2 + 1;
                        const key = `${year}-${semester}`;
                        const credits = creditSums[key]?.total || 0;
                        cell.textContent = credits > 0 ? credits : '';
                    }
                });
                
                // 마지막 셀에 전체 학점 표시
                if (lastCell) {
                    if (totalCredits > 0) {
                        lastCell.textContent = `${totalCredits}(${totalCourses}과목)`;
                    } else {
                        lastCell.textContent = '';
                    }
                }
            }
        });
    }
}

// 교과목의 이수모형표 셀 ID 생성
function getCurriculumCellId(course) {
    const [year, semester] = course.yearSemester.split('-');
    let category = course.category;
    let subCategory = '';
    
    // --- 추가: 표시 강제 플래그가 있으면 무조건 기타 행에 배치 ---
    if (course.forceCurriculumRow === '기타' && course.isRequired === '선택') {
        return `cell-전공선택-기타-${year}-${semester === '계절' ? '2' : semester}`;
    }
    // --- 기존 코드 ...
    // 전공선택 과목 중 설계가 아닌 것은 이론으로 분류 (기타 카테고리 추가)
    if (course.isRequired === '선택' && category !== '설계' && category !== '교양' && category !== '기타') {
        category = '이론';
    }
    
    // 기술 카테고리의 세부 분류
    if (category === '기술') {
        // 기술분야가 이미 설정되어 있으면 그것을 사용
        if (course.techField) {
            subCategory = course.techField;
        } else {
            // 과목명으로 자동 분류
            if (course.courseName.includes('구조')) subCategory = '구조';
            else if (course.courseName.includes('환경')) subCategory = '환경';
            else if (course.courseName.includes('시공')) subCategory = '시공';
            else if (course.courseName.includes('디지털')) subCategory = '디지털';
            else subCategory = '구조'; // 기본값
        }
    }
    
    // 필수/선택에 따른 구분
    const requiredType = course.isRequired === '필수' ? '전공필수' : '전공선택';
    
    // 계절학기 속성을 갖는 교과목은 2학기 셀에 배치
    let targetSemester = semester;
    if (semester === '계절') {
        targetSemester = '2';
    }
    
    // 교양 과목 처리
    if (category === '교양') {
        if (course.isRequired === '선택') {
            return `cell-교양-교양선택-merged`;
        } else {
            return `cell-교양-교양필수-${year}-${targetSemester}`;
        }
    }
    
    // 전공 과목 처리
    if (subCategory) {
        return `cell-${requiredType}-${subCategory}-${year}-${targetSemester}`;
    } else {
        return `cell-${requiredType}-${category}-${year}-${targetSemester}`;
    }
}
// 교과목 블록 생성 (diff/삭제/이동(ghost) 기반)
function createCourseBlock(course, isDeleted = false, isGhost = false) {
    const block = document.createElement('div');
    block.className = 'course-block';
    block.dataset.courseName = course.courseName;
    block.dataset.courseId = course.id;
    
    // 현재 활성화된 탭 확인 (함수 상단에서 선언)
    const commonValuesTab = document.getElementById('commonValues');
    const curriculumTab = document.getElementById('curriculum');
    const isCommonValuesActive = commonValuesTab && commonValuesTab.classList.contains('active');
    const isCurriculumActive = curriculumTab && curriculumTab.classList.contains('active');
    
    // 삭제된 교과목인 경우
    if (isDeleted) {
        block.classList.add('deleted');
    } 
    // 원래 위치 흔적(ghost)인 경우
    else if (isGhost) {
        block.classList.add('ghost');
    } 
    // 일반 교과목인 경우
    else {
        
        // 변경사항 표시 모드일 때만 변경 유형 확인
        if ((isCurriculumActive && showChangesModeCurriculum) || 
            (isCommonValuesActive && showChangesModeCommonValues)) {
            const diffSummary = getCurrentDiffSummary();
            const courseChange = diffSummary.find(entry => 
                entry.course && entry.course.id === course.id
            );
            
            // 변경 유형에 따른 클래스 적용
            if (courseChange) {
                switch(courseChange.type) {
                    case '추가':
                        block.classList.add('highlighted'); // 초록색 강조
                        break;
                    case '수정':
                        // 학년학기가 변경된 경우 moved 클래스 추가
                        const yearSemesterChanged = courseChange.changes.some(c => c.field === 'yearSemester');
                        if (yearSemesterChanged) {
                            block.classList.add('moved');
                        }
                        block.classList.add('modified'); // 파란색 강조
                        break;
                }
            }
        }
    }
    
    // 카테고리별 색상 클래스 추가
    // 공통가치대응 탭이 활성화된 경우 색상 기준 전환 스위치에 따라 결정
    if (isCommonValuesActive) {
        if (colorModeBySubjectType) {
            // 과목분류 기준 색상
            const subjectTypeClass = getSubjectTypeClass(course.subjectType);
            if (subjectTypeClass) {
                block.classList.add(`course-block-${subjectTypeClass}`);
            }
        } else {
            // 구분 기준 색상
            const categoryClass = getCategoryClass(course.category);
            if (categoryClass) {
                block.classList.add(`course-block-${categoryClass}`);
            }
        }
    } else if (isCurriculumActive) {
        if (colorModeBySubjectTypeCurriculum) {
            // 과목분류 기준 색상
            const subjectTypeClass = getSubjectTypeClass(course.subjectType);
            if (subjectTypeClass) {
                block.classList.add(`course-block-${subjectTypeClass}`);
            }
        } else {
            // 구분 기준 색상
            const categoryClass = getCategoryClass(course.category);
            if (categoryClass) {
                block.classList.add(`course-block-${categoryClass}`);
            }
        }
    } else {
        // 다른 탭에서는 기존대로 구분 기준 색상
        const categoryClass = getCategoryClass(course.category);
        if (categoryClass) {
            block.classList.add(`course-block-${categoryClass}`);
        }
    }
    
    // 설계 교과목의 경우 색상 기준 전환을 위한 추가 클래스 적용
    if (course.category === '설계' && course.subjectType === '설계') {
        if (isCommonValuesActive) {
            if (colorModeBySubjectType) {
                // 과목분류 모드에서는 subjectType 기준으로 이미 적용됨
                block.classList.add('color-mode-subject-type');
            } else {
                // 구분 모드에서는 category 기준으로 이미 적용됨
                block.classList.add('color-mode-category');
            }
        } else if (isCurriculumActive) {
            if (colorModeBySubjectTypeCurriculum) {
                // 과목분류 모드에서는 subjectType 기준으로 이미 적용됨
                block.classList.add('color-mode-subject-type');
            } else {
                // 구분 모드에서는 category 기준으로 이미 적용됨
                block.classList.add('color-mode-category');
            }
        }
    }
    
    // 교과목 이름 변경 이력 확인 (변경사항 표시 모드일 때만)
    let originalCourseName = '';
    
    if ((isCurriculumActive && showChangesModeCurriculum) || 
        (isCommonValuesActive && showChangesModeCommonValues)) {
        const diffSummary = getCurrentDiffSummary();
        const courseChange = diffSummary.find(entry => 
            entry.course && entry.course.id === course.id
        );
        
        if (courseChange && courseChange.type === '수정') {
            const nameChange = courseChange.changes.find(change => change.field === 'courseName');
            if (nameChange) {
                originalCourseName = nameChange.before;
            }
        }
    }
    
    // 블록 내용 설정 - 상세내용을 작은 글씨로 표시
    let blockContent = `
        <div class="course-block-title">${course.courseName}<span class="course-credits-text">(${course.credits})</span></div>
    `;
    
    // 이전 교과목 이름이 있으면 표시 (변경사항 표시 모드일 때만)
    if (originalCourseName && originalCourseName !== course.courseName) {
        blockContent += `
            <div class="course-block-original-name">이전: ${originalCourseName}</div>
        `;
    }
    
    blockContent += `
        <div class="course-block-info">
            ${course.description ? `<span class="course-description">${course.description}</span>` : ''}
        </div>
    `;
    
    block.innerHTML = blockContent;
    
    // 커스텀 툴팁 이벤트 추가 (ghost 블록 제외)
    if (!isGhost) {
        block.addEventListener('mouseenter', (e) => {
            showCourseTooltip(e, course);
            
            // 변경된 블럭인 경우 변경이력 팝업의 해당 항목 하이라이트
            if (block.classList.contains('modified') || block.classList.contains('highlighted') || block.classList.contains('deleted')) {
                highlightChangeHistoryItem(course.id);
            }
        });
        block.addEventListener('mouseleave', () => {
            hideCourseTooltip();
            
            // 하이라이트 제거
            removeChangeHistoryHighlight();
        });
        block.addEventListener('mousemove', moveCourseTooltip);
    }

    // 삭제된 교과목이나 ghost 블록이 아닌 경우에만 드래그 가능
    if (!isDeleted && !isGhost) {
    updateCourseBlockDraggable(block);
    
    // 드래그 이벤트 리스너 추가
    block.addEventListener('dragstart', handleCourseBlockDragStart);
    block.addEventListener('dragend', handleCourseBlockDragEnd);
    
    // 더블클릭으로 편집
    block.addEventListener('dblclick', () => editCourseBlock(course));
    }
    
    // 현재 설정된 글씨 크기 적용
    block.style.fontSize = currentCurriculumFontSize + 'px';
    
    // 블록 내부 텍스트 요소들의 폰트 사이즈도 업데이트
    const title = block.querySelector('.course-block-title');
    const info = block.querySelector('.course-block-info');
    const originalName = block.querySelector('.course-block-original-name');
    
    if (title) {
        title.style.fontSize = currentCurriculumFontSize + 'px';
    }
    if (info) {
        info.style.fontSize = (currentCurriculumFontSize - 2) + 'px'; // 정보 텍스트는 약간 작게
    }
    if (originalName) {
        originalName.style.fontSize = (currentCurriculumFontSize - 3) + 'px'; // 이전 이름은 더 작게
    }
    
    return block;
}

// --- 커스텀 툴팁 함수들 (최상단에 위치) ---
let tooltipTimer = null;
let isCourseBlockDragging = false; // 드래그 중 여부 플래그 추가

function showCourseTooltip(event, course) {
    if (isCourseBlockDragging) return; // 드래그 중에는 툴팁 표시 안함
    
    // 수정모드일 때는 툴팁 표시 안함
    const curriculumEditModeButton = document.getElementById('editModeToggleCurriculum');
    const commonValuesEditModeButton = document.getElementById('editModeToggleCommonValues');
    const isCurriculumEditMode = curriculumEditModeButton && curriculumEditModeButton.classList.contains('active');
    const isCommonValuesEditMode = commonValuesEditModeButton && commonValuesEditModeButton.classList.contains('active');
    
    if (isCurriculumEditMode || isCommonValuesEditMode) return;
    
    window.hideCourseTooltip(); // 기존 툴팁 제거 및 타이머 취소
    tooltipTimer = setTimeout(() => {
        const tooltip = document.createElement('div');
        tooltip.className = 'custom-course-tooltip';
        tooltip.innerHTML = getCourseTooltipHTML(course);
        document.body.appendChild(tooltip);
        positionCourseTooltip(event, tooltip);
    }, 800);
}
window.showCourseTooltip = showCourseTooltip;

function hideCourseTooltip() {
    if (tooltipTimer) {
        clearTimeout(tooltipTimer);
        tooltipTimer = null;
    }
    const existing = document.querySelector('.custom-course-tooltip');
    if (existing) existing.remove();
}
window.hideCourseTooltip = hideCourseTooltip;

function moveCourseTooltip(event) {
    const tooltip = document.querySelector('.custom-course-tooltip');
    if (tooltip) positionCourseTooltip(event, tooltip);
}
window.moveCourseTooltip = moveCourseTooltip;

function positionCourseTooltip(event, tooltip) {
    const padding = 12;
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    tooltip.style.left = (mouseX + 20 + scrollX) + 'px';
    tooltip.style.top = (mouseY + 20 + scrollY) + 'px';
}

// 교과목 툴팁 HTML 생성 (diff 기반 상태표시 포함)
function getCourseTooltipHTML(course) {
    const matrixValues = matrixData[course.courseName] || new Array(18).fill(0);
    const performanceCriteria = getPerformanceCriteria(matrixValues);
    
    // 변경 상태 확인
    const diffSummary = getCurrentDiffSummary();
    const courseChange = diffSummary.find(entry => 
        entry.course && entry.course.id === course.id
    );
    
    let statusInfo = '';
    
    if (courseChange) {
        switch(courseChange.type) {
            case '삭제':
                statusInfo = '<div class="tooltip-row" style="color: #f44336; font-weight: bold;">🗑️ 삭제된 교과목</div>';
                break;
            case '추가':
                statusInfo = '<div class="tooltip-row" style="color: #4caf50; font-weight: bold;">✨ 새로 추가된 교과목</div>';
                break;
            case '수정':
                const yearSemesterChange = courseChange.changes.find(c => c.field === 'yearSemester');
                if (yearSemesterChange) {
                    statusInfo = `<div class="tooltip-row" style="color: #2196f3; font-weight: bold;">📍 ${yearSemesterChange.before} → ${yearSemesterChange.after}로 이동됨</div>`;
                } else {
                    statusInfo = '<div class="tooltip-row" style="color: #2196f3; font-weight: bold;">✏️ 수정된 교과목</div>';
                }
                break;
        }
    }
    
    return `
        <div class="tooltip-title">${course.courseName}</div>
        ${statusInfo}
        <div class="tooltip-row"><b>담당교수</b>: ${course.professor ? course.professor : '-'}</div>
        <div class="tooltip-row"><b>교과목번호</b>: ${course.courseNumber}</div>
        <div class="tooltip-row"><b>학점</b>: ${course.credits}학점</div>
        <div class="tooltip-row"><b>학년-학기</b>: ${course.yearSemester}</div>
        <div class="tooltip-row"><b>구분</b>: ${course.category}</div>
        <div class="tooltip-row"><b>필수여부</b>: ${course.isRequired}</div>
        ${course.description ? `<div class="tooltip-row"><b>상세내용</b>: ${course.description}</div>` : ''}
        <div class="tooltip-row"><b>수행평가기준</b>:<br>${performanceCriteria.fullText.replace(/, /g, '<br>')}</div>
    `;
}

// --- 변경이력 팝업 하이라이트 함수들 ---
function highlightChangeHistoryItem(courseId) {
    // 변경이력 패널이 열려있는지 확인
    const changeHistoryPanel = document.getElementById('changeHistoryPanel');
    if (!changeHistoryPanel || changeHistoryPanel.style.display === 'none') {
        return;
    }
    
    // 변경이력 리스트 가져오기
    const panelList = document.getElementById('changeHistoryPanelList');
    if (!panelList) return;
    
    // 현재 diff summary 가져오기
    const diffSummary = getCurrentDiffSummary();
    if (!diffSummary || diffSummary.length === 0) return;
    
    // 해당 courseId와 일치하는 항목 찾기
    const historyItems = panelList.querySelectorAll('li');
    historyItems.forEach((item, index) => {
        const entry = diffSummary[index];
        if (entry && entry.course && entry.course.id === courseId) {
            // 하이라이트 적용
            item.classList.add('highlighted-history-item');
            item.style.backgroundColor = '#fff3cd';
            item.style.border = '2px solid #ffc107';
            item.style.borderRadius = '4px';
            item.style.padding = '8px';
            item.style.transition = 'all 0.3s ease';
            
            // 스크롤하여 해당 항목이 보이도록
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}

function removeChangeHistoryHighlight() {
    // 변경이력 패널의 모든 하이라이트 제거
    const panelList = document.getElementById('changeHistoryPanelList');
    if (!panelList) return;
    
    const highlightedItems = panelList.querySelectorAll('.highlighted-history-item');
    highlightedItems.forEach(item => {
        item.classList.remove('highlighted-history-item');
        item.style.backgroundColor = '';
        item.style.border = '';
        item.style.borderRadius = '';
        item.style.padding = '';
    });
}

// --- 기존 코드(createCourseBlock 등) 아래에 유지 ---

// 교과목 블록 드래그 시작
function handleCourseBlockDragStart(e) {
    // 수정모드가 아닌 경우 드래그 방지
    // 현재 활성화된 탭에 따라 적절한 수정모드 버튼 확인
    const curriculumEditModeButton = document.getElementById('editModeToggleCurriculum');
    const commonValuesEditModeButton = document.getElementById('editModeToggleCommonValues');
    
    const isCurriculumEditMode = curriculumEditModeButton && curriculumEditModeButton.classList.contains('active');
    const isCommonValuesEditMode = commonValuesEditModeButton && commonValuesEditModeButton.classList.contains('active');
    
    if (!isCurriculumEditMode && !isCommonValuesEditMode) {
        e.preventDefault();
        return;
    }
    
    // 드래그 시작 시 기존 placeholder 정리
    clearAllPlaceholders();
    
    const courseName = e.target.dataset.courseName;
    e.dataTransfer.setData('text/plain', courseName);
    e.target.classList.add('dragging');
    
    // 드래그 중인 교과목 데이터를 전역 변수에 저장
    const course = courses.find(c => c.courseName === courseName);
    if (course) {
        currentDraggedData = { type: 'course', course: course };
    }
    isCourseBlockDragging = true; // 드래그 시작 시 플래그 true
    
    // 드래그 시작 시 현재 DOM 순서 로그
    const blockWrap = e.target.closest('.block-wrap');
    if (blockWrap) {
        const currentOrder = Array.from(blockWrap.querySelectorAll('.course-block:not(.ghost):not(.deleted)'))
            .map(block => block.dataset.courseName);
    }
    
    
    // [추가] VALUE1,2,3 셀에서 드래그 시작 시 삭제 ZONE 표시 및 셀 정보 저장
    const courseBlock = e.target.closest('.course-block');
    if (courseBlock) {
        const parentCell = courseBlock.closest('td');
        if (parentCell && parentCell.id && parentCell.id.includes('-value')) {
            // 드래그 시작한 셀 정보 저장
            const cellId = parentCell.id;
            const idParts = cellId.replace('commonValues-cell-', '').split('-');
            draggedFromCell = {
                subjectType: idParts[0],
                valueKey: idParts[1] // value1, value2, value3
            };
            showDeleteZone();
        }
    }
}

// 교과목 블록 드래그 종료
function handleCourseBlockDragEnd(e) {
    // [추가] 드래그 종료 시 삭제 ZONE 숨기기 및 셀 정보 초기화
    hideDeleteZone();
    draggedFromCell = null;
    currentDraggedData = null; // 드래그 데이터 초기화
    
    e.target.classList.remove('dragging');
    isCourseBlockDragging = false; // 드래그 종료 시 플래그 false
    window.hideCourseTooltip(); // 혹시 남아있을 툴팁 제거
    
    // 드래그 종료 시 모든 placeholder 정리
    clearAllPlaceholders();
    
    // 모든 미리보기 효과 제거
    document.querySelectorAll('.block-wrap').forEach(wrap => {
        clearBlockWrapPreview(wrap);
    });
    
    // 드래그 종료 시 최종 DOM 순서 로그
    const blockWrap = e.target.closest('.block-wrap');
    if (blockWrap) {
        const finalOrder = Array.from(blockWrap.querySelectorAll('.course-block:not(.ghost):not(.deleted)'))
            .map(block => block.dataset.courseName);
    }
    
}

// 교과목 블록 편집
function editCourseBlock(course) {
    // 교과목 인덱스 찾기
    const courseIndex = courses.findIndex(c => c.id === course.id);
    if (courseIndex !== -1) {
        // editCourse 함수를 사용하여 모달 열기
        editCourse(courseIndex);
    } else {
        // id로 찾지 못한 경우 courseName으로 찾기
        const fallbackIndex = courses.findIndex(c => c.courseName === course.courseName);
        if (fallbackIndex !== -1) {
            editCourse(fallbackIndex);
        } else {
            alert('교과목을 찾을 수 없습니다.');
        }
    }
}

// 모달에서 교과목 삭제
function deleteCourseFromModal() {
    const courseName = document.querySelector('input[name="courseName"]').value;
    const courseIndex = courses.findIndex(c => c.courseName === courseName);
    
    if (courseIndex !== -1) {
        if (confirm(`"${courseName}" 교과목을 삭제하시겠습니까?`)) {
            // 공통가치대응 표의 셀 데이터 보존
            const currentCommonValuesData = collectCommonValuesTableData();
            
            // 변경이력 기록 추가
            addChangeHistory('삭제', courseName, []);
            courses.splice(courseIndex, 1);
            
            // 공통가치대응 표의 셀 데이터 복원
            commonValuesCellTexts = currentCommonValuesData;
            
            // 표들 다시 렌더링
            renderCurriculumTable();
            renderCourses();
            renderMatrix();
            renderCommonValuesTable(); // 공통가치대응 탭도 즉시 갱신
            updateStats();
            
            // 모달 닫기
            closeModal();
            
            showToast('교과목이 삭제되었습니다.');
            renderChangeHistoryPanel();
            renderCurriculumTable();
            
            // 화살표 즉시 업데이트
            setTimeout(() => {
                const movedCoursesForGhost = getMovedCoursesForGhost();
                drawMoveArrows(movedCoursesForGhost);
            }, 10);
        }
    } else {
        alert('삭제할 교과목을 찾을 수 없습니다.');
    }
}

// 이수모형 드롭 영역 설정
function setupCurriculumDropZones() {
    const cells = document.querySelectorAll('[id^="cell-"]');
    
    cells.forEach(cell => {
        cell.addEventListener('dragover', handleCurriculumDragOver);
        cell.addEventListener('drop', handleCurriculumDrop);
    });
    
    // 기술분야 특별 드롭존 설정
    const techDropZones = document.querySelectorAll('#curriculum td[id*="-구조-"], #curriculum td[id*="-환경-"], #curriculum td[id*="-시공-"], #curriculum td[id*="-디지털-"]');
    techDropZones.forEach(zone => {
        zone.addEventListener('dragover', handleTechDragOver);
        zone.addEventListener('drop', handleTechDrop);
        zone.addEventListener('dragenter', handleTechDragEnter);
        zone.addEventListener('dragleave', handleTechDragLeave);
    });
}

// 드래그 오버 처리
function handleCurriculumDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

// 드롭 처리
function handleCurriculumDrop(e) {
    e.preventDefault();
    
    // 수정모드가 아닌 경우 드롭 방지
    const editModeButton = document.getElementById('editModeToggleCurriculum');
    const isEditMode = editModeButton && editModeButton.classList.contains('active');
    
    if (!isEditMode) {
        return;
    }
    
    const courseName = e.dataTransfer.getData('text/plain');
    const course = courses.find(c => c.courseName === courseName);
    
    if (!course) return;
    
    // 셀 ID에서 속성 추출
    const cellId = e.target.closest('[id^="cell-"]').id;
    const cellInfo = cellId.split('-'); // 예: ["cell", "전공필수", "설계", "3", "2"]
    let changes = [];
    if (cellInfo.length >= 5) {
        // type, category, year, semester
        const type = cellInfo[1]; // 전공필수/전공선택/교양 등
        let category = cellInfo[2];
        const year = cellInfo[3];
        const semester = cellInfo[4];

        // '기타' 또는 '이론' 셀은 category, techField, isRequired에 영향을 주지 않음
        if (category !== '기타' && category !== '이론') {
            // [명확화] 교양필수 행에 드롭된 경우 필수여부를 무조건 '필수'로 변경
            if (type === '교양필수') {
                if (course.isRequired !== '필수') {
                    const oldIsRequired = course.isRequired;
                    course.isRequired = '필수';
                    changes.push({field: '필수여부', before: oldIsRequired, after: '필수'});
                }
            } else if (type === '전공필수') {
                if (course.isRequired !== '필수') {
                    const oldIsRequired = course.isRequired;
                    course.isRequired = '필수';
                    changes.push({field: '필수여부', before: oldIsRequired, after: '필수'});
                }
            } else {
                if (course.isRequired !== '선택') {
                    const oldIsRequired = course.isRequired;
                    course.isRequired = '선택';
                    changes.push({field: '필수여부', before: oldIsRequired, after: '선택'});
                }
            }

            // 카테고리/기술분야
            const oldCategory = course.category;
            const oldTechField = course.techField;
            if (["설계", "기술", "실무", "건축적사고", "교양"].includes(category)) {
                course.category = category;
                if (oldCategory !== course.category) {
                    changes.push({field: '구분', before: oldCategory, after: course.category});
                }
                // 기술분야 초기화
                if (category !== '기술' && course.techField) {
                    changes.push({field: '기술분야', before: oldTechField, after: ''});
                    delete course.techField;
                }
            } else if (["구조", "환경", "시공", "디지털"].includes(category)) {
                course.category = '기술';
                if (oldCategory !== '기술') {
                    changes.push({field: '구분', before: oldCategory, after: '기술'});
                }
                course.techField = category;
                if (oldTechField !== category) {
                    changes.push({field: '기술분야', before: oldTechField, after: category});
                }
            }

            // 교양 처리
            if (type.startsWith('교양')) {
                const oldCategory2 = course.category;
                course.category = '교양';
                if (oldCategory2 !== '교양') {
                    changes.push({field: '구분', before: oldCategory2, after: '교양'});
                }
            }
        } else {
            // [추가] 이론 또는 기타 행에 드롭된 경우 필수여부를 무조건 '선택'으로 변경
            if (course.isRequired !== '선택') {
                const oldIsRequired = course.isRequired;
                course.isRequired = '선택';
                changes.push({field: '필수여부', before: oldIsRequired, after: '선택'});
            }
        }
        // 학년학기
        const newYearSemester = `${year}-${semester}`;
        const oldYearSemester = course.yearSemester;
        if (oldYearSemester !== newYearSemester) {
            changes.push({field: '학년학기', before: oldYearSemester, after: newYearSemester});
            course.yearSemester = newYearSemester;
        }
    }
    // 기타 행 드롭 여부 판별
    const 기타행매치 = cellId.match(/^cell-전공선택-기타-(\d+)-(\d+)$/);
    if (기타행매치) {
        course.forceCurriculumRow = '기타';
    } else if (course.forceCurriculumRow) {
        delete course.forceCurriculumRow;
    }
    // 변경이력 기록
    if (changes.length > 0) {
        addChangeHistory('수정', course.courseName, changes);
        // [추가] 변경이력 팝업(토스트) 알림
        const changeMsg = `교과목 "${course.courseName}" 속성 변경됨:\n` + changes.map(c => `- ${c.field}: ${c.before} → ${c.after}`).join('\n');
        showToast(changeMsg);
    }
    // 표 다시 렌더링
    renderCurriculumTable();
    renderCourses();
    renderMatrix();
    renderChangeHistoryPanel();
    // 화살표 즉시 업데이트
    setTimeout(() => {
        const movedCoursesForGhost = getMovedCoursesForGhost();
        drawMoveArrows(movedCoursesForGhost);
    }, 10);
}

// 기술분야 드래그 앤 드롭 처리 함수들
function handleTechDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // 기술과목인지 확인
    const courseName = e.dataTransfer.getData('text/plain');
    const course = courses.find(c => c.courseName === courseName);
    
    if (course && course.category === '기술') {
        e.target.style.backgroundColor = '#e3f2fd';
        e.target.style.border = '2px dashed #1976d2';
    }
}

function handleTechDragEnter(e) {
    e.preventDefault();
    
    const courseName = e.dataTransfer.getData('text/plain');
    const course = courses.find(c => c.courseName === courseName);
    
    if (course && course.category === '기술') {
        e.target.style.backgroundColor = '#e3f2fd';
        e.target.style.border = '2px dashed #1976d2';
    }
}

function handleTechDragLeave(e) {
    e.target.style.backgroundColor = '';
    e.target.style.border = '';
}

function handleTechDrop(e) {
    e.preventDefault();
    
    // 수정모드가 아닌 경우 드롭 방지
    const editModeButton = document.getElementById('editModeToggleCurriculum');
    const isEditMode = editModeButton && editModeButton.classList.contains('active');
    
    if (!isEditMode) {
        return;
    }
    
    const courseName = e.dataTransfer.getData('text/plain');
    const course = courses.find(c => c.courseName === courseName);
    
    if (!course || course.category !== '기술') {
        e.target.style.backgroundColor = '';
        e.target.style.border = '';
        return;
    }
    
    // 셀 ID에서 기술분야와 학년-학기 정보 추출
    const cellId = e.target.closest('[id^="cell-"]').id;
    const match = cellId.match(/cell-.*?-(구조|환경|시공|디지털)-(\d+)-(\d+)/);
    
    if (match) {
        const [, techField, year, semester] = match;
        const newYearSemester = `${year}-${semester}`;
        const oldYearSemester = course.yearSemester;
        
        // 기술분야별 적절한 셀에 배치
        if (oldYearSemester !== newYearSemester) {
            // 변경 이력 기록
            addChangeHistory('수정', course.courseName, [
                {field: '학년학기', before: oldYearSemester, after: newYearSemester},
                {field: '기술분야', before: '일반', after: techField}
            ]);
        }
        
        // 기술분야별 과목 분류
        classifyTechCourse(course, techField);
        
        // 교과목의 학년-학기 정보 업데이트
        course.yearSemester = newYearSemester;
        
        // 표 다시 렌더링
        renderCurriculumTable();
        // 교과목 관리 테이블도 업데이트
        renderCourses();
        // 수행평가매트릭스도 업데이트
        renderMatrix();
        
        renderChangeHistoryPanel();
        
        // 화살표 즉시 업데이트
        setTimeout(() => {
            const movedCoursesForGhost = getMovedCoursesForGhost();
            drawMoveArrows(movedCoursesForGhost);
        }, 10);
        
        // 스타일 초기화
        e.target.style.backgroundColor = '';
        e.target.style.border = '';
    }
}

// 기술과목 분류 함수
function classifyTechCourse(course, techField) {
    // 기술과목들을 기술분야별로 분류
    const techCourseClassification = {
        '구조': ['건축구조의이해', '건축구조디자인'],
        '환경': ['건축환경계획', '건축설비계획'],
        '시공': ['건축재료와응용', '건축시공학개론'],
        '디지털': ['빌딩시스템']
    };
    
    // 과목이 해당 기술분야에 속하는지 확인
    if (techCourseClassification[techField] && techCourseClassification[techField].includes(course.courseName)) {
        course.techField = techField;
    } else {
        // 기본적으로는 구조분야로 분류 (필요시 수정)
        course.techField = techField;
    }
}

// --- 셀 내부 블럭 수동 정렬 기능 ---
function setupBlockWrapDragEvents() {
    // 기존 이벤트 리스너 제거 (중복 방지)
    document.querySelectorAll('.block-wrap').forEach(wrap => {
        wrap.removeEventListener('dragover', handleBlockWrapDragOver);
        wrap.removeEventListener('dragleave', handleBlockWrapDragLeave);
        wrap.removeEventListener('drop', handleBlockWrapDrop);
    });
    
    // 새로운 이벤트 리스너 추가
    document.querySelectorAll('.block-wrap').forEach(wrap => {
        wrap.addEventListener('dragover', handleBlockWrapDragOver);
        wrap.addEventListener('dragleave', handleBlockWrapDragLeave);
        wrap.addEventListener('drop', handleBlockWrapDrop);
    });
}
// block-wrap 드래그 오버 - 시각적 인디케이터만 표시 (셀 크기 변경 없음)
function handleBlockWrapDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    try {
        // 현재 드래그 중인 블록 확인
        const draggingBlock = document.querySelector('.course-block.dragging');
        if (!draggingBlock) return;
        
        // blockWrap 유효성 검사
        const blockWrap = e.currentTarget;
        if (!blockWrap || !blockWrap.isConnected) return;
        
        // 타겟 블록 안전하게 가져오기
        const targetBlock = e.target?.closest?.('.course-block');
        
        // 드래그 인디케이터 생성 또는 가져오기 (DOM에 영향 없는 absolute positioning)
        let previewIndicator = document.querySelector('.drag-preview-indicator');
        if (!previewIndicator) {
            previewIndicator = document.createElement('div');
            previewIndicator.className = 'drag-preview-indicator';
            previewIndicator.style.cssText = `
                position: fixed;
                height: 3px;
                background: #2196f3;
                width: 100%;
                z-index: 10000;
                pointer-events: none;
                transition: all 0.2s ease;
                box-shadow: 0 0 8px rgba(33, 150, 243, 0.6);
                display: none;
                border-radius: 2px;
            `;
            document.body.appendChild(previewIndicator);
        }
        
        // 드롭 위치를 계산하여 인디케이터 위치만 업데이트
        if (targetBlock && targetBlock.parentNode && targetBlock !== draggingBlock && blockWrap.contains(targetBlock)) {
            const rect = targetBlock.getBoundingClientRect();
            const mouseY = e.clientY;
            const blockCenterY = rect.top + rect.height / 2;
            const dropPosition = mouseY < blockCenterY ? 'before' : 'after';
            
            // 인디케이터 위치 설정 (fixed positioning 사용)
            if (dropPosition === 'before') {
                previewIndicator.style.top = (rect.top - 2) + 'px';
            } else {
                previewIndicator.style.top = (rect.bottom - 1) + 'px';
            }
            previewIndicator.style.left = rect.left + 'px';
            previewIndicator.style.width = rect.width + 'px';
            previewIndicator.style.display = 'block';
            
            // 드롭 위치 정보를 데이터 속성으로 저장 (실제 드롭 시 사용)
            blockWrap.dataset.dropTarget = targetBlock.dataset.courseId;
            blockWrap.dataset.dropPosition = dropPosition;
            
            // 타겟 블록에 시각적 강조 효과 (선택적)
            targetBlock.style.opacity = '0.7';
            targetBlock.style.transition = 'opacity 0.2s ease';
            
        } else if (blockWrap && !targetBlock) {
            // 빈 영역에 드래그 중 - 맨 끝에 추가될 것임을 표시
            const lastBlock = blockWrap.querySelector('.course-block:last-child');
            if (lastBlock) {
                const rect = lastBlock.getBoundingClientRect();
                previewIndicator.style.top = (rect.bottom - 1) + 'px';
                previewIndicator.style.left = rect.left + 'px';
                previewIndicator.style.width = rect.width + 'px';
                previewIndicator.style.display = 'block';
            } else {
                // 셀이 비어있는 경우
                const cellRect = blockWrap.getBoundingClientRect();
                previewIndicator.style.top = cellRect.top + 'px';
                previewIndicator.style.left = cellRect.left + 'px';
                previewIndicator.style.width = cellRect.width + 'px';
                previewIndicator.style.display = 'block';
            }
            
            blockWrap.dataset.dropTarget = 'end';
            blockWrap.dataset.dropPosition = 'append';
        }
        
        // 기존 초기화 플래그 설정 (드래그 종료 시 정리용)
        blockWrap.dataset.initialized = 'true';
        
    } catch (error) {
        console.error('Drag over error:', error);
        clearAllPlaceholders();
    }
}

// block-wrap 드래그 리브
function handleBlockWrapDragLeave(e) {
    try {
        const blockWrap = e.currentTarget;
        if (!blockWrap || !blockWrap.isConnected) return;
        
        const relatedTarget = e.relatedTarget;
        
        // block-wrap을 완전히 벗어났을 때만 처리
        if (!blockWrap.contains(relatedTarget)) {
            // 드롭 위치 데이터 초기화
            delete blockWrap.dataset.dropTarget;
            delete blockWrap.dataset.dropPosition;
            
            // 인디케이터 숨기기
            const indicator = document.querySelector('.drag-preview-indicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
            
            // 타겟 블록 스타일 초기화
            blockWrap.querySelectorAll('.course-block').forEach(block => {
                block.style.opacity = '';
                block.style.transition = '';
            });
            
            clearBlockWrapPreview(blockWrap);
        }
    } catch (error) {
        console.error('Drag leave error:', error);
        clearAllPlaceholders();
    }
}

// 미리보기 효과 제거 함수 - 밀림 효과용 (깜박임 방지)
function clearBlockWrapPreview(blockWrap) {
    if (!blockWrap || !blockWrap.isConnected) return;
    
    try {
        // 프리뷰 블럭 제거
        const previewBlock = blockWrap.querySelector('.drag-preview-block');
        if (previewBlock && previewBlock.parentNode) {
            previewBlock.remove();
        }
        
        // 모든 블럭의 스타일 초기화
        const blocks = blockWrap.querySelectorAll('.course-block');
        blocks.forEach(block => {
            if (block && block.isConnected) {
                block.style.transform = '';
                block.style.transition = '';
                block.style.boxShadow = '';
                block.style.opacity = '';
                block.style.border = '';
                block.style.background = '';
            }
        });
        
        // 초기화 플래그 제거
        delete blockWrap.dataset.initialized;
        
        // 셀 하이라이트 제거
        const cell = blockWrap.closest('td');
        if (cell) {
            cell.classList.remove('cell-highlight');
            cell.style.background = '';
            cell.style.border = '';
        }
        
    } catch (error) {
        console.error('Clear preview error:', error);
    }
}

// block-wrap 드롭 (셀 내부 순서 변경)
function handleBlockWrapDrop(e) {
    e.preventDefault();
    
    try {
        const draggingBlock = document.querySelector('.course-block.dragging');
        if (!draggingBlock) return;
        
        const blockWrap = e.currentTarget;
        if (!blockWrap || !blockWrap.isConnected) return;
        
        // 저장된 드롭 위치 정보 가져오기
        const dropTargetId = blockWrap.dataset.dropTarget;
        const dropPosition = blockWrap.dataset.dropPosition;
        
        if (dropTargetId === 'end') {
            // 맨 끝에 추가
            blockWrap.appendChild(draggingBlock);
        } else if (dropTargetId) {
            // 특정 위치에 삽입
            const targetBlock = blockWrap.querySelector(`[data-course-id="${dropTargetId}"]`);
            if (targetBlock) {
                if (dropPosition === 'before') {
                    blockWrap.insertBefore(draggingBlock, targetBlock);
                } else {
                    const nextSibling = targetBlock.nextElementSibling;
                    if (nextSibling && nextSibling.classList.contains('course-block')) {
                        blockWrap.insertBefore(draggingBlock, nextSibling);
                    } else {
                        blockWrap.appendChild(draggingBlock);
                    }
                }
            }
        } else {
            // 폴백: 저장된 위치 정보가 없는 경우 기존 로직 사용
            const targetBlock = e.target.closest('.course-block');
            if (targetBlock && targetBlock !== draggingBlock && blockWrap.contains(targetBlock)) {
                const rect = targetBlock.getBoundingClientRect();
                const mouseY = e.clientY;
                const blockCenterY = rect.top + rect.height / 2;
                const dropPos = mouseY < blockCenterY ? 'before' : 'after';
                
                if (dropPos === 'before') {
                    blockWrap.insertBefore(draggingBlock, targetBlock);
                } else {
                    const nextSibling = targetBlock.nextElementSibling;
                    if (nextSibling && nextSibling.classList.contains('course-block')) {
                        blockWrap.insertBefore(draggingBlock, nextSibling);
                    } else {
                        blockWrap.appendChild(draggingBlock);
                    }
                }
            }
        }
        
        // 드롭 완료 후 부드러운 애니메이션 적용
        draggingBlock.style.animation = 'dropAnimation 0.3s ease';
        setTimeout(() => {
            draggingBlock.style.animation = '';
        }, 300);
        
        // courses 배열 순서 동기화
        updateCoursesOrderFromDOM();
        
    } catch (error) {
        console.error('Drop error:', error);
    } finally {
        // 드롭 완료 후 모든 placeholder 정리
        clearAllPlaceholders();
    }
}

// DOM 순서대로 courses 배열 재정렬
function updateCoursesOrderFromDOM() {
    const newOrder = [];
    const processedIds = new Set();
    
    // 모든 셀의 block-wrap을 순회하며, DOM 순서대로 courses 배열 재정렬
    document.querySelectorAll('.block-wrap').forEach(wrap => {
        const blocks = wrap.querySelectorAll('.course-block:not(.ghost):not(.deleted)');
        blocks.forEach(block => {
            const courseId = block.dataset.courseId;
            if (courseId && !processedIds.has(courseId)) {
                const course = courses.find(c => c.id === courseId);
                if (course) {
                    newOrder.push(course);
                    processedIds.add(courseId);
                }
            }
        });
    });
    
    // 기존 courses에 있지만 DOM에 없는 교과목(숨겨진 등)도 유지
    courses.forEach(course => { 
        if (!processedIds.has(course.id)) {
            newOrder.push(course);
        }
    });
    
    // courses 배열 업데이트
    const oldOrder = courses.map(c => c.id);
    courses = newOrder;
    const newOrderIds = courses.map(c => c.id);
}

// 이수모형 폰트 사이즈 조정 기능
let currentCurriculumFontSize = parseInt(localStorage.getItem('currentCurriculumFontSize')) || 14;

function increaseCurriculumFontSize() {
    if (currentCurriculumFontSize < 20) {
        currentCurriculumFontSize += 1;
        updateCurriculumFontSize();
    }
}

function decreaseCurriculumFontSize() {
    if (currentCurriculumFontSize > 10) {
        currentCurriculumFontSize -= 1;
        updateCurriculumFontSize();
    }
}

function updateCurriculumFontSize() {
    const curriculumTable = document.querySelector('.curriculum-table');
    const fontDisplay = document.getElementById('curriculum-font-size-display');
    
    if (curriculumTable) {
        curriculumTable.style.fontSize = currentCurriculumFontSize + 'px';
        // 헤더와 셀의 폰트 사이즈도 업데이트
        const headers = curriculumTable.querySelectorAll('th');
        const cells = curriculumTable.querySelectorAll('td');
        
        headers.forEach(header => {
            header.style.fontSize = currentCurriculumFontSize + 'px';
        });
        
        cells.forEach(cell => {
            cell.style.fontSize = currentCurriculumFontSize + 'px';
        });
        
        // 교과목 블록의 폰트 사이즈도 업데이트
        const courseBlocks = curriculumTable.querySelectorAll('.course-block');
        courseBlocks.forEach(block => {
            block.style.fontSize = currentCurriculumFontSize + 'px';
            
            // 블록 내부 텍스트 요소들의 폰트 사이즈도 업데이트
            const title = block.querySelector('.course-block-title');
            const info = block.querySelector('.course-block-info');
            const originalName = block.querySelector('.course-block-original-name');
            
            if (title) {
                title.style.fontSize = currentCurriculumFontSize + 'px';
            }
            if (info) {
                info.style.fontSize = (currentCurriculumFontSize - 2) + 'px'; // 정보 텍스트는 약간 작게
            }
            if (originalName) {
                originalName.style.fontSize = (currentCurriculumFontSize - 3) + 'px'; // 이전 이름은 더 작게
            }
        });
    }
    
    if (fontDisplay) {
        fontDisplay.textContent = currentCurriculumFontSize + 'px';
    }
    
    // localStorage에 저장
    // localStorage.setItem('currentCurriculumFontSize', currentCurriculumFontSize.toString());
    
    // 화살표 즉시 업데이트
    setTimeout(() => {
        const movedCoursesForGhost = getMovedCoursesForGhost();
        drawMoveArrows(movedCoursesForGhost);
    }, 10);
}

// 교과목 블록의 드래그 가능 여부 업데이트
function updateCourseBlockDraggable(block) {
    // 현재 활성화된 탭에 따라 적절한 수정모드 확인
    const curriculumEditModeButton = document.getElementById('editModeToggleCurriculum');
    const commonValuesEditModeButton = document.getElementById('editModeToggleCommonValues');
    
    const isCurriculumEditMode = curriculumEditModeButton && curriculumEditModeButton.classList.contains('active');
    const isCommonValuesEditMode = commonValuesEditModeButton && commonValuesEditModeButton.classList.contains('active');
    
    // 둘 중 하나라도 수정모드이면 드래그 가능
    block.draggable = isCurriculumEditMode || isCommonValuesEditMode;
}

// 모든 교과목 블록의 드래그 가능 여부 업데이트 (삭제/ghost 블록은 드래그 불가능)
function updateAllCourseBlocksDraggable() {
    const courseBlocks = document.querySelectorAll('.course-block');
    courseBlocks.forEach(block => {
        // 삭제된 블록이나 ghost 블록은 드래그 불가능
        if (block.classList.contains('deleted')) {
            block.draggable = false;
            block.style.cursor = 'not-allowed';
        } else if (block.classList.contains('ghost')) {
            block.draggable = false;
            block.style.cursor = 'default';
        } else {
        updateCourseBlockDraggable(block);
        }
    });
}

// 이수모형 탭 수정모드 토글
function toggleEditModeCurriculum() {
    isEditModeCurriculum = !isEditModeCurriculum;
    
    const button = document.getElementById('editModeToggleCurriculum');
    const textSpan = document.getElementById('editModeTextCurriculum');
    
    if (isEditModeCurriculum) {
        // 수정모드 활성화
        button.classList.add('active');
        textSpan.textContent = '수정모드';
    } else {
        // 수정모드 비활성화
        button.classList.remove('active');
        textSpan.textContent = '일반모드';
    }
    
    // 버전 버튼 토글
    const versionButtons = document.querySelectorAll('.curriculum-version-btn');
    versionButtons.forEach(btn => {
        btn.style.display = isEditModeCurriculum ? '' : 'none';
    });
    
    // 교과목 추가 버튼 토글
    const addButton = document.querySelector('.curriculum-add-btn');
    if (addButton) {
        addButton.style.display = isEditModeCurriculum ? '' : 'none';
    }
    
    // 제목 편집 가능 여부 설정
    setCurriculumTitleEditable(isEditModeCurriculum);
    
    // 셀 편집 가능 여부 설정
    if (isEditModeCurriculum) {
        enableCurriculumCellEditing();
    } else {
        disableCurriculumCellEditing();
    }
    
    // 모든 교과목 블록의 드래그 가능 여부 업데이트
    updateAllCourseBlocksDraggable();
}

// 이수모형 전체 화면 토글
function toggleCurriculumFullscreen() {
    const curriculumContent = document.getElementById('curriculum');
    const fullscreenText = document.getElementById('curriculum-fullscreen-text');
    
    if (curriculumContent.classList.contains('fullscreen-active')) {
        curriculumContent.classList.remove('fullscreen-active');
        fullscreenText.textContent = '전체 화면';
    } else {
        curriculumContent.classList.add('fullscreen-active');
        fullscreenText.textContent = '화면 축소';
    }
}

// 이수모형 Excel 내보내기



// ===== 전체 버전 관리 함수들 =====

// 버전 표시 업데이트 함수
function updateVersionDisplay() {
    const versionElement = document.getElementById('currentVersion');
    if (versionElement) {
        versionElement.textContent = currentVersion || '기본';
    }
    
    // 매트릭스 버전 텍스트도 업데이트
    const matrixVersionText = document.getElementById('matrixVersionText');
    if (matrixVersionText) {
        matrixVersionText.textContent = currentVersion || '기본';
    }
    
    console.log('현재 버전:', currentVersion);
}

// 모든 버전 데이터 로드
function loadAllVersions() {
    try {
        // 로컬 스토리지 사용 안 함 - 메모리에 있는 데이터만 사용
        // versions 객체는 이미 Firebase에서 로드되었거나 메모리에 있음
        
        // 버전이 하나도 없으면 기본 버전 생성
        if (!versions || Object.keys(versions).length === 0) {
            versions = {
                '기본': {
                    coursesTab: {
                        courses: [],
                        initialCourses: []
                    },
                    matrixTab: {
                        matrixData: {},
                        matrixTitleText: '수행평가 매트릭스',
                        matrixExtraTableData: {}
                    },
                    curriculumTab: {
                        curriculumCellTexts: {},
                        curriculumTitleText: '건축학전공 교과과정 이수모형 2025'
                    },
                    commonValuesTab: {
                        commonValuesCellTexts: {},
                        commonValuesCopiedBlocks: {},
                        commonValuesTitleText: '공통가치대응 매트릭스'
                    },
                    settings: {
                        designSettings: {},
                        changeHistory: []
                    },
                    metadata: {
                        description: '기본 버전',
                        saveDate: new Date().toISOString(),
                        timestamp: Date.now()
                    }
                }
            };
            currentVersion = '기본';
        }
        
        // Firebase에서 로드되지 않은 경우 최근 버전 자동 선택
        if (!currentVersion || currentVersion === '기본') {
            selectLatestVersion();
        }
        
        // 모든 버전 데이터에 대해 구조 검증 및 복구
        Object.keys(versions).forEach(vName => {
            const v = versions[vName];
            
            // 탭 구조로 변환되지 않은 이전 버전 데이터 처리
            if (!v.coursesTab && !v.matrixTab && !v.curriculumTab && !v.commonValuesTab) {
                versions[vName] = {
                    coursesTab: {
                        courses: v.courses || [],
                        initialCourses: v.initialCourses || []
                    },
                    matrixTab: {
                        matrixData: v.matrixData || {},
                        matrixTitleText: v.matrixTitleText || '',
                        matrixExtraTableData: v.matrixExtraTableData || {}
                    },
                    curriculumTab: {
                        curriculumTitleText: v.curriculumTitleText || '',
                        curriculumCellTexts: v.curriculumCellTexts || {},


                    },
                    commonValuesTab: {
                        commonValuesTitleText: v.commonValuesTitleText || '',
                        commonValuesCellTexts: v.commonValuesCellTexts || {},
                        commonValuesCopiedBlocks: v.commonValuesCopiedBlocks || {}
                    },
                    settings: {
                        designSettings: v.designSettings || {},
                        changeHistory: v.changeHistory || []
                    },
                    metadata: {
                        description: v.description || '',
                        saveDate: v.saveDate || new Date().toISOString(),
                        timestamp: v.timestamp || Date.now()
                    }
                };
            }
            
            // 필요한 속성이 없는 경우 초기화
            if (!versions[vName].coursesTab) versions[vName].coursesTab = {};
            if (!versions[vName].matrixTab) versions[vName].matrixTab = {};
            if (!versions[vName].curriculumTab) versions[vName].curriculumTab = {};
            if (!versions[vName].commonValuesTab) versions[vName].commonValuesTab = {};
            if (!versions[vName].settings) versions[vName].settings = {};
            if (!versions[vName].metadata) versions[vName].metadata = {};
        });
        
        updateCurrentVersionDisplay();
    } catch (error) {
        alert('버전 데이터 로드 중 오류가 발생했습니다.');
    }
}

// 현재 버전 표시 업데이트
function updateCurrentVersionDisplay() {
    const versionElement = document.getElementById('currentVersion');
    if (versionElement) {
        versionElement.textContent = currentVersion;
    }
    updateAllVersionLabels();
}

// 전체 데이터를 현재 버전으로 저장
function saveCurrentVersion() {
    // 버전 저장 직전에 항상 표의 모든 셀을 수집
    matrixExtraTableData = collectMatrixExtraTableData();
    
    const versionData = {
        // 1. 교과목 관리 탭
        coursesTab: {
            courses: courses,
            initialCourses: initialCourses
        },
        
        // 2. 수행평가 매트릭스 탭
        matrixTab: {
            matrixData: matrixData,
            matrixTitleText: tempMatrixData._newTitle || versions[currentVersion]?.matrixTab?.matrixTitleText || '수행평가 매트릭스',
            matrixExtraTableData: matrixExtraTableData
        },
        
        // 3. 이수모형 탭
        curriculumTab: {
            curriculumCellTexts: curriculumCellTexts,
            curriculumTitleText: tempCurriculumCellTexts._newTitle || versions[currentVersion]?.curriculumTab?.curriculumTitleText || '건축학전공 교과과정 이수모형'
        },
        
        // 4. 공통가치대응 탭
        commonValuesTab: {
            commonValuesCellTexts: commonValuesCellTexts,
            commonValuesCopiedBlocks: commonValuesCopiedBlocks,
            commonValuesTitleText: tempCommonValuesCellTexts._newTitle || versions[currentVersion]?.commonValuesTab?.commonValuesTitleText || '공통가치대응'
        },
        
        // 5. 공통 설정
        settings: {
            designSettings: designSettings,
            changeHistory: getCurrentDiffSummary()
        },
        
        // 6. 메타데이터
        metadata: {
            saveDate: new Date().toISOString(),
            timestamp: Date.now()
        }
    };
    
    versions[currentVersion] = versionData;
    // localStorage.setItem('uosVersions', JSON.stringify(versions));
    
    // Firebase에 저장
    saveDataToFirebase('versions', versions);
    saveDataToFirebase('currentVersion', currentVersion);
    
    showToast('현재 버전이 저장되었습니다.');
}
// 버전 저장/내보내기 모달 표시
function saveVersion() {
    const modal = document.getElementById('versionSaveModal');
    if (modal) {
        modal.style.display = 'block';
        
        // 현재 날짜/시간을 년월일_시:분:초 형식으로 포맷팅
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        const defaultName = `${year}${month}${day}_${hours}:${minutes}:${seconds}`;
        
        // 현재 데이터 요약 정보 생성
        let courseCount = Array.isArray(courses) ? courses.length : 0;
        let matrixDataCount = typeof matrixData === 'object' ? Object.keys(matrixData).length : 0;
        let curriculumCellCount = typeof curriculumCellTexts === 'object' ? Object.keys(curriculumCellTexts).length : 0;
        let commonValuesCount = typeof commonValuesCellTexts === 'object' ? Object.keys(commonValuesCellTexts).length : 0;
        
        // 요약 정보 표시
        const summaryElement = document.getElementById('versionSaveSummary');
        if (summaryElement) {
            const formattedDate = `${year}${month}${day}_${hours}:${minutes}:${seconds}`;
            summaryElement.innerHTML = `
                <div class="alert alert-info">
                    <strong>저장할 데이터 요약:</strong><br>
                    - 교과목: ${courseCount}개<br>
                    - 매트릭스 데이터: ${matrixDataCount}개<br>
                    - 이수모형 셀: ${curriculumCellCount}개<br>
                    - 공통가치 셀: ${commonValuesCount}개<br>
                    <small>현재 시간: ${formattedDate}</small>
                </div>
            `;
        }
        
        // 입력 필드 초기화
        document.getElementById('versionNameInput').value = defaultName;
        document.getElementById('versionDescriptionInput').value = '';
        

        
        // 현재 버전 표시
        const currentVersionElement = document.getElementById('currentVersionDisplay');
        if (currentVersionElement) {
            currentVersionElement.textContent = currentVersion;
        }
    }
}

// 버전 저장 모달 닫기
function closeVersionSaveModal() {
    const modal = document.getElementById('versionSaveModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 버전 데이터 저장 (임시 저장소에서 실제 저장소로 이동)

async function saveVersionData(event) {
    event.preventDefault();


    
    const versionName = document.getElementById('versionNameInput').value.trim();
    const versionDescription = document.getElementById('versionDescriptionInput').value.trim();
    
    if (!versionName) {
        alert('버전 이름을 입력해주세요.');
        return;
    }
    
    if (versions[versionName] && !confirm(`'${versionName}' 버전이 이미 존재합니다. 덮어쓰시겠습니까?`)) {
            return;
        }
    
    try {
        // 임시 저장소의 데이터를 실제 저장소로 이동 (깊은 복사 적용)
        if (tempCourses.length > 0) {
            courses = JSON.parse(JSON.stringify(tempCourses));
            tempCourses = [];
        }
        
        // tempMatrixData 처리 - 비어있어도 현재 matrixData는 유지해야 함
        if (Object.keys(tempMatrixData).length > 0) {
            
            // 매트릭스 제목 변경사항은 버전 데이터에만 저장됨
            
            // tempMatrixData에서 제목 관련 속성들을 제외한 실제 matrixData만 추출
            const actualMatrixData = { ...tempMatrixData };
            delete actualMatrixData._titleChanged;
            delete actualMatrixData._oldTitle;
            delete actualMatrixData._newTitle;
            
            // 기존 matrixData와 병합 (tempMatrixData가 우선)
            matrixData = { ...matrixData, ...actualMatrixData };
            
            // --- 필터링 추가: courses에 없는 과목은 제외 ---
            const validCourseNames = new Set(courses.map(c => c.courseName));
            Object.keys(matrixData).forEach(name => {
                if (!validCourseNames.has(name)) {
                    delete matrixData[name];
                }
            });
            
            tempMatrixData = {};
        } else {
            // tempMatrixData가 비어있어도 현재 matrixData는 그대로 유지
            // courses에 있는 과목만 필터링
            const validCourseNames = new Set(courses.map(c => c.courseName));
            const filteredMatrixData = {};
            Object.keys(matrixData).forEach(name => {
                if (validCourseNames.has(name)) {
                    filteredMatrixData[name] = matrixData[name];
                }
            });
            matrixData = filteredMatrixData;
        }
        
        if (Object.keys(tempCurriculumCellTexts).length > 0) {
            // 이수모형 제목 변경사항은 버전 데이터에만 저장됨
            
            // tempCurriculumCellTexts에서 제목 관련 속성들을 제외한 실제 데이터만 추출
            const actualCurriculumData = { ...tempCurriculumCellTexts };
            delete actualCurriculumData._titleChanged;
            delete actualCurriculumData._oldTitle;
            delete actualCurriculumData._newTitle;
            
            // 임시 저장소와 현재 표 데이터를 병합
            const currentCurriculumData = collectCurriculumTableData();
            curriculumCellTexts = { ...currentCurriculumData, ...actualCurriculumData };
            tempCurriculumCellTexts = {};
        } else {
            // 임시 저장소에 데이터가 없으면 현재 표의 모든 셀 내용을 수집
            curriculumCellTexts = collectCurriculumTableData();
        }
        
        if (Object.keys(tempCommonValuesCellTexts).length > 0) {
            
            // 공통가치대응 제목 변경사항은 버전 데이터에만 저장됨
            
            // tempCommonValuesCellTexts에서 제목 관련 속성들을 제외한 실제 데이터만 추출
            const actualCommonValuesData = { ...tempCommonValuesCellTexts };
            delete actualCommonValuesData._titleChanged;
            delete actualCommonValuesData._oldTitle;
            delete actualCommonValuesData._newTitle;
            
            // 임시 저장소와 현재 표 데이터를 병합 (2차원 구조만 유지)
            const currentCommonValuesData = collectCommonValuesTableData();
            
            // 1차원 key 제거하고 2차원 구조만 유지
            const cleanedTempData = {};
            Object.entries(actualCommonValuesData).forEach(([key, value]) => {
                if (key.includes('-cell-') && key.includes('-value')) {
                    // 1차원 key는 무시 (예: "commonValues-cell-설계-value1")
                } else if (typeof value === 'object' && value !== null) {
                    // 2차원 구조는 유지 (예: {"설계": {"value1": "a"}})
                    cleanedTempData[key] = value;
                }
            });
            
            commonValuesCellTexts = { ...currentCommonValuesData, ...cleanedTempData };
            tempCommonValuesCellTexts = {};
        } else {
            // 임시 저장소에 데이터가 없으면 현재 표의 모든 셀 내용을 수집
            commonValuesCellTexts = collectCommonValuesTableData();
        }
        
        // 매트릭스 하부 표 데이터 처리
        if (Object.keys(tempMatrixExtraTableData).length > 0) {
            // 임시 저장소와 현재 표 데이터를 병합
            const currentTableData = collectMatrixExtraTableData();
            matrixExtraTableData = { ...currentTableData, ...tempMatrixExtraTableData };
            tempMatrixExtraTableData = {};
        } else {
            // 임시 저장소에 데이터가 없으면 현재 표의 모든 셀 내용을 수집
            matrixExtraTableData = collectMatrixExtraTableData();
        }
        
        // 깊은 복사를 통해 현재 상태의 독립적인 복사본 생성
    const versionData = {
            coursesTab: {
                courses: Array.isArray(courses) ? JSON.parse(JSON.stringify(courses)) : [],
                initialCourses: Array.isArray(initialCourses) ? JSON.parse(JSON.stringify(initialCourses)) : [],
                deletedCoursesData: typeof deletedCoursesData === 'object' ? JSON.parse(JSON.stringify(deletedCoursesData)) : {}
            },
            matrixTab: {
                matrixData: typeof matrixData === 'object' ? JSON.parse(JSON.stringify(matrixData)) : {},
                initialMatrixData: typeof initialMatrixData === 'object' ? JSON.parse(JSON.stringify(initialMatrixData)) : {},
        matrixTitleText: tempMatrixData._newTitle || versions[currentVersion]?.matrixTab?.matrixTitleText || '수행평가 매트릭스',
                matrixExtraTableData: typeof matrixExtraTableData === 'object' ? 
                    JSON.parse(JSON.stringify(matrixExtraTableData)) : {}
            },
            curriculumTab: {
                curriculumCellTexts: typeof curriculumCellTexts === 'object' ? 
                    JSON.parse(JSON.stringify(curriculumCellTexts)) : {},
                curriculumTitleText: tempCurriculumCellTexts._newTitle || versions[currentVersion]?.curriculumTab?.curriculumTitleText || '건축학전공 교과과정 이수모형'
            },
            commonValuesTab: {
                commonValuesCellTexts: typeof commonValuesCellTexts === 'object' ? 
                    JSON.parse(JSON.stringify(commonValuesCellTexts)) : {},
                commonValuesCopiedBlocks: typeof commonValuesCopiedBlocks === 'object' ? 
                    JSON.parse(JSON.stringify(commonValuesCopiedBlocks)) : {},
                extracurricularTexts: typeof extracurricularTexts === 'object' ? 
                    JSON.parse(JSON.stringify(extracurricularTexts)) : {},
                extracurricularBlocks: typeof extracurricularBlocks === 'object' ? 
                    JSON.parse(JSON.stringify(extracurricularBlocks)) : {},
                extracurricularMergedTexts: Array.isArray(extracurricularMergedTexts) ? 
                    JSON.parse(JSON.stringify(extracurricularMergedTexts)) : [],
                commonValuesTitleText: tempCommonValuesCellTexts._newTitle || versions[currentVersion]?.commonValuesTab?.commonValuesTitleText || '공통가치대응'
            },
            settings: {
                designSettings: typeof designSettings === 'object' ? 
                    JSON.parse(JSON.stringify(designSettings)) : {},
                changeHistory: Array.isArray(changeHistory) ? 
                    JSON.parse(JSON.stringify(changeHistory)) : [],
                tempMatrixChangeHistory: Array.isArray(tempMatrixChangeHistory) ? 
                    JSON.parse(JSON.stringify(tempMatrixChangeHistory)) : []
            },
            metadata: {
        description: versionDescription,
        saveDate: new Date().toISOString(),
                timestamp: Date.now()
            }
        };
        
        // 저장될 데이터 상태 로그
        
        // 버전 데이터 저장 (깊은 복사 적용)
        versions[versionName] = JSON.parse(JSON.stringify(versionData));
        
        // 로컬 스토리지에 저장 (용량 문제 방지를 위해 분할 저장)
        try {
    // localStorage.setItem('uosVersions', JSON.stringify(versions));
        } catch (storageError) {
            
            // 용량이 너무 크면 분할 저장 시도
            try {
                // 현재 버전만 따로 저장
                const singleVersionData = {};
                singleVersionData[versionName] = versions[versionName];
                // localStorage.setItem(`uosVersion_${versionName}`, JSON.stringify(singleVersionData));
                
                // 버전 목록만 저장
                const versionsList = Object.keys(versions);
                // localStorage.setItem('uosVersionsList', JSON.stringify(versionsList));
                
                alert('버전 데이터가 커서 분할 저장되었습니다.');
            } catch (splitError) {
                alert('버전 데이터가 너무 커서 저장에 실패했습니다. 불필요한 버전을 삭제해주세요.');
                return;
            }
        }
    
    currentVersion = versionName;
    
    // Firebase에 버전별로 개별 저장
    if (firebaseInitialized && isOnline) {
        try {
            // 새 버전 데이터를 Firebase에 개별 저장
            await saveDataToFirebase(`versions/${versionName}`, versionData);
            
            // 버전 목록 업데이트
            const versionList = Object.keys(versions);
            await saveDataToFirebase('versionList', versionList);
            
            // 현재 버전 정보 저장
            await saveDataToFirebase('currentVersion', currentVersion);
            
        } catch (error) {
            showToast('클라우드 저장에 실패했습니다. 로컬에만 저장되었습니다.');
        }
    }
        
        // 버전 저장 후 임시 변경이력 초기화
        tempMatrixChangeHistory = [];
        
        // UI 업데이트
        renderCourses();
        renderMatrix();
        renderCurriculumTable();
        // 셀 편집 중이 아닐 때만 테이블 렌더링
        if (!isCommonValuesCellEditing) {
            renderCommonValuesTable();
        }
        renderMatrixExtraTable();
        updateStats();
    updateCurrentVersionDisplay();
        renderVersionList();
        updateVersionNavigationButtons();
        renderChangeHistoryPanel();  // 변경이력 패널도 업데이트
    
    // 버전 저장 후 초기 매트릭스 데이터를 현재 상태로 업데이트 (파란점을 검은점으로 변경)
    initialMatrixData = JSON.parse(JSON.stringify(matrixData));
    
    showToast(`'${versionName}' 버전이 저장되었습니다.`);
        
    } catch (error) {
        alert('버전 저장 중 오류가 발생했습니다. 데이터가 너무 큽니다.');
        return;
    }
    
    closeVersionSaveModal();
}

// 전체 데이터를 현재 버전으로 저장 (임시 저장소에서 실제 저장소로 이동)
async function saveCurrentVersion() {
    // 임시 저장소의 데이터를 실제 저장소로 이동 (깊은 복사 적용)
    if (tempCourses.length > 0) {
        courses = JSON.parse(JSON.stringify(tempCourses));
        tempCourses = [];
    }
    
    if (Object.keys(tempMatrixData).length > 0) {
        
        // 매트릭스 제목 변경사항은 버전 데이터에만 저장됨
        
        // tempMatrixData에서 제목 관련 속성들을 제외한 실제 matrixData만 추출
        const actualMatrixData = { ...tempMatrixData };
        delete actualMatrixData._titleChanged;
        delete actualMatrixData._oldTitle;
        delete actualMatrixData._newTitle;
        
        // --- 필터링 추가: courses에 없는 과목은 제외 ---
        const validCourseNames = new Set(courses.map(c => c.courseName));
        Object.keys(actualMatrixData).forEach(name => {
            if (!validCourseNames.has(name)) {
                delete actualMatrixData[name];
            }
        });
        
        matrixData = JSON.parse(JSON.stringify(actualMatrixData));
        tempMatrixData = {};
    } else {
        // tempMatrixData가 비어있으면 현재 matrixData를 그대로 유지
        // 매트릭스 데이터는 삭제하지 않고 모두 보존
    }
    
    if (Object.keys(tempCurriculumCellTexts).length > 0) {
        // 이수모형 제목 변경사항은 버전 데이터에만 저장됨
        
        // tempCurriculumCellTexts에서 제목 관련 속성들을 제외한 실제 데이터만 추출
        const actualCurriculumData = { ...tempCurriculumCellTexts };
        delete actualCurriculumData._titleChanged;
        delete actualCurriculumData._oldTitle;
        delete actualCurriculumData._newTitle;
        
        // 임시 저장소와 현재 표 데이터를 병합
        const currentCurriculumData = collectCurriculumTableData();
        curriculumCellTexts = { ...currentCurriculumData, ...actualCurriculumData };
        tempCurriculumCellTexts = {};
    } else {
        // 임시 저장소에 데이터가 없으면 현재 표의 모든 셀 내용을 수집
        curriculumCellTexts = collectCurriculumTableData();
    }
    
            if (Object.keys(tempCommonValuesCellTexts).length > 0) {
            
            // 공통가치대응 제목 변경사항은 버전 데이터에만 저장됨
            
            // tempCommonValuesCellTexts에서 제목 관련 속성들을 제외한 실제 데이터만 추출
            const actualCommonValuesData = { ...tempCommonValuesCellTexts };
            delete actualCommonValuesData._titleChanged;
            delete actualCommonValuesData._oldTitle;
            delete actualCommonValuesData._newTitle;
            
            // 임시 저장소와 현재 표 데이터를 병합 (2차원 구조만 유지)
            const currentCommonValuesData = collectCommonValuesTableData();
            
            // 1차원 key 제거하고 2차원 구조만 유지
            const cleanedTempData = {};
            Object.entries(actualCommonValuesData).forEach(([key, value]) => {
                if (key.includes('-cell-') && key.includes('-value')) {
                    // 1차원 key는 무시 (예: "commonValues-cell-설계-value1")
                } else if (typeof value === 'object' && value !== null) {
                    // 2차원 구조는 유지 (예: {"설계": {"value1": "a"}})
                    cleanedTempData[key] = value;
                }
            });
            
            commonValuesCellTexts = { ...currentCommonValuesData, ...cleanedTempData };
            tempCommonValuesCellTexts = {};
        } else {
            // 임시 저장소에 데이터가 없으면 현재 표의 모든 셀 내용을 수집
            commonValuesCellTexts = collectCommonValuesTableData();
        }
    
    // 매트릭스 하부 안내 표 데이터 처리
    const collectedMatrixExtraData = collectMatrixExtraTableData();
    
    if (Object.keys(tempMatrixExtraTableData).length > 0) {
        // 임시 저장소와 병합
        const mergedMatrixExtraData = { ...collectedMatrixExtraData, ...tempMatrixExtraTableData };
        matrixExtraTableData = mergedMatrixExtraData;
        tempMatrixExtraTableData = {};
    } else {
        // 임시 저장소에 데이터가 없으면 수집한 데이터 사용
        matrixExtraTableData = collectedMatrixExtraData;
    }
    
    
    // 깊은 복사를 통해 현재 상태의 독립적인 복사본 생성
    const versionData = {
        // 1. 교과목 관리 탭
        coursesTab: {
            courses: Array.isArray(courses) ? JSON.parse(JSON.stringify(courses)) : [],
            initialCourses: Array.isArray(initialCourses) ? JSON.parse(JSON.stringify(initialCourses)) : []
        },
        
        // 2. 수행평가 매트릭스 탭
        matrixTab: {
            matrixData: typeof matrixData === 'object' ? JSON.parse(JSON.stringify(matrixData)) : {},
            matrixTitleText: tempMatrixData._newTitle || versions[currentVersion]?.matrixTab?.matrixTitleText || '수행평가 매트릭스',
            matrixExtraTableData: typeof matrixExtraTableData === 'object' ? 
                JSON.parse(JSON.stringify(matrixExtraTableData)) : {}
        },
        
        // 3. 이수모형 탭
        curriculumTab: {
            curriculumCellTexts: typeof curriculumCellTexts === 'object' ? 
                JSON.parse(JSON.stringify(curriculumCellTexts)) : {},
            curriculumTitleText: tempCurriculumCellTexts._newTitle || versions[currentVersion]?.curriculumTab?.curriculumTitleText || '건축학전공 교과과정 이수모형'
        },
        
        // 4. 공통가치대응 탭
        commonValuesTab: {
            commonValuesCellTexts: typeof commonValuesCellTexts === 'object' ? 
                JSON.parse(JSON.stringify(commonValuesCellTexts)) : {},
            commonValuesCopiedBlocks: typeof commonValuesCopiedBlocks === 'object' ? 
                JSON.parse(JSON.stringify(commonValuesCopiedBlocks)) : {},
            extracurricularMergedTexts: Array.isArray(extracurricularMergedTexts) ? 
                JSON.parse(JSON.stringify(extracurricularMergedTexts)) : [],
            commonValuesTitleText: tempCommonValuesCellTexts._newTitle || versions[currentVersion]?.commonValuesTab?.commonValuesTitleText || '공통가치대응'
        },
        
        // 공통 설정
        settings: {
            designSettings: typeof designSettings === 'object' ? 
                JSON.parse(JSON.stringify(designSettings)) : {},
            changeHistory: Array.isArray(getCurrentDiffSummary()) ? 
                getCurrentDiffSummary() : []
        },
        
        // 메타데이터
        metadata: {
            saveDate: new Date().toISOString(),
            timestamp: Date.now()
        }
    };
    
    // 버전 데이터 저장 (깊은 복사 적용)
    versions[currentVersion] = JSON.parse(JSON.stringify(versionData));
    
    // 로컬 스토리지에 저장 (용량 문제 방지를 위해 분할 저장)
    try {
        // localStorage.setItem('uosVersions', JSON.stringify(versions));
    } catch (storageError) {
        
        // 용량이 너무 크면 분할 저장 시도
        try {
            // 현재 버전만 따로 저장
            const singleVersionData = {};
            singleVersionData[currentVersion] = versions[currentVersion];
            localStorage.setItem(`uosVersion_${currentVersion}`, JSON.stringify(singleVersionData));
            
            // 버전 목록만 저장
            const versionsList = Object.keys(versions);
            localStorage.setItem('uosVersionsList', JSON.stringify(versionsList));
            
            alert('버전 데이터가 커서 분할 저장되었습니다.');
        } catch (splitError) {
            alert('버전 데이터가 너무 커서 저장에 실패했습니다. 불필요한 버전을 삭제해주세요.');
            return;
        }
    }
    
    
    // Firebase에 버전별로 개별 저장
    if (firebaseInitialized && isOnline) {
        try {
            // 현재 버전 데이터를 Firebase에 개별 저장
            await saveDataToFirebase(`versions/${currentVersion}`, versionData);
            
            // 버전 목록 업데이트
            const versionList = Object.keys(versions);
            await saveDataToFirebase('versionList', versionList);
            
            // 현재 버전 정보 저장
            await saveDataToFirebase('currentVersion', currentVersion);
            
        } catch (error) {
            showToast('클라우드 저장에 실패했습니다. 로컬에만 저장되었습니다.');
        }
    }
    
    // 테이블들 다시 렌더링
    renderCourses();
    renderMatrix();
    renderCurriculumTable();
    // 셀 편집 중이 아닐 때만 테이블 렌더링
    if (!isCommonValuesCellEditing) {
        renderCommonValuesTable();
    }
    renderMatrixExtraTable();
    updateStats();
    
    updateVersionNavigationButtons();
    showToast('현재 버전이 저장되었습니다.');
}

// 버전 복원 (임시 저장소 초기화 포함)
function restoreVersion(versionName) {
    if (!confirm(`'${versionName}' 버전을 복원하시겠습니까? 현재 데이터가 덮어써집니다.`)) {
        return;
    }
    
    // 원본 데이터를 수정하지 않기 위해 깊은 복사
    let versionData;
    try {
        versionData = JSON.parse(JSON.stringify(versions[versionName]));
    } catch (parseError) {
        console.error('버전 데이터 파싱 오류:', parseError);
        alert('버전 데이터를 파싱하는 중 오류가 발생했습니다.');
        return;
    }
    
    if (!versionData) {
        alert('버전 데이터를 찾을 수 없습니다.');
        return;
    }
    
    try {
        // 버전 복원 플래그 설정
        window.isRestoringVersion = true;
        
        // 임시 저장소 초기화
        clearTempStorage();
        
        // 1. 교과목 관리 탭 데이터 복원 (깊은 복사 적용)
        if (versionData.coursesTab) {
            courses = Array.isArray(versionData.coursesTab.courses) ? 
                JSON.parse(JSON.stringify(versionData.coursesTab.courses)) : [];
                
            initialCourses = Array.isArray(versionData.coursesTab.initialCourses) ? 
                JSON.parse(JSON.stringify(versionData.coursesTab.initialCourses)) : 
                JSON.parse(JSON.stringify(courses));
                
            // 삭제된 과목 데이터 복원
            deletedCoursesData = versionData.coursesTab.deletedCoursesData ? 
                JSON.parse(JSON.stringify(versionData.coursesTab.deletedCoursesData)) : {};
            
            // localStorage에도 저장
            if (Object.keys(deletedCoursesData).length > 0) {
                localStorage.setItem('deletedCoursesData', JSON.stringify(deletedCoursesData));
            } else {
                localStorage.removeItem('deletedCoursesData');
            }
                
            ensureCourseIds(courses);
        ensureCourseIds(initialCourses);
        }
        
        // 2. 수행평가 매트릭스 탭 데이터 복원 (깊은 복사 적용)
        if (versionData.matrixTab) {
            matrixData = versionData.matrixTab.matrixData ? 
                JSON.parse(JSON.stringify(versionData.matrixTab.matrixData)) : {};
            
            // 저장된 initialMatrixData가 있으면 복원, 없으면 현재 matrixData로 설정
            if (versionData.matrixTab.initialMatrixData) {
                initialMatrixData = JSON.parse(JSON.stringify(versionData.matrixTab.initialMatrixData));
            } else {
                // 이전 버전 호환성: initialMatrixData가 없으면 현재 데이터로 설정
                initialMatrixData = JSON.parse(JSON.stringify(matrixData));
            }
                
            // 제목은 버전 데이터에서 직접 사용됨 - localStorage 사용 안 함
            
            // matrixExtraTableData 복원 (null 체크 추가)
            if (versionData.matrixTab.matrixExtraTableData) {
                matrixExtraTableData = JSON.parse(JSON.stringify(versionData.matrixTab.matrixExtraTableData));
        } else {
                matrixExtraTableData = {};
            }
        }
        
        // 3. 이수모형 탭 데이터 복원 (깊은 복사 적용)
        if (versionData.curriculumTab) {
            curriculumCellTexts = versionData.curriculumTab.curriculumCellTexts ? 
                JSON.parse(JSON.stringify(versionData.curriculumTab.curriculumCellTexts)) : {};
                
                
            // 제목은 버전 데이터에서 직접 사용됨 - localStorage 사용 안 함
        }
        
        // 4. 공통가치대응 탭 데이터 복원 (깊은 복사 적용)



        if (versionData.commonValuesTab) {
            let raw = versionData.commonValuesTab.commonValuesCellTexts
                ? JSON.parse(JSON.stringify(versionData.commonValuesTab.commonValuesCellTexts))
                : {};
        
            // 변환: 1차원 key → 2차원 구조
            const converted = {};
            Object.entries(raw).forEach(([key, value]) => {
                const match = key.match(/^commonValues-cell-([^\\-]+)-value([123])$/);
                if (match) {
                    const subject = match[1];
                    const vkey = 'value' + match[2];
                    if (!converted[subject]) converted[subject] = {};
                    converted[subject][vkey] = value;
                }
            });
            commonValuesCellTexts = Object.keys(converted).length > 0 ? converted : raw;
            
            // 공통가치대응 노드 그룹 속성 데이터 복원
            if (versionData.commonValuesTab.commonValuesCopiedBlocks) {
                commonValuesCopiedBlocks = JSON.parse(JSON.stringify(versionData.commonValuesTab.commonValuesCopiedBlocks));
            } else {
                // 기존 구조 호환성을 위해 빈 객체로 초기화
                commonValuesCopiedBlocks = {};
            }
            
            // 비교과 데이터 복원
            if (versionData.commonValuesTab.extracurricularTexts) {
                extracurricularTexts = JSON.parse(JSON.stringify(versionData.commonValuesTab.extracurricularTexts));
            } else {
                extracurricularTexts = { value1: [], value2: [], value3: [] };
            }
            
            if (versionData.commonValuesTab.extracurricularBlocks) {
                extracurricularBlocks = JSON.parse(JSON.stringify(versionData.commonValuesTab.extracurricularBlocks));
            } else {
                extracurricularBlocks = { value1: [], value2: [], value3: [] };
            }
            
            if (versionData.commonValuesTab.extracurricularMergedTexts) {
                extracurricularMergedTexts = JSON.parse(JSON.stringify(versionData.commonValuesTab.extracurricularMergedTexts));
            } else {
                extracurricularMergedTexts = [];
            }
        
            // 제목은 버전 데이터에서 직접 사용됨 - localStorage 사용 안 함
        }
        
        // 공통 설정 복원 (깊은 복사 적용)
        if (versionData.settings) {
            designSettings = versionData.settings.designSettings ? 
                JSON.parse(JSON.stringify(versionData.settings.designSettings)) : {};
            // 변경이력 복원 추가
            changeHistory = versionData.settings.changeHistory || [];
            // 임시 매트릭스 변경이력 복원
            tempMatrixChangeHistory = versionData.settings.tempMatrixChangeHistory || [];
        } else {
            // 기존 구조 호환성
            designSettings = versionData.designSettings || designSettings;
            // 변경이력 복원 추가 (레거시)
            changeHistory = versionData.changeHistory || [];
        }
        
        // 현재 버전 업데이트
        currentVersion = versionName;
        
        // 제목들을 즉시 업데이트
        const matrixTitle = document.getElementById('matrixTitle');
        if (matrixTitle && versionData.matrixTab?.matrixTitleText) {
            matrixTitle.textContent = versionData.matrixTab.matrixTitleText;
        }
        
        const curriculumTitle = document.getElementById('curriculumTitle');
        if (curriculumTitle && versionData.curriculumTab?.curriculumTitleText) {
            curriculumTitle.textContent = versionData.curriculumTab.curriculumTitleText;
        }
        
        const commonValuesTitle = document.getElementById('commonValuesTitle');
        if (commonValuesTitle && versionData.commonValuesTab?.commonValuesTitleText) {
            commonValuesTitle.textContent = versionData.commonValuesTab.commonValuesTitleText;
        }
            
        // 모든 탭 렌더링
        renderCourses();
        renderMatrix();
        renderCurriculumTable();
        renderMatrixExtraTable();
        
        // 공통가치대응 테이블 강제 렌더링 (복원 시에는 편집 상태 무시)
        window.isRestoringVersion = true;
        const originalIsCommonValuesCellEditing = isCommonValuesCellEditing;
        isCommonValuesCellEditing = false;
        renderCommonValuesTable();
        isCommonValuesCellEditing = originalIsCommonValuesCellEditing;
        window.isRestoringVersion = false;
        updateStats();
        drawChart();
        drawSubjectTypeChart();
        renderChangeHistoryPanel();
        updateAllVersionLabels();
        updateCurrentVersionDisplay();
        
        // 복원된 데이터 요약 정보 생성
        let courseCount = Array.isArray(courses) ? courses.length : 0;
        let matrixDataCount = typeof matrixData === 'object' ? Object.keys(matrixData).length : 0;
        let curriculumCellCount = typeof curriculumCellTexts === 'object' ? Object.keys(curriculumCellTexts).length : 0;
        let commonValuesCount = typeof commonValuesCellTexts === 'object' ? Object.keys(commonValuesCellTexts).length : 0;
        let matrixExtraCount = typeof matrixExtraTableData === 'object' ? Object.keys(matrixExtraTableData).length : 0;
        
        // 복원 결과를 더 명확하게 표시
        const restoreMessage = `
            '${versionName}' 버전이 복원되었습니다.
            
            복원된 데이터:
            - 교과목: ${courseCount}개
            - 매트릭스 데이터: ${matrixDataCount}개
            - 이수모형 셀: ${curriculumCellCount}개
            - 공통가치 셀: ${commonValuesCount}개
            - 매트릭스 추가 셀: ${matrixExtraCount}개
        `;
        
        showToast(restoreMessage);
        
        // 현재 활성화된 탭 유지 (탭 전환 제거)
        // 현재 탭에 시각적 피드백만 추가
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            // 하이라이트 효과 추가
            activeTab.style.animation = 'restoreHighlight 2s ease-in-out';
            setTimeout(() => {
                activeTab.style.animation = '';
            }, 2000);
        }
        
        // 버전 네비게이션 버튼 상태 업데이트
        updateVersionNavigationButtons();
        
        // 버전 관리 모달이 열려있다면 닫기
        const versionManagerModal = document.getElementById('versionManagerModal');
        if (versionManagerModal && versionManagerModal.style.display === 'block') {
            closeVersionManager();
        }
        
        // 복원 완료 후 콘솔에 로그 출력
    } catch (e) {
        console.error('버전 복원 오류:', e);
        alert(`버전 복원 중 오류가 발생했습니다.\n\n오류 내용: ${e.message}\n\n자세한 내용은 개발자 콘솔을 확인하세요.`);
    }
}

// 버전 삭제
async function deleteVersion(versionName) {
    if (!confirm(`'${versionName}' 버전을 삭제하시겠습니까?`)) {
        return;
    }
    
    delete versions[versionName];
    // localStorage.setItem('uosVersions', JSON.stringify(versions));
    
    // Firebase에서 개별 버전 삭제
    if (firebaseInitialized && isOnline) {
        try {
            // 개별 버전 데이터 삭제
            await db.ref(`versions/${versionName}`).remove();
            
            // 버전 목록 업데이트
            const versionList = Object.keys(versions);
            await saveDataToFirebase('versionList', versionList);
            
        } catch (error) {
            showToast('클라우드에서 삭제에 실패했습니다. 로컬에서만 삭제되었습니다.');
        }
    }
    
    // 현재 버전이 삭제된 경우 기본 버전으로 변경
    if (currentVersion === versionName) {
        currentVersion = '기본';
            
        // Firebase에서도 현재 버전 업데이트
        if (firebaseInitialized && isOnline) {
            try {
                await saveDataToFirebase('currentVersion', currentVersion);
            } catch (error) {
            }
        }
        
        updateCurrentVersionDisplay();
    }
    
    renderVersionList();
    updateVersionNavigationButtons();
    showToast(`'${versionName}' 버전이 삭제되었습니다.`);
}



// 버전명 라벨 동기화 함수
function updateAllVersionLabels() {
    const version = currentVersion || '기본';
    const matrixLabel = document.getElementById('matrixVersionText');
    const curriculumLabel = document.getElementById('curriculumVersionText');
    const commonValuesLabel = document.getElementById('commonValuesVersionText');
    if (matrixLabel) matrixLabel.textContent = version;
    if (curriculumLabel) curriculumLabel.textContent = version;
    if (commonValuesLabel) commonValuesLabel.textContent = version;
}

// 복원 후 새로고침 시 restoredVersionChangeHistory를 null로 초기화
window.addEventListener('DOMContentLoaded', function() {
    const stored = localStorage.getItem('restoredVersionChangeHistory');
    if (stored) {
        try {
            restoredVersionChangeHistory = JSON.parse(stored);
        } catch(e) {
            restoredVersionChangeHistory = null;
        }
        // 한 번 읽으면 바로 삭제(1회성)
        localStorage.removeItem('restoredVersionChangeHistory');
    } else {
        restoredVersionChangeHistory = null;
    }
    
    // 창 크기 변경 시 차트 리사이즈
    window.addEventListener('resize', function() {
        setTimeout(() => {
            drawChart();
            drawSubjectTypeChart();
        }, 100);
    });
    
    // 초기 차트 그리기
    setTimeout(() => {
        drawChart();
        drawSubjectTypeChart();
    }, 100);
    
    // 버전 라벨 업데이트
    setTimeout(() => {
        updateAllVersionLabels();
    }, 200);
});

// 변경된 교과목 id Set 반환 함수
function getChangedCourseIds() {
    const diff = getCurrentDiffSummary();
    const ids = new Set();
    diff.forEach(entry => {
        if (entry.course && entry.course.id) {
            ids.add(entry.course.id);
        }
    });
    return ids;
}
// 고유 id 생성 함수
function generateUniqueId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}
// courses 배열의 모든 교과목에 id가 없으면 자동 부여 및 yearSemester 형식 변환
function ensureCourseIds(arr) {
    arr.forEach(course => {
        if (!course.id) course.id = generateUniqueId();
        // yearSemester 형식 변환
        if (course.yearSemester) {
            course.yearSemester = formatYearSemester(course.yearSemester);
        }
    });
}

// 페이지 로드 시 모든 courses/initialCourses/버전 courses에 id 보장
window.addEventListener('DOMContentLoaded', function() {
    if (typeof ensureCourseIds === 'function') {
        if (typeof courses !== 'undefined') ensureCourseIds(courses);
        if (typeof initialCourses !== 'undefined') ensureCourseIds(initialCourses);
        if (typeof versions !== 'undefined') {
            Object.values(versions).forEach(v => {
                if (v.courses) ensureCourseIds(v.courses);
            });
        }
    }
});

// 이동된 교과목 정보를 가져오는 함수
function getMovedCoursesForGhost() {
    const movedCourses = [];
    
    // 같은 학년학기 내에서만 화살표 그리기
    // 현재 교과목들과 초기 교과목들을 비교하여 같은 학년학기 내에서 이동된 것들을 찾기 (id 기준)
    courses.forEach(currentCourse => {
        const initialCourse = initialCourses.find(ic => ic.id === currentCourse.id);
        // 같은 학년학기 내에서만 화살표 그리기
        if (initialCourse && initialCourse.yearSemester === currentCourse.yearSemester) {
            movedCourses.push({
                initialCourse: initialCourse,
                currentCourse: currentCourse
            });
        }
    });
    
    return movedCourses;
}

// 매트릭스 탭에서 이동된 교과목 정보를 가져오는 함수
function getMovedCoursesForMatrix() {
    const movedCourses = [];
    
    // 현재 교과목들과 초기 교과목들을 비교하여 순서가 변경된 것들을 찾기
    courses.forEach(currentCourse => {
        const initialCourse = initialCourses.find(ic => ic.id === currentCourse.id);
        if (initialCourse) {
            // 현재 위치와 초기 위치의 인덱스 비교
            const currentIndex = courses.indexOf(currentCourse);
            const initialIndex = initialCourses.indexOf(initialCourse);
            
            if (currentIndex !== initialIndex) {
                movedCourses.push({
                    initialCourse: initialCourse,
                    currentCourse: currentCourse,
                    initialIndex: initialIndex,
                    currentIndex: currentIndex
                });
            }
        }
    });
    
    return movedCourses;
}

// 매트릭스 탭용 화살표 그리기 함수
function drawMatrixMoveArrows(movedCourses) {
    // 매트릭스 테이블의 Canvas 컨테이너 생성
    const matrixTable = document.getElementById('matrixTable');
    if (!matrixTable || movedCourses.length === 0) return;
    
    // 기존 Canvas 제거
    const existingCanvas = document.getElementById('matrixArrowsCanvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }
    
    // Canvas 생성
    const canvas = document.createElement('canvas');
    canvas.id = 'matrixArrowsCanvas';
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10';
    
    // 테이블 위치와 크기 가져오기
    const tableRect = matrixTable.getBoundingClientRect();
    canvas.width = tableRect.width;
    canvas.height = tableRect.height;
    canvas.style.left = '0';
    canvas.style.top = '0';
    
    // Canvas를 테이블 컨테이너에 추가
    matrixTable.parentElement.style.position = 'relative';
    matrixTable.parentElement.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    // 각 이동된 과목에 대해 화살표 그리기
    movedCourses.forEach(moveInfo => {
        const ghostRow = document.querySelector(`[data-ghost-for="${moveInfo.currentCourse.id}"]`);
        const currentRow = document.querySelector(`[data-course-id="${moveInfo.currentCourse.id}"]`);
        
        if (ghostRow && currentRow) {
            const ghostRect = ghostRow.getBoundingClientRect();
            const currentRect = currentRow.getBoundingClientRect();
            
            // 화살표 시작점과 끝점 계산
            const startX = ghostRect.right - tableRect.left - 50;
            const startY = ghostRect.top + ghostRect.height / 2 - tableRect.top;
            const endX = currentRect.right - tableRect.left - 50;
            const endY = currentRect.top + currentRect.height / 2 - tableRect.top;
            
            // 화살표 그리기
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            
            // 베지어 곡선으로 화살표 그리기
            const controlX = (startX + endX) / 2 + 50;
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(controlX, (startY + endY) / 2, endX, endY);
            ctx.stroke();
            
            // 화살촉 그리기
            const angle = Math.atan2(endY - startY, endX - startX);
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
            ctx.fill();
        }
    });
}

// 화살표 초기화 함수
function clearMoveArrows() {
    const canvasContainer = document.getElementById('moveArrowsCanvas');
    if (canvasContainer) {
        canvasContainer.remove();
    }
    
    const hoverCanvas = document.getElementById('moveArrowsHoverCanvas');
    if (hoverCanvas) {
        hoverCanvas.remove();
    }
    
    // 애니메이션 중지
    if (window.arrowAnimationFrame) {
        cancelAnimationFrame(window.arrowAnimationFrame);
        window.arrowAnimationFrame = null;
    }
}

// 이동된 교과목 화살표 그리기 함수 (Canvas 기반)
function drawMoveArrows(movedCoursesForGhost) {
    const curriculumTable = document.querySelector('.curriculum-table');
    
    // 전역 변수에 저장 (리사이즈 시 재사용)
    window.movedCoursesForGhost = movedCoursesForGhost;
    
    if (!curriculumTable || movedCoursesForGhost.length === 0) {
        clearMoveArrows();
        return;
    }
    
    // 기본 Canvas 컨테이너 생성 (일반 화살표용)
    let canvasContainer = document.getElementById('moveArrowsCanvas');
    if (!canvasContainer) {
        canvasContainer = document.createElement('canvas');
        canvasContainer.id = 'moveArrowsCanvas';
        canvasContainer.style.position = 'absolute';
        canvasContainer.style.top = '0';
        canvasContainer.style.left = '0';
        canvasContainer.style.pointerEvents = 'none';
        canvasContainer.style.zIndex = '1';
        
        // 이수모형 컨테이너에 상대 위치 설정
        const curriculumContent = document.getElementById('curriculum');
        if (curriculumContent) {
            const tableContainer = curriculumContent.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.style.position = 'relative';
                tableContainer.appendChild(canvasContainer);
            }
        }
    }
    
    // 호버용 Canvas 컨테이너 생성 (하이라이트된 화살표용 - 상위 레이어)
    let hoverCanvas = document.getElementById('moveArrowsHoverCanvas');
    if (!hoverCanvas) {
        hoverCanvas = document.createElement('canvas');
        hoverCanvas.id = 'moveArrowsHoverCanvas';
        hoverCanvas.style.position = 'absolute';
        hoverCanvas.style.top = '0';
        hoverCanvas.style.left = '0';
        hoverCanvas.style.pointerEvents = 'none';
        hoverCanvas.style.zIndex = '1000'; // 다른 요소들보다 위에 표시
        
        const curriculumContent = document.getElementById('curriculum');
        if (curriculumContent) {
            const tableContainer = curriculumContent.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.appendChild(hoverCanvas);
            }
        }
    }
    
    // Canvas 크기 설정
    const tableContainer = document.querySelector('.curriculum-table').closest('.table-container');
    if (!tableContainer) return;

    // 캔버스는 표와 '같은 좌표계'에 있어야 스크롤/스케일/인쇄 확대에도 따라간다.
    // → 표의 직접 부모(모바일: map-stage, 데스크톱: 내부 스크롤 div)에 배치
    const tblEl = document.querySelector('.curriculum-table');
    const scrollHost = tblEl ? tblEl.parentElement : tableContainer;
    if (getComputedStyle(scrollHost).position === 'static') scrollHost.style.position = 'relative';
    if (canvasContainer.parentElement !== scrollHost) scrollHost.appendChild(canvasContainer);
    if (hoverCanvas.parentElement !== scrollHost) scrollHost.appendChild(hoverCanvas);
    // 비트맵 크기는 화면(rect)이 아니라 '콘텐츠 레이아웃' 크기로 (변환·스크롤과 무관)
    const layoutW = Math.max(scrollHost.scrollWidth, tblEl ? tblEl.offsetWidth : 0);
    const layoutH = Math.max(scrollHost.scrollHeight, tblEl ? tblEl.offsetHeight : 0);
    const containerRect = tableContainer.getBoundingClientRect();
    canvasContainer.width = layoutW;
    canvasContainer.height = layoutH;
    hoverCanvas.width = layoutW;
    hoverCanvas.height = layoutH;
    
    const ctx = canvasContainer.getContext('2d');
    const hoverCtx = hoverCanvas.getContext('2d');
    ctx.clearRect(0, 0, canvasContainer.width, canvasContainer.height);
    hoverCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
    
    // 화살표 데이터 저장 (호버 효과용)
    window.arrowData = [];
    
    movedCoursesForGhost.forEach((moveInfo, index) => {
        // 고스트 블럭 위치는 순전히 초기 상태로만 계산
        const originalCellId = getCurriculumCellId(moveInfo.initialCourse);
        const newCellId = getCurriculumCellId(moveInfo.currentCourse);
        
        // 실제로 위치가 다른 경우에만 화살표 그리기
        if (originalCellId !== newCellId) {
            const originalCell = document.getElementById(originalCellId);
            const newCell = document.getElementById(newCellId);
            
            if (originalCell && newCell) {
                drawArrowBetweenCells(ctx, containerRect, originalCell, newCell, index, moveInfo);
            }
        }
    });
    
    // 애니메이션 시작
    startArrowAnimation();
}

// Canvas 기반 화살표 호버 이벤트 설정
function setupArrowHoverEvents(fromGhostBlock, toCurrentBlock) {
    // 고스트 블럭 호버 시
    fromGhostBlock.addEventListener('mouseenter', function() {
        window.hoveredArrow = window.arrowData.find(arrow => 
            arrow.fromGhostBlock === fromGhostBlock
        );
        fromGhostBlock.classList.add('arrow-hover');
    });
    
    fromGhostBlock.addEventListener('mouseleave', function() {
        window.hoveredArrow = null;
        fromGhostBlock.classList.remove('arrow-hover');
    });
    
    // 현재 블럭 호버 시
    toCurrentBlock.addEventListener('mouseenter', function() {
        window.hoveredArrow = window.arrowData.find(arrow => 
            arrow.toCurrentBlock === toCurrentBlock
        );
        const arrow = window.arrowData.find(arrow => 
            arrow.toCurrentBlock === toCurrentBlock
        );
        if (arrow && arrow.fromGhostBlock) {
            arrow.fromGhostBlock.classList.add('arrow-hover');
        }
    });
    
    toCurrentBlock.addEventListener('mouseleave', function() {
        window.hoveredArrow = null;
        const arrow = window.arrowData.find(arrow => 
            arrow.toCurrentBlock === toCurrentBlock
        );
        if (arrow && arrow.fromGhostBlock) {
            arrow.fromGhostBlock.classList.remove('arrow-hover');
        }
    });
}

// 화살표 애니메이션
function startArrowAnimation() {
    let offset = 0;
    
    function animate() {
        const canvas = document.getElementById('moveArrowsCanvas');
        const hoverCanvas = document.getElementById('moveArrowsHoverCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const hoverCtx = hoverCanvas ? hoverCanvas.getContext('2d') : null;
        
        // 두 Canvas 모두 클리어
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (hoverCtx) {
            hoverCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
        }
        
        // 모든 화살표 그리기
        if (window.arrowData) {
            // 일반 화살표와 호버된 화살표 분리
            const normalArrows = [];
            const hoveredArrows = [];
            
            window.arrowData.forEach(arrow => {
                if (window.hoveredArrow === arrow) {
                    hoveredArrows.push(arrow);
                } else {
                    normalArrows.push(arrow);
                }
            });
            
            // 일반 화살표 그리기 (하위 Canvas)
            normalArrows.forEach(arrow => {
                drawArrow(ctx, arrow, offset, false);
            });
            
            // 호버된 화살표 그리기 (상위 Canvas)
            if (hoverCtx && hoveredArrows.length > 0) {
                hoveredArrows.forEach(arrow => {
                    drawArrow(hoverCtx, arrow, offset, true);
                });
            }
        }
        
        // 애니메이션 오프셋 업데이트
        offset += 0.2;
        if (offset >= 9) offset = 0;
        
        window.arrowAnimationFrame = requestAnimationFrame(animate);
    }
    
    // 화살표 그리기 헬퍼 함수
    function drawArrow(ctx, arrow, offset, isHovered) {
        // 선택된 스타일로 화살표 경로 계산 및 그리기
        const pathData = calculateArrowPath(arrow.fromX, arrow.fromY, arrow.toX, arrow.toY, arrowStyle);
        drawArrowPath(ctx, pathData);
        
        // 호버 상태에 따른 스타일
        if (isHovered) {
            ctx.strokeStyle = 'rgba(100, 100, 100, 1)'; // 적당히 진한 회색
            ctx.lineWidth = 1.2; // 살짝 두꺼운 선
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
        } else {
            ctx.strokeStyle = 'rgba(189, 189, 189, 0.85)';
            ctx.lineWidth = 1.2;
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
        
        // 점선 패턴 설정 (애니메이션 효과)
        ctx.setLineDash([4, 5]);
        ctx.lineDashOffset = -offset;
        ctx.stroke();
        
        // 화살표 머리 그리기
        let angle;
        if (arrowStyle === 'straight-curve') {
            // straight-curve 스타일의 경우
            const dx = arrow.toX - arrow.fromX;
            const dy = arrow.toY - arrow.fromY;
            if (Math.abs(dy) > 300) {
                // 수직 거리가 300픽셀 이상이면 수직 방향
                angle = dy > 0 ? Math.PI / 2 : -Math.PI / 2; // 아래 또는 위
            } else {
                // 그 외의 경우 마지막 선분은 수평
                angle = dx > 0 ? 0 : Math.PI; // 오른쪽 또는 왼쪽
            }
        } else {
            // 다른 스타일의 경우 control point 기반 계산
            angle = Math.atan2(arrow.toY - arrow.cp2Y, arrow.toX - arrow.cp2X);
        }
        const arrowLength = isHovered ? 10 : 10;
        const arrowAngle = Math.PI / 6;
        
        // 그림자 설정 (화살표 머리용)
        if (isHovered) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 2;
        }
        
        ctx.beginPath();
        ctx.moveTo(arrow.toX, arrow.toY);
        ctx.lineTo(
            arrow.toX - arrowLength * Math.cos(angle - arrowAngle),
            arrow.toY - arrowLength * Math.sin(angle - arrowAngle)
        );
        ctx.lineTo(
            arrow.toX - arrowLength * Math.cos(angle + arrowAngle),
            arrow.toY - arrowLength * Math.sin(angle + arrowAngle)
        );
        ctx.closePath();
        
        if (isHovered) {
            ctx.fillStyle = 'rgba(100, 100, 100, 1)'; // 적당히 진한 회색
        } else {
            ctx.fillStyle = 'rgba(189, 189, 189, 0.85)';
        }
        ctx.fill();
        
        // 그림자 제거
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
    
    animate();
}

// 화살표 스타일에 따른 경로 계산
function calculateArrowPath(fromX, fromY, toX, toY, style) {
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    switch(style) {
        case 'straight':
            // 직선 화살표
            return {
                type: 'line',
                points: [fromX, fromY, toX, toY]
            };
            
        case 'curved':
            // 부드러운 곡선 화살표
            const cp1X = fromX + deltaX * 0.5;
            const cp1Y = fromY;
            const cp2X = toX - deltaX * 0.5;
            const cp2Y = toY;
            return {
                type: 'bezier',
                points: [fromX, fromY, cp1X, cp1Y, cp2X, cp2Y, toX, toY]
            };
            
        case 'straight-curve':
            // 직선 + 곡선 혼합 (현재 스타일)
            // 수직 거리가 300픽셀 이상이면 수직 연결로 처리
            if (Math.abs(deltaY) > 300) {
                return {
                    type: 'vertical-mixed',
                    straightLength: 20,
                    points: [fromX, fromY, toX, toY]
                };
            } else {
                return {
                    type: 'mixed',
                    straightLength: 20,
                    points: [fromX, fromY, toX, toY]
                };
            }
            
        case 'right-angle':
            // 직각 화살표
            const midX = fromX + deltaX / 2;
            return {
                type: 'polyline',
                points: [fromX, fromY, midX, fromY, midX, toY, toX, toY]
            };
            
        case 'smooth-right':
            // 부드러운 직각 화살표
            const radius = Math.min(15, Math.abs(deltaX) * 0.15, Math.abs(deltaY) * 0.15);
            return {
                type: 'smooth-right',
                radius: radius,
                points: [fromX, fromY, toX, toY]
            };
            
        case 'arc':
            // 호 형태 화살표
            return {
                type: 'arc',
                points: [fromX, fromY, toX, toY]
            };
            
        default:
            return calculateArrowPath(fromX, fromY, toX, toY, 'straight-curve');
    }
}

// 화살표 경로 그리기
function drawArrowPath(ctx, pathData) {
    ctx.beginPath();
    
    switch(pathData.type) {
        case 'line':
            ctx.moveTo(pathData.points[0], pathData.points[1]);
            ctx.lineTo(pathData.points[2], pathData.points[3]);
            break;
            
        case 'bezier':
            ctx.moveTo(pathData.points[0], pathData.points[1]);
            ctx.bezierCurveTo(
                pathData.points[2], pathData.points[3],
                pathData.points[4], pathData.points[5],
                pathData.points[6], pathData.points[7]
            );
            break;
            
        case 'mixed':
            const [fromX, fromY, toX, toY] = pathData.points;
            const deltaX = toX - fromX;
            const straightLen = pathData.straightLength;
            
            ctx.moveTo(fromX, fromY);
            const straightX1 = fromX + (deltaX > 0 ? straightLen : -straightLen);
            ctx.lineTo(straightX1, fromY);
            
            const straightX2 = toX - (deltaX > 0 ? straightLen : -straightLen);
            const cp1X = straightX1 + (deltaX > 0 ? 30 : -30);
            const cp2X = straightX2 - (deltaX > 0 ? 30 : -30);
            
            ctx.bezierCurveTo(cp1X, fromY, cp2X, toY, straightX2, toY);
            ctx.lineTo(toX, toY);
            break;
            
        case 'vertical-mixed':
            const [vfromX, vfromY, vtoX, vtoY] = pathData.points;
            const vdeltaY = vtoY - vfromY;
            const vstraightLen = pathData.straightLength;
            
            ctx.moveTo(vfromX, vfromY);
            // 수직으로 시작
            const straightY1 = vfromY + (vdeltaY > 0 ? vstraightLen : -vstraightLen);
            ctx.lineTo(vfromX, straightY1);
            
            // 중간 부분 - 베지어 곡선으로 연결
            const straightY2 = vtoY - (vdeltaY > 0 ? vstraightLen : -vstraightLen);
            const vcp1Y = straightY1 + (vdeltaY > 0 ? 30 : -30);
            const vcp2Y = straightY2 - (vdeltaY > 0 ? 30 : -30);
            
            ctx.bezierCurveTo(vfromX, vcp1Y, vtoX, vcp2Y, vtoX, straightY2);
            // 수직으로 끝
            ctx.lineTo(vtoX, vtoY);
            break;
            
        case 'polyline':
            ctx.moveTo(pathData.points[0], pathData.points[1]);
            for (let i = 2; i < pathData.points.length; i += 2) {
                ctx.lineTo(pathData.points[i], pathData.points[i + 1]);
            }
            break;
            
        case 'smooth-right':
            // 부드러운 직각 화살표
            const [fx, fy, tx, ty] = pathData.points;
            const dx = tx - fx;
            const dy = ty - fy;
            const r = pathData.radius;
            
            ctx.moveTo(fx, fy);
            
            if (Math.abs(dx) > Math.abs(dy) * 1.5) {
                // 수평 이동이 주요한 경우
                const midX = fx + dx * 0.7;
                
                ctx.lineTo(midX - r, fy);
                ctx.quadraticCurveTo(midX, fy, midX, fy + (dy > 0 ? r : -r));
                ctx.lineTo(midX, ty - (dy > 0 ? r : -r));
                ctx.quadraticCurveTo(midX, ty, midX + r, ty);
                ctx.lineTo(tx, ty);
            } else if (Math.abs(dy) > Math.abs(dx) * 1.5) {
                // 수직 이동이 주요한 경우
                const midY = fy + dy * 0.7;
                
                ctx.lineTo(fx, midY - r);
                ctx.quadraticCurveTo(fx, midY, fx + (dx > 0 ? r : -r), midY);
                ctx.lineTo(tx - (dx > 0 ? r : -r), midY);
                ctx.quadraticCurveTo(tx, midY, tx, midY + r);
                ctx.lineTo(tx, ty);
            } else {
                // 대각선 이동
                const midX = fx + dx * 0.6;
                const midY = fy + dy * 0.4;
                
                ctx.lineTo(midX - r, fy);
                ctx.quadraticCurveTo(midX, fy, midX, fy + (dy > 0 ? r : -r));
                ctx.lineTo(midX, midY);
                ctx.lineTo(midX, ty - (dy > 0 ? r : -r));
                ctx.quadraticCurveTo(midX, ty, midX + r, ty);
                ctx.lineTo(tx, ty);
            }
            break;
            
        case 'arc':
            const [arcFromX, arcFromY, arcToX, arcToY] = pathData.points;
            const arcDeltaX = arcToX - arcFromX;
            const arcDeltaY = arcToY - arcFromY;
            const controlDist = Math.sqrt(arcDeltaX * arcDeltaX + arcDeltaY * arcDeltaY) * 0.5;
            
            ctx.moveTo(arcFromX, arcFromY);
            ctx.quadraticCurveTo(
                arcFromX + arcDeltaX * 0.5 + arcDeltaY * 0.3,
                arcFromY + arcDeltaY * 0.5 - arcDeltaX * 0.3,
                arcToX, arcToY
            );
            break;
    }
}

// 스케일 팩터 캐시 (성능 최적화)
let cachedScaleFactor = null;
let scaleFactorCacheTime = 0;
const SCALE_CACHE_TTL = 1000; // 1초

// 스케일 팩터 감지 함수
function getTableScaleFactor() {
    const currentTime = Date.now();
    
    // 캐시된 값이 유효하면 재사용
    if (cachedScaleFactor !== null && (currentTime - scaleFactorCacheTime) < SCALE_CACHE_TTL) {
        return cachedScaleFactor;
    }
    
    const tableElement = document.querySelector('.curriculum-table');
    if (!tableElement) {
        cachedScaleFactor = 1;
        scaleFactorCacheTime = currentTime;
        return 1;
    }
    
    const computedStyle = window.getComputedStyle(tableElement);
    const transform = computedStyle.transform;
    let scaleFactor = 1;
    
    // transform matrix에서 스케일 값 추출
    if (transform && transform !== 'none') {
        const matrixMatch = transform.match(/matrix\(([^)]+)\)/);
        if (matrixMatch) {
            const values = matrixMatch[1].split(',').map(v => parseFloat(v.trim()));
            if (values.length >= 6) {
                scaleFactor = values[0]; // scaleX 값
            }
        }
    }
    
    // 캐시 업데이트
    cachedScaleFactor = scaleFactor;
    scaleFactorCacheTime = currentTime;
    
    return scaleFactor;
}

// 스케일 팩터 캐시 무효화 (화면 크기 변경이나 스케일 변경 시 호출)
function invalidateScaleFactorCache() {
    cachedScaleFactor = null;
    scaleFactorCacheTime = 0;
    console.log('🔄 스케일 팩터 캐시 무효화됨');
}

// 두 교과목 블럭 사이에 화살표 그리기 (Canvas 버전) - 개선됨
function drawArrowBetweenCells(ctx, containerRect, fromCell, toCell, index, moveInfo) {
    if (!ctx || !containerRect) {
        return;
    }
    
    // 고스트 블럭과 현재 교과목 블럭 찾기
    // 고스트 블럭을 찾을 때 해당 교과목의 고스트 블럭만 찾도록 수정
    const targetCourseName = moveInfo.currentCourse.courseName;
    const targetCourseId = moveInfo.currentCourse.id;
    
    // 고스트 블럭들 중에서 해당 교과목의 고스트 블럭 찾기
    const ghostBlocks = fromCell.querySelectorAll('.course-block.ghost');
    let fromGhostBlock = null;
    
    ghostBlocks.forEach(block => {
        // courseId로 정확히 매칭 (문자열로 변환하여 비교)
        if (block.dataset.courseId && block.dataset.courseId === String(targetCourseId)) {
            fromGhostBlock = block;
        }
    });
    
    // 현재 위치의 블럭 찾기
    const allBlocksInCell = toCell.querySelectorAll('.course-block:not(.ghost)');
    let toCurrentBlock = null;
    
    allBlocksInCell.forEach(block => {
        // courseId로 정확히 매칭 (문자열로 변환하여 비교)
        if (block.dataset.courseId && block.dataset.courseId === String(targetCourseId)) {
            toCurrentBlock = block;
        }
    });
    
    if (!fromGhostBlock || !toCurrentBlock) {
        // 디버깅: 매칭 실패 시 로그
        if (!fromGhostBlock) {
        }
        if (!toCurrentBlock) {
        }
        return;
    }
    
    const fromRect = fromGhostBlock.getBoundingClientRect();
    const toRect = toCurrentBlock.getBoundingClientRect();
    
    // 각 교과목 블럭의 중심 좌표
    const fromCenterX = fromRect.left + fromRect.width / 2;
    const fromCenterY = fromRect.top + fromRect.height / 2;
    const toCenterX = toRect.left + toRect.width / 2;
    const toCenterY = toRect.top + toRect.height / 2;
    
    // 화살표 시작점은 고스트 블럭 테두리, 끝점은 현재 블럭 테두리
    const fromEdge = getRectEdgePoint(fromRect, toCenterX, toCenterY);
    const toEdge = getRectEdgePoint(toRect, fromCenterX, fromCenterY);
    
    // 캔버스 자신의 화면 rect 를 기준으로 좌표 변환
    // (지도뷰 scale/translate 등 어떤 조상 변환에도 정확)
    const cvs = document.getElementById('moveArrowsCanvas');
    const cvsRect = cvs.getBoundingClientRect();
    const kx = cvsRect.width / (cvs.width || 1);
    const ky = cvsRect.height / (cvs.height || 1);
    const fromX = (fromEdge.x - cvsRect.left) / (kx || 1);
    const fromY = (fromEdge.y - cvsRect.top) / (ky || 1);
    const toX = (toEdge.x - cvsRect.left) / (kx || 1);
    const toY = (toEdge.y - cvsRect.top) / (ky || 1);
    
    // 연결점이 유효한지 확인
    if (isNaN(fromX) || isNaN(fromY) || isNaN(toX) || isNaN(toY)) {
        return;
    }
    
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // 블록 중심 간의 실제 수직 거리 계산
    const actualDeltaY = toCenterY - fromCenterY;
    
    // 연결점이 좌우 중심점인지 상하 중심점인지 판단
    // 블록 중심 간 수직 거리가 300픽셀 이상이면 수직 연결로 처리
    const isVerticalConnection = Math.abs(actualDeltaY) > 300 || Math.abs(deltaY) > Math.abs(deltaX);
    const roundness = 0.4; // vis-network와 동일한 roundness 값
    
    let cp1X, cp1Y, cp2X, cp2Y;
    
    if (!isVerticalConnection) {
        // 수평 연결 - 좌우 연결에 적합
        // 수평 직선 구간을 먼저 가진 후 곡선으로 연결
        const straightSectionLength = 30; // 직선 구간 길이 (픽셀)
        const curveControlOffset = Math.min(Math.abs(deltaX) * 0.3, 50); // 곡선 제어점 오프셋
        
        // 첫 번째 컨트롤 포인트 (시작점에서 수평 직선 구간만큼 이동)
        cp1X = fromX + (deltaX > 0 ? straightSectionLength : -straightSectionLength);
        cp1Y = fromY;
        
        // 두 번째 컨트롤 포인트 (끝점에서 수평 직선 구간만큼 이동)
        cp2X = toX - (deltaX > 0 ? straightSectionLength : -straightSectionLength);
        cp2Y = toY;
    } else {
        // 수직 연결 - 상하 연결에 적합
        const controlPointOffset = Math.abs(deltaY) * roundness;
        
        // 첫 번째 컨트롤 포인트 (시작점에서 수직으로 이동)
        cp1X = fromX;
        cp1Y = fromY + (deltaY > 0 ? controlPointOffset : -controlPointOffset);
        
        // 두 번째 컨트롤 포인트 (끝점에서 수직으로 이동)
        cp2X = toX;
        cp2Y = toY - (deltaY > 0 ? controlPointOffset : -controlPointOffset);
    }
    
    // 선택된 스타일로 화살표 경로 계산 및 그리기
    const pathData = calculateArrowPath(fromX, fromY, toX, toY, arrowStyle);
    drawArrowPath(ctx, pathData);
    
    // 화살표 스타일 설정
    ctx.strokeStyle = 'rgba(189, 189, 189, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 5]); // 점선 패턴
    ctx.stroke();
    
    // 화살표 머리 그리기
    let angle;
    if (arrowStyle === 'straight-curve') {
        // straight-curve 스타일의 경우
        if (Math.abs(actualDeltaY) > 300) {
            // 블록 중심 간 수직 거리가 300픽셀 이상이면 수직 방향
            angle = actualDeltaY > 0 ? Math.PI / 2 : -Math.PI / 2; // 아래 또는 위
        } else {
            // 그 외의 경우 마지막 선분은 수평
            angle = deltaX > 0 ? 0 : Math.PI; // 오른쪽 또는 왼쪽
        }
    } else {
        // 다른 스타일의 경우 control point 기반 계산
        angle = Math.atan2(toY - cp2Y, toX - cp2X);
    }
    const arrowLength = 10;
    const arrowAngle = Math.PI / 6;
    
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - arrowLength * Math.cos(angle - arrowAngle),
        toY - arrowLength * Math.sin(angle - arrowAngle)
    );
    ctx.lineTo(
        toX - arrowLength * Math.cos(angle + arrowAngle),
        toY - arrowLength * Math.sin(angle + arrowAngle)
    );
    ctx.closePath();
    ctx.fillStyle = 'rgba(189, 189, 189, 0.85)';
    ctx.fill();
    
    // 화살표 데이터 저장 (호버 효과용)
    window.arrowData.push({
        fromX, fromY, toX, toY,
        cp1X, cp1Y, cp2X, cp2Y,
        fromGhostBlock, toCurrentBlock,
        moveInfo
    });
    
    // 고스트 블럭과 현재 블럭에 호버 이벤트 추가
    setupArrowHoverEvents(fromGhostBlock, toCurrentBlock);
}

// 리사이즈 디바운스를 위한 타이머
let resizeTimer;

// 화살표만 다시 그리는 함수 (Canvas 버전)
function updateArrowsOnly() {
    const curriculumTab = document.getElementById('curriculum');
    if (!curriculumTab || curriculumTab.style.display === 'none') {
        return;
    }
    
    // 저장된 화살표 데이터로 다시 그리기
    if (window.movedCoursesForGhost && window.movedCoursesForGhost.length > 0) {
        drawMoveArrows(window.movedCoursesForGhost);
    }
}

// 화살표만 다시 그리는 함수 (Canvas 버전)
function updateArrowsOnly() {
    const curriculumTab = document.getElementById('curriculum');
    if (!curriculumTab || curriculumTab.style.display === 'none') {
        return;
    }
    
    // 저장된 화살표 데이터로 다시 그리기
    if (window.movedCoursesForGhost && window.movedCoursesForGhost.length > 0) {
        drawMoveArrows(window.movedCoursesForGhost);
    }
}

// 윈도우 리사이즈 시 이수모형표 전체 재렌더링 (디바운스 적용)
window.addEventListener('resize', function() {
    const curriculumTab = document.getElementById('curriculum');
    const curriculumTabBtn = document.querySelector('.tab-btn[onclick*="curriculum"]');
    
    // 이수모형 탭이 활성화되어 있는지 확인
    if ((curriculumTab && curriculumTab.style.display !== 'none') || 
        (curriculumTabBtn && curriculumTabBtn.classList.contains('active'))) {
        
        // 이전 타이머 취소
        clearTimeout(resizeTimer);
        
        // 디바운스로 리사이즈 완료 후 전체 재렌더링
        resizeTimer = setTimeout(() => {
            // 스케일 팩터 캐시 무효화
            invalidateScaleFactorCache();
            
            // 이수모형표 전체 재렌더링
            renderCurriculumTable();
        }, 250);
    }
});

// ResizeObserver를 사용한 더 정확한 크기 변경 감지
let resizeObserver = null;

function initResizeObserver() {
    const curriculumContent = document.getElementById('curriculum');
    if (!curriculumContent) {
        return;
    }
    
    // 기존 observer가 있으면 안전하게 해제
    if (resizeObserver) {
        try {
            // ResizeObserver 인스턴스인지 확인하고 null이 아닌지 확인
            if (resizeObserver && resizeObserver instanceof ResizeObserver && typeof resizeObserver.disconnect === 'function') {
                resizeObserver.disconnect();
            }
        } catch (e) {
            // 오류 무시 - Chrome 확장 프로그램과의 충돌 가능성
            console.debug('ResizeObserver disconnect error (ignored):', e);
        }
        resizeObserver = null;
    }
    
    // ResizeObserver가 지원되는지 확인
    if (typeof ResizeObserver !== 'undefined') {
        try {
            // 새로운 ResizeObserver 생성
            resizeObserver = new ResizeObserver(entries => {
                const curriculumTab = document.getElementById('curriculum');
                const curriculumTabBtn = document.querySelector('.tab-btn[onclick*="curriculum"]');
                
                // 이수모형 탭이 활성화되어 있는지 확인
                if ((curriculumTab && curriculumTab.style.display !== 'none') || 
                    (curriculumTabBtn && curriculumTabBtn.classList.contains('active'))) {
                    
                    // 디바운스 처리
                    clearTimeout(resizeTimer);
                    
                    resizeTimer = setTimeout(() => {
                        // 이수모형표 재렌더링
                        renderCurriculumTable();
                    }, 250);
                }
            });
            
            // curriculum 컨텐츠 관찰 시작
            resizeObserver.observe(curriculumContent);
        } catch (e) {
            resizeObserver = null;
        }
    } else {
        console.info('ResizeObserver not supported, using window resize event as fallback');
    }
}

// DOM 로드 완료 시 ResizeObserver 초기화
document.addEventListener('DOMContentLoaded', function() {
    // 약간의 지연을 두고 초기화 (다른 확장 프로그램과의 충돌 방지)
    setTimeout(() => {
        try {
            initResizeObserver();
        } catch (e) {
        }
    }, 100);
});

// 페이지 언로드 시 ResizeObserver 정리
window.addEventListener('beforeunload', function() {
    if (resizeObserver) {
        try {
            // ResizeObserver 인스턴스인지 확인하고 null이 아닌지 확인
            if (resizeObserver && resizeObserver instanceof ResizeObserver && typeof resizeObserver.disconnect === 'function') {
                resizeObserver.disconnect();
            }
            resizeObserver = null;
        } catch (e) {
            // 오류 무시 - Chrome 확장 프로그램과의 충돌 가능성
            console.debug('ResizeObserver cleanup error (ignored):', e);
        }
    }
});

function getRectEdgePoint(rect, targetX, targetY) {
    // rect: getBoundingClientRect() 결과, targetX/Y: 연결하려는 반대편 중심
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    
    // 방향 판단: 수평 거리가 수직 거리보다 크면 좌우 연결, 아니면 상하 연결
    if (Math.abs(dx) > Math.abs(dy)) {
        // 좌우 연결 - 좌측 또는 우측 중심점
        if (dx > 0) {
            // 우측 중심점
            return {
                x: rect.right,
                y: cy
            };
        } else {
            // 좌측 중심점
            return {
                x: rect.left,
                y: cy
            };
        }
    } else {
        // 상하 연결 - 상단 또는 하단 중심점
        if (dy > 0) {
            // 하단 중심점
            return {
                x: cx,
                y: rect.bottom
            };
        } else {
            // 상단 중심점
            return {
                x: cx,
                y: rect.top
            };
        }
    }
}

// 버전 관리/불러오기 모달 표시
function showVersionManager(event) {
    const modal = document.getElementById('versionManagerModal');
    if (modal) {
        // Ctrl 키가 눌렸는지 확인
        if (event && (event.ctrlKey || event.metaKey)) {
            // 전체 버전 목록 관리 모드
            showFullVersionManager();
        } else {
            // 일반 버전 관리 모드
            modal.style.display = 'block';
            renderVersionList();
        }
    }
}

// 전체 버전 목록 관리 (Firebase의 모든 버전 표시)
async function showFullVersionManager() {
    const modal = document.getElementById('versionManagerModal');
    if (!modal) return;
    
    modal.style.display = 'block';
    
    // 제목 변경
    const modalTitle = modal.querySelector('.modal-header h2');
    if (modalTitle) {
        modalTitle.textContent = '전체 버전 관리 (Firebase)';
    }
    
    const versionList = document.getElementById('versionList');
    if (!versionList) return;
    
    versionList.innerHTML = '<p style="text-align: center; padding: 20px;">Firebase에서 버전 목록을 불러오는 중...</p>';
    
    try {
        // Firebase에서 직접 버전 목록 로드
        const firebaseVersionList = await loadDataFromFirebase('versionList');
        const firebaseVersions = await loadDataFromFirebase('versions');
        
        versionList.innerHTML = '';
        
        // 버전 목록과 실제 데이터 비교
        const listVersions = firebaseVersionList || [];
        const actualVersions = firebaseVersions ? Object.keys(firebaseVersions) : [];
        const allVersions = new Set([...listVersions, ...actualVersions]);
        
        if (allVersions.size === 0) {
            versionList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">Firebase에 저장된 버전이 없습니다.</p>';
            return;
        }
        
        // 정보 표시
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'background: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px;';
        infoDiv.innerHTML = `
            <h4>Firebase 버전 상태</h4>
            <p>versionList 항목: ${listVersions.length}개</p>
            <p>실제 버전 데이터: ${actualVersions.length}개</p>
            <p>전체 고유 버전: ${allVersions.size}개</p>
            ${listVersions.length !== actualVersions.length ? '<p style="color: red;">⚠️ 버전 목록과 실제 데이터가 일치하지 않습니다.</p>' : ''}
        `;
        versionList.appendChild(infoDiv);
        
        // 모든 버전 표시
        allVersions.forEach(versionName => {
            const inList = listVersions.includes(versionName);
            const hasData = actualVersions.includes(versionName);
            
            const versionItem = document.createElement('div');
            versionItem.className = 'version-item';
            versionItem.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px;';
            
            versionItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${versionName}</strong>
                        <span style="margin-left: 10px;">
                            ${inList ? '✅ 목록' : '❌ 목록'}
                            ${hasData ? '✅ 데이터' : '❌ 데이터'}
                        </span>
                    </div>
                    <div>
                        ${!inList && hasData ? `<button onclick="addToVersionList('${versionName}')" class="btn btn-sm">목록에 추가</button>` : ''}
                        ${inList && !hasData ? `<button onclick="removeFromVersionList('${versionName}')" class="btn btn-sm btn-danger">목록에서 제거</button>` : ''}
                        ${hasData ? `<button onclick="deleteVersionFromFirebase('${versionName}')" class="btn btn-sm btn-danger">완전 삭제</button>` : ''}
                    </div>
                </div>
            `;
            
            versionList.appendChild(versionItem);
        });
        
        // 동기화 버튼 추가
        const syncButton = document.createElement('button');
        syncButton.className = 'btn btn-primary';
        syncButton.style.cssText = 'width: 100%; margin-top: 20px;';
        syncButton.textContent = '버전 목록 동기화';
        syncButton.onclick = syncVersionList;
        versionList.appendChild(syncButton);
        
    } catch (error) {
        console.error('Firebase 버전 로드 실패:', error);
        versionList.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">Firebase 버전 로드에 실패했습니다.</p>';
    }
}

// 버전 목록에 추가
async function addToVersionList(versionName) {
    try {
        const versionList = await loadDataFromFirebase('versionList') || [];
        if (!versionList.includes(versionName)) {
            versionList.push(versionName);
            await saveDataToFirebase('versionList', versionList);
            showToast(`'${versionName}'이(가) 버전 목록에 추가되었습니다.`);
            showFullVersionManager();
        }
    } catch (error) {
        showToast('버전 목록 추가에 실패했습니다.');
    }
}

// 버전 목록에서 제거
async function removeFromVersionList(versionName) {
    try {
        const versionList = await loadDataFromFirebase('versionList') || [];
        const index = versionList.indexOf(versionName);
        if (index > -1) {
            versionList.splice(index, 1);
            await saveDataToFirebase('versionList', versionList);
            showToast(`'${versionName}'이(가) 버전 목록에서 제거되었습니다.`);
            showFullVersionManager();
        }
    } catch (error) {
        showToast('버전 목록 제거에 실패했습니다.');
    }
}

// Firebase에서 버전 완전 삭제
async function deleteVersionFromFirebase(versionName) {
    if (!confirm(`'${versionName}' 버전을 Firebase에서 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }
    
    try {
        // 버전 데이터 삭제
        await db.ref(`versions/${versionName}`).remove();
        
        // 버전 목록에서도 제거
        const versionList = await loadDataFromFirebase('versionList') || [];
        const index = versionList.indexOf(versionName);
        if (index > -1) {
            versionList.splice(index, 1);
            await saveDataToFirebase('versionList', versionList);
        }
        
        // 로컬 메모리에서도 제거
        if (versions[versionName]) {
            delete versions[versionName];
        }
        
        showToast(`'${versionName}' 버전이 완전히 삭제되었습니다.`);
        showFullVersionManager();
    } catch (error) {
        showToast('버전 삭제에 실패했습니다.');
    }
}

// 버전 목록 동기화 (실제 데이터와 일치시키기)
async function syncVersionList() {
    if (!confirm('버전 목록을 실제 데이터와 동기화하시겠습니까?')) {
        return;
    }
    
    try {
        const firebaseVersions = await loadDataFromFirebase('versions') || {};
        const actualVersionNames = Object.keys(firebaseVersions);
        
        // versionList를 실제 데이터와 일치시킴
        await saveDataToFirebase('versionList', actualVersionNames);
        
        showToast('버전 목록이 동기화되었습니다.');
        showFullVersionManager();
    } catch (error) {
        showToast('버전 목록 동기화에 실패했습니다.');
    }
}

// 버전 순서 가져오기 (버전 관리 모달과 동일한 순서)
function getVersionOrder() {
    // localStorage 대신 메모리에서 가져오기
    const savedOrder = window.versionOrder;
    
    if (savedOrder) {
        const orderArray = Array.isArray(savedOrder) ? savedOrder : JSON.parse(savedOrder);
        
        // 저장된 순서에 없는 새 버전들을 먼저 수집 (최신순)
        const newVersions = [];
        Object.entries(versions).forEach(([name, data]) => {
            if (!orderArray.includes(name)) {
                const metadata = data.metadata || {};
                const timestamp = metadata.timestamp || new Date(metadata.saveDate || 0).getTime();
                newVersions.push({ name, timestamp });
            }
        });
        
        // 새 버전들을 날짜순으로 정렬 (최신이 위로)
        newVersions.sort((a, b) => b.timestamp - a.timestamp);
        
        // 새 버전들을 맨 위에, 그 다음 기존 순서대로
        const finalOrder = [...newVersions.map(v => v.name), ...orderArray.filter(name => versions[name])];
        return finalOrder;
    } else {
        // 기본: 날짜순으로 정렬 (최신순)
        return Object.entries(versions)
            .map(([name, data]) => {
                const metadata = data.metadata || {};
                const timestamp = metadata.timestamp || new Date(metadata.saveDate || 0).getTime();
                return { name, timestamp };
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .map(v => v.name);
    }
}

// 이전 버전으로 이동
function previousVersion() {
    const versionNames = getVersionOrder();
    const currentIndex = versionNames.indexOf(currentVersion);
    if (currentIndex > 0) {
        const previousVersionName = versionNames[currentIndex - 1];
        restoreVersion(previousVersionName);
        showToast(`이전 버전 '${previousVersionName}'으로 이동했습니다.`);
    } else {
        showToast('첫 번째 버전입니다.');
    }
}
// 다음 버전으로 이동
function nextVersion() {
    const versionNames = getVersionOrder();
    const currentIndex = versionNames.indexOf(currentVersion);
    if (currentIndex < versionNames.length - 1) {
        const nextVersionName = versionNames[currentIndex + 1];
        restoreVersion(nextVersionName);
        showToast(`다음 버전 '${nextVersionName}'으로 이동했습니다.`);
    } else {
        showToast('마지막 버전입니다.');
    }
}

// 버전 네비게이션 버튼 상태 업데이트
function updateVersionNavigationButtons() {
    const versionNames = getVersionOrder();
    const currentIndex = versionNames.indexOf(currentVersion);

    const prevBtn = document.querySelector('.version-nav-btn[onclick=\"previousVersion()\"]');
    const nextBtn = document.querySelector('.version-nav-btn[onclick=\"nextVersion()\"]');

    if (prevBtn) {
        prevBtn.disabled = currentIndex <= 0;
    }

    if (nextBtn) {
        nextBtn.disabled = currentIndex >= versionNames.length - 1;
    }
}

// 버전 목록 렌더링
function renderVersionList() {
    const versionList = document.getElementById('versionList');
    if (!versionList) return;
    
    versionList.innerHTML = '';
    
    // 버전 순서가 저장되어 있으면 사용, 없으면 날짜순으로 정렬
    let versionEntries;
    const savedOrder = window.versionOrder;
    
    if (savedOrder) {
        const orderArray = Array.isArray(savedOrder) ? savedOrder : JSON.parse(savedOrder);
        
        // 저장된 순서에 없는 새 버전들을 먼저 수집 (최신순)
        const newVersions = [];
        Object.entries(versions).forEach(([name, data]) => {
            if (!orderArray.includes(name)) {
                const metadata = data.metadata || {};
                const timestamp = metadata.timestamp || new Date(metadata.saveDate || 0).getTime();
                newVersions.push({ name, data, timestamp });
            }
        });
        
        // 새 버전들을 날짜순으로 정렬 (최신이 위로)
        newVersions.sort((a, b) => b.timestamp - a.timestamp);
        
        // 기존 저장된 순서의 버전들
        const existingVersions = orderArray
            .filter(name => versions[name]) // 존재하는 버전만 필터링
            .map(name => {
                const data = versions[name];
                const metadata = data.metadata || {};
                const timestamp = metadata.timestamp || new Date(metadata.saveDate || 0).getTime();
                return { name, data, timestamp };
            });
        
        // 새 버전들을 맨 위에, 그 다음 기존 순서대로
        versionEntries = [...newVersions, ...existingVersions];
    } else {
        // 기본: 날짜순으로 정렬 (최신순)
        versionEntries = Object.entries(versions).map(([name, data]) => {
            const metadata = data.metadata || {};
            const timestamp = metadata.timestamp || new Date(metadata.saveDate || 0).getTime();
            return { name, data, timestamp };
        }).sort((a, b) => b.timestamp - a.timestamp);
    }
    
    if (versionEntries.length === 0) {
        versionList.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">저장된 버전이 없습니다.</p>';
        return;
    }
    
    // 현재 버전 정보 표시
    const currentVersionInfo = document.createElement('div');
    currentVersionInfo.className = 'current-version-info';
    currentVersionInfo.innerHTML = `
        <div class="alert alert-info">
            <strong>현재 버전:</strong> ${currentVersion}
        </div>
    `;
    versionList.appendChild(currentVersionInfo);
    
    versionEntries.forEach(({ name, data }) => {
        const metadata = data.metadata || {};
        const saveDate = new Date(metadata.saveDate || metadata.timestamp);
        
        // 날짜/시간 포맷팅
        const dateString = saveDate.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        // 데이터 요약 정보 생성
        let courseCount = 0;
        let matrixDataCount = 0;
        let curriculumCellCount = 0;
        let commonValuesCount = 0;
        
        if (data.coursesTab && Array.isArray(data.coursesTab.courses)) {
            courseCount = data.coursesTab.courses.length;
        }
        
        if (data.matrixTab && data.matrixTab.matrixData) {
            matrixDataCount = Object.keys(data.matrixTab.matrixData).length;
        }
        
        if (data.curriculumTab && data.curriculumTab.curriculumCellTexts) {
            curriculumCellCount = Object.keys(data.curriculumTab.curriculumCellTexts).length;
        }
        
        if (data.commonValuesTab && data.commonValuesTab.commonValuesCellTexts) {
            commonValuesCount = Object.keys(data.commonValuesTab.commonValuesCellTexts).length;
        }
        
        const versionItem = document.createElement('div');
        versionItem.className = 'version-item';
        versionItem.draggable = true;
        versionItem.dataset.versionName = name;
        if (name === currentVersion) {
            versionItem.classList.add('current-version');
        }
        
        versionItem.innerHTML = `
            <div class="version-drag-handle" style="cursor: move; position: absolute; left: 0; top: 0; bottom: 0; width: 20px; display: flex; align-items: center; justify-content: center; color: #999;">
                <span style="font-size: 18px;">⋮⋮</span>
            </div>
            <div class="version-item-info" style="margin-left: 25px;">
                <div class="version-item-name">
                    ${name} <span style="color: #999; font-size: 0.75em; margin-left: 8px;">(${dateString})</span> ${name === currentVersion ? '<span class="badge bg-success">현재</span>' : ''}
                </div>
                ${metadata.description ? `<div class="version-item-description">${metadata.description}</div>` : ''}
                <div class="version-item-summary">
                    <small>
                        교과목 ${courseCount}개 | 
                        매트릭스 데이터 ${matrixDataCount}개 | 
                        이수모형 셀 ${curriculumCellCount}개 | 
                        공통가치 셀 ${commonValuesCount}개
                    </small>
                </div>
            </div>
            <div class="version-item-actions">
                <button class="btn btn-sm btn-primary" onclick="restoreVersion('${name}')" 
                    ${name === currentVersion ? 'disabled' : ''}>복원</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteVersion('${name}')"
                    ${name === '기본' ? 'disabled' : ''}>삭제</button>
            </div>
        `;
        
        versionList.appendChild(versionItem);
    });
    
    // 드래그 앤 드롭 이벤트 핸들러 추가
    setupVersionDragAndDrop();
}

// 버전 드래그 앤 드롭 설정
function setupVersionDragAndDrop() {
    const versionList = document.getElementById('versionList');
    if (!versionList) return;
    
    let draggedItem = null;
    
    const versionItems = versionList.querySelectorAll('.version-item');
    
    versionItems.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedItem = this;
            this.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        });
        
        item.addEventListener('dragend', function(e) {
            this.style.opacity = '';
            draggedItem = null;
        });
        
        item.addEventListener('dragover', function(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            
            const afterElement = getDragAfterElement(versionList, e.clientY);
            if (afterElement == null) {
                versionList.appendChild(draggedItem);
            } else {
                versionList.insertBefore(draggedItem, afterElement);
            }
        });
        
        item.addEventListener('drop', function(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            
            // 새로운 순서 저장
            saveVersionOrder();
            
            return false;
        });
    });
}

// 드래그 위치 계산 헬퍼 함수
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.version-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// 버전 순서 저장
async function saveVersionOrder() {
    const versionList = document.getElementById('versionList');
    if (!versionList) return;
    
    const versionItems = versionList.querySelectorAll('.version-item');
    const order = Array.from(versionItems).map(item => item.dataset.versionName);
    
    // 메모리에 저장
    window.versionOrder = order;
    
    // Firebase에 저장
    if (firebaseInitialized && isOnline) {
        try {
            await saveDataToFirebase('versionOrder', order);
            showToast('버전 순서가 저장되었습니다.');
        } catch (error) {
            showToast('버전 순서가 로컬에만 저장되었습니다.');
        }
    } else {
        showToast('버전 순서가 로컬에 저장되었습니다.');
    }
}

// 버전 관리 모달 닫기
function closeVersionManager() {
    const modal = document.getElementById('versionManagerModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 공통가치대응 테이블 렌더링 (교과목 블럭 포함, 실제 데이터 연동)
function renderCommonValuesTable() {
    // 셀 편집 중일 때는 렌더링하지 않음 (복원 시에는 제외)
    if (isCommonValuesCellEditing && !window.isRestoringVersion) {
        return;
    }
    
    // 편집 중인 셀이 있는지 확인 (복원 시에는 제외)
    const editingCells = document.querySelectorAll('#commonValuesTable .editing-cell');
    if (editingCells.length > 0 && !window.isRestoringVersion) {
        return;
    }
    
    // 공통가치대응 탭이 활성화되어 있지 않으면 렌더링하지 않음 (복원 시에는 제외)
    const commonValuesTab = document.getElementById('commonValuesTab');
    if (commonValuesTab && !commonValuesTab.classList.contains('active') && !window.isRestoringVersion) {
        return;
    }
    
    // 공통가치대응 제목 업데이트 (편집 중이 아닐 때만)
    const titleElement = document.getElementById('commonValuesTitle');
    if (titleElement && titleElement.contentEditable !== 'true') {
        // localStorage 사용 안 함 - 버전 데이터에서 가져오기
        const versionTitle = versions[currentVersion]?.commonValuesTab?.commonValuesTitleText;
        if (versionTitle) {
            titleElement.textContent = versionTitle;
        } else {
            titleElement.textContent = '공통가치대응';
        }
    }
    
/// ... existing code ...

// 폴리곤 선택 상태 관리 (전역)
let selectedCommonValuesBlob = null;
window.selectedCommonValuesBlob = null;
const commonValuesBlobData = {};

// 그룹명 사용자 지정 매핑
let commonValuesGroupNames = {
    value1: '환경의 지속가능성',
    value2: '미래기술의 활용',
    value3: '창의적 문제해결'
};
// VALUE별 교과목 id 목록 (전역)
let valueCourseIds = { value1: [], value2: [], value3: [] };
const valueKeys = ['value1', 'value2', 'value3'];
let groupLabelPositions = new Map(); // 그룹 라벨 위치 저장 {groupKey -> {x, y, width, height}}

function renderCommonValuesNetworkGraph() {
    const container = document.getElementById('commonValuesNetworkGraph');
    if (!container) return;

    // VALUE1,2,3에 포함된 교과목 id를 모두 모은다
    const subjectTypes = [
        '설계', '디지털', '역사', '이론', '도시', '사회', '기술', '실무', '비교과'
    ];
    
    // commonValuesCopiedBlocks 구조 확인
    
    // 전역 valueCourseIds 초기화
    valueCourseIds = { value1: [], value2: [], value3: [] };
    
    subjectTypes.forEach(subjectType => {
        valueKeys.forEach(key => {
            if (commonValuesCopiedBlocks[subjectType] && Array.isArray(commonValuesCopiedBlocks[subjectType][key])) {
                valueCourseIds[key].push(...commonValuesCopiedBlocks[subjectType][key]);
            }
        });
    });
    // 중복 제거
    valueKeys.forEach(key => {
        valueCourseIds[key] = Array.from(new Set(valueCourseIds[key]));
    });
    
    // 비교과 노드 ID 누락 검사 및 자동 복구
    const allExtracurricularIds = [];
    Object.values(valueCourseIds).forEach(ids => {
        ids.forEach(id => {
            if (id.startsWith('extracurricular-') && !allExtracurricularIds.includes(id)) {
                allExtracurricularIds.push(id);
            }
        });
    });
    
    // extracurricularNameMap에 없는 ID 자동 생성
    const missingNameMappings = allExtracurricularIds.filter(id => 
        !window.extracurricularNameMap || !window.extracurricularNameMap[id]
    );
    
    if (missingNameMappings.length > 0) {
        missingNameMappings.forEach(id => {
            if (!window.extracurricularNameMap) {
                window.extracurricularNameMap = {};
            }
            window.extracurricularNameMap[id] = id.replace('extracurricular-', '');
        });
    }

    // 노드: 교과목만 추가 (VALUE1,2,3 노드 제거)
    const nodes = [];
    const nodeIdSet = new Set();
    valueKeys.forEach(key => {
        valueCourseIds[key].forEach((id, idx) => {
            if (!nodeIdSet.has(id)) {
                // 비교과 블럭 처리
                if (id.startsWith('extracurricular-')) {
                    const name = window.extracurricularNameMap ? window.extracurricularNameMap[id] : id.replace('extracurricular-', '');
                    
                    // 🔍 비교과 노드 생성 검증
                    if (!name || name.trim() === '') {
                        return; // 이 노드 스킵
                    }
                    
                    const { subjectTypeColors, categoryColors } = generateColorLegend();
                    
                    let nodeColor = {};
                    if (colorModeBySubjectType) {
                        nodeColor.background = subjectTypeColors['비교과'] || '#f1f8e9';
                        nodeColor.border = '#757575';
                    } else {
                        nodeColor.background = categoryColors['기타'] || '#f3e5f5';
                        nodeColor.border = '#7b1fa2';
                    }
                    
                    nodes.push({
                        id: id,
                        label: name,
                        group: key,
                        shape: 'box',
                        color: {
                            background: nodeColor.background,
                            border: nodeColor.border
                        },
                        font: {
                            color: '#343a40',
                            size: 14,
                            face: 'arial'
                        },
                        fixed: false,
                        isExtracurricular: true // 비교과 노드 표시
                    });
                    nodeIdSet.add(id);
                } else {
                    // 일반 교과목 처리
                    const course = courses.find(c => c.id === id);
                    if (!course) {
                        // Course not found for courseId
                    }
                    if (course) {
                    let nodeColor = {};
                    const { subjectTypeColors, categoryColors } = generateColorLegend();
                    
                    if (colorModeBySubjectType) {
                        // 과목분류별 색상
                        nodeColor.background = subjectTypeColors[course.subjectType] || '#f5f5f5';
                        // 테두리는 배경색보다 진한 색으로
                        const borderColors = {
                            '설계': '#9e9e9e',
                            '디지털': '#a1887f',
                            '역사': '#d84315',
                            '이론': '#00897b',
                            '도시': '#c2185b',
                            '사회': '#5e35b1',
                            '기술': '#ef6c00',
                            '실무': '#43a047',
                            '비교과': '#757575'
                        };
                        nodeColor.border = borderColors[course.subjectType] || '#757575';
                    } else {
                        // 구분별 색상
                        nodeColor.background = categoryColors[course.category] || '#f8f9fa';
                        // 테두리는 배경색보다 진한 색으로
                        const borderColors = {
                            '교양': '#6c757d',
                            '건축적사고': '#1976d2',
                            '설계': '#c62828',
                            '기술': '#f57c00',
                            '실무': '#388e3c',
                            '기타': '#7b1fa2'
                        };
                        nodeColor.border = borderColors[course.category] || '#6c757d';
                    }
                    // 그룹 라벨 위치 기준으로 노드 초기 위치 배치 (라벨 아래쪽, x축으로 분산)
                    let initX = undefined, initY = undefined;
                    if (typeof groupLabelPositions !== 'undefined' && groupLabelPositions[key]) {
                        // 더 나은 초기 배치: 원형 패턴으로 배치 (간격 확대)
                        const totalNodes = valueCourseIds[key].length;
                        const radius = Math.max(120, totalNodes * 25); // 노드 수에 따라 반지름 조정 (간격 확대)
                        const angleStep = (2 * Math.PI) / totalNodes;
                        const angle = idx * angleStep;
                        
                        // 원형 배치로 초기 위치 계산 (더 넓은 간격)
                        initX = groupLabelPositions[key].x + Math.cos(angle) * radius;
                        initY = groupLabelPositions[key].y + 120 + Math.sin(angle) * radius;
                        
                        // 속하지 않은 그룹 폴리곤(hull)과 일정 거리 이상 떨어지도록 위치 조정
                        valueKeys.forEach(otherKey => {
                            if (otherKey !== key && commonValuesBlobData[otherKey]) {
                                // hull 경계와의 최소 거리 계산
                                const hull = commonValuesBlobData[otherKey];
                                let minDist = Infinity;
                                hull.forEach(pt => {
                                    const dx = initX - pt.x;
                                    const dy = initY - pt.y;
                                    const dist = Math.sqrt(dx*dx + dy*dy);
                                    if (dist < minDist) minDist = dist;
                                });
                                // 만약 너무 가까우면(120px 미만) hull 바깥 방향으로 밀어냄
                                if (minDist < 120) {
                                    // hull 중심 계산
                                    let hullCenterX = 0, hullCenterY = 0;
                                    hull.forEach(pt => { hullCenterX += pt.x; hullCenterY += pt.y; });
                                    hullCenterX /= hull.length; hullCenterY /= hull.length;
                                    // 바깥 방향으로 120-minDist 만큼 이동
                                    const dx = initX - hullCenterX;
                                    const dy = initY - hullCenterY;
                                    const len = Math.sqrt(dx*dx + dy*dy) || 1;
                                    initX += (dx/len) * (120-minDist);
                                    initY += (dy/len) * (120-minDist);
                                }
                            }
                        });
                    }
                    nodes.push({
                        id: course.id,
                        label: course.courseName,
                        group: key,
                        shape: 'box',
                        color: {
                            background: nodeColor.background,
                            border: nodeColor.border
                        },
                        font: {
                            color: '#343a40',
                            size: 14,
                            face: 'arial'
                        },
                        x: initX,
                        y: initY,
                        fixed: false,
                        subjectType: course.subjectType,
                        category: course.category
                    });
                    nodeIdSet.add(id);
                    }
                }
            }
        });
    });
    
    // 비교과 텍스트를 노드로 추가 (VALUE 셀)
    valueKeys.forEach(key => {
        // extracurricularTexts 처리
        if (extracurricularTexts[key] && extracurricularTexts[key].length > 0) {
            extracurricularTexts[key].forEach((text, idx) => {
                const nodeId = `extracurricular-${key}-${idx}`;
                if (!nodeIdSet.has(nodeId)) {
                    const { subjectTypeColors, categoryColors } = generateColorLegend();
                    let nodeColor = {};
                    if (colorModeBySubjectType) {
                        nodeColor.background = subjectTypeColors['비교과'] || '#f1f8e9';
                        nodeColor.border = '#757575';
                    } else {
                        nodeColor.background = categoryColors['기타'] || '#f3e5f5';
                        nodeColor.border = '#7b1fa2';
                    }
                    
                    // 그룹 라벨 위치 기준으로 노드 초기 위치 배치
                    let initX = undefined, initY = undefined;
                    if (typeof groupLabelPositions !== 'undefined' && groupLabelPositions[key]) {
                        const courseNodeCount = valueCourseIds[key].length;
                        const totalExtracurricular = extracurricularTexts[key].length;
                        const totalNodes = courseNodeCount + totalExtracurricular;
                        
                        // 원형 배치로 초기 위치 계산 (교과목 노드들 바깥쪽에 배치)
                        const baseRadius = Math.max(120, courseNodeCount * 25);
                        const radius = baseRadius + 60; // 교과목 노드들보다 바깥쪽에 배치 (간격 확대)
                        const angleStep = (2 * Math.PI) / totalExtracurricular;
                        const angle = idx * angleStep;
                        
                        initX = groupLabelPositions[key].x + Math.cos(angle) * radius;
                        initY = groupLabelPositions[key].y + 100 + Math.sin(angle) * radius;
                    }
                    
                    nodes.push({
                        id: nodeId,
                        label: text,
                        group: key,
                        shape: 'box',
                        color: {
                            background: nodeColor.background,
                            border: nodeColor.border
                        },
                        font: {
                            color: '#343a40',
                            size: 14,
                            face: 'arial'
                        },
                        x: initX,
                        y: initY,
                        fixed: false,
                        isExtracurricular: true // 비교과 노드 표시
                    });
                    nodeIdSet.add(nodeId);
                }
            });
        }
        
        // extracurricularBlocks 처리 (비교과 블럭)
        if (extracurricularBlocks[key] && extracurricularBlocks[key].length > 0) {
            extracurricularBlocks[key].forEach((name, idx) => {
                const nodeId = `extracurricular-block-${key}-${idx}`;
                if (!nodeIdSet.has(nodeId)) {
                    const { subjectTypeColors, categoryColors } = generateColorLegend();
                    let nodeColor = {};
                    if (colorModeBySubjectType) {
                        nodeColor.background = subjectTypeColors['비교과'] || '#f1f8e9';
                        nodeColor.border = '#757575';
                    } else {
                        nodeColor.background = categoryColors['기타'] || '#f3e5f5';
                        nodeColor.border = '#7b1fa2';
                    }
                    
                    // 그룹 라벨 위치 기준으로 노드 초기 위치 배치
                    let initX = undefined, initY = undefined;
                    if (typeof groupLabelPositions !== 'undefined' && groupLabelPositions[key]) {
                        const courseNodeCount = valueCourseIds[key].length;
                        const extracurricularTextCount = extracurricularTexts[key] ? extracurricularTexts[key].length : 0;
                        const extracurricularStartIdx = courseNodeCount + extracurricularTextCount + idx;
                        initX = groupLabelPositions[key].x + (extracurricularStartIdx * 60) - (30 * (courseNodeCount + extracurricularTextCount + extracurricularBlocks[key].length));
                        initY = groupLabelPositions[key].y + 80;
                    }
                    
                    nodes.push({
                        id: nodeId,
                        label: name,
                        group: key,
                        shape: 'box',
                        color: {
                            background: nodeColor.background,
                            border: nodeColor.border
                        },
                        font: {
                            color: '#343a40',
                            size: 14,
                            face: 'arial'
                        },
                        x: initX,
                        y: initY,
                        fixed: false,
                        isExtracurricular: true // 비교과 노드 표시
                    });
                    nodeIdSet.add(nodeId);
                }
            });
        }
    });
    
    // 비교과 병합 셀의 텍스트는 노드로 추가하지 않음 (처음 추가할 때는 노드 생성 안함)
    /*
    if (extracurricularMergedTexts && extracurricularMergedTexts.length > 0) {
        extracurricularMergedTexts.forEach((text, idx) => {
            const nodeId = `extracurricular-merged-${idx}`;
            if (!nodeIdSet.has(nodeId)) {
                const { subjectTypeColors, categoryColors } = generateColorLegend();
                let nodeColor = {};
                if (colorModeBySubjectType) {
                    nodeColor.background = subjectTypeColors['비교과'] || '#f1f8e9';
                    nodeColor.border = '#757575';
                } else {
                    nodeColor.background = categoryColors['기타'] || '#f3e5f5';
                    nodeColor.border = '#7b1fa2';
                }
                
                nodes.push({
                    id: nodeId,
                    label: text,
                    group: 'merged', // 병합 셀의 텍스트는 별도 그룹
                    shape: 'box',
                    color: {
                        background: nodeColor.background,
                        border: nodeColor.border
                    },
                    font: {
                        color: '#343a40',
                        size: 14,
                        face: 'arial'
                    },
                    fixed: false,
                    isExtracurricular: true // 비교과 노드 표시
                });
                nodeIdSet.add(nodeId);
            }
        });
    }
    */
    
    // 생성된 노드 수 확인

    // 생성된 노드 수 확인

    // 엣지: 같은 학년-학기 내 교과목끼리만 연결
    const edges = [];
    // 모든 노드(course) 정보를 id로 빠르게 참조
    const nodeCourseMap = {};
    nodes.forEach(n => {
        const course = courses.find(c => c.id === n.id);
        if (course) nodeCourseMap[n.id] = course;
    });
    // yearSemester별로 그룹화
    const yearSemesterGroups = {};
    nodes.forEach(n => {
        const course = nodeCourseMap[n.id];
        if (course && course.yearSemester) {
            if (!yearSemesterGroups[course.yearSemester]) yearSemesterGroups[course.yearSemester] = [];
            yearSemesterGroups[course.yearSemester].push(n.id);
        }
    });
    // 각 yearSemester 그룹 내에서 모든 쌍 연결 (단, 자기 자신 제외)
    Object.entries(yearSemesterGroups).forEach(([yearSemester, groupIds]) => {
        for (let i = 0; i < groupIds.length; i++) {
            for (let j = i + 1; j < groupIds.length; j++) {
                // 같은 학년-학기 연결은 더 두껍게, yearSemester 텍스트 팝업
                edges.push({ from: groupIds[i], to: groupIds[j], width: 3, title: yearSemester });
                edges.push({ from: groupIds[j], to: groupIds[i], width: 3, title: yearSemester });
            }
        }
    });

    // 추가: 같은 과목분류를 가지지만 다른 value 그룹에 속한 노드들을 점선으로 연결
    const subjectTypeGroups = {};
    nodes.forEach(n => {
        const course = nodeCourseMap[n.id];
        if (course && course.subjectType) {
            if (!subjectTypeGroups[course.subjectType]) subjectTypeGroups[course.subjectType] = [];
            subjectTypeGroups[course.subjectType].push(n.id);
        }
    });
    
    // 각 과목분류 그룹 내에서 다른 value 그룹에 속한 노드들만 연결
    Object.entries(subjectTypeGroups).forEach(([subjectType, nodeIds]) => {
        if (nodeIds.length > 1) {
            for (let i = 0; i < nodeIds.length; i++) {
                for (let j = i + 1; j < nodeIds.length; j++) {
                    const nodeId1 = nodeIds[i];
                    const nodeId2 = nodeIds[j];
                    
                    // 각 노드가 속한 value 그룹 찾기
                    let node1ValueGroup = null;
                    let node2ValueGroup = null;
                    
                    for (const [valueKey, valueNodeIds] of Object.entries(valueCourseIds)) {
                        if (valueNodeIds.includes(nodeId1)) node1ValueGroup = valueKey;
                        if (valueNodeIds.includes(nodeId2)) node2ValueGroup = valueKey;
                    }
                    
                    // 다른 value 그룹에 속한 경우에만 점선으로 연결
                    if (node1ValueGroup && node2ValueGroup && node1ValueGroup !== node2ValueGroup) {
                        edges.push({
                            from: nodeId1,
                            to: nodeId2,
                            dashes: true,  // 점선
                            width: 1.5,
                            color: { color: '#9e9e9e', opacity: 0.5 },
                            title: `${subjectType}`,
                            arrows: { 
                                to: { enabled: true, scaleFactor: 0.35 },
                                from: { enabled: true, scaleFactor: 0.35 }
                            },
                            smooth: { type: 'curvedCW', roundness: 0.2 }
                        });
                    }
                }
            }
        }
    });
    
    // 추가: 비교과 노드들 사이의 분야연결엣지 (점선) 생성
    const extracurricularGroups = {};
    nodes.forEach(n => {
        if (n.isExtracurricular && n.group) {
            if (!extracurricularGroups[n.group]) extracurricularGroups[n.group] = [];
            extracurricularGroups[n.group].push(n.id);
        }
    });
    
    // 비교과 노드들을 서로 다른 그룹끼리 점선으로 연결
    const extracurricularGroupKeys = Object.keys(extracurricularGroups);
    if (extracurricularGroupKeys.length > 1) {
        for (let i = 0; i < extracurricularGroupKeys.length; i++) {
            for (let j = i + 1; j < extracurricularGroupKeys.length; j++) {
                const group1 = extracurricularGroupKeys[i];
                const group2 = extracurricularGroupKeys[j];
                const group1Nodes = extracurricularGroups[group1];
                const group2Nodes = extracurricularGroups[group2];
                
                // 각 그룹의 노드들을 서로 연결
                group1Nodes.forEach(nodeId1 => {
                    group2Nodes.forEach(nodeId2 => {
                        edges.push({
                            from: nodeId1,
                            to: nodeId2,
                            dashes: true,  // 점선
                            width: 1.5,
                            color: { color: '#9e9e9e', opacity: 0.5 },
                            title: `비교과 연결`,  // VALUE 구분 제거
                            isExtracurricular: true,  // 비교과 엣지 표시
                            arrows: { 
                                to: { enabled: true, scaleFactor: 0.35 },
                                from: { enabled: true, scaleFactor: 0.35 }
                            },
                            smooth: { type: 'curvedCW', roundness: 0.3 }
                        });
                    });
                });
            }
        }
    }

    // 네트워크 옵션 (vis-network 기본 스타일 완전 제어)
    const options = {
        nodes: {
            chosen: {
                node: function(values, id, selected, hovering) {
                    // 그룹 노드인지 확인 (그룹 노드는 선택 효과 비활성화)
                    const node = network.body.data.nodes.get(id);
                    if (node && node.isGroup) {
                        // 그룹 노드는 선택/호버 효과 없음
                        return;
                    }
                    
                    // font 객체가 없으면 기본값으로 초기화
                    if (!values.font || typeof values.font !== 'object') {
                        values.font = {
                            color: '#343a40',
                            size: 14,
                            face: 'arial'
                        };
                    }
                    
                    // 기본 스타일 유지 (배경색은 변경하지 않음)
                    if (selected) {
                        // values.borderColor = '#454545ff';  // 검은색으로 선택 상태 표시
                        values.borderWidth = 3;
                        values.font.color = '#020202ff';
                    } else if (hovering) {
                        values.borderColor = values.color && values.color.border ? values.color.border : '#01579b';  // 원래 노드의 테두리 색상 유지
                        values.borderWidth = 2;
                        values.font.color = values.color && values.color.border ? values.color.border : '#01579b';
                    } else {
                        // 기본 상태에서는 그룹별 색상 유지 (배경색은 그대로)
                        values.borderColor = values.color && values.color.border ? values.color.border : '#01579b';
                        values.borderWidth = 1;
                        values.font.color = values.color && values.color.border ? values.color.border : '#01579b';
                    }
                    // 배경색은 절대 변경하지 않음 - 원래 그룹 색상 유지
                }
            },
            shadow: {
                enabled: true,
                color: 'rgba(0,0,0,0.3)',
                size: 8,
                x: 2,
                y: 2
            },
            borderWidth: 1,
            borderWidthSelected: 4
        },
        // groups 설정 제거 - 노드별로 개별 색상 적용
        // 엣지 설정 (vis-network 기본 스타일 완전 제어)
        edges: {
            color: { 
                color: '#bdbdbd', 
                highlight: '#0d30be',  // 호버 시 파란색
                hover: '#bdbdbd'       // 호버 시 파란색
            },
            chosen: {
                edge: function(values, id, selected, hovering) {
                    // 🔧 엣지 정보 가져오기
                    const edge = network.body.data.edges.get(id);
                    const isDashedEdge = edge && edge.dashes === true;
                    
                    if (selected) {
                        if (edge.isExtracurricular) {
                            // 비교과 엣지: 비교과 테마색 사용
                            values.color = '#8bc34a';
                        } else if (isDashedEdge && edge.title) {
                            // 🔧 점선 엣지: 과목분류색 사용
                            const subjectType = edge.title.trim();
                            const subjectTypeBorderColors = {
                                '설계': '#9e9e9e',
                                '디지털': '#a1887f',
                                '역사': '#d84315',
                                '이론': '#00897b',
                                '도시': '#c2185b',
                                '사회': '#5e35b1',
                                '기술': '#ef6c00',
                                '실무': '#43a047',
                                '비교과': '#8bc34a'
                            };
                            values.color = subjectTypeBorderColors[subjectType] || '#4caf50';
                        } else {
                            values.color = '#515151ff';  // 일반 엣지 선택 시
                        }
                        values.width = 3;
                    } else if (hovering) {
                        if (edge.isExtracurricular) {
                            // 비교과 엣지 호버: 비교과 테마색 사용
                            values.color = '#8bc34a';
                        } else if (isDashedEdge && edge.title) {
                            // 🔧 점선 엣지 호버: 과목분류색 사용 (약간 밝게)
                            const subjectType = edge.title.trim();
                            const subjectTypeLightColors = {
                                '설계': '#9e9e9e',
                                '디지털': '#a1887f',
                                '역사': '#d84315',
                                '이론': '#00897b',
                                '도시': '#c2185b',
                                '사회': '#5e35b1',
                                '기술': '#ef6c00',
                                '실무': '#43a047',
                                '비교과': '#8bc34a'
                            };
                            values.color = subjectTypeLightColors[subjectType] || '#282828ff';
                        } else {
                            values.color = '#292929ff';  // 일반 엣지 호버 시
                        }
                        values.width = 2;
                    } else {
                        values.color = '#bdbdbd';  // 기본 회색
                        values.width = 1;
                    }
                }
            },
            arrows: { 
                to: { enabled: true, scaleFactor: 0.35 },
                from: { enabled: true, scaleFactor: 0.35 }
            },
            smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 },
            length: 20 // 엣지 길이 더 길게
        },
        layout: {
            improvedLayout: true,
            hierarchical: false,
        },
        physics: {
            enabled: true,
            barnesHut: {
                gravitationalConstant: -5000, // 🌟 더 강한 반발력으로 노드 간격 증가
                centralGravity: 0.1, // 🌟 중앙 중력을 더 줄여서 분산도 증가
                springLength: 250, // 🌟 스프링 길이를 더 늘려서 노드간 거리 증가
                springConstant: 0.001, // 🌟 스프링 상수 조정
                damping: 0.7, // 🌟 감쇠 조정
                avoidOverlap: 1.2 // 🌟 겹침 방지 강화
            },
            stabilization: { 
                enabled: false // 안정화 비활성화 - 노드가 계속 움직임
            },
            minVelocity: 0.01, // 최소 속도를 매우 낮게 설정
            maxVelocity: 50, // 최대 속도 제한
            adaptiveTimestep: true, // 적응형 시간 간격
        },
        interaction: {
            hover: true,
            tooltipDelay: 120,
            dragNodes: true,  // 노드 드래그 가능
            dragView: true,   // 뷰 드래그 가능
            selectConnectedEdges: false, // 노드 선택 시 연결된 엣지 선택하지 않음
        },
        autoResize: true,
        height: '100%',
        width: '100%',
        // physics: {
        //     enabled: true,
        //     barnesHut: {
        //         gravitationalConstant: -2000, // 최적화: 반발력 조정
        //         centralGravity: 0.3, // 중앙 중력 완전 제거
        //         springLength: 12000, // 최적화: 스프링 길이 단축
        //         springConstant: 0.0008, // 최적화: 적절한 스프링 상수
        //         damping: 0.80, // 최적화: 강한 감쇠로 빠른 안정화
        //         avoidOverlap: 5 // 최적화: 겹침 방지 최소화
        //     },
        //     stabilization: { 
        //         iterations: 1000,  // 최적화: 안정화 반복 최소화
        //         enabled: true,
        //         updateInterval: 100, // 최적화: 업데이트 간격 증가
        //         fit: true // 최적화: 자동 피팅 활성화
        //     },
        //     adaptiveTimestep: true,
        //     timestep: 0.5, // 최적화: 시간 간격 조정
        //     maxVelocity: 0.1 // 최적화: 최대 속도 제한
        // },
        // interaction: {
        //     hover: true,
        //     tooltipDelay: 120,
        // },
        // autoResize: true,
        // height: '100%',
        // width: '100%',
    };

    // 기존 네트워크 제거
    container.innerHTML = '';
    container.style.display = 'block';
    
    // 모든 노드에 기본 스타일 적용 및 VALUE 그룹 소속 수에 따른 글씨 크기 조정
    nodes.forEach(n => {
        // 해당 노드가 몇 개의 VALUE 그룹에 속하는지 계산
        let valueGroupCount = 0;
        valueKeys.forEach(key => {
            if (valueCourseIds[key].includes(n.id)) {
                valueGroupCount++;
            }
        });
        
        // VALUE 그룹 소속 수에 따라 글씨 크기와 테두리 두께를 함께 조정
        const baseFontSize = 13;
        const fontSizeStep = 3; // 그룹 하나당 2px 증가
        const adjustedFontSize = baseFontSize + valueGroupCount * fontSizeStep;

        // 테두리 두께도 그룹 수에 따라 증가 (기본 2 + 그룹당 1)
        const baseBorderWidth = 1;
        const adjustedBorderWidth = baseBorderWidth + valueGroupCount;

        // font 속성 설정 (단순화)
        n.font = {
            size: adjustedFontSize,
            color: '#495057',
            face: 'Noto Sans KR, Arial, sans-serif',
            strokeWidth: 1,
            strokeColor: '#495057'
        };
        n.borderWidth = adjustedBorderWidth;
        n.shapeProperties = {
            borderRadius: 12
        };
        n.margin = {
            top: 2,
            right: 6,
            bottom: 2,
            left: 6
        };
        
        // 모든 노드를 박스 모양으로 유지하여 교과목 이름이 잘 보이도록
        n.shape = 'box';
        
        // 교과목 이름 표시 보장
        if (!n.label && n.title) {
            n.label = n.title;
        }
        
        // 박스 크기: VALUE 그룹 수에 따라 조정
        const sizeMultiplier = 1 + (valueGroupCount * 0.1); // 10%씩 증가
        n.widthConstraint = { 
            minimum: Math.round(80 * sizeMultiplier), 
            maximum: Math.round(180 * sizeMultiplier)
        };
        n.heightConstraint = { 
            minimum: Math.round(30 * sizeMultiplier), 
            maximum: Math.round(50 * sizeMultiplier) 
        };
        
        // 모서리 처리: 교과목 블럭 스타일 (12px radius)
        n.shapeProperties = {
            borderRadius: 12 // 교과목 블럭과 동일한 둥근 모서리
        };
        
        // 여백: 교과목 블럭과 유사한 패딩 효과
        n.margin = {
            top: 2,
            right: 6,
            bottom: 2,
            left: 6
        };
    });

    // 네트워크 노드 생성 완료

    // 🛡️ 노드/엣지 데이터 유효성 검증 및 정리
    const validNodes = nodes.filter(node => {
        if (!node || !node.id) return false;
        
        // 노드 데이터의 모든 속성을 안전하게 검증
        const safeNode = { ...node };
        
        // color 속성 검증
        if (safeNode.color && typeof safeNode.color === 'object') {
            const safeColor = {};
            if (safeNode.color.background !== undefined) safeColor.background = safeNode.color.background;
            if (safeNode.color.border !== undefined) safeColor.border = safeNode.color.border;
            if (safeNode.color.highlight && typeof safeNode.color.highlight === 'object') {
                safeColor.highlight = {};
                if (safeNode.color.highlight.background !== undefined) safeColor.highlight.background = safeNode.color.highlight.background;
                if (safeNode.color.highlight.border !== undefined) safeColor.highlight.border = safeNode.color.highlight.border;
            }
            safeNode.color = safeColor;
        }
        
        // font 속성 검증
        if (safeNode.font && typeof safeNode.font === 'object') {
            const safeFont = {};
            if (safeNode.font.color !== undefined) safeFont.color = safeNode.font.color;
            if (safeNode.font.size !== undefined) safeFont.size = safeNode.font.size;
            if (safeNode.font.face !== undefined) safeFont.face = safeNode.font.face;
            if (safeNode.font.background !== undefined) safeFont.background = safeNode.font.background;
            if (safeNode.font.strokeWidth !== undefined) safeFont.strokeWidth = safeNode.font.strokeWidth;
            if (safeNode.font.strokeColor !== undefined) safeFont.strokeColor = safeNode.font.strokeColor;
            safeNode.font = safeFont;
        }
        
        // 기타 속성들 검증
        if (safeNode.opacity !== undefined && (typeof safeNode.opacity !== 'number' || safeNode.opacity < 0 || safeNode.opacity > 1)) {
            safeNode.opacity = 1;
        }
        if (safeNode.borderWidth !== undefined && (typeof safeNode.borderWidth !== 'number' || safeNode.borderWidth < 0)) {
            safeNode.borderWidth = 2;
        }
        
        Object.assign(node, safeNode);
        return true;
    });
    
    const validEdges = edges.filter(edge => {
        if (!edge || !edge.from || !edge.to) return false;
        
        // 특정 손상된 edge ID 제거
        if (edge.id === 'b32b3453-2317-430d-9775-ce82c08eaed0') {
            return false;
        }
        
        // 엣지 데이터의 모든 속성을 안전하게 검증
        const safeEdge = { ...edge };
        
        // color 속성 검증
        if (safeEdge.color && typeof safeEdge.color === 'object') {
            const safeColor = {};
            if (safeEdge.color.color !== undefined) safeColor.color = safeEdge.color.color;
            if (safeEdge.color.highlight !== undefined) safeColor.highlight = safeEdge.color.highlight;
            if (safeEdge.color.hover !== undefined) safeColor.hover = safeEdge.color.hover;
            safeEdge.color = safeColor;
        }
        
        // 기타 속성들 검증
        if (safeEdge.width !== undefined && (typeof safeEdge.width !== 'number' || safeEdge.width < 0)) {
            safeEdge.width = 1;
        }
        if (safeEdge.opacity !== undefined && (typeof safeEdge.opacity !== 'number' || safeEdge.opacity < 0 || safeEdge.opacity > 1)) {
            safeEdge.opacity = 1;
        }
        
        Object.assign(edge, safeEdge);
        return true;
    });
    
    // 데이터 검증 완료
    
    // 🛡️ 안전한 vis-network 인스턴스 생성 (폰트 속성 자동 검증)
    const safeNodeDataSet = window.createSafeVisNetworkDataSet(validNodes);
    // 🔧 엣지는 일반 DataSet 사용 (SpringSolver 호환성 유지)
    const edgeDataSet = new vis.DataSet(validEdges);
    const network = new vis.Network(container, { nodes: safeNodeDataSet, edges: edgeDataSet }, options);
    
    // 🔧 네트워크 생성 후 안정화 및 검증
    setTimeout(() => {
        try {
            // 물리 엔진 데이터 검증
            if (network && network.body && network.body.data && network.body.data.nodes) {
                const nodeCount = network.body.data.nodes.length;
                const edgeCount = network.body.data.edges.length;
                // 네트워크 안정화 완료
                
                // 🛡️ 네트워크 내부 상태 추가 검증
                if (network.body && network.body.nodes) {
                    const nodeIds = Object.keys(network.body.nodes);
                    // 네트워크 내부 노드 초기화 완료
                }
            }
            
            // 초기화 시점 font 검증 (한 번만 수행)
            if (window.validateAndFixNetworkFonts) {
                window.validateAndFixNetworkFonts(network);
            }
            
            // 🛡️ 물리 엔진 안정화
            if (network && network.physics) {
                network.setOptions({
                    physics: {
                        enabled: true,
                        stabilization: {
                            enabled: true,
                            iterations: 100,
                            updateInterval: 25
                        }
                    }
                });
            }
        } catch (error) {
        }
    }, 100);
    
    // 주기적 font 검증 제거 - 초기화 시점에만 수행
    
    // 🚨 오류 복구 시스템 활성화
    window.setupNetworkErrorRecovery(network);
    
    // 그룹 경계 반발력 시스템
    let boundaryForces = new Map(); // nodeId -> {x, y} force vectors
    let repulsionSystemActive = true; // 반발력 시스템 활성화로 변경
    let repulsionInterval = null;
    let stabilityCheckCount = 0; // 안정화 체크 카운터
    let lastNodePositions = new Map(); // 이전 노드 위치 저장
    const stabilityThreshold = 0.5; // 안정화 임계값 (픽셀 단위)
    
    // Directional force system for value groups
    let directionalForceInterval = null;
    let directionalForceActive = true;
    const directionalForceMagnitude = 8.0; // 더 강한 힘으로 증가
     
    // Start directional force system
    function startDirectionalForceSystem() {
        if (directionalForceInterval) clearInterval(directionalForceInterval);
        directionalForceInterval = setInterval(applyDirectionalForces, 30); // 30ms마다 실행 (33fps) - 더 빠른 반응
        directionalForceActive = true;
    }
    
    // Apply directional forces to nodes based on their value group
    function applyDirectionalForces() {
        if (!directionalForceActive) return;
        
        // 최적화: 불필요한 시뮬레이션 호출 제거
        // network.startSimulation();
        
        const nodeIds = nodes.map(n => n.id);
        const positions = network.getPositions(nodeIds);
        
        // 물리 엔진의 body에 직접 힘을 적용
        nodes.forEach(node => {
            if (node.group && positions[node.id]) {
                const body = network.body.nodes[node.id];
                if (!body || !body.options.physics) return;
                
                let forceX = 0;
                let forceY = 0;
                
                if (node.group === 'value1') {
                    // Apply leftward force
                    forceX = -directionalForceMagnitude;
                } else if (node.group === 'value2') {
                    // Apply rightward force
                    forceX = directionalForceMagnitude;
                } else if (node.group === 'value3') {
                    // Apply upward force
                    forceY = -directionalForceMagnitude;
                }
                
                // 물리 힘 적용 비활성화
                // if (forceX !== 0 || forceY !== 0) {
                //     // 물리 엔진 body에 직접 힘 적용
                //     body.vx += forceX * 0.01; // 속도에 힘을 적용
                //     body.vy += forceY * 0.01;
                // }
            }
        });
        
        // 디버깅용 로그 (첫 실행시에만)
        if (directionalForceInterval && !window.directionalForceLogged) {
            window.directionalForceLogged = true;
        }
    }
    
    // Stop directional force system
    function stopDirectionalForceSystem() {
        if (directionalForceInterval) {
            clearInterval(directionalForceInterval);
            directionalForceInterval = null;
        }
        directionalForceActive = false;
    }
    
    // 🌟 스플라인 클릭 시 물리 효과 트리거 함수
    function triggerSplinePhysicsEffect(groupKey, clickPosition) {
        if (window.physicsEffects) {
            window.physicsEffects.triggerExplosion(groupKey, clickPosition);
        }
    }
    
    // 그룹 중심점 계산 헬퍼 함수
    function calculateGroupCenter(nodeIds) {
        let sumX = 0, sumY = 0;
        let validNodes = 0;
        
        nodeIds.forEach(nodeId => {
            let pos;
            try {
                pos = network.getPosition(nodeId);
            } catch (e) {
                // 노드가 존재하지 않는 경우 무시
                return;
            }
            if (pos) {
                sumX += pos.x;
                sumY += pos.y;
                validNodes++;
            }
        });
        
        return validNodes > 0 ? 
            { x: sumX / validNodes, y: sumY / validNodes } : 
            { x: 0, y: 0 };
    }
    
    // 🔧 전체 네트워크 중심점 계산 및 고정 시스템
    let globalNetworkCenter = null; // 전체 네트워크의 고정 중심점
    let networkCenterStabilized = false; // 중심점 안정화 여부
    
    // 전체 네트워크의 중심점 계산
    function calculateGlobalNetworkCenter() {
        const allPositions = network.getPositions();
        let sumX = 0, sumY = 0, validNodes = 0;
        
        Object.values(allPositions).forEach(pos => {
            if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                sumX += pos.x;
                sumY += pos.y;
                validNodes++;
            }
        });
        
        return validNodes > 0 ? 
            { x: sumX / validNodes, y: sumY / validNodes } : 
            { x: 0, y: 0 };
    }
    
    // 전체 네트워크 중심점 유지 시스템 (비활성화)
    function maintainGlobalNetworkCenter() {
        // 중심점 자동 보정 기능 비활성화
        // 노드들의 왼쪽 위 이동 현상을 방지하기 위해 주석 처리
        return;
    }
    
    // 🌟 페이지 로딩시 자동으로 물리효과 시작하는 함수
    function triggerInitialPhysicsEffects() {
        
        // 모든 그룹에 대해 순차적으로 물리효과 적용
        valueKeys.forEach((groupKey, index) => {
            const groupNodeIds = valueCourseIds[groupKey];
            if (!groupNodeIds || groupNodeIds.length === 0) return;
            
            // 각 그룹마다 시간차를 두고 효과 적용 (0.5초씩 간격)
            setTimeout(() => {
                // 그룹 중심점을 클릭 위치로 사용
                const centerPos = calculateGroupCenter(groupNodeIds);
                
                // 약간의 랜덤 오프셋 추가하여 자연스러움 연출
                const clickPosition = {
                    x: centerPos.x + (Math.random() - 0.5) * 100,
                    y: centerPos.y + (Math.random() - 0.5) * 100
                };
                
                // 기존 물리효과 함수 호출 (강도는 조금 약하게)
                triggerSplinePhysicsEffectGentle(groupKey, clickPosition);
                
            }, index * 500); // 각 그룹마다 0.5초씩 지연
        });
    }
    
    // 🌟 부드러운 버전의 물리효과 (페이지 로딩시용)
    function triggerSplinePhysicsEffectGentle(groupKey, clickPosition) {
        if (window.physicsEffects) {
            // 새로운 물리 시스템을 사용하여 부드러운 폭발 효과
            window.physicsEffects.triggerExplosion(groupKey, clickPosition);
        }
    }

    // 최적화: 방향성 힘 시스템 비활성화 (성능 향상)
    // startDirectionalForceSystem();
    
    // 동적 제어점 시스템
    let dynamicControlPoints = new Map(); // groupKey -> [{x, y, vx, vy, originalX, originalY}]
    let controlPointForces = new Map(); // controlPointId -> {x, y} force vectors
    
    // 반발력 시스템을 즉시 시작 (네트워크 안정화와 무관하게) - 활성화됨
    
    // 스플라인 데이터가 없는 경우를 대비한 테스트 데이터 생성
    setTimeout(() => {
        if (!commonValuesBlobData.value1 || commonValuesBlobData.value1.length === 0) {
            // 각 그룹 주변에 간단한 직사각형 스플라인 생성
            valueKeys.forEach((key, index) => {
                const centerX = 200 + (index * 300); // 그룹별로 300px씩 떨어뜨림
                const centerY = 200;
                const width = 150;
                const height = 150;
                
                commonValuesBlobData[key] = [
                    {x: centerX - width/2, y: centerY - height/2}, // 왼쪽 위
                    {x: centerX + width/2, y: centerY - height/2}, // 오른쪽 위
                    {x: centerX + width/2, y: centerY + height/2}, // 오른쪽 아래
                    {x: centerX - width/2, y: centerY + height/2}  // 왼쪽 아래
                ];
                // Test spline created
            });
        }
        // startRepulsionSystem(); // 반발력 시스템 비활성화 - 노드 이동 현상 방지
    }, 50); // 0.05초 후 즉시 시작 - 더 빠른 시작
    
    // 네트워크 안정화 완료 후에도 다시 한번 확인 - 활성화됨
    network.on('stabilizationIterationsDone', function() {
        // startRepulsionSystem(); // 반발력 시스템 비활성화
        
        // 🔧 네트워크 안정화 완료 후 전체 중심점 고정
        globalNetworkCenter = calculateGlobalNetworkCenter();
        networkCenterStabilized = true;
        
        // 🌟 페이지 로딩시 자동으로 물리효과 시작 (안정화 완료 후)
        setTimeout(() => {
            triggerInitialPhysicsEffects();
        }, 200);
    });
    
    // 최종 백업 - 1초 후 무조건 시작 - 활성화됨
    setTimeout(() => {
        // startRepulsionSystem(); // 반발력 시스템 비활성화
        
        // 🔧 백업용 중심점 고정 (안정화가 완료되지 않은 경우 대비)
        if (!networkCenterStabilized) {
            globalNetworkCenter = calculateGlobalNetworkCenter();
            networkCenterStabilized = true;
        }
        
        // 🌟 백업용 물리효과 시작 (비활성화)
        // triggerInitialPhysicsEffects();
    }, 1000);
    
    // 🌟 페이지 로딩시 자동으로 스플라인 물리효과 시작 (클릭 없이)
    // 자동 물리 효과 비활성화
    // setTimeout(() => {
    //     
    //     // 모든 그룹에 대해 순차적으로 물리효과 적용
    //     valueKeys.forEach((groupKey, index) => {
    //         const groupNodeIds = valueCourseIds[groupKey];
    //         if (!groupNodeIds || groupNodeIds.length === 0) return;
    //         
    //         // 각 그룹마다 시간차를 두고 효과 적용 (1초씩 간격)
    //         setTimeout(() => {
    //             // 그룹 중심점을 클릭 위치로 사용
    //             const centerPos = calculateGroupCenter(groupNodeIds);
    //             
    //             // 약간의 랜덤 오프셋 추가하여 자연스러움 연출
    //             const clickPosition = {
    //                 x: centerPos.x + (Math.random() - 0.5) * 80,
    //                 y: centerPos.y + (Math.random() - 0.5) * 80
    //             };
    //             
    //             // 기존 물리효과 함수 호출
    //             triggerSplinePhysicsEffect(groupKey, clickPosition);
    //             
    //         }, index * 1000); // 각 그룹마다 1초씩 지연
    //     });
    // }, 2000); // 2초 후 시작
    
    // 동적 제어점 초기화 및 업데이트 함수
    function updateDynamicControlPoints(groupKey, splineBoundary) {
        if (!splineBoundary || splineBoundary.length < 3) return;
        
        const controlPoints = [];
        const targetSpacing = 100; // 제어점 간격
        
        // 각 스플라인 선분을 따라 제어점 생성
        for (let i = 0; i < splineBoundary.length; i++) {
            const p1 = splineBoundary[i];
            const p2 = splineBoundary[(i + 1) % splineBoundary.length];
            
            const segmentLength = Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
            );
            
            const numControlPoints = Math.max(1, Math.floor(segmentLength / targetSpacing));
            
            for (let j = 0; j < numControlPoints; j++) {
                const t = j / numControlPoints;
                const x = p1.x + t * (p2.x - p1.x);
                const y = p1.y + t * (p2.y - p1.y);
                
                controlPoints.push({
                    x: x,
                    y: y,
                    vx: 0,
                    vy: 0,
                    originalX: x,
                    originalY: y,
                    segmentIndex: i,
                    t: t
                });
            }
        }
        
        dynamicControlPoints.set(groupKey, controlPoints);
    }
    // 그룹 스플라인 침입 방지 및 밀어내기 함수
    function calculateBoundaryRepulsion() {
        boundaryForces.clear();
        
        // 모든 노드에 대해 반발력 계산
        const allNodes = network.getPositions();
        let totalNodesProcessed = 0;
        let nodesWithForces = 0;
        
        Object.entries(allNodes).forEach(([nodeId, position]) => {
            if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') return;
            
            // 드래그 중인 그룹의 노드는 반발력/인력 계산에서 제외
            let skipNodeForces = false;
            if (isDraggingGroup && draggedGroupKey) {
                const draggedGroupNodes = valueCourseIds[draggedGroupKey] || [];
                if (draggedGroupNodes.includes(nodeId)) {
                    skipNodeForces = true;
                }
            }
            
            totalNodesProcessed++;
            
            if (skipNodeForces) return; // 드래그 중인 노드는 힘 계산 건너뛰기
            
            // 1. 그룹 라벨과 노드 간의 스프링 반발력 계산 (더 넓은 범위)
            groupLabelPositions.forEach((labelPos, groupKey) => {
                const dx = position.x - labelPos.x;
                const dy = position.y - labelPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const maxRepulsionDistance = 200; // 반발력이 작용하는 최대 거리 (기존 120 → 200)
                
                if (distance > 0 && distance < maxRepulsionDistance) {
                    // 스프링 반발력 공식: F = k * (equilibrium_distance - current_distance)
                    const equilibriumDistance = 160; // 평형 거리 (증가)
                    const springConstant = 2.0; // 스프링 상수 (강화)
                    
                    // 라벨 크기를 고려한 추가 반발력
                    const labelWidth = labelPos.width || 100;
                    const labelHeight = labelPos.height || 30;
                    
                    // 라벨 중심으로부터의 거리에 따른 반발력 계산
                    let forceMultiplier = 1.0;
                    
                    // 라벨의 직사각형 영역 내부인지 확인
                    const insideRect = Math.abs(dx) < labelWidth/2 && Math.abs(dy) < labelHeight/2;
                    if (insideRect) {
                        forceMultiplier = 5.0; // 라벨 직사각형 내부에서는 5배 강한 반발력 (증가)
                    } else if (distance < equilibriumDistance) {
                        // 평형 거리보다 가까운 경우 거리에 반비례하는 강한 반발력
                        forceMultiplier = 3.0 + (equilibriumDistance - distance) / equilibriumDistance; // 기본값 증가
                    } else {
                        // 평형 거리보다 먼 경우에도 약간의 밀어내는 힘 유지
                        forceMultiplier = 0.3; // 0.1에서 0.3으로 증가
                    }
                    
                    // 스프링 반발력 계산
                    const springForce = springConstant * (equilibriumDistance - distance) * forceMultiplier;
                    
                    // 거리 기반 감쇠 (너무 멀리서는 약한 힘)
                    const dampingFactor = Math.max(0.1, (maxRepulsionDistance - distance) / maxRepulsionDistance);
                    const finalForce = springForce * dampingFactor;
                    
                    // 정규화된 방향 벡터
                    const normalizedX = dx / distance;
                    const normalizedY = dy / distance;
                    
                    if (!boundaryForces.has(nodeId)) {
                        boundaryForces.set(nodeId, { x: 0, y: 0 });
                    }
                    const currentForce = boundaryForces.get(nodeId);
                    currentForce.x += normalizedX * finalForce;
                    currentForce.y += normalizedY * finalForce;
                }
            });
            
            // 2. 동적 제어점과 노드 사이의 양방향 반발력
            valueKeys.forEach(groupKey => {
                const groupBoundary = commonValuesBlobData[groupKey];
                if (!groupBoundary || groupBoundary.length < 3) return;
                
                // 제어점이 없으면 초기화
                if (!dynamicControlPoints.has(groupKey)) {
                    updateDynamicControlPoints(groupKey, groupBoundary);
                }
                
                const controlPoints = dynamicControlPoints.get(groupKey);
                const groupNodeIds = valueCourseIds[groupKey] || [];
                const isGroupMember = groupNodeIds.includes(nodeId);
                
                // 그룹 외부 노드만 제어점과 상호작용
                if (!isGroupMember && controlPoints) {
                    controlPoints.forEach((controlPoint, cpIndex) => {
                        const dx = position.x - controlPoint.x;
                        const dy = position.y - controlPoint.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance > 0 && distance < 150) { // 상호작용 범위
                            // 반발력 계산
                            let forceStrength = 0;
                            if (distance < 50) {
                                forceStrength = 800 / Math.pow(distance + 1, 1.5);
                            } else if (distance < 100) {
                                forceStrength = 400 / Math.pow(distance + 5, 1.8);
                            } else {
                                forceStrength = 200 / Math.pow(distance + 10, 2);
                            }
                            
                            const normalizedX = dx / distance;
                            const normalizedY = dy / distance;
                            
                            // 노드에 가해지는 힘
                            if (!boundaryForces.has(nodeId)) {
                                boundaryForces.set(nodeId, { x: 0, y: 0 });
                            }
                            const nodeForce = boundaryForces.get(nodeId);
                            nodeForce.x += normalizedX * forceStrength;
                            nodeForce.y += normalizedY * forceStrength;
                            
                            // 제어점에 가해지는 반대 방향 힘
                            const cpId = `${groupKey}_${cpIndex}`;
                            if (!controlPointForces.has(cpId)) {
                                controlPointForces.set(cpId, { x: 0, y: 0 });
                            }
                            const cpForce = controlPointForces.get(cpId);
                            cpForce.x -= normalizedX * forceStrength * 0.5; // 제어점은 더 적게 움직임
                            cpForce.y -= normalizedY * forceStrength * 0.5;
                        }
                    });
                }
            });
            
            // 3. 침입 노드 감지 및 강제 추출 시스템
            let isIntruder = false;
            valueKeys.forEach(groupKey => {
                const groupBoundary = commonValuesBlobData[groupKey];
                if (!groupBoundary || groupBoundary.length < 3) return;
                
                const groupNodeIds = valueCourseIds[groupKey] || [];
                const isGroupMember = groupNodeIds.includes(nodeId);
                
                // 그룹에 속하지 않는 노드가 스플라인 내부에 있는지 검사
                if (!isGroupMember) {
                    const isInsideSpline = isPointInPolygon(position, groupBoundary);
                    
                    // 침입 노드 발견! 점진적 추출
                    if (isInsideSpline) {
                        isIntruder = true;
                        
                        // 가장 가까운 스플라인 경계점 찾기
                        let closestBoundaryPoint = null;
                        let minDistanceToBoundary = Infinity;
                        
                        // 스플라인의 각 선분에서 가장 가까운 점 찾기
                        for (let i = 0; i < groupBoundary.length; i++) {
                            const p1 = groupBoundary[i];
                            const p2 = groupBoundary[(i + 1) % groupBoundary.length];
                            
                            // 선분에서 노드까지의 가장 가까운 점 계산
                            const lineVec = { x: p2.x - p1.x, y: p2.y - p1.y };
                            const nodeVec = { x: position.x - p1.x, y: position.y - p1.y };
                            const lineLength = Math.sqrt(lineVec.x * lineVec.x + lineVec.y * lineVec.y);
                            
                            if (lineLength > 0) {
                                const t = Math.max(0, Math.min(1, (nodeVec.x * lineVec.x + nodeVec.y * lineVec.y) / (lineLength * lineLength)));
                                const closestPoint = {
                                    x: p1.x + t * lineVec.x,
                                    y: p1.y + t * lineVec.y
                                };
                                
                                const distToPoint = Math.sqrt(
                                    Math.pow(position.x - closestPoint.x, 2) + 
                                    Math.pow(position.y - closestPoint.y, 2)
                                );
                                
                                if (distToPoint < minDistanceToBoundary) {
                                    minDistanceToBoundary = distToPoint;
                                    closestBoundaryPoint = closestPoint;
                                }
                            }
                        }
                        
                        // 경계점 방향으로 부드러운 추출력 적용
                        if (closestBoundaryPoint) {
                            // 노드에서 경계점으로의 방향
                            const dx = closestBoundaryPoint.x - position.x;
                            const dy = closestBoundaryPoint.y - position.y;
                            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                            
                            // 정규화된 방향 벡터
                            const dirX = dx / distance;
                            const dirY = dy / distance;
                            
                            // 거리에 따라 점진적으로 증가하는 추출력
                            // 중심에서 멀수록 약하게, 경계 가까이서는 더 강하게
                            const baseForce = 200; // 기본 추출력 (훨씬 부드럽게)
                            const distanceFactor = Math.min(1.0, minDistanceToBoundary / 100); // 거리에 따른 계수
                            const expulsionForce = baseForce + (1 - distanceFactor) * 300; // 최대 500
                            
                            if (!boundaryForces.has(nodeId)) {
                                boundaryForces.set(nodeId, { x: 0, y: 0 });
                            }
                            const currentForce = boundaryForces.get(nodeId);
                            // 기존 힘에 추가하되, 추출력을 우선시
                            currentForce.x = currentForce.x * 0.2 + dirX * expulsionForce * 0.8;
                            currentForce.y = currentForce.y * 0.2 + dirY * expulsionForce * 0.8;
                        }
                        
                        // 안정화 약간만 해제
                        stabilityCheckCount = Math.max(0, stabilityCheckCount - 1);
                    }
                    // 침입하지 않은 외부 노드에 대한 일반 반발력
                    else {
                        const distanceToSpline = getDistanceToSpline(position, groupBoundary);
                        const maxRepulsionDistance = 200;
                        
                        if (distanceToSpline < maxRepulsionDistance) {
                            // 스플라인 밖에 있는 노드가 가까이 오면 조절점에서의 강한 반발력 적용
                            
                            let forceMultiplier = 1.0;
                            let baseForceStrength = 800;
                            
                            if (distanceToSpline < 20) {
                                forceMultiplier = 15.0;
                                baseForceStrength = 1500;
                            } else if (distanceToSpline < 40) {
                                forceMultiplier = 10.0;
                                baseForceStrength = 1000;
                            } else if (distanceToSpline < 60) {
                                forceMultiplier = 7.0;
                                baseForceStrength = 700;
                            } else if (distanceToSpline < 100) {
                                forceMultiplier = 4.0;
                                baseForceStrength = 400;
                            } else {
                                forceMultiplier = 2.0;
                                baseForceStrength = 250;
                            }
                            
                            const distanceDecay = Math.pow((maxRepulsionDistance - distanceToSpline) / maxRepulsionDistance, 2);
                            const finalForceStrength = baseForceStrength * forceMultiplier * distanceDecay;
                            
                            const repulsionForce = calculateSplineRepulsion(position, groupBoundary, finalForceStrength);
                            
                            if (!boundaryForces.has(nodeId)) {
                                boundaryForces.set(nodeId, { x: 0, y: 0 });
                            }
                            const currentForce = boundaryForces.get(nodeId);
                            currentForce.x += repulsionForce.x;
                            currentForce.y += repulsionForce.y;
                            
                            if (distanceToSpline < 40) {
                                stabilityCheckCount = 0;
                            }
                        }
                    }
                }
            });
            
            // 3. 그룹 내 노드들 간의 인력 (같은 그룹끼리 모이도록) - 침입자는 제외
            if (!isIntruder) {
                valueKeys.forEach(groupKey => {
                    const groupNodeIds = valueCourseIds[groupKey] || [];
                    const isGroupMember = groupNodeIds.includes(nodeId);
                    
                    if (isGroupMember && groupNodeIds.length > 1) {
                    // 1. 그룹 중심점으로의 인력
                    const groupPositions = groupNodeIds.map(id => {
                        try {
                            return network.getPosition(id);
                        } catch (e) {
                            // 노드가 존재하지 않는 경우 무시
                            return null;
                        }
                    }).filter(pos => pos);
                    if (groupPositions.length > 0) {
                        const centerX = groupPositions.reduce((sum, pos) => sum + pos.x, 0) / groupPositions.length;
                        const centerY = groupPositions.reduce((sum, pos) => sum + pos.y, 0) / groupPositions.length;
                        
                        // 중심점으로의 인력 계산
                        const dx = centerX - position.x;
                        const dy = centerY - position.y;
                        const distanceToCenter = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distanceToCenter > 20) { // 더 먼 거리에서만 작동 (10 → 20)
                            const attractionStrength = Math.min(15, distanceToCenter * 0.1); // 인력 대폭 약화 (80→15, 0.5→0.1)
                            const normalizedX = dx / distanceToCenter;
                            const normalizedY = dy / distanceToCenter;
                            
                            if (!boundaryForces.has(nodeId)) {
                                boundaryForces.set(nodeId, { x: 0, y: 0 });
                            }
                            const currentForce = boundaryForces.get(nodeId);
                            currentForce.x += normalizedX * attractionStrength * 0.3; // 추가로 30%로 약화
                            currentForce.y += normalizedY * attractionStrength * 0.3;
                            
                        }
                    }
                    
                    // 2. 그룹 내 노드들 간의 상호 인력 (스프링 연결)
                    groupNodeIds.forEach(otherNodeId => {
                        if (otherNodeId !== nodeId) {
                            let otherPos;
                            try {
                                otherPos = network.getPosition(otherNodeId);
                            } catch (e) {
                                // 노드가 존재하지 않는 경우 무시
                                return;
                            }
                            if (otherPos) {
                                const dx = otherPos.x - position.x;
                                const dy = otherPos.y - position.y;
                                const distance = Math.sqrt(dx * dx + dy * dy);
                                
                                if (distance > 30 && distance < 120) { // 더 제한적인 거리에서만 인력 작용 (20→30, 200→120)
                                    const springForce = Math.min(15, distance * 0.08); // 스프링 인력 강화
                                    const normalizedX = dx / distance;
                                    const normalizedY = dy / distance;
                                    
                                    if (!boundaryForces.has(nodeId)) {
                                        boundaryForces.set(nodeId, { x: 0, y: 0 });
                                    }
                                    const currentForce = boundaryForces.get(nodeId);
                                                            currentForce.x += normalizedX * springForce * 0.4; // 강화된 스프링 인력
                        currentForce.y += normalizedY * springForce * 0.4;
                                }
                            }
                        }
                        });
                    }
                });
            }
            
            // 이 노드에 반발력이 적용되었는지 체크
            if (boundaryForces.has(nodeId)) {
                nodesWithForces++;
            }
        });
        
        // 계산 결과 완료
    }
    
    // 스플라인 조절점으로부터의 반발력 계산 (외부 노드만 해당)
    function calculateSplineRepulsion(nodePosition, splineBoundary, force) {
        let totalForceX = 0;
        let totalForceY = 0;
        
        // 100px 간격으로 스플라인 위에 제어점 생성
        const controlPoints = [];
        const targetSpacing = 100; // 제어점 간격
        
        // 각 스플라인 선분을 따라 제어점 생성
        for (let i = 0; i < splineBoundary.length; i++) {
            const p1 = splineBoundary[i];
            const p2 = splineBoundary[(i + 1) % splineBoundary.length];
            
            // 선분의 길이 계산
            const segmentLength = Math.sqrt(
                Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
            );
            
            // 이 선분에 필요한 제어점 개수
            const numControlPoints = Math.max(1, Math.floor(segmentLength / targetSpacing));
            
            // 선분을 따라 균등하게 제어점 배치
            for (let j = 0; j < numControlPoints; j++) {
                const t = j / numControlPoints;
                controlPoints.push({
                    x: p1.x + t * (p2.x - p1.x),
                    y: p1.y + t * (p2.y - p1.y)
                });
            }
        }
        
        // 각 제어점에서 노드로의 반발력 계산
        controlPoints.forEach(controlPoint => {
            const dx = nodePosition.x - controlPoint.x;
            const dy = nodePosition.y - controlPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0 && distance < 150) { // 각 제어점의 영향 범위
                // 거리에 반비례하는 반발력
                const forceStrength = force / Math.pow(distance + 10, 2); // 부드러운 감쇠
                const normalizedX = dx / distance;
                const normalizedY = dy / distance;
                
                // 각 제어점에서의 반발력 누적
                totalForceX += normalizedX * forceStrength;
                totalForceY += normalizedY * forceStrength;
            }
        });
        
        return { x: totalForceX, y: totalForceY };
    }
    
    // 노드에서 스플라인까지의 최단 거리 계산
    function getDistanceToSpline(nodePosition, splineBoundary) {
        let minDistance = Infinity;
        
        for (let i = 0; i < splineBoundary.length; i++) {
            const point = splineBoundary[i];
            const distance = Math.sqrt(
                Math.pow(nodePosition.x - point.x, 2) + 
                Math.pow(nodePosition.y - point.y, 2)
            );
            minDistance = Math.min(minDistance, distance);
        }
        
        return minDistance;
    }
    
    // 노드 위치 안정화 상태 체크 함수
    function checkStability() {
        const currentPositions = network.getPositions();
        let isStable = true;
        let maxMovement = 0;
        let hasSplineIntruders = false;
        
        Object.entries(currentPositions).forEach(([nodeId, position]) => {
            // 기본 이동 거리 체크
            if (lastNodePositions.has(nodeId)) {
                const lastPos = lastNodePositions.get(nodeId);
                const movement = Math.sqrt(
                    Math.pow(position.x - lastPos.x, 2) + 
                    Math.pow(position.y - lastPos.y, 2)
                );
                maxMovement = Math.max(maxMovement, movement);
                
                if (movement > stabilityThreshold) {
                    isStable = false;
                }
            }
            
            // 스플라인 침입자 체크
            valueKeys.forEach(groupKey => {
                const groupBoundary = commonValuesBlobData[groupKey];
                const groupNodeIds = valueCourseIds[groupKey] || [];
                if (!groupNodeIds.includes(nodeId) && groupBoundary) {
                    const isInsideSpline = isPointInPolygon(position, groupBoundary);
                    const distanceToSpline = getDistanceToSpline(position, groupBoundary);
                    
                    // 스플라인 내부 또는 너무 가까이 있는 외부 노드
                    if (isInsideSpline || distanceToSpline < 35) {
                        hasSplineIntruders = true;
                        isStable = false;
                    }
                }
            });
            
            lastNodePositions.set(nodeId, { x: position.x, y: position.y });
        });
        
        // 스플라인 침입자가 있으면 무조건 불안정
        if (hasSplineIntruders) {
            stabilityCheckCount = 0;
            isStable = false;
        } else if (isStable) {
            stabilityCheckCount++;
        } else {
            stabilityCheckCount = 0; // 불안정하면 카운터 리셋
        }
        
        // 8번 연속 안정화되고 침입자가 없어야 완전 안정화로 간주 (그룹 인력으로 인해 더 오래 안정화 필요)
        return { 
            isStable: stabilityCheckCount >= 8 && !hasSplineIntruders, 
            maxMovement, 
            checkCount: stabilityCheckCount, 
            hasIntruders: hasSplineIntruders 
        };
    }
    
    // 제어점에 힘을 적용하고 위치 업데이트
    function applyControlPointForces() {
        controlPointForces.forEach((force, cpId) => {
            const [groupKey, indexStr] = cpId.split('_');
            const index = parseInt(indexStr);
            const controlPoints = dynamicControlPoints.get(groupKey);
            
            if (controlPoints && controlPoints[index]) {
                const cp = controlPoints[index];
                
                // 속도 업데이트 (감쇠 적용)
                const damping = 0.8;
                cp.vx = (cp.vx + force.x * 0.1) * damping;
                cp.vy = (cp.vy + force.y * 0.1) * damping;
                
                // 위치 업데이트
                cp.x += cp.vx;
                cp.y += cp.vy;
                
                // 원래 위치로의 복원력 (스프링)
                const restoreForce = 0.05;
                const dx = cp.originalX - cp.x;
                const dy = cp.originalY - cp.y;
                cp.vx += dx * restoreForce;
                cp.vy += dy * restoreForce;
            }
        });
        
        // 힘 초기화
        controlPointForces.clear();
        
        // 변형된 제어점을 기반으로 스플라인 재계산
        valueKeys.forEach(groupKey => {
            const controlPoints = dynamicControlPoints.get(groupKey);
            if (controlPoints && controlPoints.length > 0) {
                // 제어점 위치를 기반으로 새로운 스플라인 생성
                const newBoundary = [];
                const originalBoundary = commonValuesBlobData[groupKey];
                
                if (originalBoundary && originalBoundary.length >= 3) {
                    // 각 원래 선분에 대해 변형된 제어점들의 평균 변위 계산
                    for (let i = 0; i < originalBoundary.length; i++) {
                        const p1 = originalBoundary[i];
                        let offsetX = 0, offsetY = 0, count = 0;
                        
                        // 이 선분에 속한 제어점들의 평균 변위 계산
                        controlPoints.forEach(cp => {
                            if (cp.segmentIndex === i) {
                                offsetX += cp.x - cp.originalX;
                                offsetY += cp.y - cp.originalY;
                                count++;
                            }
                        });
                        
                        if (count > 0) {
                            newBoundary.push({
                                x: p1.x + offsetX / count,
                                y: p1.y + offsetY / count
                            });
                        } else {
                            newBoundary.push({x: p1.x, y: p1.y});
                        }
                    }
                    
                    // 변형된 스플라인 저장
                    commonValuesBlobData[groupKey] = newBoundary;
                }
            }
        });
    }
    
    // 지속적 반발력 적용 함수
    function applyBoundaryRepulsion() {
        if (!repulsionSystemActive) return;
        
        calculateBoundaryRepulsion();
        applyControlPointForces();
        
        // 안정화 상태 체크
        const stabilityInfo = checkStability();
        
        if (boundaryForces.size > 0) {
            const nodesToUpdate = {};
            let hasSignificantForces = false;
            
            boundaryForces.forEach((force, nodeId) => {
                // 드래그 중인 그룹의 노드는 반발력 적용 제외
                let skipNode = false;
                if (isDraggingGroup && draggedGroupKey) {
                    const draggedGroupNodes = valueCourseIds[draggedGroupKey] || [];
                    if (draggedGroupNodes.includes(nodeId)) {
                        skipNode = true;
                    }
                }
                
                if (!skipNode && (Math.abs(force.x) > 0.1 || Math.abs(force.y) > 0.1)) { // 임계값 낮춤 (더 민감한 반응)
                    hasSignificantForces = true;
                    try {
                        let currentPos;
                        try {
                            currentPos = network.getPosition(nodeId);
                        } catch (e) {
                            // 노드가 존재하지 않는 경우 건너뛰기
                            return;
                        }
                        if (currentPos) {
                            // 안정화 정도와 노드 위치에 따라 dampening 조정
                            let dampening = 0.18;
                            
                            // 스플라인 침입 노드들에게는 더 강한 dampening 적용
                            let isSplineIntruder = false;
                            valueKeys.forEach(groupKey => {
                                const groupBoundary = commonValuesBlobData[groupKey];
                                const groupNodeIds = valueCourseIds[groupKey] || [];
                                if (!groupNodeIds.includes(nodeId) && groupBoundary && isPointInPolygon(currentPos, groupBoundary)) {
                                    isSplineIntruder = true;
                                }
                            });
                            
                            if (isSplineIntruder) {
                                dampening = 0.5; // 스플라인 침입자는 매우 강한 dampening (0.25 → 0.5)
                            } else if (stabilityInfo.maxMovement < 1.0) {
                                dampening *= 0.9; // 거의 안정화되면 부드럽게 (0.8 → 0.9)
                            }
                            
                            nodesToUpdate[nodeId] = {
                                x: currentPos.x + force.x * dampening,
                                y: currentPos.y + force.y * dampening
                            };
                        }
                    } catch (error) {
                        // 노드 위치 가져오기 실패 시 무시
                    }
                }
            });
            
            // 안정화되었지만 여전히 반발력이 있으면 계속 적용
            if (hasSignificantForces || !stabilityInfo.isStable) {
                stabilityCheckCount = 0; // 반발력이 계속 있으면 안정화 카운터 리셋
            }
            
            // 배치로 노드 위치 업데이트
            Object.entries(nodesToUpdate).forEach(([nodeId, pos]) => {
                try {
                    network.moveNode(nodeId, pos.x, pos.y);
                } catch (error) {
                    // 노드 이동 실패 시 무시
                }
            });
            
            // 업데이트된 노드들의 스플라인 경계 재계산
            if (Object.keys(nodesToUpdate).length > 0) {
                setTimeout(() => {
                    valueKeys.forEach(key => {
                        const groupNodeIds = valueCourseIds[key] || [];
                        const hasUpdatedNodes = groupNodeIds.some(nodeId => nodesToUpdate[nodeId]);
                        if (hasUpdatedNodes) {
                            updateGroupBoundary(key);
                        }
                    });
                }, 10);
            }
        } else if (stabilityInfo.isStable && stabilityInfo.checkCount >= 10) {
            // 완전히 안정화되었고 10번 이상 체크되었으면 주기를 늦춤 (성능 최적화)
            // 하지만 여전히 모니터링은 계속
        }
    }
    
    // 반발력 시스템 시작 - 노드와 그룹 제목 겹침 방지
    function startRepulsionSystem() {
        if (repulsionInterval) {
            clearInterval(repulsionInterval);
        }
        // 최적화: 반발력 시스템도 비활성화됨
        // repulsionInterval = setInterval(applyContinuousRepulsion, 16); // 60fps로 최적화
        
        // 물리 시뮬레이션을 완전히 비활성화하고 직접 제어
        network.setOptions({
            physics: {
                enabled: false, // 물리 시뮬레이션 비활성화
                stabilization: false
            }
        });
        
        // 직접 위치 업데이트를 위한 별도 인터벌
        const directUpdateInterval = setInterval(() => {
            const allNodes = network.body.data.nodes.get();
            let hasMovement = false;
            
            allNodes.forEach(node => {
                const networkNode = network.body.nodes[node.id];
                if (networkNode && (networkNode.vx || networkNode.vy)) {
                    // 속도가 있으면 위치 업데이트
                    networkNode.x += (networkNode.vx || 0) * 0.1;
                    networkNode.y += (networkNode.vy || 0) * 0.1;
                    
                    // 속도 감쇠
                    networkNode.vx *= 0.95;
                    networkNode.vy *= 0.95;
                    
                    hasMovement = true;
                }
            });
            
            // 움직임이 있으면 캔버스 다시 그리기
            if (hasMovement) {
                network.canvas.frame.canvas.style.display = 'none';
                network.canvas.frame.canvas.style.display = 'block';
            }
        }, 16); // 60fps
        
        // 인터벌 정리를 위해 저장
        if (window.directUpdateInterval) {
            clearInterval(window.directUpdateInterval);
        }
        window.directUpdateInterval = directUpdateInterval;
    }
    
    // 반발력 시스템 중지
    function stopRepulsionSystem() {
        if (repulsionInterval) {
            clearInterval(repulsionInterval);
            repulsionInterval = null;
        }
        
        // 직접 업데이트 인터벌도 정리
        if (window.directUpdateInterval) {
            clearInterval(window.directUpdateInterval);
            window.directUpdateInterval = null;
        }
        
        // 물리 시뮬레이션 다시 활성화
        network.setOptions({
            physics: {
                enabled: true,
                stabilization: false
            }
        });
    }

    // 제거된 침입 노드 추적 시스템
    let expelledNodes = new Set(); // 추방된 노드들 기록
    let nodeGroupExclusions = new Map(); // 노드별 제외된 그룹 목록

    // 스플라인 버텍스 포인트와 침입 노드 간 상호 반발력 적용 함수
    function applySplineVertexRepulsion(nodeId, nodePosition, groupKey, groupBoundary) {
        if (!groupBoundary || groupBoundary.length < 3) return 0;
        
        const splineVertexForce = 20; // 스플라인 버텍스 포인트의 반발력
        const vertexInfluenceRadius = 80; // 버텍스 포인트 영향 범위
        let totalVertexForce = 0;
        
        // 각 스플라인 버텍스 포인트와 침입 노드 간 반발력 계산
        groupBoundary.forEach(vertex => {
            const vertexX = vertex.x;
            const vertexY = vertex.y;
            
            // 버텍스 포인트와 노드 간 거리 계산
            const dx = nodePosition.x - vertexX;
            const dy = nodePosition.y - vertexY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 영향 범위 내에 있는 경우만 반발력 적용
            if (distance < vertexInfluenceRadius && distance > 0) {
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                // 거리에 반비례하는 반발력 (가까울수록 강함)
                const vertexForceMultiplier = Math.max(0.1, (vertexInfluenceRadius - distance) / vertexInfluenceRadius);
                const vertexRepulsionForce = splineVertexForce * vertexForceMultiplier * 0.008;
                
                // 노드에 반발력 적용
                const node = network.body.nodes[nodeId];
                if (node) {
                    node.vx = (node.vx || 0) + dirX * vertexRepulsionForce;
                    node.vy = (node.vy || 0) + dirY * vertexRepulsionForce;
                    totalVertexForce += vertexRepulsionForce;
                }
            }
        });
        
        return totalVertexForce;
    }
    // 지속적으로 부드럽게 노드들을 그룹 경계 밖으로 밀어내는 함수 (스플라인 버텍스 반발력 포함)
    function applyContinuousRepulsion() {
        // 스플라인 데이터가 없어도 기본 반발력은 작용하도록 수정
        // if (!commonValuesBlobData || Object.keys(commonValuesBlobData).length === 0) {
        //     return false; // 처리할 데이터가 없음
        // }

        // 그룹 드래그 중에는 침입 노드 검사 중단 (false positive 방지)
        if (isDraggingGroup) {
            return true; // 드래그 중이므로 검사 패스
        }

        const baseRepulsionForce = 80; // 기존 30 → 80으로 증가 (더 빠르게)
        const springK = 0.15; // 스프링 상수(강화)
        const minDistanceFromBoundary = 600; // 경계에서 더 가까운 거리
        const boundaryOffset = 150; // 경계 확장 오프셋 (줄임)
        const labelRepulsionForce = 300; // 그룹 제목 반발력 (강화)
        const labelRepulsionRadius = 300; // 그룹 제목 반발력 반경 (확대)
        const nodeRepulsionForce = 350; // 노드 간 반발력 (강화)
        const nodeRepulsionRadius = 250; // 노드 간 반발력 반경 (확대)
        let totalForceApplied = 0;
        let detectedIntruders = [];
        
        // 물리 엔진의 각 노드에 연속적으로 부드러운 힘 적용
        Object.keys(network.body.nodes).forEach(nodeId => {
            const node = network.body.nodes[nodeId];
            if (!node) return;
            
            const nodePosition = { x: node.x, y: node.y };
            
            // value 그룹별 방향성 힘 적용
            let directionalForce = 0.3; // 방향성 힘의 강도 (조정)
            let targetX = nodePosition.x;
            let targetY = nodePosition.y;
            
            // 노드가 속한 value 그룹 찾기
            let nodeValueGroup = null;
            for (const [valueKey, nodeIds] of Object.entries(valueCourseIds)) {
                if (nodeIds.includes(nodeId)) {
                    nodeValueGroup = valueKey;
                    break;
                }
            }
            

            
            // 노드 간 반발력 적용 (모든 다른 노드와의 거리 확인)
            Object.keys(network.body.nodes).forEach(otherNodeId => {
                if (nodeId === otherNodeId) return; // 자기 자신은 제외
                
                const otherNode = network.body.nodes[otherNodeId];
                if (!otherNode) return;
                
                const dx = nodePosition.x - otherNode.x;
                const dy = nodePosition.y - otherNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 노드 간 반발력 반경 내에 있는 경우
                if (distance > 0 && distance < nodeRepulsionRadius) {
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    
                    // 거리에 반비례하는 반발력 (가까울수록 강함)
                    const forceMultiplier = Math.max(0.1, (nodeRepulsionRadius - distance) / nodeRepulsionRadius);
                    const repulsionForce = nodeRepulsionForce * forceMultiplier * 0.05; // 더 강화된 반발력
                    
                    // 노드에 반발력 적용
                    node.vx = (node.vx || 0) + dirX * repulsionForce;
                    node.vy = (node.vy || 0) + dirY * repulsionForce;
                    totalForceApplied += repulsionForce;
                }
            });
            
            // 그룹 제목과 노드 간의 반발력 적용
            groupLabelPositions.forEach((labelPos, groupKey) => {
                const dx = nodePosition.x - labelPos.x;
                const dy = nodePosition.y - labelPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 그룹 제목 반발력 반경 내에 있는 경우
                if (distance > 0 && distance < labelRepulsionRadius) {
                    const dirX = dx / distance;
                    const dirY = dy / distance;
                    
                    // 거리에 반비례하는 반발력 (가까울수록 강함)
                    const forceMultiplier = Math.max(0.1, (labelRepulsionRadius - distance) / labelRepulsionRadius);
                    const repulsionForce = labelRepulsionForce * forceMultiplier * 0.03; // 더 강화된 반발력
                    
                    // 노드에 반발력 적용
                    node.vx = (node.vx || 0) + dirX * repulsionForce;
                    node.vy = (node.vy || 0) + dirY * repulsionForce;
                    totalForceApplied += repulsionForce;
                }
            });
            
            // 각 그룹에 대해 확인 (스플라인 데이터가 있을 때만)
            if (commonValuesBlobData && Object.keys(commonValuesBlobData).length > 0) {
            valueKeys.forEach(groupKey => {
                const groupNodeIds = valueCourseIds[groupKey];
                const groupBoundary = commonValuesBlobData[groupKey];
                
                if (!groupBoundary || groupBoundary.length < 3) return;
                
                const nodeInThisGroup = groupNodeIds && groupNodeIds.includes(nodeId);
                const expandedBoundary = createExpandedBoundary(groupBoundary, boundaryOffset);
                const nodeInsideExpandedBoundary = isPointInPolygon(nodePosition, expandedBoundary);
                const nodeInsideOriginalBoundary = isPointInPolygon(nodePosition, groupBoundary);
                
                // 추방된 노드의 재진입 방지 (강력한 연속 힘)
                if (expelledNodes.has(nodeId)) {
                    const exclusions = nodeGroupExclusions.get(nodeId);
                    if (exclusions && exclusions.has(groupKey) && nodeInsideExpandedBoundary) {
                        // 중심점 계산
                        let centerX = 0, centerY = 0;
                        expandedBoundary.forEach(point => {
                            centerX += point.x;
                            centerY += point.y;
                        });
                        centerX /= expandedBoundary.length;
                        centerY /= expandedBoundary.length;
                        
                        const dx = nodePosition.x - centerX;
                        const dy = nodePosition.y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance > 0) {
                            const dirX = dx / distance;
                            const dirY = dy / distance;
                            // spring force: F = -k * x (x: 경계 중심~노드 거리)
                            const springForce = springK * distance + baseRepulsionForce * 0.4;
                            node.vx = (node.vx || 0) + dirX * springForce;
                            node.vy = (node.vy || 0) + dirY * springForce;
                            totalForceApplied += springForce;
                            // 스플라인 버텍스 포인트와의 추가 반발력
                            const vertexForce = applySplineVertexRepulsion(nodeId, nodePosition, groupKey, groupBoundary);
                            totalForceApplied += vertexForce;
                        }
                        return;
                    }
                }
                // 그룹에 속하지 않지만 경계 내부에 있는 노드 처리 (새로운 침입자)
                if (!nodeInThisGroup && nodeInsideOriginalBoundary) {
                    const exclusions = nodeGroupExclusions.get(nodeId);
                    const isExcluded = exclusions && exclusions.has(groupKey);
                    let belongsToAnyGroup = false;
                    valueKeys.forEach(checkGroupKey => {
                        const checkGroupNodeIds = valueCourseIds[checkGroupKey];
                        if (checkGroupNodeIds && checkGroupNodeIds.includes(nodeId)) {
                            belongsToAnyGroup = true;
                        }
                    });
                    if (!belongsToAnyGroup && !isExcluded) {
                        detectedIntruders.push(nodeId);
                        // 중심점 계산
                        let centerX = 0, centerY = 0;
                        expandedBoundary.forEach(point => {
                            centerX += point.x;
                            centerY += point.y;
                        });
                        centerX /= expandedBoundary.length;
                        centerY /= expandedBoundary.length;
                        const dx = nodePosition.x - centerX;
                        const dy = nodePosition.y - centerY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance > 0) {
                            const dirX = dx / distance;
                            const dirY = dy / distance;
                            // spring force: F = -k * x (x: 경계 중심~노드 거리)
                            const springForce = springK * distance + baseRepulsionForce * 1.0;
                            node.vx = (node.vx || 0) + dirX * springForce;
                            node.vy = (node.vy || 0) + dirY * springForce;
                            totalForceApplied += springForce;
                            // 스플라인 버텍스 포인트와의 추가 반발력
                            const vertexForce = applySplineVertexRepulsion(nodeId, nodePosition, groupKey, groupBoundary);
                            totalForceApplied += vertexForce;
                        }
                    }
                }
                // 경계 밖으로 완전히 나간 노드를 추방 목록에 추가 (더 신중한 처리)
                if (!nodeInThisGroup && !nodeInsideOriginalBoundary && !nodeInsideExpandedBoundary) {
                    if (detectedIntruders.includes(nodeId)) {
                        setTimeout(() => {
                            let currentNodePosition;
                            try {
                                currentNodePosition = network.getPosition(nodeId);
                            } catch (e) {
                                // 노드가 존재하지 않는 경우 무시
                                return;
                            }
                            if (currentNodePosition && 
                                !isPointInPolygon(currentNodePosition, groupBoundary) &&
                                !isPointInPolygon(currentNodePosition, expandedBoundary)) {
                                if (!nodeGroupExclusions.has(nodeId)) {
                                    nodeGroupExclusions.set(nodeId, new Set());
                                }
                                nodeGroupExclusions.get(nodeId).add(groupKey);
                                expelledNodes.add(nodeId);
                            }
                        }, 800);
                    }
                }
            });
            } // 스플라인 데이터가 있을 때만 실행하는 if문 닫기
        });
        
        // // 시각적 표시 업데이트
        // const nodeUpdates = [];
        // nodes.forEach(node => {
        //     const isIntruder = detectedIntruders.includes(node.id);
        //     const isExpelled = expelledNodes.has(node.id);
            
        //     if (isIntruder) {
        //         // 현재 침입 중인 노드 - 빨간 테두리
        //         nodeUpdates.push({
        //             id: node.id,
        //             color: {
        //                 ...node.color,
        //                 border: '#00ff3cff', // 빨간 테두리 (침입 중)
        //                 highlight: {
        //                     border: '#FF0000',
        //                     background: '#FFEEEE'
        //                 }
        //             }
        //         });
        //     } else if (isExpelled) {
        //         // 추방된 노드 - 회색 테두리로 표시
        //         nodeUpdates.push({
        //             id: node.id,
        //             color: {
        //                 ...node.color,
        //                 border: '#888888', // 회색 테두리 (추방됨)
        //                 highlight: {
        //                     border: '#888888',
        //                     background: '#F5F5F5'
        //                 }
        //             }
        //         });
        //     } else if (node.color && (node.color.border === '#FF0000' || node.color.border === '#888888')) {
        //         // 이전에 특별한 테두리였던 노드 복원
        //         nodeUpdates.push({
        //             id: node.id,
        //             color: {
        //                 ...node.color,
        //                 border: node.originalBorder || '#1d1d1dff'
        //             }
        //         });
        //     }
        // });
        
        // nodeUpdates 변수가 정의되지 않았으므로 제거
        // if (nodeUpdates.length > 0) {
        //     try {
        //         network.body.data.nodes.update(nodeUpdates);
        //     } catch (error) {
        //     }
        // }
        
        // 힘이 적용되었다면 물리 시뮬레이션 활성화
        if (totalForceApplied > 0) {
            network.startSimulation();
        } else {
            // 모든 노드가 안정화되었는지 확인 (더 관대한 기준)
            const allNodes = network.body.data.nodes.get();
            let allStable = true;
            let totalSpeed = 0;
            
            allNodes.forEach(node => {
                const speed = Math.sqrt((node.vx || 0) ** 2 + (node.vy || 0) ** 2);
                totalSpeed += speed;
                if (speed > 1.0) { // 속도 기준을 0.5에서 1.0으로 더 완화
                    allStable = false;
                }
            });
            
            // 평균 속도도 확인
            const avgSpeed = totalSpeed / allNodes.length;
            if (avgSpeed > 0.5) { // 평균 속도 기준을 0.2에서 0.5로 완화
                allStable = false;
            }
            
            // 시뮬레이션을 계속 실행하도록 유지 (stopSimulation 제거)
            // 모든 노드가 서로 200px 이상 떨어져 있는지 확인
            let allNodesFarEnough = true;
            
            for (let i = 0; i < allNodes.length; i++) {
                for (let j = i + 1; j < allNodes.length; j++) {
                    const node1 = allNodes[i];
                    const node2 = allNodes[j];
                    const dx = node1.x - node2.x;
                    const dy = node1.y - node2.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 300) { // 300px 미만이면 아직 안정화되지 않음
                            allNodesFarEnough = false;
                            break;
                        }
                }
                if (!allNodesFarEnough) break;
            }
            
            // 추가로 그룹 제목과의 거리도 확인
            if (allNodesFarEnough) {
                allNodes.forEach(node => {
                    groupLabelPositions.forEach((labelPos, groupKey) => {
                        const dx = node.x - labelPos.x;
                        const dy = node.y - labelPos.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < 300) { // 300px 미만이면 아직 안정화되지 않음
                            allNodesFarEnough = false;
                        }
                    });
                });
            }
            
                    // 조건을 만족하지 않으면 직접 노드 위치 업데이트
        if (!allNodesFarEnough) {
            // vis-network 물리 시뮬레이션 대신 직접 위치 업데이트
            allNodes.forEach(node => {
                const networkNode = network.body.nodes[node.id];
                if (networkNode) {
                    // 현재 속도에 따라 위치 업데이트
                    networkNode.x += (networkNode.vx || 0) * 0.1;
                    networkNode.y += (networkNode.vy || 0) * 0.1;
                    
                    // 속도 감쇠
                    networkNode.vx *= 0.95;
                    networkNode.vy *= 0.95;
                }
            });
            
            // 강제로 시뮬레이션 재시작
            network.startSimulation();
        }
        }
        
        return detectedIntruders.length === 0; // 모든 침입 노드가 제거되었는지 반환
    }

    // 경계 확장 함수 (오프셋 적용)
    function createExpandedBoundary(originalBoundary, offset) {
        if (!originalBoundary || originalBoundary.length < 3) {
            return originalBoundary;
        }

        // 폴리곤 중심점 계산
        let centerX = 0, centerY = 0;
        originalBoundary.forEach(point => {
            centerX += point.x;
            centerY += point.y;
        });
        centerX /= originalBoundary.length;
        centerY /= originalBoundary.length;

        // 각 점을 중심에서 바깥쪽으로 오프셋만큼 확장
        const expandedBoundary = originalBoundary.map(point => {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance === 0) {
                return { x: point.x, y: point.y };
            }
            
            // 정규화된 방향 벡터에 오프셋 적용
            const dirX = dx / distance;
            const dirY = dy / distance;
            
            return {
                x: point.x + dirX * offset,
                y: point.y + dirY * offset
            };
        });

        return expandedBoundary;
    }

    // 특정 그룹의 경계만 업데이트하는 함수
    function updateGroupBoundary(groupKey) {
        if (!groupKey || !valueCourseIds[groupKey]) return;
        
        const ids = valueCourseIds[groupKey];
        if (!ids.length) return;

        let outlinePoints = [];
        ids.forEach(id => {
            let position;
            try {
                position = network.getPosition(id);
            } catch (e) {
                // 노드가 존재하지 않는 경우 무시
                return;
            }
            if (position) {
                const points = getNodeOutlinePoints(network, id, 15);
                outlinePoints = outlinePoints.concat(points);
            }
        });

        if (outlinePoints.length < 3) return;

        let hull = convexHull(outlinePoints);
        // 스플라인 버텍스 포인트 개수 증가
        hull = increaseSplineVertices(hull);
        
        // 🌟 시각적 스플라인과 클릭 감지 경계를 분리
        // 시각적 스플라인: 더 부드럽게 처리
        let visualHull = [...hull];
        for (let i = 0; i < 3; i++) visualHull = smoothHull(visualHull);
        
        // 🎯 고정밀 클릭 감지 경계: 시각적 스플라인의 실제 곡선을 정밀하게 추적
        let clickBoundary = generatePreciseSplineBoundary(visualHull, 2); // 정밀한 경계 생성
        
        // 시각적 렌더링을 위한 데이터는 별도 저장
        if (!window.commonValuesVisualData) {
            window.commonValuesVisualData = {};
        }
        window.commonValuesVisualData[groupKey] = visualHull;
        
        // 클릭 감지용 경계 저장
        commonValuesBlobData[groupKey] = clickBoundary;
        
        // requestAnimationFrame을 사용하여 부드러운 렌더링
        requestAnimationFrame(() => {
            network.redraw();
        });
    }

    // 침입 노드 수 카운팅 함수
    function countInvasionNodes() {
        if (!commonValuesBlobData || Object.keys(commonValuesBlobData).length === 0) {
            return 0;
        }

        let invasionCount = 0;
        
        Object.keys(network.body.nodes).forEach(nodeId => {
            const node = network.body.nodes[nodeId];
            if (!node) return;
            
            const nodePosition = { x: node.x, y: node.y };
            
            valueKeys.forEach(groupKey => {
                const groupNodeIds = valueCourseIds[groupKey];
                const groupBoundary = commonValuesBlobData[groupKey];
                
                if (!groupBoundary || groupBoundary.length < 3) return;
                
                const nodeInThisGroup = groupNodeIds.includes(nodeId);
                const nodeInsideBoundary = isPointInPolygon(nodePosition, groupBoundary);
                
                // 이미 이 그룹에서 추방된 노드인지 확인
                const exclusions = nodeGroupExclusions.get(nodeId);
                const isExcluded = exclusions && exclusions.has(groupKey);
                
                if (!nodeInThisGroup && nodeInsideBoundary && !isExcluded) {
                    invasionCount++;
                }
            });
        });
        
        return invasionCount;
    }

    // 추방 기록 초기화 함수 (필요시 사용)
    function resetExpulsionHistory() {
        expelledNodes.clear();
        nodeGroupExclusions.clear();
    }

    // 특정 노드의 추방 기록 제거 (노드가 다른 그룹으로 이동했을 때)
    function clearNodeExpulsion(nodeId) {
        expelledNodes.delete(nodeId);
        nodeGroupExclusions.delete(nodeId);
    }

    // 그룹별 색상 (테두리용 진한 색상)
    const groupColors = {
        value1: '#1976d2', // 진한 파랑
        value2: '#d81b60', // 진한 핑크  
        value3: '#388e3c', // 진한 녹색
    };

    // 배경용 진한 색상
    const groupBgColors = {
        value1: 'rgba(33,150,243,0.15)',
        value2: 'rgba(233,30,99,0.15)', 
        value3: 'rgba(56,142,60,0.15)', // 녹색 배경
    };

    // blob 형태의 부드러운 커브 영역 그리기 함수
    function drawBlobCurve(ctx, points) {
        if (!points || points.length < 3) return;
        
        ctx.beginPath();
        
        // 첫 번째 점으로 이동
        ctx.moveTo(points[0].x, points[0].y);
        
        // blob 형태의 부드러운 곡선 그리기
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            const nextNext = points[(i + 2) % points.length];
            
            // 현재 점과 다음 점 사이의 중간점 계산
            const midX = (current.x + next.x) / 2;
            const midY = (current.y + next.y) / 2;
            
            // 제어점 계산 (blob 형태를 위한 부드러운 곡선)
            const controlX = midX + (next.y - current.y) * 0.3;
            const controlY = midY - (next.x - current.x) * 0.3;
            
            // 다음 중간점 계산
            const nextMidX = (next.x + nextNext.x) / 2;
            const nextMidY = (next.y + nextNext.y) / 2;
            
            // 부드러운 blob 곡선 그리기
            ctx.quadraticCurveTo(controlX, controlY, nextMidX, nextMidY);
        }
        
        // 닫힌 blob 형태 완성
        ctx.closePath();
    }

    // 컨벡스 헐 계산 함수(Andrew's monotone chain)
    function convexHull(points) {
        points = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
        const lower = [];
        for (let p of points) {
            while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
            lower.push(p);
        }
        const upper = [];
        for (let i = points.length - 1; i >= 0; i--) {
            const p = points[i];
            while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
            upper.push(p);
        }
        upper.pop();
        lower.pop();
        return lower.concat(upper);
        function cross(a, b, c) {
            return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        }
    }

    function smoothHull(hull) {
        if (!hull || hull.length < 3) return hull;
        const smoothed = [];
        const len = hull.length;
        const smoothingFactor = 0.4;
        for (let i = 0; i < len; i++) {
            const prev = hull[(i - 1 + len) % len];
            const current = hull[i];
            const next = hull[(i + 1) % len];
            const smoothedX = current.x * (1 - smoothingFactor) + (prev.x + next.x) * smoothingFactor / 2;
            const smoothedY = current.y * (1 - smoothingFactor) + (prev.y + next.y) * smoothingFactor / 2;
            smoothed.push({ x: smoothedX, y: smoothedY });
        }
        return smoothed;
    }

    // 스플라인 버텍스 포인트 개수 증가 함수 (세밀화)
    function increaseSplineVertices(hull) {
        if (!hull || hull.length < 3) return hull;
        
        const increased = [];
        const len = hull.length;
        
        for (let i = 0; i < len; i++) {
            const current = hull[i];
            const next = hull[(i + 1) % len];
            
            // 현재 점 추가
            increased.push(current);
            
            // 현재 점과 다음 점 사이에 2개의 추가 점 삽입
            const dx = next.x - current.x;
            const dy = next.y - current.y;
            
            // 첫 번째 중간점 (1/3 지점)
            increased.push({
                x: current.x + dx * 0.33,
                y: current.y + dy * 0.33
            });
            
            // 두 번째 중간점 (2/3 지점)
            increased.push({
                x: current.x + dx * 0.67,
                y: current.y + dy * 0.67
            });
        }
        
        return increased;
    }

    // 스플라인 버텍스 포인트들을 물리 시뮬레이션 노드로 변환
    function getSplineVertexNodes(groupKey) {
        if (!commonValuesBlobData[groupKey]) return [];
        
        const splinePoints = commonValuesBlobData[groupKey];
        const vertexNodes = [];
        
        splinePoints.forEach((point, index) => {
            vertexNodes.push({
                id: `spline_vertex_${groupKey}_${index}`,
                x: point.x,
                y: point.y,
                groupKey: groupKey,
                type: 'spline_vertex',
                mass: 0.5, // 가벼운 질량으로 설정
                fixed: false // 움직일 수 있도록 설정
            });
        });
        
        return vertexNodes;
    }
    function drawSmoothCurve(ctx, points) {
        if (!points || points.length < 3) return;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 0; i < points.length; i++) {
            const p0 = points[(i - 1 + points.length) % points.length];
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            const p3 = points[(i + 2) % points.length];
            // Catmull-Rom to Bezier 변환
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        ctx.closePath();
    }
// ... 기존 코드 ...
    // 노드 외곽점 샘플링 함수 (더 부드러운 스플라인을 위해 더 많은 점 생성)
    // 그룹별로 겹침을 최소화하기 위해 offset을 더 크게 적용
    function getNodeOutlinePoints(network, nodeId, offset = 48) {
        let pos;
        try {
            pos = network.getPosition(nodeId);
        } catch (e) {
            // 노드가 존재하지 않는 경우 빈 배열 반환
            return [];
        }
        const node = network.body.nodes[nodeId];
        if (!pos || !node) return [];
        const width = (node.shapeObj && node.shapeObj.width) || 60;
        const height = (node.shapeObj && node.shapeObj.height) || 30;

        // 네 모서리 좌표
        const corners = [
            { x: pos.x - width / 2, y: pos.y - height / 2 },
            { x: pos.x + width / 2, y: pos.y - height / 2 },
            { x: pos.x + width / 2, y: pos.y + height / 2 },
            { x: pos.x - width / 2, y: pos.y + height / 2 }
        ];
        // 박스의 중간점(상, 하, 좌, 우)
        const mids = [
            { x: pos.x, y: pos.y - height / 2 },
            { x: pos.x + width / 2, y: pos.y },
            { x: pos.x, y: pos.y + height / 2 },
            { x: pos.x - width / 2, y: pos.y }
        ];

        // 각 꼭지점과 중간점을 박스 중심에서 offset만큼 이동
        const allPoints = corners.concat(mids).map(pt => {
            const dx = pt.x - pos.x;
            const dy = pt.y - pos.y;
            const length = Math.sqrt(dx * dx + dy * dy) || 1;
            return {
                x: pt.x + (dx / length) * offset,
                y: pt.y + (dy / length) * offset
            };
        });
        return allPoints;
    }

    // 전역 변수 사용 (상태 유지)
    
    // 네트워크가 그려진 후 그룹 blob을 그림
    network.on('beforeDrawing', function(ctx) {
        // 1. blob 영역 먼저 그림 (노드/엣지 아래)
        // 선택되지 않은 스플라인들을 먼저 그리기
        valueKeys.forEach(key => {
            if (window.selectedCommonValuesBlob === key || window.hoveredBlob === key) {
                return; // 선택된 스플라인과 호버된 스플라인은 나중에 그리기
            }
            drawSplineForGroup(ctx, key);
        });
        
        // 2. 선택된 스플라인을 그리기 (레이어 상단)
        if (window.selectedCommonValuesBlob) {
            drawSplineForGroup(ctx, window.selectedCommonValuesBlob);
        }
        
        // 3. 호버된 스플라인을 가장 마지막에 그리기 (최상단)
        if (window.hoveredBlob && window.hoveredBlob !== window.selectedCommonValuesBlob) {
            drawSplineForGroup(ctx, window.hoveredBlob);
        }
    });
    
    // 스플라인 그리기 함수
    function drawSplineForGroup(ctx, key) {
            const ids = valueCourseIds[key];
            if (!ids.length) {
                return;
            }
            let outlinePoints = [];
            ids.forEach(id => {
                const points = getNodeOutlinePoints(network, id, 100); // offset을 크게 적용
                outlinePoints = outlinePoints.concat(points);
            });
            
            outlinePoints.forEach((pt, idx) => {
                
            });
            
            if (outlinePoints.length < 3) {
                return;
            }
            let hull = convexHull(outlinePoints);
            // 스플라인 버텍스 포인트 개수 증가
            hull = increaseSplineVertices(hull);
            
            // 🌟 시각적 스플라인과 클릭 감지 경계를 분리
            // 시각적 스플라인: 더 부드럽게 처리
            let visualHull = [...hull];
            for (let i = 0; i < 3; i++) visualHull = smoothHull(visualHull); // smoothing 3회
            
            // 🔧 클릭 감지 경계: 시각적 스플라인과 유사하게 만들되 약간만 확장
            let clickBoundary = expandPolygon(visualHull, 3); // 3픽셀만 확장
            
            // 시각적 렌더링을 위한 데이터는 별도 저장
            if (!window.commonValuesVisualData) {
                window.commonValuesVisualData = {};
            }
            window.commonValuesVisualData[key] = visualHull;
            
            // 클릭 감지용 경계 저장
            commonValuesBlobData[key] = clickBoundary;
            
            // blob 색상 및 강조 효과 개선
            ctx.save();
            
            // 선택/호버 상태에 따른 투명도 설정
            let alpha = 0.56; // 기본
        if (window.selectedCommonValuesBlob === key) {
            alpha = 1.95; // 선택됨 (더 진하게)
        } else if (window.hoveredBlob === key) {
            alpha = 0.65; // 호버됨 (선택과 동일하게 진하게)
            }
            ctx.globalAlpha = alpha;
            ctx.fillStyle = groupBgColors[key] || 'rgba(33,150,243,0.16)';

            // 선택/호버 상태에 따른 테두리 설정
            const strokeColor = groupColors[key] || '#666';
            ctx.strokeStyle = strokeColor;
            let lineWidth = 2; // 기본
        if (window.selectedCommonValuesBlob === key) {
                lineWidth = 4; // 선택됨
            } else if (hoveredBlob === key) {
                lineWidth = 3; // 호버됨
            }
            ctx.lineWidth = lineWidth;
            // 점선 제거
            // ctx.setLineDash([6, 2]); // 점선 패턴 제거
            // 🌟 시각적 렌더링은 부드러운 시각용 데이터 사용
            const renderData = window.commonValuesVisualData && window.commonValuesVisualData[key] 
                             ? window.commonValuesVisualData[key] 
                             : hull;
            drawSmoothCurve(ctx, renderData);
            ctx.fill();
            ctx.stroke();
            // ctx.setLineDash([]); // 점선 패턴 초기화 제거
            ctx.restore();

            
            // 그룹명 라벨 표시 (중앙)
            if (ids.length > 0) {
                // 중앙점 계산
                let centerX = 0, centerY = 0, validNodeCount = 0;
                ids.forEach(id => {
                    let pos;
                    try {
                        pos = network.getPosition(id);
                    } catch (e) {
                        // 노드가 존재하지 않는 경우 무시
                        return;
                    }
                    if (pos) {
                        centerX += pos.x; centerY += pos.y;
                        validNodeCount++;
                    }
                });
                if (validNodeCount > 0) {
                    centerX /= validNodeCount; 
                    centerY /= validNodeCount;
                } else {
                    // 유효한 노드가 없으면 라벨 표시 안함
                    return;
                }
                ctx.save();
                ctx.globalAlpha = 1;
                // 선택/호버 상태에 따른 폰트 스타일 설정
                let fontSize = 26;
                if (hoveredLabel === key) {
                    fontSize = 32; // 호버 시 폰트 크기 증가
                }
                ctx.font = `bold ${fontSize}px Noto Sans KR, sans-serif`;
                
                let textColor;
            if (window.selectedCommonValuesBlob === key) {
                    textColor = groupColors[key] || '#333'; // 선택됨
                } else if (hoveredBlob === key || hoveredLabel === key) {
                    textColor = 'rgba(85, 85, 85, 0.8)'; // 호버됨
                } else {
                    textColor = 'rgba(127, 127, 127, 0.29)'; // 기본 (회색)
                }
                ctx.fillStyle = textColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 5;
                const groupLabel = commonValuesGroupNames[key] || key;
                
                // 라벨 텍스트 크기 측정 및 위치 저장
                const textMetrics = ctx.measureText(groupLabel);
                const labelWidth = textMetrics.width;
                const labelHeight = 30; // 폰트 크기 26px 기준으로 약간 여유 있게
                
                // 캔버스 좌표계로 저장 (DOM 좌표로 변환하지 않음)
                groupLabelPositions.set(key, {
                    x: centerX,
                    y: centerY,
                    width: labelWidth,
                    height: labelHeight
                });
                
                ctx.strokeText(groupLabel, centerX, centerY);
                ctx.fillText(groupLabel, centerX, centerY);
                ctx.restore();
            }
    }

    // 🎯 정밀한 스플라인 경계 생성 함수 - 시각적 스플라인의 실제 곡선을 정밀 추적
    function generatePreciseSplineBoundary(visualHull, tolerance = 2) {
        if (!visualHull || visualHull.length < 3) return visualHull;
        
        const precisePoints = [];
        const samplesPerSegment = 8; // 세그먼트당 샘플 수 증가
        
        for (let i = 0; i < visualHull.length; i++) {
            const current = visualHull[i];
            const next = visualHull[(i + 1) % visualHull.length];
            
            // 🔍 각 세그먼트를 세밀하게 샘플링
            for (let j = 0; j < samplesPerSegment; j++) {
                const t = j / samplesPerSegment;
                
                // 🌟 곡선 보간 (부드러운 스플라인 효과)
                const prevPoint = visualHull[(i - 1 + visualHull.length) % visualHull.length];
                const nextNext = visualHull[(i + 2) % visualHull.length];
                
                // Catmull-Rom 곡선 보간으로 부드러운 곡선 생성
                const interpolatedPoint = catmullRomInterpolation(prevPoint, current, next, nextNext, t);
                
                // 🎯 곡률에 따른 적응형 확장
                const curvature = calculateCurvature(prevPoint, current, next);
                const adaptiveTolerance = tolerance * (1 + curvature * 0.5); // 곡선 부분은 더 많이 확장
                
                // 법선 벡터 계산 (곡선에 수직)
                const tangent = {
                    x: next.x - current.x,
                    y: next.y - current.y
                };
                const tangentLength = Math.sqrt(tangent.x * tangent.x + tangent.y * tangent.y) || 1;
                const normal = {
                    x: -tangent.y / tangentLength,
                    y: tangent.x / tangentLength
                };
                
                // 🌟 정밀한 경계점 생성 (안쪽과 바깥쪽)
                precisePoints.push({
                    x: interpolatedPoint.x + normal.x * adaptiveTolerance,
                    y: interpolatedPoint.y + normal.y * adaptiveTolerance
                });
            }
        }
        
        // 🔧 중복점 제거 및 최적화
        const optimizedPoints = precisePoints.filter((point, index) => {
            if (index === 0) return true;
            const prev = precisePoints[index - 1];
            const distance = Math.sqrt((point.x - prev.x) ** 2 + (point.y - prev.y) ** 2);
            return distance > 1; // 1픽셀 이상 떨어진 점만 유지
        });
        
        return optimizedPoints.length > 3 ? optimizedPoints : visualHull;
    }
    
    // 🌟 Catmull-Rom 스플라인 보간 함수
    function catmullRomInterpolation(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        // Catmull-Rom 공식
        const x = 0.5 * (
            2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        
        const y = 0.5 * (
            2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        
        return { x, y };
    }
    
    // 🔍 곡률 계산 함수 - 곡선의 굽힘 정도 측정
    function calculateCurvature(p1, p2, p3) {
        // 세 점으로 이루어진 각도의 곡률 계산
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        
        const v1Length = Math.sqrt(v1.x * v1.x + v1.y * v1.y) || 1;
        const v2Length = Math.sqrt(v2.x * v2.x + v2.y * v2.y) || 1;
        
        // 정규화된 벡터
        const nv1 = { x: v1.x / v1Length, y: v1.y / v1Length };
        const nv2 = { x: v2.x / v2Length, y: v2.y / v2Length };
        
        // 외적으로 곡률 계산 (0: 직선, 1: 최대 곡선)
        const crossProduct = Math.abs(nv1.x * nv2.y - nv1.y * nv2.x);
        return Math.min(crossProduct, 1);
    }

    // 점이 폴리곤 내부에 있는지 확인하는 함수 (개선된 경계 처리)
    function isPointInPolygon(point, polygon) {
        if (!point || !polygon || polygon.length < 3) {
            return false;
        }
        
        // 🔧 좌표값 유효성 검사
        if (typeof point.x !== 'number' || typeof point.y !== 'number' || 
            isNaN(point.x) || isNaN(point.y)) {
            return false;
        }
        
        // 🎯 고정밀 ray casting 알고리즘 - 부동소수점 정확도 개선
        let inside = false;
        const epsilon = 1e-10; // 부동소수점 오차 허용범위
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const pi = polygon[i];
            const pj = polygon[j];
            
            // 🔧 폴리곤 좌표값 유효성 검사
            if (!pi || !pj || typeof pi.x !== 'number' || typeof pi.y !== 'number' ||
                typeof pj.x !== 'number' || typeof pj.y !== 'number' ||
                isNaN(pi.x) || isNaN(pi.y) || isNaN(pj.x) || isNaN(pj.y)) {
                continue;
            }
            
            // 🌟 정밀한 경계 판정 - 부동소수점 오차 고려
            const yiCondition = (pi.y > point.y + epsilon);
            const yjCondition = (pj.y > point.y + epsilon);
            
            // 🎯 더 정확한 교점 계산
            if (yiCondition !== yjCondition) {
                const denominator = pj.y - pi.y;
                if (Math.abs(denominator) > epsilon) { // 0으로 나누기 방지
                    const intersectX = (pj.x - pi.x) * (point.y - pi.y) / denominator + pi.x;
                    
                    // 🔧 경계선 위의 점 처리 개선
                    if (Math.abs(point.x - intersectX) < epsilon) {
                        return true; // 경계선 위의 점은 내부로 간주
                    }
                    
                    if (point.x < intersectX - epsilon) {
                        inside = !inside;
                    }
                }
            }
        }
        
        return inside;
    }
    
    // 🎯 보완적 스플라인 영역 검사 함수 - 거리 기반 추가 검증
    function isPointInSplineRegion(point, visualHull, clickBoundary, tolerance = 5) {
        // 1차: 기본 폴리곤 검사
        const insideClickBoundary = isPointInPolygon(point, clickBoundary);
        
        if (insideClickBoundary) {
            return true;
        }
        
        // 2차: 시각적 스플라인과의 거리 기반 검증 (경계 근처에서 정밀 검사)
        let minDistanceToSpline = Infinity;
        
        for (let i = 0; i < visualHull.length; i++) {
            const current = visualHull[i];
            const next = visualHull[(i + 1) % visualHull.length];
            
            // 🔍 선분과 점 사이의 최단거리 계산
            const distance = distanceToLineSegment(point, current, next);
            minDistanceToSpline = Math.min(minDistanceToSpline, distance);
        }
        
        // 🎯 스플라인과의 거리가 허용 범위 내이고, 대략적으로 내부 영역인 경우 true
        if (minDistanceToSpline <= tolerance) {
            // 중심점 계산
            const center = calculatePolygonCenter(visualHull);
            const distanceToCenter = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
            const maxRadius = calculateMaxRadius(visualHull, center);
            
            // 중심에서 최대 반지름의 120% 내부에 있으면 스플라인 영역으로 간주
            return distanceToCenter <= maxRadius * 1.2;
        }
        
        return false;
    }
    
    // 🔧 점과 선분 사이의 최단거리 계산
    function distanceToLineSegment(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            // 선분의 길이가 0 (점과 점)
            return Math.sqrt(A * A + B * B);
        }
        
        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    // 🌟 폴리곤 중심점 계산
    function calculatePolygonCenter(polygon) {
        let centerX = 0, centerY = 0;
        for (const point of polygon) {
            centerX += point.x;
            centerY += point.y;
        }
        return {
            x: centerX / polygon.length,
            y: centerY / polygon.length
        };
    }
    
    // 🔍 중심점에서 폴리곤 경계까지의 최대 반지름 계산
    function calculateMaxRadius(polygon, center) {
        let maxRadius = 0;
        for (const point of polygon) {
            const distance = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
            maxRadius = Math.max(maxRadius, distance);
        }
        return maxRadius;
    }
    
    // 🔧 스플라인 영역 감지 성능 최적화 - 캐시 시스템
    const splineRegionCache = new Map();
    let lastCacheUpdateTime = 0;
    const CACHE_LIFETIME = 1000; // 1초 캐시
    
    function isPointInSplineRegionOptimized(point, groupKey, tolerance = 3) {
        const now = Date.now();
        const cacheKey = `${groupKey}_${Math.round(point.x)}_${Math.round(point.y)}_${tolerance}`;
        
        // 🚀 캐시 체크
        if (now - lastCacheUpdateTime < CACHE_LIFETIME && splineRegionCache.has(cacheKey)) {
            return splineRegionCache.get(cacheKey);
        }
        
        // 캐시 만료 시 정리
        if (now - lastCacheUpdateTime >= CACHE_LIFETIME) {
            splineRegionCache.clear();
            lastCacheUpdateTime = now;
        }
        
        // 실제 계산
        const clickBoundary = commonValuesBlobData[groupKey];
        const visualHull = window.commonValuesVisualData && window.commonValuesVisualData[groupKey] 
                         ? window.commonValuesVisualData[groupKey] 
                         : clickBoundary;
        
        if (!clickBoundary || !visualHull) {
            splineRegionCache.set(cacheKey, false);
            return false;
        }
        
        const result = isPointInSplineRegion(point, visualHull, clickBoundary, tolerance);
        splineRegionCache.set(cacheKey, result);
        return result;
    }
    
    // 🎯 스플라인 영역 디버깅 도구
    window.debugSplineRegion = function(groupKey, showBoundaries = true) {
        console.log(`🔍 Debugging spline region for group: ${groupKey}`);
        
        const clickBoundary = commonValuesBlobData[groupKey];
        const visualHull = window.commonValuesVisualData && window.commonValuesVisualData[groupKey];
        
        if (!clickBoundary) {
            console.log('❌ No click boundary found');
            return;
        }
        
        console.log('📊 Spline region info:', {
            groupKey,
            clickBoundaryPoints: clickBoundary.length,
            visualHullPoints: visualHull ? visualHull.length : 0,
            clickBoundary: clickBoundary.slice(0, 5).map(p => `(${Math.round(p.x)}, ${Math.round(p.y)})`),
            visualHull: visualHull ? visualHull.slice(0, 5).map(p => `(${Math.round(p.x)}, ${Math.round(p.y)})`) : null
        });
        
        // 경계 시각화 (개발자 도구용)
        if (showBoundaries && window.network) {
            const canvas = container.querySelector('canvas');
            const ctx = canvas.getContext('2d');
            
            // 클릭 경계 (빨간색)
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.beginPath();
            clickBoundary.forEach((point, i) => {
                const canvasPoint = network.canvasToDOM(point);
                if (i === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
                else ctx.lineTo(canvasPoint.x, canvasPoint.y);
            });
            ctx.closePath();
            ctx.stroke();
            
            // 시각적 경계 (파란색)
            if (visualHull) {
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 1;
                ctx.beginPath();
                visualHull.forEach((point, i) => {
                    const canvasPoint = network.canvasToDOM(point);
                    if (i === 0) ctx.moveTo(canvasPoint.x, canvasPoint.y);
                    else ctx.lineTo(canvasPoint.x, canvasPoint.y);
                });
                ctx.closePath();
                ctx.stroke();
            }
        }
    };
    
    // 폴리곤을 지정한 거리만큼 확장하는 함수
    function expandPolygon(polygon, expandDistance) {
        if (!polygon || polygon.length < 3) return polygon;
        
        const expanded = [];
        const len = polygon.length;
        
        for (let i = 0; i < len; i++) {
            const current = polygon[i];
            const prev = polygon[(i - 1 + len) % len];
            const next = polygon[(i + 1) % len];
            
            // 이전 점과의 벡터
            const v1x = current.x - prev.x;
            const v1y = current.y - prev.y;
            const v1len = Math.sqrt(v1x * v1x + v1y * v1y);
            
            // 다음 점과의 벡터
            const v2x = next.x - current.x;
            const v2y = next.y - current.y;
            const v2len = Math.sqrt(v2x * v2x + v2y * v2y);
            
            if (v1len === 0 || v2len === 0) {
                expanded.push({x: current.x, y: current.y});
                continue;
            }
            
            // 정규화된 벡터들
            const n1x = v1x / v1len;
            const n1y = v1y / v1len;
            const n2x = v2x / v2len;
            const n2y = v2y / v2len;
            
            // 각 변의 법선 벡터 (외향)
            const norm1x = -n1y;
            const norm1y = n1x;
            const norm2x = -n2y;
            const norm2y = n2x;
            
            // 평균 법선 벡터
            let avgNormX = (norm1x + norm2x) / 2;
            let avgNormY = (norm1y + norm2y) / 2;
            const avgNormLen = Math.sqrt(avgNormX * avgNormX + avgNormY * avgNormY);
            
            if (avgNormLen > 0) {
                avgNormX /= avgNormLen;
                avgNormY /= avgNormLen;
                
                // 확장된 점
                expanded.push({
                    x: current.x + avgNormX * expandDistance,
                    y: current.y + avgNormY * expandDistance
                });
            } else {
                expanded.push({x: current.x, y: current.y});
            }
        }
        
        return expanded;
    }

    // 그룹 드래그 관련 변수
    let isDraggingGroup = false;
    let draggedGroupKey = null;
    let dragStartPosition = null;
    let groupOriginalPositions = {};

    // 스플라인 선택 지속성 설정 (전역 변수)
    window.splineSelectionPersistent = false; // 기본값: 일반 모드 (한 번 클릭으로 선택/해제)
    
    // blob 커브 클릭 및 드래그 이벤트 처리
    network.on('click', function(params) {
        // 노드 클릭 시에는 스플라인 선택을 유지
        if (params.nodes.length > 0) {
            return;
        }
        
        // 그룹 폴리곤 클릭 시 선택/선택해제, 빈 영역 클릭 시 선택 해제
        if (params.nodes.length === 0) {
            const canvasPosition = params.pointer.canvas;
            
            // 먼저 그룹 라벨 클릭 체크 (우선순위)
            let clickedLabel = null;
            groupLabelPositions.forEach((labelPos, groupKey) => {
                // 라벨 위치를 현재 뷰포트에 맞게 변환
                const viewPos = network.canvasToDOM({x: labelPos.x, y: labelPos.y});
                const currentLabelX = viewPos.x * network.body.view.scale + network.body.view.translation.x;
                const currentLabelY = viewPos.y * network.body.view.scale + network.body.view.translation.y;
                
                const halfWidth = labelPos.width / 2;
                const halfHeight = labelPos.height / 2;
                
                if (canvasPosition.x >= currentLabelX - halfWidth && 
                    canvasPosition.x <= currentLabelX + halfWidth &&
                    canvasPosition.y >= currentLabelY - halfHeight && 
                    canvasPosition.y <= currentLabelY + halfHeight) {
                    clickedLabel = groupKey;
                }
            });
            
            if (clickedLabel) {
                // 라벨 클릭 시 해당 그룹 선택/선택해제
                window.selectedCommonValuesBlob = window.selectedCommonValuesBlob === clickedLabel ? null : clickedLabel;
                updateNodeHighlight();
                network.redraw();
                return;
            }
            
            // 라벨이 클릭되지 않은 경우 기존 스플라인 클릭 체크
            let clickedBlob = null;
            for (const key of valueKeys) {
                if (commonValuesBlobData[key]) {
                    // 🎯 정밀한 스플라인 영역 검사 사용
                    const visualHull = window.commonValuesVisualData && window.commonValuesVisualData[key] 
                                     ? window.commonValuesVisualData[key] 
                                     : commonValuesBlobData[key];
                    
                    if (isPointInSplineRegion(canvasPosition, visualHull, commonValuesBlobData[key], 3)) {
                        clickedBlob = key;
                        break;
                    }
                }
            }
            
            if (clickedBlob) {
                // 🔧 디버깅: 클릭 위치와 폴리곤 정보 로그
                if (window.DEBUG_SPLINE_CLICKS) {
                    console.log('Spline clicked:', {
                        blob: clickedBlob,
                        clickPos: canvasPosition,
                        polygon: commonValuesBlobData[clickedBlob],
                        visualData: window.commonValuesVisualData[clickedBlob]
                    });
                }
                
                // 같은 그룹 클릭 시 선택해제, 다른 그룹 클릭 시 선택 변경
                window.selectedCommonValuesBlob = window.selectedCommonValuesBlob === clickedBlob ? null : clickedBlob;
                
                // 🌟 그룹스플라인 클릭 시 새로운 물리효과 작동
                triggerSplinePhysicsEffect(clickedBlob, canvasPosition);
                
                updateNodeHighlight();
                network.redraw();
            } else {
                // 🔧 디버깅: 빈 영역 클릭 정보 로그
                if (window.DEBUG_SPLINE_CLICKS) {
                    console.log('Empty area clicked:', {
                        clickPos: canvasPosition,
                        checkedPolygons: valueKeys.map(k => {
                            const visualHull = window.commonValuesVisualData && window.commonValuesVisualData[k] 
                                             ? window.commonValuesVisualData[k] 
                                             : commonValuesBlobData[k];
                            return {
                                key: k,
                                polygon: commonValuesBlobData[k],
                                visualHull: visualHull,
                                isInside: commonValuesBlobData[k] ? isPointInSplineRegion(canvasPosition, visualHull, commonValuesBlobData[k], 3) : false
                            };
                        })
                    });
                }
                
                // 빈 영역 클릭 시 선택 해제
                if (window.selectedCommonValuesBlob) {
                    window.selectedCommonValuesBlob = null;
                    updateNodeHighlight();
                    network.redraw();
                }
            }
        }
    });

    // 마우스 호버 시 스플라인 하이라이트
    let hoveredBlob = null;
    window.hoveredBlob = null; // 전역 변수로 설정
    let hoveredLabel = null; // 호버된 라벨 추적
    network.on('hoverNode', function(params) {
        // 노드 호버 시에도 스플라인 호버 상태 유지
        // 스플라인 호버 해제하지 않음
    });
    
    // 직접 마우스 이벤트로 드래그 처리
    let isMouseDown = false;
    let mouseDownPosition = null;
    
    container.addEventListener('mousedown', function(event) {
        // 좌클릭만 처리
        if (event.button !== 0) return;
        
        const rect = container.getBoundingClientRect();
        const canvasPosition = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        
        // 해당 위치의 노드 확인 - 노드가 있으면 스플라인 드래그 방지
        const nodeAtPosition = network.getNodeAt(canvasPosition);
        if (nodeAtPosition) {
            return;
        }
        
        // vis.js 캔버스 좌표계로 직접 변환
        const canvasPos = network.DOMtoCanvas(canvasPosition);
        
        // 🎯 정밀한 스플라인 영역 내부 클릭 확인
        for (const key of valueKeys) {
            if (commonValuesBlobData[key]) {
                const visualHull = window.commonValuesVisualData && window.commonValuesVisualData[key] 
                                 ? window.commonValuesVisualData[key] 
                                 : commonValuesBlobData[key];
                
                if (isPointInSplineRegion(canvasPos, visualHull, commonValuesBlobData[key], 3)) {
                isMouseDown = true;
                mouseDownPosition = canvasPos;
                isDraggingGroup = true;
                draggedGroupKey = key;
                dragStartPosition = canvasPos;
                
                // 그룹 내 노드들의 원래 위치 저장
                groupOriginalPositions = {};
                const groupNodeIds = valueCourseIds[key];
                
                // 🔍 데이터 일치성 검증 - 네트워크에 실제 존재하는 노드만 필터링
                const validGroupNodeIds = groupNodeIds ? groupNodeIds.filter(nodeId => {
                    try {
                        // 1차 검증: 네트워크에 노드가 존재하는지 확인
                        const position = network.getPosition(nodeId);
                        
                        // 2차 검증: 위치 정보가 유효한지 확인
                        if (position && typeof position.x === 'number' && typeof position.y === 'number') {
                            return true;
                        } else {
                            return false;
                        }
                    } catch (e) {
                        // 노드가 네트워크에 존재하지 않는 경우
                        if (nodeId.startsWith('extracurricular-')) {
                            const name = window.extracurricularNameMap ? window.extracurricularNameMap[nodeId] : 'unknown';
                        } else {
                        }
                        return false;
                    }
                }) : [];
                
                if (validGroupNodeIds && validGroupNodeIds.length > 0) {
                    validGroupNodeIds.forEach(nodeId => {
                        let nodePosition;
                        try {
                            nodePosition = network.getPosition(nodeId);
                            if (nodePosition && typeof nodePosition.x === 'number' && typeof nodePosition.y === 'number') {
                                groupOriginalPositions[nodeId] = { x: nodePosition.x, y: nodePosition.y };
                            }
                        } catch (e) {
                            // 🚨 노드가 존재하지 않는 경우 무시 (데이터 불일치 상황)
                            return;
                        }
                    });
                }
                
                // 물리 시뮬레이션과 상호작용 비활성화, 반발력 시스템 일시 정지
                network.setOptions({
                    physics: { enabled: false },
                    interaction: {
                        dragNodes: false,
                        dragView: false
                    }
                });
                
                // 그룹 드래그 중에도 반발력 시스템 계속 작동
                
                container.style.cursor = 'grabbing';
                window.selectedCommonValuesBlob = key;
                updateNodeHighlight();
                
                event.preventDefault();
                break;
                }
            }
        }
    });

    // 마우스 이동 이벤트 (호버 + 드래그)
    container.addEventListener('mousemove', function(event) {
        const rect = container.getBoundingClientRect();
        const canvasPosition = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        
        // vis.js 캔버스 좌표계로 직접 변환
        const canvasPos = network.DOMtoCanvas(canvasPosition);
        
        // 드래그 중인 경우
        if (isDraggingGroup && draggedGroupKey && dragStartPosition) {
            const deltaX = canvasPos.x - dragStartPosition.x;
            const deltaY = canvasPos.y - dragStartPosition.y;
            
            // 그룹 내 모든 노드들을 같이 이동 (배치 처리)
            const groupNodeIds = valueCourseIds[draggedGroupKey];
            
            if (groupNodeIds && groupNodeIds.length > 0) {
                const updatePositions = {};
                
                groupNodeIds.forEach(nodeId => {
                    const originalPos = groupOriginalPositions[nodeId];
                    if (originalPos) {
                        const newX = originalPos.x + deltaX;
                        const newY = originalPos.y + deltaY;
                        updatePositions[nodeId] = { x: newX, y: newY };
                    }
                });
                
                // 한 번에 모든 노드 위치 업데이트
                try {
                    Object.entries(updatePositions).forEach(([nodeId, pos]) => {
                        network.moveNode(nodeId, pos.x, pos.y);
                    });
                } catch (error) {
                    // 노드 이동 실패 시 무시
                }
                
                // 실시간 폴리곤 업데이트 (throttled)
                if (!window.dragUpdateTimer) {
                    window.dragUpdateTimer = setTimeout(() => {
                        updateGroupBoundary(draggedGroupKey);
                        
                        // 🔧 드래그 중 전체 네트워크 중심점 유지
                        maintainGlobalNetworkCenter();
                        
                        window.dragUpdateTimer = null;
                    }, 16); // ~60fps
                }
            }
        }
        // 호버 감지 (드래그 중이 아닐 때만)
        else {
            // 노드가 있는 위치는 호버하지 않음
            const nodeAtPosition = network.getNodeAt(canvasPosition);
            let newHoveredBlob = null;
            
            if (!nodeAtPosition) {
                // 먼저 그룹 라벨 호버 체크 (우선순위)
                let newHoveredLabel = null;
                groupLabelPositions.forEach((labelPos, groupKey) => {
                    // 라벨 위치를 현재 뷰포트에 맞게 변환
                    const viewPos = network.canvasToDOM({x: labelPos.x, y: labelPos.y});
                    const currentLabelX = viewPos.x * network.body.view.scale + network.body.view.translation.x;
                    const currentLabelY = viewPos.y * network.body.view.scale + network.body.view.translation.y;
                    
                    const halfWidth = labelPos.width / 2;
                    const halfHeight = labelPos.height / 2;
                    
                    // canvasPosition (DOM 좌표)와 비교
                    if (canvasPosition.x >= currentLabelX - halfWidth && 
                        canvasPosition.x <= currentLabelX + halfWidth &&
                        canvasPosition.y >= currentLabelY - halfHeight && 
                        canvasPosition.y <= currentLabelY + halfHeight) {
                        newHoveredLabel = groupKey;
                    }
                });
                
                // 라벨 호버 상태 업데이트
                if (hoveredLabel !== newHoveredLabel) {
                    hoveredLabel = newHoveredLabel;
                    network.redraw(); // 라벨 호버 상태 변경 시 다시 그리기
                }
                
                if (newHoveredLabel) {
                    newHoveredBlob = newHoveredLabel;
                } else {
                    // 🎯 라벨 호버가 없는 경우 정밀한 스플라인 호버 체크
                    for (const key of valueKeys) {
                        if (commonValuesBlobData[key]) {
                            const visualHull = window.commonValuesVisualData && window.commonValuesVisualData[key] 
                                             ? window.commonValuesVisualData[key] 
                                             : commonValuesBlobData[key];
                            
                            if (isPointInSplineRegion(canvasPos, visualHull, commonValuesBlobData[key], 3)) {
                                newHoveredBlob = key;
                                break;
                            }
                        }
                    }
                }
            } else {
                // 노드 위에 마우스가 있을 때 라벨 호버 상태 초기화
                if (hoveredLabel) {
                    hoveredLabel = null;
                    network.redraw();
                }
            }
            
            // 호버 상태가 변경된 경우에만 다시 그리기
            if (hoveredBlob !== newHoveredBlob) {
                hoveredBlob = newHoveredBlob;
                
                // 커서 스타일 변경
                if (!isDraggingGroup) {
                    container.style.cursor = hoveredBlob ? 'pointer' : 'default';
                }
                
                network.redraw();
            }
        }
    });
    
    // 마우스 업 이벤트 (드래그 종료)
    container.addEventListener('mouseup', function(event) {
        if (isDraggingGroup) {
            
            const currentGroupKey = draggedGroupKey;
            
            // 타이머 정리
            if (window.dragUpdateTimer) {
                clearTimeout(window.dragUpdateTimer);
                window.dragUpdateTimer = null;
            }
            
            isDraggingGroup = false;
            draggedGroupKey = null;
            dragStartPosition = null;
            groupOriginalPositions = {};
            isMouseDown = false;
            mouseDownPosition = null;
            
            // 🔧 물리 시뮬레이션과 상호작용 점진적 재활성화 (응축 현상 방지)
            // 먼저 안정화 없이 물리만 활성화
            network.setOptions({
                physics: { 
                    enabled: true,
                    stabilization: { enabled: false } // 안정화 비활성화
                },
                interaction: {
                    dragNodes: true,
                    dragView: true
                }
            });
            
            // 잠시 후 안정화 다시 활성화 (부드럽게)
            setTimeout(() => {
                network.setOptions({
                    physics: { 
                        enabled: true,
                        stabilization: { 
                            enabled: true,
                            iterations: 50 // 적은 반복으로 부드럽게
                        }
                    }
                });
            }, 500); // 0.5초 후 안정화 재활성화
            
            // 반발력 시스템 상태 확인 (이미 활성화되어 있어야 함) - 비활성화됨
            repulsionSystemActive = false; // 반발력 시스템 비활성화
            
            // 커서 복원
            container.style.cursor = hoveredBlob ? 'pointer' : 'default';
            
            // 최종 그룹 경계 재계산
            if (currentGroupKey) {
                updateGroupBoundary(currentGroupKey);
                
                // 다른 그룹들도 업데이트
                setTimeout(() => {
                    Object.keys(valueCourseIds).forEach(key => {
                        if (key !== currentGroupKey) {
                            updateGroupBoundary(key);
                        }
                    });
                }, 100);
            }
        }
    });
    
    // 전역 mouseup 이벤트 (마우스가 컨테이너 밖으로 나가도 드래그 종료)
    document.addEventListener('mouseup', function(event) {
        if (isDraggingGroup) {
            container.dispatchEvent(new MouseEvent('mouseup', event));
        }
    });

    // 그룹 드래그 시작 (레거시 - 사용되지 않음)
    network.on('dragStart', function(params) {
        // 🔧 드래그 시작 시 재시작 카운터 리셋 (이제 오류가 해결되어 필요시에만 사용)
        window.physicsRestartCount = 0;
    });

    // 그룹 드래그 중
    network.on('dragging', function(params) {
        if (isDraggingGroup && draggedGroupKey && dragStartPosition) {
            const currentPosition = params.pointer.canvas;
            const deltaX = currentPosition.x - dragStartPosition.x;
            const deltaY = currentPosition.y - dragStartPosition.y;
            
            // 그룹 내 모든 노드들을 같이 이동
            const groupNodeIds = valueCourseIds[draggedGroupKey];
            
            // 디버깅: 드래그 상태 확인
            if (!groupNodeIds) {
                return;
            }
            
            if (groupNodeIds && groupNodeIds.length > 0) {
                // 배치로 노드 위치 업데이트 (성능 개선)
                const updatePositions = {};
                groupNodeIds.forEach(nodeId => {
                    const originalPos = groupOriginalPositions[nodeId];
                    if (originalPos) {
                        const newX = originalPos.x + deltaX;
                        const newY = originalPos.y + deltaY;
                        updatePositions[nodeId] = { x: newX, y: newY };
                    }
                });
                
                // 모든 노드 위치 업데이트 (개별 호출)
                Object.entries(updatePositions).forEach(([nodeId, pos]) => {
                    try {
                        network.moveNode(nodeId, pos.x, pos.y);
                    } catch (e) {
                    }
                });
                
                // 실시간 폴리곤 업데이트 (throttle 적용)
                if (!window.dragUpdateTimer) {
                    window.dragUpdateTimer = setTimeout(() => {
                        updateGroupBoundary(draggedGroupKey);
                        
                        // 🔧 드래그 중 전체 네트워크 중심점 유지
                        maintainGlobalNetworkCenter();
                        
                        window.dragUpdateTimer = null;
                    }, 16); // ~60fps
                }
            }
        }
    });

    // 그룹 드래그 종료
    network.on('dragEnd', function(params) {
        // 🔧 드래그 종료 - 드래그 중 건너뛴 엣지/하이라이트 처리 재반영
        try {
            if (typeof window.updateNodeHighlight === 'function') {
                window.updateNodeHighlight();
            }
            if (window.network) {
                window.network.redraw();
            }
        } catch (e) {
            console.warn('드래그 종료 후 상태 갱신 중 오류:', e);
        }

        if (isDraggingGroup) {
            const currentGroupKey = draggedGroupKey; // 현재 그룹키 저장
            
            // 타이머 정리
            if (window.dragUpdateTimer) {
                clearTimeout(window.dragUpdateTimer);
                window.dragUpdateTimer = null;
            }
            
            isDraggingGroup = false;
            draggedGroupKey = null;
            dragStartPosition = null;
            groupOriginalPositions = {};
            
            // 🔧 그룹 스플라인 드래그 완료 시 점진적 재활성화 (응축 현상 방지)
            network.setOptions({
                interaction: {
                    dragView: true, // 캔버스 드래그 재활성화
                    dragNodes: true // 개별 노드 드래그 재활성화
                },
                physics: {
                    enabled: true, // 물리 시뮬레이션 재활성화
                    stabilization: { enabled: false } // 안정화 비활성화
                }
            });
            
            // 잠시 후 안정화 다시 활성화 (부드럽게)
            setTimeout(() => {
                network.setOptions({
                    physics: { 
                        enabled: true,
                        stabilization: { 
                            enabled: true,
                            iterations: 50 // 적은 반복으로 부드럽게
                        }
                    }
                });
            }, 500); // 0.5초 후 안정화 재활성화
            
            // 드래그 완료 시 커서 원래대로 복원
            container.style.cursor = hoveredBlob ? 'pointer' : 'default';
            
            // 최종 그룹 경계 재계산 (즉시 실행)
            if (currentGroupKey) {
                updateGroupBoundary(currentGroupKey);
                
                // 다른 그룹들도 업데이트 (겹침 확인을 위해)
                setTimeout(() => {
                    Object.keys(valueCourseIds).forEach(key => {
                        if (key !== currentGroupKey) {
                            updateGroupBoundary(key);
                        }
                    });
                }, 100);
            }
            
        }
    });
    
    // 노드 하이라이트 업데이트 함수를 전역으로 이동
    window.updateNodeHighlight = function() {
        // 🛡️ 네트워크 객체 안전성 검증
        if (!window.network || !window.network.body || !window.network.body.data) {
            console.warn('네트워크 객체가 초기화되지 않았습니다.');
            return;
        }
        
        // 스플라인 선택 상태와 테이블 헤더 동기화
        syncSplineWithTableHeaders();
        
        // 🔧 vis-network 호환성을 위한 안전한 선택 해제
        try {
            // 드래그 중에는 unselectAll 호출 금지 (내부 상태 충돌 방지)
            if (!(typeof isDraggingGroup !== 'undefined' && isDraggingGroup)) {
                // 🛡️ unselectAll 전에 모든 노드의 font 속성 검증 및 복구
                if (window.network && window.network.body && window.network.body.data && window.network.body.data.nodes) {
                    window.validateAndFixNetworkFonts(window.network);
                }

                // 네트워크 상태 재검증 후 unselectAll
                if (window.network && window.network.body && window.network.body.data) {
                    window.network.unselectAll();
                }
            }
        } catch (error) {
            
            // 🛡️ font 속성 관련 오류인 경우 특별 처리
            if (error.message && error.message.includes('includes') && error.message.includes('getFormattingValues')) {
                console.warn('🛡️ Node 포맷팅 오류 감지 - 폰트 속성 복구 시도');
                try {
                    window.validateAndFixNetworkFonts(window.network);
                    // 복구 후 재시도
                    setTimeout(() => {
                        if (window.network) {
                            window.network.unselectAll();
                        }
                    }, 50);
                } catch (fontFixError) {
                    console.warn('폰트 속성 복구 실패:', fontFixError);
                }
                return;
            }
            
            // 대안: 직접 선택된 노드 목록 초기화
            try {
                if (window.network && window.network.body && window.network.body.selectionHandler) {
                    window.network.body.selectionHandler.unselectAll();
                }
            } catch (innerError) {
                console.warn('대안 선택 해제도 실패:', innerError);
                // 최후의 수단: 네트워크 재초기화 고려
                return;
            }
        }
        
        const nodeUpdate = [];
        // 🛡️ 현재 네트워크의 실제 노드 데이터를 안전하게 가져옵니다
        let currentNodes = [];
        try {
            if (window.network && window.network.body && window.network.body.data && window.network.body.data.nodes) {
                const rawNodes = window.network.body.data.nodes.get();
                
                // 🛡️ 노드 데이터 추가 검증 및 정리
                currentNodes = rawNodes.filter(node => {
                    if (!node || !node.id) {
                        console.warn('유효하지 않은 노드 데이터 발견:', node);
                        return false;
                    }
                    
                    // 노드의 필수 속성들이 올바른지 확인
                    if (node.color && typeof node.color !== 'object') {
                        console.warn(`노드 ${node.id}의 color 속성이 잘못되었습니다:`, node.color);
                        node.color = undefined;
                    }
                    
                    if (node.font && typeof node.font !== 'object') {
                        console.warn(`노드 ${node.id}의 font 속성이 잘못되었습니다:`, node.font);
                        node.font = undefined;
                    }
                    
                    return true;
                });
            }
        } catch (error) {
            console.warn('노드 데이터 가져오기 실패:', error);
            return;
        }
        
        // 선택된 그룹의 노드들 수집 (교과목 + 비교과)
        let selectedGroupNodeIds = [];
        if (window.selectedCommonValuesBlob && valueCourseIds && valueCourseIds[window.selectedCommonValuesBlob]) {
            selectedGroupNodeIds = [...valueCourseIds[window.selectedCommonValuesBlob]];
            
            // 비교과 노드들도 추가
            const valueKey = window.selectedCommonValuesBlob;
            
            // extracurricularTexts의 노드 추가
            if (extracurricularTexts && extracurricularTexts[valueKey]) {
                extracurricularTexts[valueKey].forEach((text, idx) => {
                    const nodeId = `extracurricular-${valueKey}-${idx}`;
                    selectedGroupNodeIds.push(nodeId);
                });
            }
            
            // extracurricularBlocks의 노드 추가
            if (extracurricularBlocks && extracurricularBlocks[valueKey]) {
                extracurricularBlocks[valueKey].forEach((name, idx) => {
                    const nodeId = `extracurricular-block-${valueKey}-${idx}`;
                    selectedGroupNodeIds.push(nodeId);
                });
            }
        }
        
        // 같은 과목분류별로 노드들을 그룹화
        const subjectTypeGroups = {};
        selectedGroupNodeIds.forEach(nodeId => {
            // 비교과 노드인 경우
            if (nodeId.startsWith('extracurricular-')) {
                if (!subjectTypeGroups['비교과']) {
                    subjectTypeGroups['비교과'] = [];
                }
                subjectTypeGroups['비교과'].push(nodeId);
            } else {
                // 일반 교과목인 경우
                const course = courses.find(c => c.id === nodeId);
                if (course && course.subjectType) {
                    if (!subjectTypeGroups[course.subjectType]) {
                        subjectTypeGroups[course.subjectType] = [];
                    }
                    subjectTypeGroups[course.subjectType].push(nodeId);
                }
            }
        });
        
        // 같은 과목분류 내에서 화살표 연결을 위한 엣지 생성
        const subjectTypeEdges = [];
        Object.values(subjectTypeGroups).forEach(nodeIds => {
            if (nodeIds.length > 1) {
                // 그룹 테마 색상 가져오기
                const groupColor = {
                    value1: '#1976d2',
                    value2: '#d81b60',
                    value3: '#388e3c'
                }[window.selectedCommonValuesBlob] || '#1d1d1d';
                
                // 같은 과목분류 내의 모든 노드 쌍을 연결
                for (let i = 0; i < nodeIds.length; i++) {
                    for (let j = i + 1; j < nodeIds.length; j++) {
                        subjectTypeEdges.push({
                            from: nodeIds[i],
                            to: nodeIds[j],
                            color: { color: groupColor, highlight: groupColor },
                            width: 2,
                            dashes: false,
                            arrows: { 
                                to: { enabled: true, scaleFactor: 0.35 },
                                from: { enabled: true, scaleFactor: 0.35 }
                            },
                            smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 },
                            title: '같은 과목분류 연결',
                            zIndex: 10
                        });
                    }
                }
            }
        });
        
        // 🛡️ 드래그 중에는 엣지 add/remove/update를 수행하지 않음 (내부 상태 불일치 방지)
        if (!(typeof isDraggingGroup !== 'undefined' && isDraggingGroup)) {
            // 🛡️ 기존 엣지 데이터를 안전하게 가져오기
            let currentEdges = [];
            try {
                if (window.network && window.network.body && window.network.body.data && window.network.body.data.edges) {
                    currentEdges = window.network.body.data.edges.get();
                }
            } catch (error) {
                console.warn('엣지 데이터 가져오기 실패:', error);
                return;
            }

            // 과목분류 연결 엣지들을 기존 엣지에 추가하거나 업데이트
            const existingSubjectTypeEdgeIds = new Set();

            // 기존 과목분류 연결 엣지들 제거 (선택 해제 시)
            currentEdges.forEach(edge => {
                if (edge.title === '같은 과목분류 연결') {
                    existingSubjectTypeEdgeIds.add(edge.id);
                }
            });

            // 🛡️ 기존 과목분류 연결 엣지들 안전하게 제거
            if (existingSubjectTypeEdgeIds.size > 0) {
                try {
                    if (window.network && window.network.body && window.network.body.data && window.network.body.data.edges) {
                        window.network.body.data.edges.remove(Array.from(existingSubjectTypeEdgeIds));
                    }
                } catch (error) {
                    console.warn('기존 엣지 제거 실패:', error);
                }
            }

            // 🛡️ 새로운 과목분류 연결 엣지들 안전하게 추가
            if (window.selectedCommonValuesBlob && subjectTypeEdges.length > 0) {
                try {
                    if (window.network && window.network.body && window.network.body.data && window.network.body.data.edges) {
                        window.network.body.data.edges.add(subjectTypeEdges);
                    }
                } catch (error) {
                    console.warn('새로운 엣지 추가 실패:', error);
                }
            }

            // 나머지 엣지들을 원래 스타일로 복원
            const edgeUpdateArray = [];
            currentEdges.forEach(edge => {
                if (edge.title !== '같은 과목분류 연결') {
                    if (window.selectedCommonValuesBlob) {
                        // 그룹 선택 중일 때는 투명도 적용
                        edgeUpdateArray.push({
                            id: edge.id,
                            color: { 
                                color: edge.dashes ? 'rgba(158, 158, 158, 0.3)' : 'rgba(189, 189, 189, 0.3)',
                                highlight: edge.dashes ? 'rgba(158, 158, 158, 0.3)' : 'rgba(189, 189, 189, 0.3)',
                                hover: edge.dashes ? 'rgba(158, 158, 158, 0.3)' : 'rgba(189, 189, 189, 0.3)'
                            },
                            width: edge.dashes ? 1.5 : 3,
                            opacity: 0.3
                        });
                    } else {
                        // 그룹 선택 해제 시 원래 스타일로 완전 복원
                        edgeUpdateArray.push({
                            id: edge.id,
                            color: { 
                                color: edge.dashes ? '#9e9e9e' : '#bdbdbd',
                                highlight: edge.dashes ? '#9e9e9e' : '#bdbdbd',
                                hover: edge.dashes ? '#9e9e9e' : '#bdbdbd'
                            },
                            width: edge.dashes ? 1.5 : 3,
                            opacity: edge.dashes ? 0.5 : 1
                        });
                    }
                }
            });

            // 🛡️ 엣지 업데이트를 안전하게 수행
            if (edgeUpdateArray.length > 0) {
                try {
                    if (window.network && window.network.body && window.network.body.data && window.network.body.data.edges) {
                        window.network.body.data.edges.update(edgeUpdateArray);
                    }
                } catch (error) {
                    console.warn('엣지 업데이트 실패:', error);
                }
            }
        }
        
        // 🛡️ 노드 업데이트를 안전하게 수행
        currentNodes.forEach(currentNode => {
            // 노드 데이터 안전성 검증
            if (!currentNode || !currentNode.id) {
                console.warn('유효하지 않은 노드 데이터:', currentNode);
                return;
            }
            
            const nodeId = currentNode.id;
            let isInSelectedGroup = false;
            if (window.selectedCommonValuesBlob) {
                // 교과목 노드 확인
                if (valueCourseIds && valueCourseIds[window.selectedCommonValuesBlob]) {
                    isInSelectedGroup = valueCourseIds[window.selectedCommonValuesBlob].includes(nodeId);
                }
                
                // 비교과 노드 확인
                if (!isInSelectedGroup && nodeId.startsWith('extracurricular-')) {
                    const valueKey = window.selectedCommonValuesBlob;
                    
                    // extracurricular-valueX-idx 형식 확인
                    if (nodeId.startsWith(`extracurricular-${valueKey}-`)) {
                        isInSelectedGroup = true;
                    }
                    // extracurricular-block-valueX-idx 형식 확인
                    else if (nodeId.startsWith(`extracurricular-block-${valueKey}-`)) {
                        isInSelectedGroup = true;
                    }
                }
            }
            
            // 업데이트할 노드 객체 생성 (id는 필수)
            const updatedNode = { id: nodeId };
            
            if (window.selectedCommonValuesBlob && isInSelectedGroup) {
                // 하이라이트되는 노드의 테두리를 원래 색상으로 유지
                const originalBorderColor = currentNode.color ? currentNode.color.border : '#bdbdbd';
                
                // 하이라이트 스타일 적용 - 현재 노드의 색상 유지
                updatedNode.color = {
                    background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                    border: originalBorderColor,
                    highlight: {
                        background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                        border: originalBorderColor
                    }
                };
                updatedNode.borderWidth = 3; // 선택된 노드는 테두리 두껍게
                updatedNode.opacity = 1;
                // 🚨 vis-network 호환성을 위한 안전한 font 속성 설정
                updatedNode.font = {
                    color: '#020202ff',
                    size: (currentNode.font && currentNode.font.size) || 14,
                    face: (currentNode.font && currentNode.font.face) || 'arial',
                    background: (currentNode.font && currentNode.font.background) || 'none',
                    strokeWidth: (currentNode.font && currentNode.font.strokeWidth) || 0,
                    strokeColor: (currentNode.font && currentNode.font.strokeColor) || '#ffffff'
                };
            } else {
                // 선택되지 않은 노드는 원래 스타일로 복원
                let originalBorderColor = '#bdbdbd'; // 기본값
                
                // 선택 해제 시에만 원래 색상 찾기
                if (!window.selectedCommonValuesBlob) {
                    const { subjectTypeColors, categoryColors } = generateColorLegend();
                    // 노드의 과목 찾기
                    const course = courses.find(c => c.id === nodeId);
                    if (course) {
                        if (colorModeBySubjectType) {
                            originalBorderColor = {
                                '설계': '#9e9e9e',
                                '디지털': '#a1887f',
                                '역사': '#d84315',
                                '이론': '#00897b',
                                '도시': '#c2185b',
                                '사회': '#5e35b1',
                                '기술': '#ef6c00',
                                '실무': '#43a047',
                                '비교과': '#757575'
                            }[course.subjectType] || '#757575';
                        } else {
                            originalBorderColor = {
                                '교양': '#6c757d',
                                '건축적사고': '#1976d2',
                                '설계': '#c62828',
                                '기술': '#f57c00',
                                '실무': '#388e3c',
                                '기타': '#7b1fa2'
                            }[course.category] || '#6c757d';
                        }
                    } else if (nodeId.startsWith('extracurricular')) {
                        // 비교과 노드의 경우
                        originalBorderColor = colorModeBySubjectType ? '#757575' : '#7b1fa2';
                    }
                } else {
                    // 선택 중일 때는 현재 색상 유지
                    originalBorderColor = currentNode.color ? currentNode.color.border : '#bdbdbd';
                }
                
                updatedNode.color = {
                    background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                    border: originalBorderColor,
                    highlight: {
                        background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                        border: originalBorderColor
                    }
                };
                updatedNode.borderWidth = 2; // 기본 테두리 두께
                
                // 선택 해제 시 투명도도 복원
                if (!window.selectedCommonValuesBlob) {
                    updatedNode.opacity = 1;
                    // 🚨 vis-network 호환성을 위한 안전한 font 속성 설정
                    updatedNode.font = {
                        color: '#495057',
                        size: (currentNode.font && currentNode.font.size) || 14,
                        face: (currentNode.font && currentNode.font.face) || 'arial',
                        background: (currentNode.font && currentNode.font.background) || 'none',
                        strokeWidth: (currentNode.font && currentNode.font.strokeWidth) || 0,
                        strokeColor: (currentNode.font && currentNode.font.strokeColor) || '#ffffff'
                    };
                } else {
                    // 선택 중일 때는 투명하게
                    updatedNode.opacity = 0.3;
                    // 🚨 vis-network 호환성을 위한 안전한 font 속성 설정
                    updatedNode.font = {
                        color: 'rgba(73, 80, 87, 0.3)',
                        size: (currentNode.font && currentNode.font.size) || 14,
                        face: (currentNode.font && currentNode.font.face) || 'arial',
                        background: (currentNode.font && currentNode.font.background) || 'none',
                        strokeWidth: (currentNode.font && currentNode.font.strokeWidth) || 0,
                        strokeColor: (currentNode.font && currentNode.font.strokeColor) || '#ffffff'
                    };
                }
            }
            
            nodeUpdate.push(updatedNode);
        });
        
        // 🛡️ 노드 스타일만 update()로 안전하게 적용 (네트워크 전체 재생성/물리효과 X)
        if (nodeUpdate.length > 0) {
            try {
                if (window.network && window.network.body && window.network.body.data && window.network.body.data.nodes) {
                    // 🛡️ 노드 업데이트 데이터 최종 검증 및 정리
                    const sanitizedNodeUpdate = nodeUpdate.map(node => {
                        // 필수 속성 검증
                        if (!node || !node.id) {
                            console.warn('유효하지 않은 노드 업데이트 데이터 제거:', node);
                            return null;
                        }
                        
                        // 안전한 노드 객체 생성
                        const safeNode = { id: node.id };
                        
                        // color 속성 안전하게 복사
                        if (node.color && typeof node.color === 'object') {
                            safeNode.color = {};
                            if (node.color.background !== undefined) safeNode.color.background = node.color.background;
                            if (node.color.border !== undefined) safeNode.color.border = node.color.border;
                            if (node.color.highlight && typeof node.color.highlight === 'object') {
                                safeNode.color.highlight = {};
                                if (node.color.highlight.background !== undefined) safeNode.color.highlight.background = node.color.highlight.background;
                                if (node.color.highlight.border !== undefined) safeNode.color.highlight.border = node.color.highlight.border;
                            }
                        }
                        
                        // 기타 속성들 안전하게 복사
                        if (node.opacity !== undefined) safeNode.opacity = node.opacity;
                        if (node.borderWidth !== undefined) safeNode.borderWidth = node.borderWidth;
                        
                        // 🛡️ font 속성 완전 초기화 및 안전하게 복사
                        const defaultFont = {
                            color: '#343a40',
                            size: 14,
                            face: 'arial',
                            background: 'none',
                            strokeWidth: 0,
                            strokeColor: '#ffffff'
                        };
                        
                        if (node.font && typeof node.font === 'object') {
                            safeNode.font = {
                                color: node.font.color !== undefined ? node.font.color : defaultFont.color,
                                size: node.font.size !== undefined ? node.font.size : defaultFont.size,
                                face: node.font.face !== undefined ? node.font.face : defaultFont.face,
                                background: node.font.background !== undefined ? node.font.background : defaultFont.background,
                                strokeWidth: node.font.strokeWidth !== undefined ? node.font.strokeWidth : defaultFont.strokeWidth,
                                strokeColor: node.font.strokeColor !== undefined ? node.font.strokeColor : defaultFont.strokeColor
                            };
                        } else {
                            // font 속성이 없으면 기본값 사용
                            safeNode.font = { ...defaultFont };
                        }
                        
                        // font 속성 sanitize
                        safeNode.font = window.sanitizeVisNetworkFont(safeNode.font);
                        
                        return safeNode;
                    }).filter(node => node !== null); // null 값 제거
                    
                    if (sanitizedNodeUpdate.length > 0) {
                        window.network.body.data.nodes.update(sanitizedNodeUpdate);
                    }
                }
            } catch (error) {
                console.warn('노드 업데이트 실패:', error);
                // 🛡️ 오류 발생 시 네트워크 상태 재검증
                if (error.message && error.message.includes('Cannot read properties of undefined')) {
                    console.warn('네트워크 내부 상태 오류 감지. 네트워크 재초기화를 고려하세요.');
                }
            }
        }
    };
    // 마우스 노드 호버 효과 (연결된 요소 포함)
    let nodeHoverOriginalStyles = new Map();
    let edgeHoverOriginalStyles = new Map();
    
    network.on('hoverNode', function(params) {
        const hoveredNodeId = params.node;
        
        // VALUE 그룹이 선택된 상태면 노드 호버 효과 적용하지 않음
        if (window.selectedCommonValuesBlob) {
            return;
        }
        
        // 호버된 노드의 과목분류 찾기
        let hoveredSubjectType = null;
        const hoveredNode = network.body.data.nodes.get(hoveredNodeId);
        if (hoveredNode) {
            if (hoveredNodeId.startsWith('extracurricular-')) {
                hoveredSubjectType = '비교과';
            } else {
                const course = courses.find(c => c.courseName === hoveredNode.label);
                if (course) {
                    hoveredSubjectType = course.subjectType;
                }
            }
        }
        
        // 같은 과목분류의 모든 노드 찾기
        const sameSubjectTypeNodeIds = [];
        if (hoveredSubjectType) {
            const allNodesTemp = network.body.data.nodes.get();
            allNodesTemp.forEach(node => {
                if (node.id.startsWith('extracurricular-') && hoveredSubjectType === '비교과') {
                    sameSubjectTypeNodeIds.push(node.id);
                } else {
                    const course = courses.find(c => c.courseName === node.label);
                    if (course && course.subjectType === hoveredSubjectType) {
                        sameSubjectTypeNodeIds.push(node.id);
                    }
                }
            });
        }
        
        // 연결된 노드와 엣지 찾기
        const connectedNodeIds = network.getConnectedNodes(hoveredNodeId);
        let connectedEdgeIds = network.getConnectedEdges(hoveredNodeId);
        
        // 비교과 노드도 다른 과목 분류와 동일하게 처리
        // 실제 연결된 노드와 엣지만 하이라이트
        
        // 모든 노드와 엣지 가져오기
        const allNodes = network.body.data.nodes.get();
        const allEdges = network.body.data.edges.get();
        
        // 🔧 과목분류별 색상 정의 가져오기
        const { subjectTypeColors, categoryColors } = generateColorLegend();
        
        // 과목분류별 테두리 색상 (더 진한 색)
        const subjectTypeBorderColors = {
            '설계': '#9e9e9e',
            '디지털': '#a1887f', 
            '역사': '#ff8a65',
            '이론': '#4db6ac',
            '도시': '#f06292',
            '사회': '#7986cb',
            '기술': '#ffb74d',
            '실무': '#66bb6a',
            '비교과': '#8bc34a'
        };
        
        // 🔧 전역 sanitizeVisNetworkFont 함수 사용
        
        // 노드 업데이트 배열
        const nodeUpdateArray = [];
        
        allNodes.forEach(node => {
            // 원래 스타일 저장 (호버 전 상태)
            if (!nodeHoverOriginalStyles.has(node.id)) {
                nodeHoverOriginalStyles.set(node.id, {
                    opacity: node.opacity || 1,
                    font: node.font || { color: '#343a40', size: 14 },
                    color: node.color ? { ...node.color } : undefined,
                    borderWidth: node.borderWidth || 2
                });
            }
            
            if (node.id === hoveredNodeId) {
                // 호버된 노드 - 강한 하이라이트 (자동으로 chosen 스타일 적용됨)
                network.selectNodes([hoveredNodeId]);
            } else if (connectedNodeIds.includes(node.id) || sameSubjectTypeNodeIds.includes(node.id)) {
                // 🔧 연결된 노드의 과목 정보 가져오기 (비교과 노드 고려)
                let course = null;
                let fontColor = '#c60000ff'; // 기본값
                let borderColor = node.color ? node.color.border : '#bdbdbd';
                
                // 비교과 노드인지 확인
                if (node.id && node.id.startsWith('extracurricular-')) {
                    // 비교과 노드의 경우 비교과 분류 색상 사용
                    fontColor = subjectTypeBorderColors['비교과'] || '#8bc34a';
                    borderColor = subjectTypeBorderColors['비교과'] || '#8bc34a';
                } else {
                    // 일반 교과목 노드의 경우
                    course = courses.find(c => c.courseName === node.label);
                    if (course && course.subjectType) {
                        // 과목분류에 따른 폰트색과 테두리색 적용
                        fontColor = subjectTypeBorderColors[course.subjectType] || '#000000';
                        borderColor = subjectTypeBorderColors[course.subjectType] || borderColor;
                    }
                }
                
                // 연결된 노드 - 중간 하이라이트 (과목분류색 적용)
                nodeUpdateArray.push({
                    id: node.id,
                    opacity: 1.0,  // 더 선명하게 (0.8에서 0.9로 변경)
                    borderWidth: 3,  // 테두리 더 두껍게
                    color: {
                        background: node.color ? node.color.background : '#f8f9fa',
                        border: borderColor,
                        highlight: {
                            background: node.color ? node.color.background : '#f8f9fa',
                            border: borderColor
                        }
                    },
                    font: window.sanitizeVisNetworkFont({
                        ...window.sanitizeVisNetworkFont(node.font),
                        color: fontColor // 🔧 과목분류색으로 변경
                    })
                });
            } else {
                // 나머지 노드 - 흐리게 (배경색은 유지, 투명도만 조정)
                nodeUpdateArray.push({
                    id: node.id,
                    opacity: 0.3,  // 더 흐리게 (0.5에서 0.3으로 변경)
                    color: {
                        background: node.color ? node.color.background : '#f8f9fa',
                        border: node.color ? node.color.border : '#bdbdbd',
                        highlight: {
                            background: node.color ? node.color.background : '#f8f9fa',
                            border: node.color ? node.color.border : '#bdbdbd'
                        }
                    },
                    font: window.sanitizeVisNetworkFont({
                        ...window.sanitizeVisNetworkFont(node.font),
                        color: 'rgba(73, 80, 87, 0.2)'  // 폰트도 더 흐리게
                    })
                });
            }
        });
        
        // 엣지 업데이트 배열
        const edgeUpdateArray = [];
        
        // 같은 과목분류 노드들 간의 임시 엣지 생성 (수축 효과)
        const tempEdges = [];
        if (sameSubjectTypeNodeIds.length > 1) {
            const edgeColor = subjectTypeBorderColors[hoveredSubjectType] || '#666666';
            
            // 모든 같은 과목분류 노드 쌍을 연결
            for (let i = 0; i < sameSubjectTypeNodeIds.length; i++) {
                for (let j = i + 1; j < sameSubjectTypeNodeIds.length; j++) {
                    const tempEdgeId = `temp-hover-${sameSubjectTypeNodeIds[i]}-${sameSubjectTypeNodeIds[j]}`;
                    tempEdges.push({
                        id: tempEdgeId,
                        from: sameSubjectTypeNodeIds[i],
                        to: sameSubjectTypeNodeIds[j],
                        hidden: true,  // 엣지를 보이지 않게 설정
                        physics: true,  // 물리 효과는 활성화
                        length: 200,  // 엣지 길이를 늘려서 힘을 줄임
                        temporary: true  // 임시 엣지 표시
                    });
                }
            }
            
            // 임시 엣지 추가
            try {
                network.body.data.edges.add(tempEdges);
                // 나중에 제거할 수 있도록 저장
                network.tempHoverEdges = tempEdges.map(e => e.id);
            } catch (error) {
                console.warn('임시 엣지 추가 실패:', error);
            }
        }
        
        allEdges.forEach(edge => {
            // 원래 스타일 저장
            if (!edgeHoverOriginalStyles.has(edge.id)) {
                edgeHoverOriginalStyles.set(edge.id, {
                    color: edge.color || { color: '#bdbdbd', highlight: '#bdbdbd' },
                    width: edge.width || 1
                });
            }
            
            if (connectedEdgeIds.includes(edge.id)) {
                // 🔧 연결된 엣지의 색상을 호버된 노드의 과목분류색으로 설정
                const hoveredNode = allNodes.find(n => n.id === hoveredNodeId);
                let hoveredCourse = null;
                let edgeColor = '#666666'; // 기본값
                
                if (hoveredNode) {
                    // 🔧 비교과 노드 처리
                    if (hoveredNode.id && hoveredNode.id.toString().startsWith('extracurricular-')) {
                        edgeColor = '#28a745'; // 비교과용 고정 색상
                    } else {
                        hoveredCourse = courses.find(c => c.courseName === hoveredNode.label);
                        if (hoveredCourse && hoveredCourse.subjectType) {
                            edgeColor = subjectTypeBorderColors[hoveredCourse.subjectType] || '#666666';
                        }
                    }
                }
                
                // 연결된 엣지 - 과목분류색으로 하이라이트
                edgeUpdateArray.push({
                    id: edge.id,
                    color: {
                        color: edgeColor,
                        highlight: edgeColor,
                        hover: edgeColor
                    },
                    width: 3 // 두께도 증가
                });
            } else {
                // 나머지 엣지 - 흐리게
                edgeUpdateArray.push({
                    id: edge.id,
                    color: {
                        color: 'rgba(189, 189, 189, 0.2)',
                        highlight: 'rgba(189, 189, 189, 0.2)',
                        hover: 'rgba(189, 189, 189, 0.2)'
                    },
                    width: 2
                });
            }
        });
        
        // 🔧 vis-network 호환성을 위한 안전한 업데이트 적용
        if (nodeUpdateArray.length > 0) {
            try {
                // 🛡️ 모든 노드의 font 속성 사전 처리
                const sanitizedArray = nodeUpdateArray.map(nodeUpdate => {
                    const safeNode = { ...nodeUpdate };
                    
                    // font 속성 완전 초기화
                    if (!safeNode.font || typeof safeNode.font !== 'object') {
                        safeNode.font = {};
                    }
                    
                    safeNode.font = window.sanitizeVisNetworkFont(safeNode.font);
                    return safeNode;
                });
                
                network.body.data.nodes.update(sanitizedArray);
            } catch (error) {
                console.warn('노드 업데이트 중 오류 발생:', error);
                // 개별적으로 업데이트 시도
                nodeUpdateArray.forEach(nodeUpdate => {
                    try {
                        const safeNode = { ...nodeUpdate };
                        safeNode.font = window.sanitizeVisNetworkFont(nodeUpdate.font || {});
                        network.body.data.nodes.update([safeNode]);
                    } catch (e) {
                        console.warn(`노드 ${nodeUpdate.id} 업데이트 실패:`, e);
                    }
                });
            }
        }
        if (edgeUpdateArray.length > 0) {
            try {
                network.body.data.edges.update(edgeUpdateArray);
            } catch (error) {
                console.warn('엣지 업데이트 중 오류 발생:', error);
            }
        }
        
        document.body.style.cursor = 'pointer';
    });

    network.on('blurNode', function(params) {
        // VALUE 그룹이 선택된 상태면 blur 효과 적용하지 않음
        if (window.selectedCommonValuesBlob) {
            return;
        }
        
        // 임시 호버 엣지 제거
        if (network.tempHoverEdges && network.tempHoverEdges.length > 0) {
            try {
                network.body.data.edges.remove(network.tempHoverEdges);
                network.tempHoverEdges = [];
            } catch (error) {
                console.warn('임시 엣지 제거 실패:', error);
            }
        }
        
        // 지속성 모드가 아닐 때만 선택 해제
        if (!window.splineSelectionPersistent) {
            try {
                // unselectAll 호출
                network.unselectAll();
            } catch (error) {
                // unselectAll 오류 무시 - vis-network 내부 처리에 맡김
            }
        }
        
        // 노드 원래 상태로 복원
        const nodeRestoreArray = [];
        nodeHoverOriginalStyles.forEach((originalStyle, nodeId) => {
            const restoreData = {
                id: nodeId,
                opacity: originalStyle.opacity,
                font: originalStyle.font,
                borderWidth: originalStyle.borderWidth || 2 // 원래 테두리 두께로 복원
            };
            
            if (originalStyle.color) {
                restoreData.color = originalStyle.color; // 원래 배경색 복원
            }
            
            nodeRestoreArray.push(restoreData);
        });
        
        if (nodeRestoreArray.length > 0) {
            network.body.data.nodes.update(nodeRestoreArray);
        }
        
        // 엣지 원래 상태로 복원
        const edgeRestoreArray = [];
        edgeHoverOriginalStyles.forEach((originalStyle, edgeId) => {
            edgeRestoreArray.push({
                id: edgeId,
                color: originalStyle.color,
                width: originalStyle.width
            });
        });
        
        if (edgeRestoreArray.length > 0) {
            network.body.data.edges.update(edgeRestoreArray);
        }
        
        // 저장된 스타일 초기화
        nodeHoverOriginalStyles.clear();
        edgeHoverOriginalStyles.clear();
        
        document.body.style.cursor = 'default';
    });

    // 엣지(화살표) 위에 마우스 올릴 때 해당 yearSemester의 모든 노드 하이라이트
    let edgeHoverOriginalEdgeStyles = new Map();
          let edgeHoverOriginalNodeStyles = new Map();
      
      network.on('hoverEdge', function(params) {
        const edgeId = params.edge;
        const edge = network.body.data.edges.get(edgeId);
          if (edge && edge.title) {
              const highlightNodeIds = [];
            const dimNodeIds = [];
            const nodeUpdateArray = [];
            const tempEdges = [];  // 임시 엣지를 저장할 배열
            
            // 현재 네트워크의 모든 노드 가져오기
            const allCurrentNodes = network.body.data.nodes.get();
            
            // 비교과 엣지인 경우 특별 처리
            if (edge.isExtracurricular) {
                // 비교과 노드들을 모두 찾기
                const extracurricularNodeIds = [];
                allCurrentNodes.forEach(node => {
                    if (node.id && node.id.toString().startsWith('extracurricular-')) {
                        extracurricularNodeIds.push(node.id);
                    }
                });
                
                // 비교과 노드들 간의 임시 엣지 생성 (수축 효과)
                if (extracurricularNodeIds.length > 1) {
                    for (let i = 0; i < extracurricularNodeIds.length; i++) {
                        for (let j = i + 1; j < extracurricularNodeIds.length; j++) {
                            const tempEdgeId = `temp-edge-hover-${extracurricularNodeIds[i]}-${extracurricularNodeIds[j]}`;
                            tempEdges.push({
                                id: tempEdgeId,
                                from: extracurricularNodeIds[i],
                                to: extracurricularNodeIds[j],
                                hidden: true,  // 엣지를 보이지 않게 설정
                                physics: true,  // 물리 효과는 활성화
                                length: 200,  // 엣지 길이를 늘려서 힘을 줄임
                                temporary: true
                            });
                        }
                    }
                    
                    // 임시 엣지 추가
                    try {
                        network.body.data.edges.add(tempEdges);
                        network.tempEdgeHoverEdges = tempEdges.map(e => e.id);
                    } catch (error) {
                        console.warn('비교과 임시 엣지 추가 실패:', error);
                    }
                }
                
                // 비교과 엣지: 비교과 노드들만 하이라이트
                allCurrentNodes.forEach(currentNode => {
                    // 원래 스타일 저장 (처음 호버 시에만)
                    if (!edgeHoverOriginalNodeStyles.has(currentNode.id)) {
                        edgeHoverOriginalNodeStyles.set(currentNode.id, {
                            opacity: currentNode.opacity || 1,
                            font: currentNode.font ? { ...currentNode.font } : { color: '#495057', size: 14 },
                            color: currentNode.color ? { ...currentNode.color } : undefined,
                            borderWidth: currentNode.borderWidth || 2
                        });
                    }
                    
                    // 비교과 노드인지 확인
                    if (currentNode.id && currentNode.id.toString().startsWith('extracurricular-')) {
                        // 비교과 노드 하이라이트 (다른 분야와 동일하게 배경색 변경)
                        highlightNodeIds.push(currentNode.id);
                        nodeUpdateArray.push({
                            id: currentNode.id,
                            opacity: 1,
                            borderWidth: 4,
                            color: {
                                background: '#8bc34a',  // 비교과 테마 컬러로 배경 변경
                                border: '#8bc34a',  // 비교과 테두리 색
                                highlight: {
                                    background: '#8bc34a',
                                    border: '#8bc34a'
                                }
                            },
                            font: {
                                color: '#ffffff',  // 흰색 폰트 (다른 분야와 동일)
                                size: (currentNode.font && currentNode.font.size) || 14,
                                face: (currentNode.font && currentNode.font.face) || 'arial'
                            }
                        });
                    } else {
                        // 비교과가 아닌 노드는 희미하게
                        dimNodeIds.push(currentNode.id);
                        nodeUpdateArray.push({
                            id: currentNode.id,
                            opacity: 0.3,
                            font: {
                                color: 'rgba(73, 80, 87, 0.3)',
                                size: (currentNode.font && currentNode.font.size) || 14,
                                face: (currentNode.font && currentNode.font.face) || 'arial'
                            },
                            color: {
                                background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                                border: currentNode.color ? currentNode.color.border : '#bdbdbd',
                                highlight: {
                                    background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                                    border: currentNode.color ? currentNode.color.border : '#bdbdbd'
                                }
                            }
                        });
                    }
                });
                
                // 비교과 엣지들도 하이라이트
                const allEdges = network.body.data.edges.get();
                const edgeUpdateArray = [];
                
                allEdges.forEach(e => {
                    if (!edgeHoverOriginalEdgeStyles.has(e.id)) {
                        edgeHoverOriginalEdgeStyles.set(e.id, {
                            color: e.color || { color: '#bdbdbd', highlight: '#bdbdbd' },
                            width: e.width || 1,
                            dashes: e.dashes || false
                        });
                    }
                    
                    if (e.isExtracurricular || e.id === edge.id) {
                        // 비교과 엣지 또는 호버된 엣지 자체 하이라이트
                        edgeUpdateArray.push({
                            id: e.id,
                            color: { 
                                color: '#8bc34a', 
                                highlight: '#8bc34a',
                                hover: '#8bc34a'
                            },
                            width: 2.5,
                            dashes: true
                        });
                    } else {
                        // 다른 엣지들은 투명도 적용
                        edgeUpdateArray.push({
                            id: e.id,
                            color: { 
                                color: 'rgba(189, 189, 189, 0.2)', 
                                highlight: 'rgba(189, 189, 189, 0.2)',
                                hover: 'rgba(189, 189, 189, 0.2)'
                            },
                            width: 1
                        });
                    }
                });
                
                // 노드와 엣지 업데이트 적용
                if (nodeUpdateArray.length > 0) {
                    network.body.data.nodes.update(nodeUpdateArray);
                }
                if (edgeUpdateArray.length > 0) {
                    network.body.data.edges.update(edgeUpdateArray);
                }
            } else if (edge.dashes === true) {
                // 점선 엣지: 과목분류 기반 하이라이트
                // title에서 과목분류 추출 (예: "설계 - VALUE1 to VALUE2" 또는 단순히 "설계")
                let subjectType;
                const subjectTypeMatch = edge.title.match(/^([^\-]+)\s*-/);
                if (subjectTypeMatch) {
                    subjectType = subjectTypeMatch[1].trim();
                } else {
                    // 하이픈이 없으면 전체 title을 과목분류로 사용
                    subjectType = edge.title.trim();
                }
                
                if (subjectType) {
                    // 같은 과목분류를 가진 모든 노드 ID 수집
                    const sameSubjectTypeNodeIds = [];
                    allCurrentNodes.forEach(node => {
                        const course = courses.find(c => c.id === node.id);
                        if (course && course.subjectType === subjectType) {
                            sameSubjectTypeNodeIds.push(node.id);
                        }
                    });
                    
                    // 같은 과목분류 노드들 간의 임시 엣지 생성 (수축 효과)
                    if (sameSubjectTypeNodeIds.length > 1) {
                        const subjectTypeColors = {
                            '설계': '#9e9e9e',
                            '디지털': '#a1887f',
                            '역사': '#d84315',
                            '이론': '#00897b',
                            '도시': '#c2185b',
                            '사회': '#5e35b1',
                            '기술': '#ef6c00',
                            '실무': '#43a047',
                            '비교과': '#757575'
                        };
                        const edgeColor = subjectTypeColors[subjectType] || '#666666';
                        
                        for (let i = 0; i < sameSubjectTypeNodeIds.length; i++) {
                            for (let j = i + 1; j < sameSubjectTypeNodeIds.length; j++) {
                                const tempEdgeId = `temp-edge-hover-${sameSubjectTypeNodeIds[i]}-${sameSubjectTypeNodeIds[j]}`;
                                tempEdges.push({
                                    id: tempEdgeId,
                                    from: sameSubjectTypeNodeIds[i],
                                    to: sameSubjectTypeNodeIds[j],
                                    hidden: true,  // 엣지를 보이지 않게 설정
                                    physics: true,  // 물리 효과는 활성화
                                    length: 200,  // 엣지 길이를 늘려서 힘을 줄임
                                    temporary: true
                                });
                            }
                        }
                        
                        // 임시 엣지 추가
                        try {
                            network.body.data.edges.add(tempEdges);
                            network.tempEdgeHoverEdges = tempEdges.map(e => e.id);
                        } catch (error) {
                            console.warn('과목분류 임시 엣지 추가 실패:', error);
                        }
                    }
                    
                    // 같은 과목분류를 가진 모든 노드 찾기
            allCurrentNodes.forEach(currentNode => {
                        // 원래 스타일 저장 (처음 호버 시에만)
                        if (!edgeHoverOriginalNodeStyles.has(currentNode.id)) {
                            edgeHoverOriginalNodeStyles.set(currentNode.id, {
                                opacity: currentNode.opacity || 1,
                                // 🚨 vis-network 호환성을 위한 안전한 font 속성 복사
                        font: currentNode.font ? {
                            color: currentNode.font.color || '#495057',
                            size: currentNode.font.size || 14,
                            face: currentNode.font.face || 'arial',
                            background: currentNode.font.background || 'none',
                            strokeWidth: currentNode.font.strokeWidth || 0,
                            strokeColor: currentNode.font.strokeColor || '#ffffff'
                        } : {
                            color: '#495057',
                            size: 14,
                            face: 'arial',
                            background: 'none',
                            strokeWidth: 0,
                            strokeColor: '#ffffff'
                        },
                                color: currentNode.color ? { ...currentNode.color } : undefined,
                                borderWidth: currentNode.borderWidth || 2
                            });
                        } else {
                        }
                        
                        const course = courses.find(c => c.id === currentNode.id);
                        if (course && course.subjectType === subjectType) {
                            highlightNodeIds.push(currentNode.id);
                        } else {
                            dimNodeIds.push(currentNode.id);
                            // 디밍할 노드 업데이트 배열에 추가
                            nodeUpdateArray.push({
                                id: currentNode.id,
                                opacity: 0.3,  // 더 강한 투명도 적용
                                // 🚨 vis-network 호환성을 위한 안전한 font 속성 설정
                                font: {
                                    color: 'rgba(73, 80, 87, 0.3)',
                                    size: (currentNode.font && currentNode.font.size) || 14,
                                    face: (currentNode.font && currentNode.font.face) || 'arial',
                                    background: (currentNode.font && currentNode.font.background) || 'none',
                                    strokeWidth: (currentNode.font && currentNode.font.strokeWidth) || 0,
                                    strokeColor: (currentNode.font && currentNode.font.strokeColor) || '#ffffff'
                                },
                                color: {
                                    background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                                    border: currentNode.color ? currentNode.color.border : '#bdbdbd',
                                    highlight: {
                                        background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                                        border: currentNode.color ? currentNode.color.border : '#bdbdbd'
                                    }
                                }
                            });
                        }
                    });
                    
                    // 하이라이트할 노드들도 업데이트 배열에 추가 (교과목 테마 컬러로 하이라이트)
                    highlightNodeIds.forEach(nodeId => {
                        const currentNode = network.body.data.nodes.get(nodeId);
                        
                        // 과목분류별 테마 색상 가져오기
                                const subjectTypeColors = {
                                    '설계': '#9e9e9e',
                                    '디지털': '#a1887f',
                                    '역사': '#d84315',
                                    '이론': '#00897b',
                                    '도시': '#c2185b',
                                    '사회': '#5e35b1',
                                    '기술': '#ef6c00',
                                    '실무': '#43a047',
                                    '비교과': '#757575'
                                };
                        
                        const course = courses.find(c => c.id === nodeId);
                        const themeColor = course && subjectTypeColors[course.subjectType] ? subjectTypeColors[course.subjectType] : '#2e7d32';
                        
                        nodeUpdateArray.push({
                            id: nodeId,
                            opacity: 1,
                            borderWidth: 4, // 더 두꺼운 테두리
                            color: {
                                background: themeColor, // 교과목 테마 컬러로 배경 변경
                                border: themeColor, // 교과목 테마 컬러로 테두리 변경
                                highlight: {
                                    background: themeColor,
                                    border: themeColor
                                }
                            },
                            // 🚨 vis-network 호환성을 위한 안전한 font 속성 설정
                            font: {
                                color: '#ffffff',
                                size: (currentNode.font && currentNode.font.size) || 14,
                                face: (currentNode.font && currentNode.font.face) || 'arial',
                                background: (currentNode.font && currentNode.font.background) || 'none',
                                strokeWidth: (currentNode.font && currentNode.font.strokeWidth) || 0,
                                strokeColor: (currentNode.font && currentNode.font.strokeColor) || '#ffffff'
                            }
                        });
                    });
                    
                    // 모든 엣지들 처리
                    const allEdges = network.body.data.edges.get();
                    const edgeUpdateArray = [];
                    
                    allEdges.forEach(e => {
                        // 원래 스타일 저장 (처음 호버 시에만)
                        if (!edgeHoverOriginalEdgeStyles.has(e.id)) {
                            edgeHoverOriginalEdgeStyles.set(e.id, {
                                color: e.color || { color: '#bdbdbd', highlight: '#bdbdbd' },
                                width: e.width || 1,
                                dashes: e.dashes || false
                            });
                        } else {
                        }
                        
                        // 같은 과목분류의 점선 엣지인지 확인
                        if (e.dashes === true && e.title && e.title.includes(subjectType)) {
                            // 과목분류별 테마 색상 가져오기
                                const subjectTypeColors = {
                                    '설계': '#9e9e9e',
                                    '디지털': '#a1887f',
                                    '역사': '#d84315',
                                    '이론': '#00897b',
                                    '도시': '#c2185b',
                                    '사회': '#5e35b1',
                                    '기술': '#ef6c00',
                                    '실무': '#43a047',
                                    '비교과': '#757575'
                                };
                            
                            const themeColor = subjectTypeColors[subjectType] || '#2e7d32';
                            
                            // 같은 과목분류의 점선들은 과목분류 테마색으로 하이라이트
                            edgeUpdateArray.push({
                                id: e.id,
                                color: { 
                                    color: themeColor, 
                                    highlight: themeColor,
                                    hover: themeColor
                                },
                                width: 2.5,
                                dashes: true
                            });
                        } else {
                            // 다른 엣지들은 투명도 적용
                            edgeUpdateArray.push({
                                id: e.id,
                                color: { 
                                    color: 'rgba(189, 189, 189, 0.2)', 
                                    highlight: 'rgba(189, 189, 189, 0.2)',
                                    hover: 'rgba(189, 189, 189, 0.2)'
                                },
                                width: 1
                            });
                        }
                    });
                    
                    // 🔧 안전한 배치 업데이트
                    if (edgeUpdateArray.length > 0) {
                        try {
                            network.body.data.edges.update(edgeUpdateArray);
                        } catch (error) {
                            console.warn('엣지 배치 업데이트 중 오류:', error);
                        }
                    }
                    
                    // 노드 업데이트 적용
                    if (nodeUpdateArray.length > 0) {
                        try {
                            // 🛡️ font 속성 사전 처리
                            const sanitizedNodes = nodeUpdateArray.map(node => {
                                const safeNode = { ...node };
                                safeNode.font = window.sanitizeVisNetworkFont(node.font || {});
                                return safeNode;
                            });
                            network.body.data.nodes.update(sanitizedNodes);
                        } catch (error) {
                            console.warn('노드 배치 업데이트 중 오류:', error);
                            // 개별 업데이트 시도
                            nodeUpdateArray.forEach(nodeUpdate => {
                                try {
                                    if (nodeUpdate.font) {
                                        nodeUpdate.font = window.sanitizeVisNetworkFont(nodeUpdate.font);
                                    }
                                    network.body.data.nodes.update([nodeUpdate]);
                                } catch (e) {
                                    console.warn(`노드 ${nodeUpdate.id} 배치 업데이트 실패:`, e);
                                }
                            });
                        }
                    }
                }
            } else {
                // 기존 yearSemester 엣지 처리
                const yearSemester = edge.title;
                
                // 모든 노드의 원래 상태 저장 및 업데이트 준비
                allCurrentNodes.forEach(currentNode => {
                // 원래 스타일 저장 (처음 호버 시에만)
                if (!edgeHoverOriginalNodeStyles.has(currentNode.id)) {
                    edgeHoverOriginalNodeStyles.set(currentNode.id, {
                        opacity: currentNode.opacity || 1,
                        // 🚨 vis-network 호환성을 위한 안전한 font 속성 복사
                        font: currentNode.font ? {
                            color: currentNode.font.color || '#495057',
                            size: currentNode.font.size || 14,
                            face: currentNode.font.face || 'arial',
                            background: currentNode.font.background || 'none',
                            strokeWidth: currentNode.font.strokeWidth || 0,
                            strokeColor: currentNode.font.strokeColor || '#ffffff'
                        } : {
                            color: '#495057',
                            size: 14,
                            face: 'arial',
                            background: 'none',
                            strokeWidth: 0,
                            strokeColor: '#ffffff'
                        },
                        color: currentNode.color ? { ...currentNode.color } : undefined
                    });
                }
                
                const course = courses.find(c => c.id === currentNode.id);
                if (course && course.yearSemester === yearSemester) {
                    highlightNodeIds.push(currentNode.id);
                } else {
                    dimNodeIds.push(currentNode.id);
                    // 디밍할 노드 업데이트 배열에 추가
                    nodeUpdateArray.push({
                        id: currentNode.id,
                        opacity: 0.3,  // 더 강한 투명도 적용
                        // 🚨 vis-network 호환성을 위한 안전한 font 속성 설정
                        font: {
                            color: 'rgba(73, 80, 87, 0.3)',
                            size: (currentNode.font && currentNode.font.size) || 14,
                            face: (currentNode.font && currentNode.font.face) || 'arial',
                            background: (currentNode.font && currentNode.font.background) || 'none',
                            strokeWidth: (currentNode.font && currentNode.font.strokeWidth) || 0,
                            strokeColor: (currentNode.font && currentNode.font.strokeColor) || '#ffffff'
                        },
                        color: {
                            background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                            border: currentNode.color ? currentNode.color.border : '#bdbdbd',
                            highlight: {
                                background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                                border: currentNode.color ? currentNode.color.border : '#bdbdbd'
                            }
                        }
                    });
                }
            });
            
            // 하이라이트할 노드들도 업데이트 배열에 추가 (색상 체계 유지)
            highlightNodeIds.forEach(nodeId => {
                const currentNode = network.body.data.nodes.get(nodeId);
                nodeUpdateArray.push({
                    id: nodeId,
                    opacity: 1,
                    borderWidth: 3,
                    color: {
                        background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                            border: currentNode.color ? currentNode.color.border : '#bdbdbd',
                        highlight: {
                            background: currentNode.color ? currentNode.color.background : '#f8f9fa',
                                border: currentNode.color ? currentNode.color.border : '#bdbdbd'
                        }
                    },
                    // 🚨 vis-network 호환성을 위한 안전한 font 속성 설정
                    font: {
                        color: '#000000ff',
                        size: (currentNode.font && currentNode.font.size) || 14,
                        face: (currentNode.font && currentNode.font.face) || 'arial',
                        background: (currentNode.font && currentNode.font.background) || 'none',
                        strokeWidth: (currentNode.font && currentNode.font.strokeWidth) || 0,
                        strokeColor: (currentNode.font && currentNode.font.strokeColor) || '#ffffff'
                    }
                });
            });
            
            // 모든 엣지들 처리
            const allEdges = network.body.data.edges.get();
            const edgeUpdateArray = [];
            
            allEdges.forEach(e => {
                // 원래 스타일 저장 (처음 호버 시에만)
                if (!edgeHoverOriginalEdgeStyles.has(e.id)) {
                    edgeHoverOriginalEdgeStyles.set(e.id, {
                        color: e.color || { color: '#bdbdbd', highlight: '#bdbdbd' },
                        width: e.width || 1
                    });
                }
                
                // 엣지의 title이 같은 yearSemester인지 확인
                if (e.title === yearSemester) {
                    // 같은 학년학기의 모든 엣지는 검은색으로
                    edgeUpdateArray.push({
                        id: e.id,
                        color: { 
                            color: '#525252ff', 
                            highlight: '#313131ff',
                            hover: '#333333ff'
                        },
                        width: 2
                    });
                } else {
                    // 다른 엣지들은 투명도 적용
                    edgeUpdateArray.push({
                        id: e.id,
                        color: { 
                            color: 'rgba(189, 189, 189, 0.2)', 
                            highlight: 'rgba(189, 189, 189, 0.2)',
                            hover: 'rgba(189, 189, 189, 0.2)'
                        },
                        width: 1
                    });
                }
            });
            
            // 배치로 업데이트
            network.body.data.edges.update(edgeUpdateArray);
            }
            
            // 모든 노드들 업데이트 (배치 처리)
            if (nodeUpdateArray.length > 0) {
                network.body.data.nodes.update(nodeUpdateArray);
            }
        }
        document.body.style.cursor = 'pointer';
    });

          network.on('blurEdge', function(params) {
          // 임시 엣지 호버 엣지 제거
          if (network.tempEdgeHoverEdges && network.tempEdgeHoverEdges.length > 0) {
              try {
                  network.body.data.edges.remove(network.tempEdgeHoverEdges);
                  network.tempEdgeHoverEdges = [];
              } catch (error) {
                  console.warn('임시 엣지 제거 실패:', error);
              }
          }
          
          // 지속성 모드가 아닐 때만 선택 해제
          if (!window.splineSelectionPersistent) {
              try {
                  // 🛡️ unselectAll 전에 font 속성 검증
                  if (network && network.body && network.body.data) {
                      window.validateAndFixNetworkFonts(network);
                  }
                  network.unselectAll();
              } catch (error) {
                  // 대안: 선택된 노드만 직접 해제
                  try {
                      if (network.body && network.body.selectionHandler) {
                          network.body.selectionHandler.unselectAll();
                      }
                  } catch (fallbackError) {
                      console.warn('blurEdge 대안 선택 해제도 실패:', fallbackError);
                  }
              }
          }
        
        // 모든 노드 원래 상태로 복원
        const nodeRestoreArray = [];
        edgeHoverOriginalNodeStyles.forEach((originalStyle, nodeId) => {
            const restoreData = {
                id: nodeId,
                opacity: originalStyle.opacity,
                font: originalStyle.font
            };
            
            // color 속성이 있으면 추가
            if (originalStyle.color) {
                restoreData.color = originalStyle.color;
            }
            
            // borderWidth 속성이 있으면 추가
            if (originalStyle.borderWidth !== undefined) {
                restoreData.borderWidth = originalStyle.borderWidth;
            }
            
            nodeRestoreArray.push(restoreData);
        });
        
        if (nodeRestoreArray.length > 0) {
            network.body.data.nodes.update(nodeRestoreArray);
        }
        
        // 모든 엣지 원래 상태로 복원
        const edgeRestoreArray = [];
        edgeHoverOriginalEdgeStyles.forEach((originalStyle, edgeId) => {
            const restoreData = {
                id: edgeId,
                color: originalStyle.color,
                width: originalStyle.width
            };
            
            // dashes 속성이 있으면 추가
            if (originalStyle.dashes !== undefined) {
                restoreData.dashes = originalStyle.dashes;
            }
            
            edgeRestoreArray.push(restoreData);
        });
        
        if (edgeRestoreArray.length > 0) {
            network.body.data.edges.update(edgeRestoreArray);
        }
        
        // 저장된 원래 스타일 초기화
        edgeHoverOriginalNodeStyles.clear();
        edgeHoverOriginalEdgeStyles.clear();
        document.body.style.cursor = 'default';
    });
    
    // 🛡️ window.network에 안전하게 할당하여 전역에서 접근 가능하게 함
    if (network && network.body && network.body.data) {
        window.network = network;
        
            // 🛡️ 네트워크 상태 주기적 검증 시스템
    window.networkHealthCheck = setInterval(() => {
        if (!window.network || !window.network.body || !window.network.body.data) {
            console.warn('네트워크 객체 상태가 손상되었습니다. 재초기화가 필요할 수 있습니다.');
            clearInterval(window.networkHealthCheck);
        } else {
            // 🛡️ 네트워크 내부 상태 추가 검증
            try {
                const nodeCount = window.network.body.data.nodes.length;
                const edgeCount = window.network.body.data.edges.length;
                
                // 노드 데이터 무결성 검증
                const nodes = window.network.body.data.nodes.get();
                const validNodes = nodes.filter(node => node && node.id);
                
                if (validNodes.length !== nodeCount) {
                    console.warn(`네트워크 노드 데이터 무결성 문제: ${validNodes.length}/${nodeCount}개 유효한 노드`);
                }
            } catch (error) {
                console.warn('네트워크 상태 검증 중 오류 발생:', error);
            }
        }
    }, 10000); // 10초마다 검증
    } else {
        console.error('네트워크 객체가 올바르게 초기화되지 않았습니다.');
    }
    
    // Value 컬럼 이벤트 시스템 설정 (네트워크 생성 후)
    setTimeout(() => {
        setupValueColumnEvents();
    }, 200);
    
    // 🌟 인터랙티브 레전드 생성 (공통가치대응 탭에서만)
    createInteractiveLegend();
}
// ... existing code ...

// 공통가치대응 탭 활성화 시 네트워크 그래프 렌더링
const originalShowTab = window.showTab;
window.showTab = function(tabName, event) {
    originalShowTab.apply(this, arguments);
    if (tabName === 'commonValues') {
        renderCommonValuesNetworkGraph();
    } else {
        const container = document.getElementById('commonValuesNetworkGraph');
        if (container) container.style.display = 'none';
    }
};
// ... existing code ...
    
    // 과목분류별 행 정의 (미분류 제외)
    const subjectTypes = [
        '설계', '디지털', '역사', '이론', '도시', '사회', '기술', '실무', '비교과'
    ];

    subjectTypes.forEach(subjectType => {
        // 전공필수 (교과목 블럭)


        // 비교과인 경우 2~5열 병합 처리
        if (subjectType === '비교과') {
            // 전공필수 셀을 병합된 셀로 사용
            const tdRequired = document.getElementById(`commonValues-cell-${subjectType}-필수`);
            if (tdRequired) {
                tdRequired.innerHTML = '';
                tdRequired.colSpan = 4; // 2~5열 병합
                tdRequired.style.textAlign = 'left';
                tdRequired.style.backgroundColor = '#f8f9fa';
                
                if (isEditModeCommonValues) {
                    // 수정모드에서도 블럭으로 표시, 클릭 시에만 편집 가능
                    tdRequired.style.cursor = 'pointer';
                    tdRequired.style.padding = '4px';
                    
                    const wrap = document.createElement('div');
                    wrap.className = 'block-wrap';
                    wrap.style.justifyContent = 'flex-start';
                    
                    // 기존 텍스트를 블럭으로 표시
                    if (extracurricularMergedTexts && extracurricularMergedTexts.length > 0) {
                        extracurricularMergedTexts.forEach(text => {
                            const block = createExtracurricularBlock(text);
                            wrap.appendChild(block);
                        });
                    }
                    // 비어있을 때도 안내 텍스트 표시하지 않음
                    
                    if (extracurricularMergedTexts && extracurricularMergedTexts.length > 0) {
                        tdRequired.appendChild(wrap);
                    }
                    
                    // 클릭 이벤트로 편집 모드 진입
                    tdRequired.addEventListener('click', function() {
                        if (tdRequired.dataset.editing === 'true') return; // 이미 편집 중이면 무시
                        
                        tdRequired.dataset.editing = 'true';
                        tdRequired.innerHTML = '';
                        tdRequired.contentEditable = 'true';
                        tdRequired.style.padding = '8px';
                        tdRequired.style.textAlign = 'left';
                        tdRequired.style.fontWeight = 'normal';
                        
                        // 기존 텍스트 복원
                        if (extracurricularMergedTexts && extracurricularMergedTexts.length > 0) {
                            tdRequired.innerHTML = extracurricularMergedTexts.join('<br>');
                        }
                        
                        tdRequired.focus();
                        
                        // blur 이벤트로 텍스트 저장
                        const handleBlur = function() {
                            const content = this.innerHTML;
                            
                            // <br> 태그를 기준으로 분할하고, 다양한 형식의 줄바꿈 처리
                            const texts = content
                                .replace(/<div>/gi, '<br>')
                                .replace(/<\/div>/gi, '')
                                .replace(/<p>/gi, '<br>')
                                .replace(/<\/p>/gi, '')
                                .split(/<br\s*\/?>/i)
                                .map(t => t.trim())
                                .filter(t => t && !t.includes('비교과 활동을 입력하세요'));
                            
                            extracurricularMergedTexts = texts;
                            
                            // 편집 상태 해제
                            tdRequired.dataset.editing = 'false';
                            tdRequired.contentEditable = 'false';
                            
                            // 테이블 다시 렌더링
                            renderCommonValuesTable();
                            
                            // 이벤트 리스너 제거
                            tdRequired.removeEventListener('blur', handleBlur);
                        };
                        
                        tdRequired.addEventListener('blur', handleBlur);
                    });
                } else {
                    // 일반모드: 텍스트를 블록으로 표시
                    tdRequired.classList.remove('editable-cell');
                    tdRequired.style.cursor = '';
                    tdRequired.contentEditable = 'false';
                    tdRequired.style.padding = '4px';
                    
                    const wrap = document.createElement('div');
                    wrap.className = 'block-wrap';
                    wrap.style.justifyContent = 'flex-start';
                    
                    if (extracurricularMergedTexts && extracurricularMergedTexts.length > 0) {
                        extracurricularMergedTexts.forEach(text => {
                            const block = createExtracurricularBlock(text);
                            wrap.appendChild(block);
                        });
                    }
                    // 비어있을 때는 아무것도 표시하지 않음 (안내 텍스트 제거)
                    
                    tdRequired.appendChild(wrap);
                }
            }
            
            // 나머지 셀들은 숨기기
            const tdRequiredCredit = document.getElementById(`commonValues-cell-${subjectType}-필수-학점`);
            if (tdRequiredCredit) tdRequiredCredit.style.display = 'none';
            
            const tdElective = document.getElementById(`commonValues-cell-${subjectType}-선택`);
            if (tdElective) tdElective.style.display = 'none';
            
            const tdElectiveCredit = document.getElementById(`commonValues-cell-${subjectType}-선택-학점`);
            if (tdElectiveCredit) tdElectiveCredit.style.display = 'none';
        } else {
            // 일반 과목분류 처리
            // 전공필수 (교과목 블럭)
            const tdRequired = document.getElementById(`commonValues-cell-${subjectType}-필수`);
            if (tdRequired) {
                tdRequired.innerHTML = '';
                tdRequired.colSpan = 1; // 병합 해제
                tdRequired.style.textAlign = '';
                tdRequired.style.fontWeight = '';
                tdRequired.style.backgroundColor = '';
                const requiredCourses = courses.filter(c => c.subjectType === subjectType && c.isRequired === '필수');
                const wrap = document.createElement('div');
                wrap.className = 'block-wrap';
                requiredCourses.forEach(course => {
                    const block = createCourseBlock(course, false, false);
                    wrap.appendChild(block);
                });
                tdRequired.appendChild(wrap);
                tdRequired.addEventListener('dragover', handleCommonValuesDragOver);
                tdRequired.addEventListener('drop', handleCommonValuesDrop);
            }

            // 전공필수 학점 표시 복원
            const tdRequiredCredit = document.getElementById(`commonValues-cell-${subjectType}-필수-학점`);
            if (tdRequiredCredit) {
                tdRequiredCredit.style.display = '';
                const requiredCourses = courses.filter(c => c.subjectType === subjectType && c.isRequired === '필수');
                tdRequiredCredit.textContent = requiredCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
            }

            // 전공선택 (교과목 블럭)
            const tdElective = document.getElementById(`commonValues-cell-${subjectType}-선택`);
            if (tdElective) {
                tdElective.innerHTML = '';
                tdElective.style.display = '';
                const electiveCourses = courses.filter(c => c.subjectType === subjectType && c.isRequired === '선택');
                const wrap = document.createElement('div');
                wrap.className = 'block-wrap';
                electiveCourses.forEach(course => {
                    const block = createCourseBlock(course, false, false);
                    wrap.appendChild(block);
                });
                tdElective.appendChild(wrap);
                tdElective.addEventListener('dragover', handleCommonValuesDragOver);
                tdElective.addEventListener('drop', handleCommonValuesDrop);
            }
            // 전공선택 학점
            const tdElectiveCredit = document.getElementById(`commonValues-cell-${subjectType}-선택-학점`);
            if (tdElectiveCredit) {
                tdElectiveCredit.style.display = '';
                const electiveCourses = courses.filter(c => c.subjectType === subjectType && c.isRequired === '선택');
                tdElectiveCredit.textContent = electiveCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
            }
        }
        // 공통가치대응I, II, III (여러 줄 표시 지원)
        const tdValue1 = document.getElementById(`commonValues-cell-${subjectType}-value1`);
        if (tdValue1) {
            // 모든 행(비교과 포함)에서 블럭 드롭 가능하도록 설정
            let wrap = tdValue1.querySelector('.block-wrap');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'block-wrap';
                tdValue1.appendChild(wrap);
            }
            wrap.innerHTML = '';
            
            // 비교과 행도 일반 행과 동일하게 처리
            tdValue1.style.backgroundColor = ''; // 배경색 제거
            tdValue1.style.cursor = 'default';
            tdValue1.contentEditable = 'false';
            tdValue1.classList.remove('editable-cell');
            
            // [수정] 복사된 블럭 정보로 렌더링 (교과목 + 비교과)
            if (commonValuesCopiedBlocks[subjectType] && Array.isArray(commonValuesCopiedBlocks[subjectType].value1)) {
                commonValuesCopiedBlocks[subjectType].value1.forEach(id => {
                    if (id.startsWith('extracurricular-')) {
                        // 비교과 블럭 처리
                        const name = window.extracurricularNameMap ? window.extracurricularNameMap[id] : id.replace('extracurricular-', '');
                        const block = createExtracurricularBlock(name);
                        wrap.appendChild(block);
                    } else {
                        // 일반 교과목 처리
                        const course = courses.find(c => c.id === id);
                        if (course) {
                            const block = createCourseBlock(course, false, false);
                            wrap.appendChild(block);
                        }
                    }
                });
            }
            
            // 비교과 행의 경우 extracurricularBlocks도 확인 (하위 호환성)
            if (subjectType === '비교과' && extracurricularBlocks && extracurricularBlocks.value1) {
                extracurricularBlocks.value1.forEach(name => {
                    const block = createExtracurricularBlock(name);
                    wrap.appendChild(block);
                });
            }
            
            tdValue1.addEventListener('dragover', handleCommonValuesDragOver);
            tdValue1.addEventListener('drop', handleCommonValuesDrop);
            
            // 셀이 편집 중이면 건드리지 않음
            if (!tdValue1.classList.contains('editing-cell')) {
                // 버전 복원 시에도 교과목 블럭이 이미 렌더링되었으므로 텍스트를 설정하지 않음
                if (!window.isRestoringVersion) {
                    // 기존 내용이 있으면 보존, 없으면 데이터에서 가져오기
                    const existingContent = wrap.innerHTML.trim();
                    if (!existingContent) {
                        const value = (commonValuesCellTexts?.[subjectType]?.value1 || '').replace(/\n/g, '<br>');
                        wrap.innerHTML = value;
                    }
                }
            }
            
            if (isEditModeCommonValues) {
                // [수정] VALUE1,2,3 셀은 텍스트 편집 불가능하도록 설정
                tdValue1.classList.remove('editable-cell');
                tdValue1.style.cursor = '';
                tdValue1.style.position = '';
                tdValue1.onclick = null;
            } else {
                tdValue1.classList.remove('editable-cell');
                tdValue1.style.cursor = '';
                tdValue1.style.position = '';
                tdValue1.onclick = null;
            }
        }
        const tdValue2 = document.getElementById(`commonValues-cell-${subjectType}-value2`);
        if (tdValue2) {
            // 모든 행(비교과 포함)에서 블럭 드롭 가능하도록 설정
            let wrap = tdValue2.querySelector('.block-wrap');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'block-wrap';
                tdValue2.appendChild(wrap);
            }
            wrap.innerHTML = '';
            
            // 비교과 행도 일반 행과 동일하게 처리
            tdValue2.style.backgroundColor = ''; // 배경색 제거
            tdValue2.style.cursor = 'default';
            tdValue2.contentEditable = 'false';
            tdValue2.classList.remove('editable-cell');
            
            // [수정] 복사된 블럭 정보로 렌더링 (교과목 + 비교과)
            if (commonValuesCopiedBlocks[subjectType] && Array.isArray(commonValuesCopiedBlocks[subjectType].value2)) {
                commonValuesCopiedBlocks[subjectType].value2.forEach(id => {
                    if (id.startsWith('extracurricular-')) {
                        // 비교과 블럭 처리
                        const name = window.extracurricularNameMap ? window.extracurricularNameMap[id] : id.replace('extracurricular-', '');
                        const block = createExtracurricularBlock(name);
                        wrap.appendChild(block);
                    } else {
                        // 일반 교과목 처리
                        const course = courses.find(c => c.id === id);
                        if (course) {
                            const block = createCourseBlock(course, false, false);
                            wrap.appendChild(block);
                        }
                    }
                });
            }
            
            // 비교과 행의 경우 extracurricularBlocks도 확인 (하위 호환성)
            if (subjectType === '비교과' && extracurricularBlocks && extracurricularBlocks.value2) {
                extracurricularBlocks.value2.forEach(name => {
                    const block = createExtracurricularBlock(name);
                    wrap.appendChild(block);
                });
            }
            
            tdValue2.addEventListener('dragover', handleCommonValuesDragOver);
            tdValue2.addEventListener('drop', handleCommonValuesDrop);
            
            // 셀이 편집 중이면 건드리지 않음
            if (!tdValue2.classList.contains('editing-cell')) {
                // 버전 복원 시에도 교과목 블럭이 이미 렌더링되었으므로 텍스트를 설정하지 않음
                if (!window.isRestoringVersion) {
                    // 기존 내용이 있으면 보존, 없으면 데이터에서 가져오기
                    const existingContent = wrap.innerHTML.trim();
                    if (!existingContent) {
                        const value = (commonValuesCellTexts?.[subjectType]?.value2 || '').replace(/\n/g, '<br>');
                        wrap.innerHTML = value;
                    }
                }
            }
            
            if (isEditModeCommonValues) {
                // [수정] VALUE1,2,3 셀은 텍스트 편집 불가능하도록 설정
                tdValue2.classList.remove('editable-cell');
                tdValue2.style.cursor = '';
                tdValue2.style.position = '';
                tdValue2.onclick = null;
            } else {
                tdValue2.classList.remove('editable-cell');
                tdValue2.style.cursor = '';
                tdValue2.style.position = '';
                tdValue2.onclick = null;
            }
        }
        const tdValue3 = document.getElementById(`commonValues-cell-${subjectType}-value3`);
        if (tdValue3) {
            // 모든 행(비교과 포함)에서 블럭 드롭 가능하도록 설정
            let wrap = tdValue3.querySelector('.block-wrap');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.className = 'block-wrap';
                tdValue3.appendChild(wrap);
            }
            wrap.innerHTML = '';
            
            // 비교과 행도 일반 행과 동일하게 처리
            tdValue3.style.backgroundColor = ''; // 배경색 제거
            tdValue3.style.cursor = 'default';
            tdValue3.contentEditable = 'false';
            tdValue3.classList.remove('editable-cell');
            
            // [수정] 복사된 블럭 정보로 렌더링 (교과목 + 비교과)
            if (commonValuesCopiedBlocks[subjectType] && Array.isArray(commonValuesCopiedBlocks[subjectType].value3)) {
                commonValuesCopiedBlocks[subjectType].value3.forEach(id => {
                    if (id.startsWith('extracurricular-')) {
                        // 비교과 블럭 처리
                        const name = window.extracurricularNameMap ? window.extracurricularNameMap[id] : id.replace('extracurricular-', '');
                        const block = createExtracurricularBlock(name);
                        wrap.appendChild(block);
                    } else {
                        // 일반 교과목 처리
                        const course = courses.find(c => c.id === id);
                        if (course) {
                            const block = createCourseBlock(course, false, false);
                            wrap.appendChild(block);
                        }
                    }
                });
            }
            
            // 비교과 행의 경우 extracurricularBlocks도 확인 (하위 호환성)
            if (subjectType === '비교과' && extracurricularBlocks && extracurricularBlocks.value3) {
                extracurricularBlocks.value3.forEach(name => {
                    const block = createExtracurricularBlock(name);
                    wrap.appendChild(block);
                });
            }
            
            tdValue3.addEventListener('dragover', handleCommonValuesDragOver);
            tdValue3.addEventListener('drop', handleCommonValuesDrop);
            
            // 셀이 편집 중이면 건드리지 않음
            if (!tdValue3.classList.contains('editing-cell')) {
                // 복원 시에는 기존 내용을 무시하고 데이터에서 가져오기
                if (window.isRestoringVersion) {
                    const value = (commonValuesCellTexts?.[subjectType]?.value3 || '').replace(/\n/g, '<br>');
                    wrap.innerHTML = value;
                } else {
                    // 기존 내용이 있으면 보존, 없으면 데이터에서 가져오기
                    const existingContent = wrap.innerHTML.trim();
                    if (!existingContent) {
                        const value = (commonValuesCellTexts?.[subjectType]?.value3 || '').replace(/\n/g, '<br>');
                        wrap.innerHTML = value;
                    }
                }
            }
            
            if (isEditModeCommonValues) {
                // [수정] VALUE1,2,3 셀은 텍스트 편집 불가능하도록 설정
                tdValue3.classList.remove('editable-cell');
                tdValue3.style.cursor = '';
                tdValue3.style.position = '';
                tdValue3.onclick = null;
            } else {
                tdValue3.classList.remove('editable-cell');
                tdValue3.style.cursor = '';
                tdValue3.style.position = '';
                tdValue3.onclick = null;
            }
        }
        // 전공필수 학점 (교과목 블럭 드롭 불가, 학점 합계만 표시)
        const tdRequiredCredit = document.getElementById(`commonValues-cell-${subjectType}-필수-학점`);
        if (tdRequiredCredit) {
            const requiredCourses = courses.filter(c => c.subjectType === subjectType && c.isRequired === '필수');
            tdRequiredCredit.textContent = requiredCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
        }
    });

    // 미분류 교과목 별도 표 렌더링(기존 방식 유지)
    const unclassifiedTbody = document.getElementById('unclassifiedTableBody');
    if (unclassifiedTbody) {
        unclassifiedTbody.innerHTML = '';
        const unclassifiedCourses = courses.filter(c => c.subjectType === '미분류' && c.category !== '교양');
        if (unclassifiedCourses.length > 0) {
            const tr = document.createElement('tr');
            const tdType = document.createElement('td');
            tdType.className = 'col-type';
            tdType.textContent = '미분류';
            tr.appendChild(tdType);
            const tdRequired = document.createElement('td');
            tdRequired.className = 'col-major-required';
            tdRequired.id = 'commonValues-cell-미분류-필수';
            const requiredUnclassified = unclassifiedCourses.filter(c => c.isRequired === '필수');
            requiredUnclassified.forEach(course => {
                const block = createCourseBlock(course, false, false);
                // 드래그 가능 여부는 createCourseBlock 내부에서 처리되므로 별도 설정 불필요
                tdRequired.appendChild(block);
            });
            // 드래그 이벤트 리스너 설정
            tdRequired.addEventListener('dragover', handleCommonValuesDragOver);
            tdRequired.addEventListener('drop', handleCommonValuesDrop);
            tr.appendChild(tdRequired);
            const tdRequiredCredit = document.createElement('td');
            tdRequiredCredit.className = 'col-major-required-credit';
            tdRequiredCredit.id = 'commonValues-cell-미분류-필수-학점';
            tdRequiredCredit.textContent = requiredUnclassified.reduce((sum, c) => sum + (c.credits || 0), 0);
            tr.appendChild(tdRequiredCredit);
            const tdElective = document.createElement('td');
            tdElective.className = 'col-major-elective';
            tdElective.id = 'commonValues-cell-미분류-선택';
            const electiveUnclassified = unclassifiedCourses.filter(c => c.isRequired === '선택');
            electiveUnclassified.forEach(course => {
                const block = createCourseBlock(course, false, false);
                // 드래그 가능 여부는 createCourseBlock 내부에서 처리되므로 별도 설정 불필요
                tdElective.appendChild(block);
            });
            // 드래그 이벤트 리스너 설정
            tdElective.addEventListener('dragover', handleCommonValuesDragOver);
            tdElective.addEventListener('drop', handleCommonValuesDrop);
            tr.appendChild(tdElective);
            const tdElectiveCredit = document.createElement('td');
            tdElectiveCredit.className = 'col-major-elective-credit';
            tdElectiveCredit.id = 'commonValues-cell-미분류-선택-학점';
            tdElectiveCredit.textContent = electiveUnclassified.reduce((sum, c) => sum + (c.credits || 0), 0);
            tr.appendChild(tdElectiveCredit);
            
            unclassifiedTbody.appendChild(tr);
        }
    }

    // 표 아래에 배치되지 않은 교과목 블럭 나열 (미분류 제외)
    const assignedIds = new Set();
    subjectTypes.forEach(subjectType => {
        courses.forEach(c => {
            if (c.subjectType === subjectType) {
                assignedIds.add(c.id);
            }
        });
    });
    courses.forEach(c => {
        if (c.subjectType === '미분류') {
            assignedIds.add(c.id);
        }
    });
    const unassigned = courses.filter(c => !assignedIds.has(c.id));
    const unassignedDiv = document.getElementById('commonValuesUnassignedBlocks');
    if (unassignedDiv) {
        unassignedDiv.innerHTML = '';
        if (unassigned.length > 0) {
            const label = document.createElement('div');
            label.textContent = '표에 배치되지 않은 교과목';
            label.style.fontWeight = 'bold';
            label.style.marginBottom = '8px';
            unassignedDiv.appendChild(label);
            unassigned.forEach(course => {
                const block = createCourseBlock(course, false, false);
                unassignedDiv.appendChild(block);
            });
        }
    }
    
    // 모든 렌더링 작업 끝난 후 그래프도 갱신
    renderCommonValuesNetworkGraph();
}

// 공통가치대응 드래그 오버/드롭 이벤트 (curriculum과 유사하게)
function handleCommonValuesDragOver(e) {
    e.preventDefault();
    
    // 드래그 중인 데이터가 없으면 드롭 불가
    if (!currentDraggedData) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // 드롭 대상 셀 확인
    let td = e.target.closest('td');
    if (!td || !td.id.startsWith('commonValues-cell-')) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    const idParts = td.id.replace('commonValues-cell-', '').split('-');
    const targetSubjectType = idParts[0];
    const targetColumn = idParts[1]; // 필수, 선택, value1, value2, value3
    
    // VALUE 컬럼이 아닌 경우 (전공필수/전공선택)
    if (!targetColumn || !targetColumn.startsWith('value')) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // 일반 교과목인 경우 원래 행이 아니면 드롭 불가
    if (currentDraggedData.type === 'course' && currentDraggedData.course.subjectType !== targetSubjectType) {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // 비교과 블럭인 경우 비교과 행이 아니면 드롭 불가
    if (currentDraggedData.type === 'extracurricular' && targetSubjectType !== '비교과') {
        e.dataTransfer.dropEffect = 'none';
        return;
    }
    
    // 드롭 가능한 경우
    e.dataTransfer.dropEffect = 'move';
}
function handleCommonValuesDrop(e) {
    e.preventDefault();
    // 수정모드가 아닐 때는 무시
    const editModeButton = document.getElementById('editModeToggleCommonValues');
    const isEditMode = editModeButton && editModeButton.classList.contains('active');
    if (!isEditMode) return;

    const data = e.dataTransfer.getData('text/plain');
    let parsedData;
    try {
        parsedData = JSON.parse(data);
    } catch {
        // JSON 파싱 실패시 기존 방식으로 처리 (일반 교과목)
        const course = courses.find(c => c.courseName === data);
        if (!course) return;
        parsedData = { type: 'course', course: course };
    }

    // td의 id에서 subjectType, isRequired 추출
    let td = e.target.closest('td');
    if (!td || !td.id.startsWith('commonValues-cell-')) return;
    // [추가] 드래그 대상 셀의 주요 속성 로그 출력
    // id 예시: commonValues-cell-설계-필수, commonValues-cell-설계-선택, ...
    const idParts = td.id.replace('commonValues-cell-', '').split('-');
    const subjectType = idParts[0];
    const isRequired = idParts[1] === '필수';
    const valueColumn = idParts[1] && idParts[1].startsWith('value');

    // VALUE1,2,3 컬럼에 드롭하는 경우 복사 동작
    if (idParts[1] && idParts[1].startsWith('value')) {
        const valueKey = idParts[1]; // value1, value2, value3
        
        // 일반 교과목의 경우 원래 분류와 다른 행에는 드롭 불가
        if (parsedData.type === 'course' && parsedData.course.subjectType !== subjectType) {
            showToast(`"${parsedData.course.courseName}" 교과목은 ${parsedData.course.subjectType} 행에만 배치할 수 있습니다.`);
            return;
        }
        
        // 비교과 블럭 처리
        if (parsedData.type === 'extracurricular') {
            // 비교과 블럭은 비교과 행에만 배치 가능
            if (subjectType !== '비교과') {
                showToast('비교과 블럭은 비교과 행에만 배치할 수 있습니다.');
                return;
            }
            
            // commonValuesCopiedBlocks에 비교과 블럭도 저장 (과목분류별로 관리)
            if (!commonValuesCopiedBlocks[subjectType]) {
                commonValuesCopiedBlocks[subjectType] = { value1: [], value2: [], value3: [] };
            }
            if (!commonValuesCopiedBlocks[subjectType][valueKey]) {
                commonValuesCopiedBlocks[subjectType][valueKey] = [];
            }
            
            // 비교과 블럭을 고유 ID로 저장 (extracurricular- 접두사 사용)
            const extracurricularId = `extracurricular-${parsedData.name}`;
            if (!commonValuesCopiedBlocks[subjectType][valueKey].includes(extracurricularId)) {
                commonValuesCopiedBlocks[subjectType][valueKey].push(extracurricularId);
            }
            
            // 비교과 블럭 정보를 별도로 저장 (이름 매핑용)
            if (!window.extracurricularNameMap) {
                window.extracurricularNameMap = {};
            }
            window.extracurricularNameMap[extracurricularId] = parsedData.name;
            
            // 표 즉시 재렌더링
            setTimeout(() => {
                renderCommonValuesTable();
            }, 0);
            return;
        }
        
        // 일반 교과목 블럭 처리
        const course = parsedData.course;
        if (!commonValuesCopiedBlocks[subjectType]) {
            commonValuesCopiedBlocks[subjectType] = { value1: [], value2: [], value3: [] };
        }
        if (!commonValuesCopiedBlocks[subjectType][valueKey]) {
            commonValuesCopiedBlocks[subjectType][valueKey] = [];
        }
        if (!commonValuesCopiedBlocks[subjectType][valueKey].includes(course.id)) {
            commonValuesCopiedBlocks[subjectType][valueKey].push(course.id);
        }
        // DOM에만 추가하지 않고, 전체 렌더링에서 반영되도록 함
        // 표 즉시 재렌더링
        setTimeout(() => {
            renderCommonValuesTable();
        }, 0);
        return;
    }

    // 비교과 블럭은 VALUE 컬럼이 아닌 곳으로는 드롭할 수 없음
    if (parsedData.type === 'extracurricular') {
        showToast('비교과 블럭은 공통가치대응 컬럼에만 배치할 수 있습니다.');
        return;
    }

    // 공통가치대응 탭에서는 전공필수/전공선택 컬럼의 수정을 막음
    showToast('공통가치대응 탭에서는 전공필수/전공선택 컬럼을 수정할 수 없습니다.\n교과목 관리 탭에서 수정해주세요.');
    return;
    
    // 아래 코드는 실행되지 않음 (전공필수/전공선택 수정 불가)
    /*
    // 변경 전 값들 저장
    const course = parsedData.course;
    const oldSubjectType = course.subjectType;
    const oldIsRequired = course.isRequired;

    // 교과목의 과목분류와 필수여부 변경
    course.subjectType = subjectType;
    course.isRequired = isRequired ? '필수' : '선택';

    // 변경이력 기록
    const changes = [];
    if (oldSubjectType !== subjectType) {
        changes.push({field: '과목분류', before: oldSubjectType, after: subjectType});
    }
    if (oldIsRequired !== course.isRequired) {
        changes.push({field: '필수여부', before: oldIsRequired, after: course.isRequired});
    }

    if (changes.length > 0) {
        addChangeHistory('수정', course.courseName, changes);
        // [추가] 변경이력 팝업(토스트) 알림
        const changeMsg = `교과목 "${course.courseName}" 속성 변경됨:\n` + changes.map(c => `- ${c.field}: ${c.before} → ${c.after}`).join('\n');
        showToast(changeMsg);
    }

    // 테이블 다시 렌더링
    renderCommonValuesTable();
    renderCourses();
    renderMatrix();
    renderChangeHistoryPanel();
    */
}

// 공통가치대응 수정모드 상태 변수 (전역에서 이미 선언됨)

// 공통가치대응 수정모드 토글 함수
function toggleEditModeCommonValues() {
    isEditModeCommonValues = !isEditModeCommonValues;
    const btn = document.getElementById('editModeToggleCommonValues');
    const text = document.getElementById('editModeTextCommonValues');
    if (btn && text) {
        if (isEditModeCommonValues) {
            btn.classList.add('active');
            text.textContent = '수정모드';
            // 수정모드에서 제목 편집 가능하게 설정
            setCommonValuesTitleEditable(true);
        } else {
            btn.classList.remove('active');
            text.textContent = '일반모드';
            // 일반모드에서 제목 편집 비활성화
            setCommonValuesTitleEditable(false);
        }
    }
    
    // 셀 편집 중이 아닐 때만 테이블 재렌더링
    if (!isCommonValuesCellEditing) {
    // 테이블 재렌더링(드래그 가능 여부 반영)
    renderCommonValuesTable();
    }
    // 모든 교과목 블럭의 드래그 가능 여부 업데이트
    updateCommonValuesCourseBlocksDraggable();
}

// 과목분류별 배지 클래스 반환
function getSubjectTypeClass(subjectType) {
    switch(subjectType) {
        case '미분류': return 'type-unclassified';
        case '설계': return 'type-design';
        case '디지털': return 'type-digital';
        case '역사': return 'type-history';
        case '이론': return 'type-theory';
        case '도시': return 'type-urban';
        case '사회': return 'type-social';
        case '기술': return 'type-tech';
        case '실무': return 'type-practice';
        case '비교과': return 'type-extracurricular';
        default: return 'type-default';
    }
}

// 공통가치대응 교과목 블록의 드래그 가능 여부 업데이트
function updateCommonValuesCourseBlocksDraggable() {
    // 공통가치대응 탭의 수정모드 상태 변수 사용
    const isEditMode = isEditModeCommonValues;
    
    // 공통가치대응 테이블 내의 모든 교과목 블록
    const commonValuesBlocks = document.querySelectorAll('#commonValuesTable .course-block');
    commonValuesBlocks.forEach(block => {
        block.draggable = isEditMode;
    });
    
    // 미분류 테이블 내의 모든 교과목 블록
    const unclassifiedBlocks = document.querySelectorAll('#unclassifiedTable .course-block');
    unclassifiedBlocks.forEach(block => {
        block.draggable = isEditMode;
    });
    
    // 배치되지 않은 교과목 블럭들
    const unassignedBlocks = document.querySelectorAll('#commonValuesUnassignedBlocks .course-block');
    unassignedBlocks.forEach(block => {
        block.draggable = isEditMode;
    });
}
// 색상 기준 전환 상태 변수 (true: 과목분류, false: 구분)
let colorModeBySubjectType = true;
// 색상 기준 전환 함수
function toggleColorMode() {
    colorModeBySubjectType = !colorModeBySubjectType;
    const slider = document.getElementById('toggleSlider');
    const text = document.getElementById('colorModeText');
    
    if (slider && text) {
        if (colorModeBySubjectType) {
            // 과목분류 모드: 슬라이더를 왼쪽으로, 회색
            slider.style.left = '3px';
            slider.style.background = '#6c757d';
            text.textContent = '분야';
        } else {
            // 구분 모드: 슬라이더를 오른쪽으로, 녹색
            slider.style.left = '51px';
            slider.style.background = '#28a745';
            text.textContent = '구분';
        }
    }
    
    // 색상 범례 업데이트
    updateColorLegendCommonValues();
    
    // 공통가치대응 탭이 활성화된 경우에만 테이블 재렌더링
    const commonValuesTab = document.getElementById('commonValues');
    if (commonValuesTab && commonValuesTab.classList.contains('active')) {
        // 셀 편집 중이 아닐 때만 테이블 재렌더링
        if (!isCommonValuesCellEditing) {
        renderCommonValuesTable();
        }
        
        // 네트워크 그래프의 노드 색상 업데이트
        if (window.network && window.network.body && window.network.body.data && window.network.body.data.nodes) {
            const allNodes = window.network.body.data.nodes.get();
            const nodeUpdateArray = [];
            
            allNodes.forEach(node => {
                // 학년-학기 노드나 비교과 노드는 스킵
                if (node.group === 'semester' || node.isExtracurricular) return;
                
                // 노드의 과목 정보 찾기
                const course = courses.find(c => c.id === node.id);
                if (!course) return;
                
                // 색상 범례 가져오기
                const { subjectTypeColors, categoryColors } = generateColorLegend();
                let newColor = '#f8f9fa'; // 기본색
                let borderColor = '#bdbdbd'; // 기본 테두리색
                
                if (colorModeBySubjectType) {
                    // 과목분류별 색상
                    newColor = subjectTypeColors[course.subjectType] || '#f5f5f5';
                    // 테두리는 배경색보다 진한 색으로
                    const borderColors = {
                        '설계': '#9e9e9e',
                        '디지털': '#a1887f',
                        '역사': '#d84315',
                        '이론': '#00897b',
                        '도시': '#c2185b',
                        '사회': '#5e35b1',
                        '기술': '#ef6c00',
                        '실무': '#43a047',
                        '비교과': '#757575'
                    };
                    borderColor = borderColors[course.subjectType] || '#757575';
                } else {
                    // 구분별 색상
                    newColor = categoryColors[course.category] || '#f8f9fa';
                    // 테두리는 배경색보다 진한 색으로
                    const borderColors = {
                        '교양': '#6c757d',
                        '건축적사고': '#1976d2',
                        '설계': '#c62828',
                        '기술': '#f57c00',
                        '실무': '#388e3c',
                        '기타': '#7b1fa2'
                    };
                    borderColor = borderColors[course.category] || '#6c757d';
                }
                
                // 노드 색상 업데이트
                nodeUpdateArray.push({
                    id: node.id,
                    color: {
                        background: newColor,
                        border: borderColor,
                        highlight: {
                            background: newColor,
                            border: borderColor
                        }
                    }
                });
            });
            
            // 업데이트 적용
            if (nodeUpdateArray.length > 0) {
                window.network.body.data.nodes.update(nodeUpdateArray);
            }
        } else {
            // 네트워크가 없으면 전체 그래프 재렌더링
            if (typeof renderCommonValuesNetworkGraph === 'function') {
                renderCommonValuesNetworkGraph();
            }
        }
    }
    
    // 이수모형 탭도 함께 갱신 (동기화)
    const curriculumTab = document.getElementById('curriculum');
    if (curriculumTab && curriculumTab.classList.contains('active')) {
        renderCurriculumTable();
    }
}

// 색상 기준 전환 상태 변수 (true: 과목분류, false: 구분)
let colorModeBySubjectTypeCurriculum = true;

// 보기 모드 상태 변수 (true: 변경사항 표시, false: 변경사항 적용)
let showChangesModeCurriculum = true;
let showChangesModeCommonValues = false; // 기본값을 변경사항 적용으로 변경

// 보기 모드 전환 함수 (이수모형 탭용)
function toggleViewModeCurriculum() {
    showChangesModeCurriculum = !showChangesModeCurriculum;
    const button = document.getElementById('viewModeToggleCurriculum');
    const text = document.getElementById('viewModeTextCurriculum');
    
    if (button && text) {
        if (showChangesModeCurriculum) {
            // 변경사항 표시 모드
            text.textContent = '변경사항 표시';
            button.style.background = '#6c757d';
        } else {
            // 변경사항 적용 모드
            text.textContent = '변경사항 적용';
            button.style.background = '#28a745';
        }
    }
    
    // 이수모형 탭이 활성화된 경우에만 테이블 재렌더링
    const curriculumTab = document.getElementById('curriculum');
    if (curriculumTab && curriculumTab.classList.contains('active')) {
        renderCurriculumTable();
    }
}

// 보기 모드 전환 함수 (공통가치대응 탭용)
function toggleViewModeCommonValues() {
    showChangesModeCommonValues = !showChangesModeCommonValues;
    const button = document.getElementById('viewModeToggleCommonValues');
    const text = document.getElementById('viewModeTextCommonValues');
    
    if (button && text) {
        if (showChangesModeCommonValues) {
            // 변경사항 표시 모드
            text.textContent = '변경사항 표시';
            button.style.background = '#6c757d';
        } else {
            // 변경사항 적용 모드
            text.textContent = '변경사항 적용';
            button.style.background = '#28a745';
        }
    }
    
    // 공통가치대응 탭이 활성화된 경우에만 테이블 재렌더링
    const commonValuesTab = document.getElementById('commonValues');
    if (commonValuesTab && commonValuesTab.classList.contains('active')) {
        renderCommonValuesTable();
    }
}

// 보기 모드 전환 함수 (매트릭스 탭용)
function toggleViewModeMatrix() {
    showChangesModeMatrix = !showChangesModeMatrix;
    const button = document.getElementById('viewModeToggleMatrix');
    const text = document.getElementById('viewModeTextMatrix');
    
    if (button && text) {
        if (showChangesModeMatrix) {
            // 변경사항 표시 모드
            text.textContent = '변경사항 표시';
            button.style.background = '#6c757d';
        } else {
            // 변경사항 적용 모드
            text.textContent = '변경사항 적용';
            button.style.background = '#28a745';
        }
    }
    
    // 매트릭스 테이블 다시 렌더링
    renderMatrix();
}

// 색상 기준 전환 함수 (이수모형 탭용)
function toggleColorModeCurriculum() {
    colorModeBySubjectTypeCurriculum = !colorModeBySubjectTypeCurriculum;
    const slider = document.getElementById('toggleSliderCurriculum');
    const text = document.getElementById('colorModeTextCurriculum');
    
    if (slider && text) {
        if (colorModeBySubjectTypeCurriculum) {
            // 과목분류 모드: 슬라이더를 왼쪽으로, 회색
            slider.style.left = '3px';
            slider.style.background = '#6c757d';
            text.textContent = '분야';
        } else {
            // 구분 모드: 슬라이더를 오른쪽으로, 녹색
            slider.style.left = '51px';
            slider.style.background = '#28a745';
            text.textContent = '구분';
        }
    }
    
    // 색상 범례 업데이트
    updateColorLegendCurriculum();
    
    // 이수모형 탭이 활성화된 경우에만 테이블 재렌더링
    const curriculumTab = document.getElementById('curriculum');
    if (curriculumTab && curriculumTab.classList.contains('active')) {
        renderCurriculumTable();
    }
    
    // 공통가치대응 탭도 함께 갱신 (동기화)
    const commonValuesTab = document.getElementById('commonValues');
    if (commonValuesTab && commonValuesTab.classList.contains('active')) {
        // 셀 편집 중이 아닐 때만 테이블 재렌더링
        if (!isCommonValuesCellEditing) {
        renderCommonValuesTable();
        
        }
    }

    // 공통가치대응 탭의 네트워크 그래프 노드 색상 업데이트
    if (window.network && window.network.body && window.network.body.data && window.network.body.data.nodes) {
        const allNodes = window.network.body.data.nodes.get();
        const nodeUpdateArray = [];
        
        allNodes.forEach(node => {
            // 학년-학기 노드나 비교과 노드는 스킵
            if (node.group === 'semester' || node.isExtracurricular) return;
            
            // 노드의 과목 정보 찾기
            const course = courses.find(c => c.id === node.id);
            if (!course) return;
            
            // 색상 범례 가져오기
            const { subjectTypeColors, categoryColors } = generateColorLegend();
            let newColor = '#f8f9fa'; // 기본색
            let borderColor = '#bdbdbd'; // 기본 테두리색
            
            if (colorModeBySubjectTypeCurriculum) {
                // 과목분류별 색상
                newColor = subjectTypeColors[course.subjectType] || '#f5f5f5';
                // 테두리는 배경색보다 진한 색으로
                const borderColors = {
                    '설계': '#9e9e9e',
                    '디지털': '#a1887f',
                    '역사': '#d84315',
                    '이론': '#00897b',
                    '도시': '#c2185b',
                    '사회': '#5e35b1',
                    '기술': '#ef6c00',
                    '실무': '#43a047',
                    '비교과': '#757575'
                };
                borderColor = borderColors[course.subjectType] || '#757575';
            } else {
                // 구분별 색상
                newColor = categoryColors[course.category] || '#f8f9fa';
                // 테두리는 배경색보다 진한 색으로
                const borderColors = {
                    '교양': '#6c757d',
                    '건축적사고': '#1976d2',
                    '설계': '#c62828',
                    '기술': '#f57c00',
                    '실무': '#388e3c',
                    '기타': '#7b1fa2'
                };
                borderColor = borderColors[course.category] || '#6c757d';
            }
            
            // 노드 색상 업데이트
            nodeUpdateArray.push({
                id: node.id,
                color: {
                    background: newColor,
                    border: borderColor,
                    highlight: {
                        background: newColor,
                        border: borderColor
                    }
                }
            });
        });
        
        // 업데이트 적용
        if (nodeUpdateArray.length > 0) {
            window.network.body.data.nodes.update(nodeUpdateArray);
        }
    } else {
        // 네트워크가 없으면 전체 그래프 재렌더링
    if (typeof renderCommonValuesNetworkGraph === 'function') {
        const commonValuesTab = document.getElementById('commonValues');
        if (commonValuesTab && commonValuesTab.classList.contains('active')) {
            renderCommonValuesNetworkGraph();
            }
        }
    }
}

// 공통가치대응 VALUE1,2,3 셀의 복사된 블럭 정보를 관리하는 전역 객체
let commonValuesCopiedBlocks = {};

// 비교과 VALUE 셀의 텍스트 정보를 관리하는 전역 객체
let extracurricularTexts = { value1: [], value2: [], value3: [] };

// 비교과 블럭 정보를 관리하는 전역 객체
let extracurricularBlocks = { value1: [], value2: [], value3: [] };

// 비교과 병합 셀의 텍스트 정보를 관리하는 전역 배열
let extracurricularMergedTexts = [];

// [추가] 드래그 시작한 셀 정보를 저장하는 전역 변수
let draggedFromCell = null;

// 드래그 중인 요소의 데이터를 저장하는 전역 변수
let currentDraggedData = null;

// 비교과 텍스트를 임시 교과목 블록으로 생성하는 함수
function createExtracurricularBlock(text) {
    const block = document.createElement('div');
    block.className = 'course-block course-block-type-extracurricular';
    block.dataset.extracurricularText = text;
    
    // 블록 내용 설정 - 이름만 표시
    let blockContent = `<div class="course-block-title">${text}</div>`;
    
    block.innerHTML = blockContent;
    
    // 현재 설정된 글씨 크기 적용
    block.style.fontSize = commonValuesFontSize + 'px';
    
    // 블록 내부 텍스트 요소들의 폰트 사이즈도 업데이트
    const title = block.querySelector('.course-block-title');
    
    if (title) {
        title.style.fontSize = commonValuesFontSize + 'px';
    }
    
    // 드래그 기능 추가
    block.draggable = true;
    block.style.cursor = 'move';
    
    // 드래그 이벤트 핸들러
    block.addEventListener('dragstart', function(e) {
        e.dataTransfer.effectAllowed = 'move';
        const dragData = {
            type: 'extracurricular',
            name: text
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
        
        // 드래그 중인 비교과 데이터를 전역 변수에 저장
        currentDraggedData = dragData;
        
        // 드래그 시작 셀 정보 저장 (VALUE 컬럼에서 드래그 시)
        const td = block.closest('td');
        if (td && td.id) {
            const idParts = td.id.replace('commonValues-cell-', '').split('-');
            if (idParts[1] && idParts[1].startsWith('value')) {
                draggedFromCell = {
                    subjectType: idParts[0],
                    valueKey: idParts[1]
                };
            }
        }
        
        block.classList.add('dragging');
        setTimeout(() => showDeleteZone(), 0);
    });
    
    block.addEventListener('dragend', function(e) {
        block.classList.remove('dragging');
        hideDeleteZone();
    });
    
    return block;
}

// 삭제 ZONE 표시 함수
function showDeleteZone() {
    let deleteZone = document.getElementById('deleteZone');
    if (!deleteZone) {
        deleteZone = document.createElement('div');
        deleteZone.id = 'deleteZone';
        deleteZone.innerHTML = `
            <div style="
                position: fixed;
                right: 32px;
                bottom: 32px;
                background: #dc3545;
                color: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
                z-index: 10000;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                border: 3px dashed #fff;
                min-width: 200px;
            ">
                <div style="font-size: 24px; margin-bottom: 10px;">🗑️</div>
                <div style="font-weight: bold; margin-bottom: 5px;">삭제 영역</div>
                <div style="font-size: 14px;">블럭을 여기에 드롭하면 삭제됩니다</div>
            </div>
        `;
        document.body.appendChild(deleteZone);
        
        // 드롭 이벤트 설정
        deleteZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            deleteZone.style.background = '#c82333';
        });
        
        deleteZone.addEventListener('dragleave', (e) => {
            deleteZone.style.background = '#dc3545';
        });
        
        deleteZone.addEventListener('drop', (e) => {
            e.preventDefault();
            const data = e.dataTransfer.getData('text/plain');
            let parsedData;
            try {
                parsedData = JSON.parse(data);
            } catch {
                // JSON 파싱 실패시 기존 방식으로 처리 (일반 교과목)
                const course = courses.find(c => c.courseName === data);
                if (course) {
                    parsedData = { type: 'course', course: course, name: data };
                }
            }
            
            if (parsedData && draggedFromCell) {
                const { subjectType, valueKey } = draggedFromCell;
                
                if (parsedData.type === 'extracurricular') {
                    // 비교과 블럭 삭제
                    const extracurricularId = `extracurricular-${parsedData.name}`;
                    if (commonValuesCopiedBlocks[subjectType] && commonValuesCopiedBlocks[subjectType][valueKey]) {
                        const index = commonValuesCopiedBlocks[subjectType][valueKey].indexOf(extracurricularId);
                        if (index > -1) {
                            commonValuesCopiedBlocks[subjectType][valueKey].splice(index, 1);
                        }
                    }
                    
                    // 하위 호환성을 위한 extracurricularBlocks에서도 삭제
                    if (subjectType === '비교과' && extracurricularBlocks && extracurricularBlocks[valueKey]) {
                        const index = extracurricularBlocks[valueKey].indexOf(parsedData.name);
                        if (index > -1) {
                            extracurricularBlocks[valueKey].splice(index, 1);
                        }
                    }
                    
                    // 셀의 텍스트도 제거
                    if (commonValuesCellTexts && commonValuesCellTexts[subjectType] && commonValuesCellTexts[subjectType][valueKey]) {
                        commonValuesCellTexts[subjectType][valueKey] = '';
                    }
                    
                    showToast(`"${parsedData.name}" 비교과 블럭이 삭제되었습니다.`);
                } else if (parsedData.type === 'course') {
                    // 일반 교과목 블럭 삭제
                    if (commonValuesCopiedBlocks[subjectType] && commonValuesCopiedBlocks[subjectType][valueKey]) {
                        const index = commonValuesCopiedBlocks[subjectType][valueKey].indexOf(parsedData.course.id);
                        if (index > -1) {
                            commonValuesCopiedBlocks[subjectType][valueKey].splice(index, 1);
                        }
                    }
                    
                    // 셀의 텍스트도 제거
                    if (commonValuesCellTexts && commonValuesCellTexts[subjectType] && commonValuesCellTexts[subjectType][valueKey]) {
                        commonValuesCellTexts[subjectType][valueKey] = '';
                    }
                    
                    showToast(`"${parsedData.course.courseName}" 블럭이 삭제되었습니다.`);
                }
                
                // 테이블 다시 렌더링
                renderCommonValuesTable();
            }
            // 드래그 시작 셀 정보 초기화
            draggedFromCell = null;
            hideDeleteZone();
        });
    }
    deleteZone.style.display = 'block';
}

// 삭제 ZONE 숨기기 함수
function hideDeleteZone() {
    const deleteZone = document.getElementById('deleteZone');
    if (deleteZone) {
        deleteZone.style.display = 'none';
    }
}

// 공통가치대응 탭 글씨크기 상태 변수
let commonValuesFontSize = 14;

function updateCommonValuesFontSize() {
    // CSS 변수로 폰트 크기 적용 (공통가치대응 탭에만 영향)
    document.documentElement.style.setProperty('--font-size', commonValuesFontSize + 'px');
    // 폰트 크기 표시 UI 동기화
    const display = document.getElementById('commonValues-font-size-display');
    if (display) display.textContent = commonValuesFontSize + 'px';
    
    // 화살표 즉시 업데이트
    setTimeout(() => {
        const movedCoursesForGhost = getMovedCoursesForGhost();
        drawMoveArrows(movedCoursesForGhost);
    }, 10);
}

function increaseCommonValuesFontSize() {
    if (commonValuesFontSize < 24) {
        commonValuesFontSize += 1;
        updateCommonValuesFontSize();
    }
}

function decreaseCommonValuesFontSize() {
    if (commonValuesFontSize > 10) {
        commonValuesFontSize -= 1;
        updateCommonValuesFontSize();
    }
}

// 공통가치대응 탭을 렌더링할 때 폰트 크기도 반영
const originalRenderCommonValuesTable = renderCommonValuesTable;
renderCommonValuesTable = function() {
    originalRenderCommonValuesTable.apply(this, arguments);
    updateCommonValuesFontSize();
}

window.increaseCommonValuesFontSize = increaseCommonValuesFontSize;
window.decreaseCommonValuesFontSize = decreaseCommonValuesFontSize;

function toggleCommonValuesFullscreen() {
    const commonValuesContent = document.getElementById('commonValues');
    const fullscreenText = document.getElementById('commonValues-fullscreen-text');
    if (!commonValuesContent || !fullscreenText) return;
    if (commonValuesContent.classList.contains('fullscreen-active')) {
        commonValuesContent.classList.remove('fullscreen-active');
        fullscreenText.textContent = '전체 화면';
    } else {
        commonValuesContent.classList.add('fullscreen-active');
        fullscreenText.textContent = '화면 축소';
    }
}
window.toggleCommonValuesFullscreen = toggleCommonValuesFullscreen;

// 공통가치대응 셀 텍스트 저장용 객체
let commonValuesCellTexts = {};

function startCommonValuesCellEdit(cell, subjectType, valueKey) {
    if (cell.classList.contains('editing-cell')) return;
    
    // 셀 편집 중 플래그 설정
    isCommonValuesCellEditing = true;
    
    // block-wrap에서 실제 내용 가져오기
    const blockWrap = cell.querySelector('.block-wrap');
    let originalContent = '';
    
    if (blockWrap) {
        originalContent = blockWrap.innerHTML || '';
        // <br> 태그를 줄바꿈으로 변환
        originalContent = originalContent.replace(/<br\s*\/?>/gi, '\n');
        // HTML 태그 제거
        originalContent = originalContent.replace(/<[^>]*>/g, '');
        originalContent = originalContent.trim();
    } else {
        originalContent = cell.textContent || '';
    }
    
    cell.setAttribute('data-original-content', originalContent);
    cell.classList.add('editing-cell');
    
    // textarea 생성 (셀 전체 영역 사용)
    const textarea = document.createElement('textarea');
    textarea.value = originalContent;
    textarea.className = 'cell-edit-textarea';
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.minHeight = '100%';
    textarea.style.overflow = 'auto';
    textarea.style.padding = '4px';
    textarea.style.margin = '0';
    textarea.style.borderRadius = '4px';
    textarea.style.border = '1.5px solidrgb(250, 0, 0)';
    textarea.style.background = '#bdbdbd';
    textarea.style.fontSize = 'inherit';
    textarea.style.fontFamily = 'inherit';
    textarea.style.resize = 'none';
    textarea.style.outline = 'none';
    textarea.style.position = 'absolute';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.right = '0';
    textarea.style.bottom = '0';
    
    // autosize
    function autosize(el) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    }
    textarea.addEventListener('input', function() { autosize(textarea); });
    setTimeout(function() { autosize(textarea); }, 0);
    
    // 이벤트
    textarea.addEventListener('blur', () => saveCommonValuesCellEdit(cell, textarea.value, subjectType, valueKey));
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelCommonValuesCellEdit(cell);
        }
        // Enter는 줄바꿈만, 저장은 blur로
    });
    
    cell.innerHTML = '';
    cell.appendChild(textarea);
    textarea.focus();
    textarea.select();
}
function saveCommonValuesCellEdit(cell, newValue, subjectType, valueKey) {
    // 임시 저장소 초기화
    if (!tempCommonValuesCellTexts[subjectType]) tempCommonValuesCellTexts[subjectType] = {};
    
    // 실제 데이터 저장소 초기화
    if (!commonValuesCellTexts[subjectType]) commonValuesCellTexts[subjectType] = {};
    
    // 모든 줄바꿈을 \n으로 통일해서 저장
    const normalized = newValue.replace(/\r\n|\r|\n/g, '\n');
    
    // 임시 저장소에 저장
    tempCommonValuesCellTexts[subjectType][valueKey] = normalized;
    
    // 실제 데이터에도 반영 (임시 데이터는 버전 저장 시 사용)
    commonValuesCellTexts[subjectType][valueKey] = normalized;
    
    cell.classList.remove('editing-cell');
    cell.removeAttribute('data-original-content');
    
    // block-wrap에 내용 저장 (다른 셀에 영향 주지 않도록 직접 업데이트)
    const blockWrap = cell.querySelector('.block-wrap');
    if (blockWrap) {
        // 표시할 때는 \n을 <br>로 변환
        blockWrap.innerHTML = normalized.replace(/\n/g, '<br>');
    } else {
        // block-wrap이 없는 경우 셀에 직접 저장
        cell.innerHTML = normalized.replace(/\n/g, '<br>');
    }
    
    // 편집 모드 상태에 따라 셀 클래스 및 이벤트 리스너 복원
    if (isEditModeCommonValues) {
        cell.classList.add('editable-cell');
        cell.style.cursor = 'pointer';
        cell.style.position = 'relative';
        cell.onclick = function(e) {
            startCommonValuesCellEdit(cell, subjectType, valueKey);
        };
    } else {
        cell.classList.remove('editable-cell');
        cell.style.cursor = '';
        cell.style.position = '';
        cell.onclick = null;
    }
    
    // 셀 편집 완료 플래그 해제
    isCommonValuesCellEditing = false;
    
    // 같은 행의 다른 셀들이 영향을 받지 않도록 확인
    // 같은 subjectType의 다른 value 셀들이 편집 중이 아닌지 확인
    const valueKeys = ['value1', 'value2', 'value3'];
    let otherCellsEditing = false;
    
    valueKeys.forEach(key => {
        if (key !== valueKey) {
            const otherCell = document.getElementById(`commonValues-cell-${subjectType}-${key}`);
            if (otherCell && otherCell.classList.contains('editing-cell')) {
                otherCellsEditing = true;
            }
        }
    });
    
    // 다른 셀이 편집 중이 아니면 전체 테이블 렌더링 방지
    if (!otherCellsEditing) {
        // 셀 편집 완료 후 전체 테이블 렌더링을 방지하기 위해 플래그 설정
        isCommonValuesCellEditing = false;
        
        // 다른 셀들의 내용을 보존하기 위해 데이터를 업데이트
        valueKeys.forEach(key => {
            if (key !== valueKey) {
                const otherCell = document.getElementById(`commonValues-cell-${subjectType}-${key}`);
                if (otherCell) {
                    const wrap = otherCell.querySelector('.block-wrap');
                    if (wrap) {
                        const existingContent = wrap.innerHTML.trim();
                        if (existingContent) {
                            // 기존 내용을 데이터에 저장
                            if (!commonValuesCellTexts[subjectType]) {
                                commonValuesCellTexts[subjectType] = {};
                            }
                            const textContent = existingContent.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
                            commonValuesCellTexts[subjectType][key] = textContent;
                        }
                    }
                }
            }
        });
        
        // 임시 저장소에도 다른 셀들의 내용을 저장
        if (!tempCommonValuesCellTexts[subjectType]) {
            tempCommonValuesCellTexts[subjectType] = {};
        }
        valueKeys.forEach(key => {
            if (key !== valueKey) {
                const otherCell = document.getElementById(`commonValues-cell-${subjectType}-${key}`);
                if (otherCell) {
                    const wrap = otherCell.querySelector('.block-wrap');
                    if (wrap) {
                        const existingContent = wrap.innerHTML.trim();
                        if (existingContent) {
                            const textContent = existingContent.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
                            tempCommonValuesCellTexts[subjectType][key] = textContent;
                        }
                    }
                }
            }
        });
    }
    
    showToast('변경사항이 임시 저장되었습니다. 버전 저장 버튼을 눌러주세요.');
}
function cancelCommonValuesCellEdit(cell) {
    const originalContent = cell.getAttribute('data-original-content');
    cell.classList.remove('editing-cell');
    cell.removeAttribute('data-original-content');
    
    // block-wrap에 원래 내용 복원
    const blockWrap = cell.querySelector('.block-wrap');
    if (blockWrap) {
        blockWrap.innerHTML = originalContent.replace(/\n/g, '<br>');
    } else {
        cell.textContent = originalContent;
    }
    
    // 편집 모드 상태에 따라 셀 클래스 및 이벤트 리스너 복원
    if (isEditModeCommonValues) {
        cell.classList.add('editable-cell');
        cell.style.cursor = 'pointer';
        cell.style.position = 'relative';
        // 셀의 id에서 subjectType과 valueKey 추출
        const cellId = cell.id;
        const match = cellId.match(/commonValues-cell-([^-]+)-value([123])/);
        if (match) {
            const subjectType = match[1];
            const valueKey = 'value' + match[2];
            cell.onclick = function(e) {
                startCommonValuesCellEdit(cell, subjectType, valueKey);
            };
        }
    } else {
        cell.classList.remove('editable-cell');
        cell.style.cursor = '';
        cell.style.position = '';
        cell.onclick = null;
    }
    
    // 셀 편집 완료 플래그 해제
    isCommonValuesCellEditing = false;
    
    // 같은 행의 다른 셀들이 영향을 받지 않도록 확인
    // 같은 subjectType의 다른 value 셀들이 편집 중이 아닌지 확인
    const cellId = cell.id;
    const match = cellId.match(/commonValues-cell-([^-]+)-value([123])/);
    if (match) {
        const subjectType = match[1];
        const valueKeys = ['value1', 'value2', 'value3'];
        let otherCellsEditing = false;
        
        valueKeys.forEach(key => {
            const otherCell = document.getElementById(`commonValues-cell-${subjectType}-${key}`);
            if (otherCell && otherCell.classList.contains('editing-cell')) {
                otherCellsEditing = true;
            }
        });
        
        // 다른 셀이 편집 중이 아니면 전체 테이블 렌더링 방지
        if (!otherCellsEditing) {
            // 셀 편집 완료 후 전체 테이블 렌더링을 방지하기 위해 플래그 설정
            isCommonValuesCellEditing = false;
            
            // 다른 셀들의 내용을 보존하기 위해 데이터를 업데이트
            valueKeys.forEach(key => {
                const otherCell = document.getElementById(`commonValues-cell-${subjectType}-${key}`);
                if (otherCell) {
                    const wrap = otherCell.querySelector('.block-wrap');
                    if (wrap) {
                        const existingContent = wrap.innerHTML.trim();
                        if (existingContent) {
                            // 기존 내용을 데이터에 저장
                            if (!commonValuesCellTexts[subjectType]) {
                                commonValuesCellTexts[subjectType] = {};
                            }
                            const textContent = existingContent.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
                            commonValuesCellTexts[subjectType][key] = textContent;
                        }
                    }
                }
            });
            
            // 임시 저장소에도 다른 셀들의 내용을 저장
            if (!tempCommonValuesCellTexts[subjectType]) {
                tempCommonValuesCellTexts[subjectType] = {};
            }
            valueKeys.forEach(key => {
                const otherCell = document.getElementById(`commonValues-cell-${subjectType}-${key}`);
                if (otherCell) {
                    const wrap = otherCell.querySelector('.block-wrap');
                    if (wrap) {
                        const existingContent = wrap.innerHTML.trim();
                        if (existingContent) {
                            const textContent = existingContent.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
                            tempCommonValuesCellTexts[subjectType][key] = textContent;
                        }
                    }
                }
            });
        }
    }
}
// 공통가치대응 테이블 엑셀 내보내기 (실제 엑셀 파일로 내보내기, 표 구조 보존)



// 모든 버전 데이터를 파일로 내보내기 (다운로드)
function exportVersionsToFile() {
    // 현재 메모리의 모든 버전 데이터를 새로운 탭별 구조로 변환
    const exportData = {
        versions: {},
        currentVersion: currentVersion,
        exportDate: new Date().toISOString(),
        structure: "tab-based" // 새로운 구조임을 명시
    };
    
    // 각 버전을 새로운 탭별 구조로 변환
    Object.keys(versions).forEach(versionName => {
        const oldVersion = versions[versionName];
        const newVersion = {
            // 1. 교과목 관리 탭
            coursesTab: {
                courses: oldVersion.courses || oldVersion.coursesTab?.courses || [],
                initialCourses: oldVersion.initialCourses || oldVersion.coursesTab?.initialCourses || []
            },
            
            // 2. 수행평가 매트릭스 탭
            matrixTab: {
                matrixData: oldVersion.matrixData || oldVersion.matrixTab?.matrixData || {},
                matrixTitleText: oldVersion.matrixTitleText || oldVersion.matrixTab?.matrixTitleText || '',
                matrixExtraTableData: oldVersion.matrixExtraTableData || oldVersion.matrixTab?.matrixExtraTableData || {}
            },
            
            // 3. 이수모형 탭
            curriculumTab: {
                curriculumCellTexts: oldVersion.curriculumCellTexts || oldVersion.curriculumTab?.curriculumCellTexts || {},
                curriculumTitleText: oldVersion.curriculumTitleText || oldVersion.curriculumTab?.curriculumTitleText || ''
            },
            
            // 4. 공통가치대응 탭
            commonValuesTab: {
                commonValuesCellTexts: oldVersion.commonValuesCellTexts || oldVersion.commonValuesTab?.commonValuesCellTexts || {},
                commonValuesTitleText: oldVersion.commonValuesTitleText || oldVersion.commonValuesTab?.commonValuesTitleText || ''
            },
            
            // 공통 설정
            settings: {
                designSettings: oldVersion.designSettings || oldVersion.settings?.designSettings || {},
                changeHistory: oldVersion.changeHistory || oldVersion.settings?.changeHistory || []
            },
            
            // 메타데이터
            metadata: {
                description: oldVersion.description || oldVersion.metadata?.description || '',
                saveDate: oldVersion.saveDate || oldVersion.metadata?.saveDate || new Date().toISOString()
            }
        };
        
        exportData.versions[versionName] = newVersion;
    });
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'uosmatrix_version.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('모든 버전이 새로운 탭별 구조로 내보내졌습니다.');
}

// 버전 파일 불러오기 (Import) 기능 추가
function importVersionsFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importData = JSON.parse(e.target.result);
                
                // 구조 확인
                if (importData.structure === "tab-based") {
                    // 새로운 탭별 구조
                    versions = importData.versions || {};
                    currentVersion = importData.currentVersion || '기본';
                } else {
                    // 기존 구조 호환성
                    versions = importData.versions || importData;
                    currentVersion = importData.currentVersion || Object.keys(versions)[0] || '기본';
                }
                
                // localStorage에 저장
                                
                // 버전 관리 모달이 열려있다면 버전 목록 새로고침
                const versionManagerModal = document.getElementById('versionManagerModal');
                if (versionManagerModal && versionManagerModal.style.display === 'block') {
                    renderVersionList();
                    showToast('버전 파일이 성공적으로 불러와졌습니다.');
                } else {
                    // 페이지 새로고침하여 데이터 적용
                    location.reload();
                    showToast('버전 파일이 성공적으로 불러와졌습니다.');
                }
            } catch (error) {
                alert('파일 형식이 올바르지 않습니다.');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// window에 함수 등록 (index.html에서 호출 가능)
window.exportVersionsToFile = exportVersionsToFile;
window.importVersionsFromFile = importVersionsFromFile;

// matrix-extra-table(하부 안내 표) 별도 데이터 구조
let matrixExtraTableData = {};

// matrix-extra-table 렌더링 함수 (셀 id 기준)
function renderMatrixExtraTable() {
    const table = document.querySelector('.matrix-extra-table');
    if (!table) return;
    
    const cells = table.querySelectorAll('td');
    
    // 항상 같은 순서로 id 부여
    cells.forEach((cell, idx) => {
        cell.id = 'matrix-extra-cell-' + idx;
        
        // 데이터가 있으면 표시, 빈 문자열도 <br>로 명확히 표시
        if (matrixExtraTableData && cell.id in matrixExtraTableData) {
            const cellData = matrixExtraTableData[cell.id];
            cell.innerHTML = cellData === '' ? '<br>' : cellData.replace(/\n/g, '<br>');
        } else {
            cell.innerHTML = '<br>';
        }
        
        // 편집 모드에 따라 이벤트 연결
        if (isEditModeMatrix) {
            cell.style.cursor = 'pointer';
            cell.onclick = function() {
                startMatrixExtraCellEdit(cell);
            };
        } else {
            cell.style.cursor = '';
            cell.onclick = null;
        }
    });
    
}

// 매트릭스 하부 안내 표 셀 편집 시작
function startMatrixExtraCellEdit(cell) {
    if (cell.querySelector('textarea')) return;
    
    // 셀 ID 확인
    if (!cell.id) {
        const idx = Array.from(cell.parentNode.children).indexOf(cell);
        cell.id = 'matrix-extra-cell-' + idx;
    }
    
    const original = cell.innerText;
    cell.innerHTML = '';
    
    // 데이터 확인 로깅
    
    // textarea 생성 (셀 전체 영역 사용)
    const textarea = document.createElement('textarea');
    // 저장된 데이터가 있으면 우선 사용, 없으면 현재 셀 내용 사용
    const savedData = matrixExtraTableData && matrixExtraTableData[cell.id];
    textarea.value = savedData !== undefined ? savedData : original;
    
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.minHeight = '100%';
    textarea.style.fontSize = 'inherit';
    textarea.style.fontFamily = 'inherit';
    textarea.style.resize = 'none';
    textarea.style.padding = '4px';
    textarea.style.margin = '0';
    textarea.style.border = '1.5px solid #bdbdbd';
    textarea.style.borderRadius = '4px';
    textarea.style.background = '#fffbe7';
    textarea.style.position = 'absolute';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.right = '0';
    textarea.style.bottom = '0';
    
    // 자동 높이 조절
    function autosize(el) {
        el.style.height = 'auto';
        el.style.height = (el.scrollHeight) + 'px';
    }
    textarea.addEventListener('input', function() { autosize(textarea); });
    
    textarea.onblur = function() {
        saveMatrixExtraCellEdit(cell, textarea.value);
    };
    
    textarea.onkeydown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            textarea.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cell.innerHTML = original;
        }
    };
    
    cell.appendChild(textarea);
    setTimeout(function() { autosize(textarea); }, 0);
    textarea.focus();
    textarea.select();
}

// ============================================
// 임시 저장소 (버전 저장 전까지 임시 보관)
// ============================================
// 각 탭별 제목 변경사항과 데이터를 임시로 보관
// 버전 저장 시 실제 데이터로 이동됨
//
// 제목 관련 임시 저장 구조:
// - tempMatrixData._titleChanged, _oldTitle, _newTitle
// - tempCurriculumCellTexts._titleChanged, _oldTitle, _newTitle  
// - tempCommonValuesCellTexts._titleChanged, _oldTitle, _newTitle
// ============================================

let tempMatrixExtraTableData = {};
let tempCourses = [];
let tempCurriculumCellTexts = {};
let tempCommonValuesCellTexts = {};
let tempMatrixData = {};
let tempMatrixChangeHistory = []; // 임시 매트릭스 변경이력

// 임시 저장소 초기화 함수
function clearTempStorage() {
    tempMatrixExtraTableData = {};
    tempCourses = [];
    tempCurriculumCellTexts = {};
    tempCommonValuesCellTexts = {};
    tempMatrixData = {};
    tempMatrixChangeHistory = [];
    
    // 매트릭스 제목 변경사항도 초기화
    const titleElement = document.getElementById('matrixTitle');
    if (titleElement && titleElement.getAttribute('data-original-title')) {
        titleElement.textContent = titleElement.getAttribute('data-original-title');
        titleElement.removeAttribute('data-original-title');
    }
    
    // 공통가치대응 제목 변경사항도 초기화
    const commonValuesTitleElement = document.getElementById('commonValuesTitle');
    if (commonValuesTitleElement && commonValuesTitleElement.getAttribute('data-original-title')) {
        commonValuesTitleElement.textContent = commonValuesTitleElement.getAttribute('data-original-title');
        commonValuesTitleElement.removeAttribute('data-original-title');
    }
}

// 탭 전환 시 UI만 초기화 (임시 데이터는 유지)
function resetEditModeUIOnly() {
    // 수정모드 상태는 유지하되, UI만 비활성화
    
    // 각 탭의 수정모드 버튼 상태만 초기화
    const buttons = [
        { id: 'editModeToggleCourses', textId: 'editModeTextCourses' },
        { id: 'editModeToggle', textId: 'editModeText' },
        { id: 'editModeToggleCurriculum', textId: 'editModeTextCurriculum' },
        { id: 'editModeToggleCommonValues', textId: 'editModeTextCommonValues' }
    ];
    
    buttons.forEach(btn => {
        const button = document.getElementById(btn.id);
        const text = document.getElementById(btn.textId);
        if (button) {
            button.classList.remove('active');
        }
        if (text) {
            text.textContent = '일반모드';
        }
    });
    
    // 편집 UI만 비활성화 (임시 데이터는 그대로 유지)
    disableCellEditing();
    setMatrixTitleEditable(false);
    setCurriculumTitleEditable(false);
    setCommonValuesTitleEditable(false);
    toggleMatrixExtraTableEditMode();
    updateAllCourseBlocksDraggable();
    updateCommonValuesCourseBlocksDraggable();
    
    // 수정모드 플래그도 false로 설정
    isEditMode = false;
    isEditModeMatrix = false;
    isEditModeCurriculum = false;
    isEditModeCommonValues = false;
}

// 모든 탭의 수정모드 상태 초기화 (임시 데이터도 초기화)
function resetAllEditModes() {
    isEditMode = false;
    isEditModeMatrix = false;
    isEditModeCurriculum = false;
    isEditModeCommonValues = false;
    
    // 각 탭의 수정모드 버튼 상태 초기화
    const buttons = [
        { id: 'editModeToggleCourses', textId: 'editModeTextCourses' },
        { id: 'editModeToggle', textId: 'editModeText' },
        { id: 'editModeToggleCurriculum', textId: 'editModeTextCurriculum' },
        { id: 'editModeToggleCommonValues', textId: 'editModeTextCommonValues' }
    ];
    
    buttons.forEach(btn => {
        const button = document.getElementById(btn.id);
        const text = document.getElementById(btn.textId);
        if (button) {
            button.classList.remove('active');
        }
        if (text) {
            text.textContent = '일반모드';
        }
    });
    
    // 각 탭별 편집 기능 비활성화
    disableCellEditing();
    setMatrixTitleEditable(false);
    setCurriculumTitleEditable(false);
    setCommonValuesTitleEditable(false);
    toggleMatrixExtraTableEditMode();
    updateAllCourseBlocksDraggable();
    updateCommonValuesCourseBlocksDraggable();
}

// 매트릭스 하부 안내 표 셀 편집 저장 (임시 저장)
function saveMatrixExtraCellEdit(cell, value) {
    // 임시 저장소에 저장
    tempMatrixExtraTableData[cell.id] = value;
    
    // 실제 데이터에도 반영 (임시 데이터는 버전 저장 시 사용)
    matrixExtraTableData[cell.id] = value;
    
    // 현재 셀만 업데이트하고 다른 셀들은 그대로 유지
    cell.innerHTML = value.replace(/\n/g, '<br>');
    
    // 디버깅을 위한 로그
    
    showToast('변경사항이 임시 저장되었습니다. 버전 저장 버튼을 눌러주세요.');
}

// matrix extra 표의 모든 셀 내용을 수집하는 함수
function collectMatrixExtraTableData() {
    const table = document.querySelector('.matrix-extra-table');
    if (!table) return {};
    const collectedData = {};
    const cells = table.querySelectorAll('td');
    
    
    // 항상 같은 순서로 id 부여
    cells.forEach((cell, idx) => {
        cell.id = 'matrix-extra-cell-' + idx;
        
        // 셀 내용 가져오기 (innerHTML을 사용하고 <br> 태그를 줄바꿈으로 변환)
        let cellContent = cell.innerHTML || '';
        
        // <br> 태그가 있으면 줄바꿈으로 변환
        cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
        
        // HTML 태그 제거 (하지만 내용은 보존)
        cellContent = cellContent.replace(/<[^>]*>/g, '');
        
        // 모든 셀을 반드시 저장 (빈 셀도 빈 문자열로 저장)
        collectedData[cell.id] = cellContent;
        
        // 디버깅: 각 셀의 내용 확인
    });
    
    return collectedData;
}

// 디버깅용: 현재 이수모형 표의 모든 셀 데이터 확인
function debugCurriculumCells() {
    const data = collectCurriculumTableData();
    
    // 빈 셀과 내용이 있는 셀 분류
    const emptyCells = [];
    const filledCells = [];
    
    Object.entries(data).forEach(([cellId, content]) => {
        if (!content || content.trim() === '') {
            emptyCells.push(cellId);
        } else {
            filledCells.push({ cellId, content });
        }
    });
    
    
    if (filledCells.length > 0) {
        filledCells.forEach(({ cellId, content }) => {
        });
    }
    
    if (emptyCells.length > 0 && emptyCells.length <= 20) {
        emptyCells.forEach(cellId => {
        });
    } else if (emptyCells.length > 20) {
    }
    
    // 저장된 curriculumCellTexts와 비교
    
    const savedEmptyCells = [];
    const savedFilledCells = [];
    
    Object.entries(curriculumCellTexts).forEach(([cellId, content]) => {
        if (!content || content.trim() === '') {
            savedEmptyCells.push(cellId);
        } else {
            savedFilledCells.push({ cellId, content });
        }
    });
    
    
    if (savedFilledCells.length > 0) {
        savedFilledCells.forEach(({ cellId, content }) => {
        });
    }
    
    return data;
}

// 글로벌 함수로 등록 (콘솔에서 사용 가능)
window.debugCurriculumCells = debugCurriculumCells;

// 디버깅용: 현재 매트릭스 데이터 상태 확인
function debugMatrixData() {
    
    if (tempMatrixData._titleChanged) {
        // 매트릭스 제목이 변경됨
    }
    
    return {
        matrixData: matrixData,
        tempMatrixData: tempMatrixData
    };
}

// 글로벌 함수로 등록 (콘솔에서 사용 가능)
window.debugMatrixData = debugMatrixData;

// 이수모형 탭의 현재 셀 데이터를 수집하는 함수
function collectCurriculumTableData() {
    const table = document.querySelector('.curriculum-table');
    if (!table) {
        return {};
    }
    const collectedData = {};
    
    // 모든 td 셀을 선택 (id가 있는 것만)
    const cells = table.querySelectorAll('td[id]');
    
    
    cells.forEach((cell) => {
        if (cell.id) {
            // 셀 내용 가져오기 (innerHTML을 사용하고 <br> 태그를 줄바꿈으로 변환)
            let cellContent = cell.innerHTML || '';
            
            // 교과목 블록이 있는 경우는 블록 제외하고 텍스트만 추출
            const courseBlocks = cell.querySelectorAll('.course-block');
            if (courseBlocks.length > 0) {
                // 교과목 블록이 있는 셀에서 블록을 제외한 텍스트 추출
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cellContent;
                
                // 교과목 블록들 제거
                tempDiv.querySelectorAll('.course-block').forEach(block => block.remove());
                
                // 남은 텍스트 내용 추출
                cellContent = tempDiv.innerHTML || '';
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            } else {
                // 일반 텍스트 셀
                // <br> 태그가 있으면 줄바꿈으로 변환
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                
                // HTML 태그 제거 (하지만 내용은 보존)
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            }
            
            // 모든 셀을 반드시 저장 (빈 셀도 빈 문자열로 저장)
            collectedData[cell.id] = cellContent;
            
            // 디버깅: 각 셀의 내용 확인
            if (cellContent) {
            }
        }
    });
    
    return collectedData;
}

// 디버깅용: 현재 공통가치대응 표의 모든 셀 데이터 확인
function debugCommonValuesCells() {
    const data = collectCommonValuesTableData();
    
    // 빈 셀과 내용이 있는 셀 분류
    const emptyCells = [];
    const filledCells = [];
    
    Object.entries(data).forEach(([cellId, content]) => {
        if (!content || content.trim() === '') {
            emptyCells.push(cellId);
        } else {
            filledCells.push({ cellId, content });
        }
    });
    
    
    if (filledCells.length > 0) {
        filledCells.forEach(({ cellId, content }) => {
        });
    }
    
    if (emptyCells.length > 0 && emptyCells.length <= 20) {
        emptyCells.forEach(cellId => {
        });
    } else if (emptyCells.length > 20) {
    }
    
    return data;
}
// 글로벌 함수로 등록 (콘솔에서 사용 가능)
window.debugCommonValuesCells = debugCommonValuesCells;

// 🔧 스플라인 클릭 디버깅 활성화/비활성화
window.enableSplineClickDebug = function() {
    window.DEBUG_SPLINE_CLICKS = true;
    console.log('스플라인 클릭 디버깅이 활성화되었습니다. 스플라인을 클릭해보세요.');
};

window.disableSplineClickDebug = function() {
    window.DEBUG_SPLINE_CLICKS = false;
    console.log('스플라인 클릭 디버깅이 비활성화되었습니다.');
};

// 공통가치대응 탭의 현재 셀 데이터를 수집하는 함수
function collectCommonValuesTableData() {
    const table = document.querySelector('#commonValuesTable');
    if (!table) {
        return {};
    }
    const collectedData = {};
    
    // 수정모드에서 텍스트 입력이 가능한 셀만 수집
    // 공통가치대응I, II, III 셀들만 수집 (value1, value2, value3)
    const subjectTypes = [
        '설계', '디지털', '역사', '이론', '도시', '사회', '기술', '실무', '비교과'
    ];
    
    
    subjectTypes.forEach(subjectType => {
        // 공통가치대응I, II, III 셀들만 수집
        const value1Cell = document.getElementById(`commonValues-cell-${subjectType}-value1`);
        const value2Cell = document.getElementById(`commonValues-cell-${subjectType}-value2`);
        const value3Cell = document.getElementById(`commonValues-cell-${subjectType}-value3`);
        
        // 2차원 구조로 데이터 수집
        if (!collectedData[subjectType]) {
            collectedData[subjectType] = {};
        }
        
        // value1 셀 수집
        if (value1Cell) {
            const blockWrap = value1Cell.querySelector('.block-wrap');
            let cellContent = '';
            
            if (blockWrap) {
                cellContent = blockWrap.innerHTML || '';
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            } else {
                cellContent = value1Cell.innerHTML || '';
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            }
            
            collectedData[subjectType].value1 = cellContent;
        }
        
        // value2 셀 수집
        if (value2Cell) {
            const blockWrap = value2Cell.querySelector('.block-wrap');
            let cellContent = '';
            
            if (blockWrap) {
                cellContent = blockWrap.innerHTML || '';
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            } else {
                cellContent = value2Cell.innerHTML || '';
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            }
            
            collectedData[subjectType].value2 = cellContent;
        }
        
        // value3 셀 수집
        if (value3Cell) {
            const blockWrap = value3Cell.querySelector('.block-wrap');
            let cellContent = '';
            
            if (blockWrap) {
                cellContent = blockWrap.innerHTML || '';
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            } else {
                cellContent = value3Cell.innerHTML || '';
                cellContent = cellContent.replace(/<br\s*\/?>/gi, '\n');
                cellContent = cellContent.replace(/<[^>]*>/g, '');
                cellContent = cellContent.trim();
            }
            
            collectedData[subjectType].value3 = cellContent;
        }
    });
    
    // 미분류 테이블의 편집 가능한 셀들도 수집 (필요한 경우)
    const unclassifiedTable = document.querySelector('#unclassifiedTable');
    if (unclassifiedTable) {
        const unclassifiedCells = unclassifiedTable.querySelectorAll('td');
        
        // 미분류 테이블에서도 편집 가능한 셀만 수집 (필요시)
        // 현재는 미분류 테이블에는 편집 가능한 텍스트 셀이 없으므로 제외
    }
    
    // 빈 셀과 내용이 있는 셀 분류
    const emptyCells = [];
    const filledCells = [];
    
    Object.entries(collectedData).forEach(([subjectType, values]) => {
        Object.entries(values).forEach(([valueKey, content]) => {
            if (!content || content.trim() === '') {
                emptyCells.push(`${subjectType}.${valueKey}`);
            } else {
                filledCells.push({ cellId: `${subjectType}.${valueKey}`, content });
            }
        });
    });
    
    
    return collectedData;
}

// 공통가치대응 제목 편집 가능하게 설정
function setCommonValuesTitleEditable(editable) {
    setTitleEditable('commonValuesTitle', editable, handleCommonValuesTitleInput, tempCommonValuesCellTexts, {}, '공통가치대응');
}

// 공통가치대응 제목 입력 처리
function handleCommonValuesTitleInput() {
    handleTitleInput('commonValuesTitle', tempCommonValuesCellTexts, '공통가치대응');
}
// 버전 저장/복원에 matrixExtraTableData 포함
// saveVersionData, saveCurrentVersion, restoreVersion 등에서 matrixExtraTableData를 함께 저장/복원
// ... existing code ...

// 매트릭스 하부 안내 표 편집 모드 토글
function toggleMatrixExtraTableEditMode() {
    const table = document.querySelector('.matrix-extra-table');
    if (!table) return;
    
    const cells = table.querySelectorAll('td');
    cells.forEach((cell, idx) => {
        // 셀에 고유 id 부여 (없으면)
        if (!cell.id) cell.id = 'matrix-extra-cell-' + idx;
        
        if (isEditModeMatrix) {
            // 편집 모드: 클릭 이벤트 연결
            cell.style.cursor = 'pointer';
            cell.onclick = function() {
                startMatrixExtraCellEdit(cell);
            };
        } else {
            // 일반 모드: 클릭 이벤트 제거
            cell.style.cursor = '';
            cell.onclick = null;
        }
    });
}

// 테스트용: 교과목 이름 변경 함수
function testChangeCourseName() {
    if (courses.length > 0) {
        const firstCourse = courses[0];
        const oldName = firstCourse.courseName;
        firstCourse.courseName = oldName + '_수정됨';
        
        // 변경 이력 추가
        addChangeHistory('수정', oldName, [{field: 'courseName', before: oldName, after: firstCourse.courseName}]);
        
        // UI 업데이트
        renderCourses();
        renderCurriculumTable();
        renderChangeHistoryPanel();
        
    }
}
window.testChangeCourseName = testChangeCourseName;

// 색상 범례 생성 함수들
function generateColorLegend() {
    // 과목분류별 색상 정의
    const subjectTypeColors = {
        '설계': '#e8e8e8',
        '디지털': '#f5f2e5', 
        '역사': '#ffece1',
        '이론': '#e0f2f1',
        '도시': '#fce4ec',
        '사회': '#e8eaf6',
        '기술': '#fff3e0',
        '실무': '#e8f5e8',
        '비교과': '#f1f8e9'
    };
    
    // 구분별 색상 정의
    const categoryColors = {
        '교양': '#e9ecef',
        '건축적사고': '#e3f2fd',
        '설계': '#ffebee',
        '기술': '#fff3e0',
        '실무': '#e8f5e8',
        '기타': '#f3e5f5'
    };
    
    return { subjectTypeColors, categoryColors };
}

function updateColorLegendCurriculum() {
    const legendContainer = document.getElementById('colorLegendCurriculum');
    if (!legendContainer) return;
    
    const { subjectTypeColors, categoryColors } = generateColorLegend();
    const colors = colorModeBySubjectTypeCurriculum ? subjectTypeColors : categoryColors;
    
    legendContainer.innerHTML = '';
    legendContainer.className = 'color-legend';
    
    Object.entries(colors).forEach(([key, color]) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'color-legend-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = 'color-legend-box';
        colorBox.style.background = color;
        
        const label = document.createElement('span');
        label.className = 'color-legend-label';
        label.textContent = key;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

function updateColorLegendCommonValues() {
    const legendContainer = document.getElementById('colorLegendCommonValues');
    if (!legendContainer) return;
    
    const { subjectTypeColors, categoryColors } = generateColorLegend();
    const colors = colorModeBySubjectType ? subjectTypeColors : categoryColors;
    
    legendContainer.innerHTML = '';
    legendContainer.className = 'color-legend';
    
    Object.entries(colors).forEach(([key, color]) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'color-legend-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = 'color-legend-box';
        colorBox.style.background = color;
        
        const label = document.createElement('span');
        label.className = 'color-legend-label';
        label.textContent = key;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContainer.appendChild(legendItem);
    });
}

// 중복 함수 제거 - 위에 이미 정의됨

// 체크박스 드롭다운 토글 함수
function toggleFilterDropdown(event, dropdownId) {
    event.stopPropagation();
    const dropdown = document.getElementById(dropdownId);
    const isOpen = dropdown.classList.contains('show');
    
    // 모든 드롭다운 닫기
    document.querySelectorAll('.filter-dropdown-content').forEach(d => d.classList.remove('show'));
    
    // 클릭한 드롭다운만 토글
    if (!isOpen) {
        dropdown.classList.add('show');
    }
}

// 학년 필터 업데이트 함수
function updateYearFilter() {
    const selectedYears = [];
    document.querySelectorAll('input[name="yearFilter"]:checked').forEach(cb => {
        selectedYears.push(cb.value + '학년');
    });
    
    const yearFilterText = document.getElementById('yearFilterText');
    if (selectedYears.length === 0) {
        yearFilterText.textContent = '전체';
    } else if (selectedYears.length === 1) {
        yearFilterText.textContent = selectedYears[0];
    } else {
        yearFilterText.textContent = `${selectedYears[0]} 외 ${selectedYears.length - 1}개`;
    }
    
    filterCourses();
}

// 학기 필터 업데이트 함수
function updateSemesterFilter() {
    const selectedSemesters = [];
    document.querySelectorAll('input[name="semesterFilter"]:checked').forEach(cb => {
        const value = cb.value === '계절' ? '계절학기' : cb.value + '학기';
        selectedSemesters.push(value);
    });
    
    const semesterFilterText = document.getElementById('semesterFilterText');
    if (selectedSemesters.length === 0) {
        semesterFilterText.textContent = '전체';
    } else if (selectedSemesters.length === 1) {
        semesterFilterText.textContent = selectedSemesters[0];
    } else {
        semesterFilterText.textContent = `${selectedSemesters[0]} 외 ${selectedSemesters.length - 1}개`;
    }
    
    filterCourses();
}

// 구분 필터 업데이트 함수
function updateCategoryFilter() {
    const selectedCategories = [];
    document.querySelectorAll('input[name="categoryFilter"]:checked').forEach(cb => {
        selectedCategories.push(cb.value);
    });
    
    const categoryFilterText = document.getElementById('categoryFilterText');
    if (selectedCategories.length === 0) {
        categoryFilterText.textContent = '전체';
    } else if (selectedCategories.length === 1) {
        categoryFilterText.textContent = selectedCategories[0];
    } else {
        categoryFilterText.textContent = `${selectedCategories[0]} 외 ${selectedCategories.length - 1}개`;
    }
    
    filterCourses();
}

// 과목분류 필터 업데이트 함수
function updateSubjectTypeFilter() {
    const selectedSubjectTypes = [];
    document.querySelectorAll('input[name="subjectTypeFilter"]:checked').forEach(cb => {
        selectedSubjectTypes.push(cb.value);
    });
    
    const subjectTypeFilterText = document.getElementById('subjectTypeFilterText');
    if (selectedSubjectTypes.length === 0) {
        subjectTypeFilterText.textContent = '전체';
    } else if (selectedSubjectTypes.length === 1) {
        subjectTypeFilterText.textContent = selectedSubjectTypes[0];
    } else {
        subjectTypeFilterText.textContent = `${selectedSubjectTypes[0]} 외 ${selectedSubjectTypes.length - 1}개`;
    }
    
    filterCourses();
}

// 드롭다운 외부 클릭 시 닫기
document.addEventListener('click', function(event) {
    if (!event.target.closest('.checkbox-filter-dropdown')) {
        document.querySelectorAll('.filter-dropdown-content').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
});

// ========================================
// 공통가치대응 Value 컬럼 그래프 하이라이트 시스템
// ========================================

// 선택된 value 그룹 상태 관리
let selectedValueGroup = null;
let originalValueGroupStyles = new Map();

// Value 컬럼 그래프 하이라이트 이벤트 시스템
function setupValueColumnEvents() {
    
    // 공통가치대응 테이블이 있는지 확인
    const table = document.getElementById('commonValuesTable');
    if (!table) {
        return;
    }
    
    // 모든 헤더 요소 확인 및 이벤트 추가
    const allHeaders = table.querySelectorAll('thead th');
    
    // Value 헤더 매핑
    const valueHeaderMap = {
        '환경의 지속가능성': { valueKey: 'value1', color: '#1976d2' },
        '미래기술의 활용': { valueKey: 'value2', color: '#d81b60' },
        '창의적 문제해결': { valueKey: 'value3', color: '#388e3c' }
    };
    
    allHeaders.forEach((header, index) => {
        const text = header.textContent.trim();
        
        // value 헤더인지 확인
        for (const [keyword, config] of Object.entries(valueHeaderMap)) {
            if (text.includes(keyword)) {
                
                // 이미 이벤트가 추가된 경우 스킵
                if (header.hasAttribute('data-value-events-added')) {
                    continue;
                }
                header.setAttribute('data-value-events-added', 'true');
                header.setAttribute('data-value-key', config.valueKey);
                
                // 헤더 기본 스타일은 CSS에서 관리
                
                // 호버 이벤트
                header.addEventListener('mouseenter', function() {
                    highlightValueGroupInGraph(config.valueKey, true); // 호버 효과
                    
                    // 스플라인 호버 상태 설정
                    window.hoveredBlob = config.valueKey;
                    
                    // 헤더 시각적 효과는 CSS에서 관리
                    header.style.cursor = 'pointer';
                });
                
                header.addEventListener('mouseleave', function() {
                    if (selectedValueGroup !== config.valueKey) {
                        unhighlightValueGroupInGraph();
                    }
                    
                    // 스플라인 호버 상태 해제
                    window.hoveredBlob = null;
                    
                    // 헤더 시각적 효과는 CSS에서 관리
                });
                
                // 클릭 이벤트
                header.addEventListener('click', function() {
                    
                    if (selectedValueGroup === config.valueKey) {
                        // 선택 해제
                        selectedValueGroup = null;
                        window.selectedCommonValuesBlob = null; // 스플라인 선택도 해제
                        unhighlightValueGroupInGraph();
                        updateHeaderSelectionState();
                        // 그래프 하이라이트도 업데이트
                        if (typeof window.updateNodeHighlight === 'function') {
                            window.updateNodeHighlight();
                        }
                        if (window.network) {
                            window.network.redraw();
                        }
                        showToast(`${keyword} 그룹 선택이 해제되었습니다.`);
                    } else {
                        // 새로운 그룹 선택
                        selectedValueGroup = config.valueKey;
                        window.selectedCommonValuesBlob = config.valueKey; // 스플라인 선택도 동기화
                        highlightValueGroupInGraph(config.valueKey, false);
                        updateHeaderSelectionState();
                        // 그래프 하이라이트도 업데이트
                        if (typeof window.updateNodeHighlight === 'function') {
                            window.updateNodeHighlight();
                        }
                        if (window.network) {
                            window.network.redraw();
                        }
                        showToast(`${keyword} 그룹이 선택되었습니다.`);
                    }
                });
                
                break; // 첫 번째 매칭만 처리
            }
        }
    });
    
    // Value 셀들 이벤트 추가
    const valueCells = table.querySelectorAll('.col-value1, .col-value2, .col-value3');
    
    valueCells.forEach((cell, index) => {
        // 이미 이벤트가 추가된 경우 스킵
        if (cell.hasAttribute('data-value-events-added')) return;
        cell.setAttribute('data-value-events-added', 'true');
        
        const valueKey = cell.classList.contains('col-value1') ? 'value1' : 
                        cell.classList.contains('col-value2') ? 'value2' : 'value3';
        
        
        // 호버 이벤트
        cell.addEventListener('mouseenter', function() {
            if (selectedValueGroup !== valueKey) {
                highlightValueGroupInGraph(valueKey, true); // 호버 효과
            }
            
            // 셀 시각적 효과
            cell.style.backgroundColor = 'rgba(100, 255, 218, 0.1)';
            cell.style.transition = 'background-color 0.2s ease, transform 0.2s ease';
            cell.style.transform = 'scale(1.01)';
        });
        
        cell.addEventListener('mouseleave', function() {
            if (selectedValueGroup !== valueKey) {
                unhighlightValueGroupInGraph();
            }
            
            // 셀 시각적 효과 복원
            if (selectedValueGroup !== valueKey) {
                cell.style.backgroundColor = '';
                cell.style.transform = 'scale(1)';
            }
        });
    });
    
}

// 그래프에서 value 그룹 하이라이트 (호버용)
function highlightValueGroupInGraph(valueKey, isTemporary = false) {
    
    if (!window.network) {
        return;
    }
    
    try {
        // 호버 상태를 별도로 저장
        window.hoveredCommonValuesBlob = valueKey;
        
        // 기존 선택된 스플라인이 있으면 우선 유지하되, 호버 효과를 위해 임시로 변경
        const originalSelectedBlob = window.selectedCommonValuesBlob;
        window.selectedCommonValuesBlob = valueKey;
        
        // updateNodeHighlight 함수 호출하여 동일한 효과 적용
        if (typeof window.updateNodeHighlight === 'function') {
            window.updateNodeHighlight();
        } else {
        }
        
        // 그래프 즉시 다시 그리기
        if (window.network) {
            window.network.redraw();
        }
        
        
    } catch (error) {
    }
}

// 그래프 하이라이트 해제 (호버 상태 복원)
function unhighlightValueGroupInGraph() {
    
    if (!window.network) {
        return;
    }
    
    try {
        // 호버 상태 해제
        window.hoveredCommonValuesBlob = null;
        
        // 원래 선택된 상태로 복원 (selectedValueGroup 기준)
        if (selectedValueGroup) {
            window.selectedCommonValuesBlob = selectedValueGroup;
        } else {
            window.selectedCommonValuesBlob = null;
        }
        
        // updateNodeHighlight 함수 호출하여 상태 복원
        if (typeof window.updateNodeHighlight === 'function') {
            window.updateNodeHighlight();
        } else {
        }
        
        // 그래프 즉시 다시 그리기
        if (window.network) {
            window.network.redraw();
        }
        
        
    } catch (error) {
    }
}

// 스플라인 선택 상태와 테이블 헤더 동기화
function syncSplineWithTableHeaders() {
    const selectedBlob = window.selectedCommonValuesBlob;
    
    // 공통가치대응 테이블이 있는지 확인
    const table = document.getElementById('commonValuesTable');
    if (!table) return;
    
    // 모든 value 헤더의 상태 업데이트
    const allHeaders = table.querySelectorAll('thead th[data-value-key]');
    allHeaders.forEach(header => {
        const valueKey = header.getAttribute('data-value-key');
        
        if (selectedBlob === valueKey) {
            // 선택된 스플라인에 해당하는 헤더 하이라이트
            header.classList.add('selected');
        } else {
            // 선택되지 않은 헤더 하이라이트 제거
            header.classList.remove('selected');
        }
    });
    
    // 셀들도 동기화 (기존 로직 유지)
    const valueCells = table.querySelectorAll('.col-value1, .col-value2, .col-value3');
    valueCells.forEach(cell => {
        const valueKey = cell.classList.contains('col-value1') ? 'value1' : 
                        cell.classList.contains('col-value2') ? 'value2' : 'value3';
        
        if (selectedBlob === valueKey) {
            cell.classList.add('selected-group');
        } else {
            cell.classList.remove('selected-group');
        }
    });
    
}

// 헤더 선택 상태 UI 업데이트
function updateHeaderSelectionState() {
    
    const table = document.getElementById('commonValuesTable');
    if (!table) return;
    
    const allHeaders = table.querySelectorAll('thead th[data-value-key]');
    allHeaders.forEach(header => {
        const valueKey = header.getAttribute('data-value-key');
        
        if (selectedValueGroup === valueKey) {
            // 선택된 헤더 - CSS 클래스 사용
            header.classList.add('selected');
        } else {
            // 선택되지 않은 헤더 - CSS 클래스 제거
            header.classList.remove('selected');
        }
    });
    
    // 셀들도 업데이트
    const valueCells = table.querySelectorAll('.col-value1, .col-value2, .col-value3');
    valueCells.forEach(cell => {
        const valueKey = cell.classList.contains('col-value1') ? 'value1' : 
                        cell.classList.contains('col-value2') ? 'value2' : 'value3';
        
        if (selectedValueGroup === valueKey) {
            cell.classList.add('selected-group');
        } else {
            cell.classList.remove('selected-group');
        }
    });
}

// 공통가치대응 탭 활성화 시 이벤트 설정
function initializeValueColumnEvents() {
    // 공통가치대응 탭 감시 (네트워크 그래프가 생성된 후에만 이벤트 설정)
    const commonValuesTab = document.querySelector('a[href="#commonValues"]');
    if (commonValuesTab) {
        commonValuesTab.addEventListener('click', function() {
            // 네트워크 그래프가 생성된 후에 이벤트가 설정되므로 여기서는 추가 설정 불필요
        });
    }
    
    // 페이지 로드 시 공통가치대응 탭이 이미 활성화된 경우
    const commonValuesContent = document.getElementById('commonValues');
    if (commonValuesContent && commonValuesContent.classList.contains('active')) {
        // 네트워크 그래프가 생성된 후에 이벤트가 설정되므로 여기서는 추가 설정 불필요
    }
}


// 물리 효과 시스템 제거됨
/*
class PhysicsEffectsSystem {
    constructor(network, nodes, valueCourseIds) {
        this.network = network;
        this.nodes = nodes;
        this.valueCourseIds = valueCourseIds;
        this.isActive = true;
        
        // 효과별 상태
        this.vibrationActive = false;
        this.magneticFieldActive = false;
        this.explosionInProgress = false;
        this.pulseActive = false;
        this.attractionActive = false;
        
        // 효과 매개변수
        this.vibrationIntensity = 2.0;
        this.magneticFieldStrength = 5.0;
        this.explosionForce = 20.0;
        
        // 애니메이션 루프 관리
        this.animationId = null;
        this.lastTime = 0;
        this.loopStarted = false;
        
        // 이벤트 핸들러 참조
        this.visibilityHandler = null;
        this.focusHandler = null;
        this.blurHandler = null;
        
        // 성능 관리 시스템
        this.frameCount = 0;
        this.performanceMode = 'adaptive'; // high, medium, low, adaptive
        this.targetFPS = 60;
        this.frameInterval = 1000 / this.targetFPS;
        this.lastFrameTime = 0;
        this.performanceStats = {
            averageFrameTime: 16.67,
            frameTimeHistory: [],
            memoryUsage: 0,
            lastOptimizationTime: Date.now()
        };
        
        // 장기 실행 관리
        this.startTime = Date.now();
        this.runTime = 0;
        this.lastCleanupTime = Date.now();
        this.cleanupInterval = 5 * 60 * 1000; // 5분마다 정리
        this.maxRunTime = 24 * 60 * 60 * 1000; // 24시간 최대 실행
        this.userInactiveTime = 0;
        this.lastUserActivity = Date.now();
        this.lastPhysicsUpdateTime = Date.now();
        
        // 배터리 최적화
        this.powerSaveMode = false;
        this.backgroundMode = false;
        
        // 노드별 물리 상태
        this.nodeStates = new Map();
        this.initializeNodeStates();
        
        // 지속적 물리 시뮬레이션 시작
        this.startAnimationLoop();
        
        // 자동 복구 시스템 설정
        this.setupAutoRecovery();
    }
    
    initializeNodeStates() {
        this.nodes.forEach(node => {
            this.nodeStates.set(node.id, {
                basePosition: null,
                velocity: { x: 0, y: 0 },
                force: { x: 0, y: 0 },
                vibrationPhase: Math.random() * Math.PI * 2,
                magneticCharge: Math.random() > 0.5 ? 1 : -1
            });
        });
    }
    
    startAnimationLoop() {
        // 기존 애니메이션 루프가 있다면 중단
        this.stopAnimationLoop();
        
        // 애니메이션 루프 시작 시간 초기화
        this.lastTime = performance.now();
        this.lastFrameTime = this.lastTime;
        this.loopStarted = true;
        this.frameCount = 0;
        
        const animate = (currentTime) => {
            try {
                // 루프가 중단되었다면 재시작하지 않음
                if (!this.loopStarted) return;
                
                const deltaTime = currentTime - this.lastTime;
                const frameElapsed = currentTime - this.lastFrameTime;
                
                // FPS 제한 및 적응형 성능 관리
                const shouldSkipFrame = this.shouldSkipFrame(frameElapsed, deltaTime);
                
                if (!shouldSkipFrame && this.isActive && deltaTime > 0 && deltaTime < 1000) {
                    this.lastFrameTime = currentTime;
                    this.frameCount++;
                    
                    // 성능 통계 업데이트
                    this.updatePerformanceStats(deltaTime);
                    
                    // 물리 업데이트 실행
                    this.updatePhysics(deltaTime);
                    
                    // 장기 실행 관리
                    this.manageLongTermExecution();
                }
                
                this.lastTime = currentTime;
                
                // 다음 프레임 예약
                this.animationId = requestAnimationFrame(animate);
                
            } catch (error) {
                console.warn('Physics animation loop error:', error);
                // 에러 발생 시 루프 재시작 시도
                this.restartAnimationLoop();
            }
        };
        
        this.animationId = requestAnimationFrame(animate);
        
        // 브라우저 탭 가시성 변경 시 처리
        this.setupVisibilityHandling();
        
        // 사용자 활동 추적 시작
        this.setupUserActivityTracking();
    }
    
    stopAnimationLoop() {
        this.loopStarted = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }
    
    restartAnimationLoop() {
        
        // 🔧 더 긴 대기 시간으로 안정성 확보
        setTimeout(() => {
            if (this.isActive) {
                this.startAnimationLoop();
            }
        }, 200);
    }
    
    setupVisibilityHandling() {
        // 페이지 가시성 변경 이벤트 처리
        if (typeof document !== 'undefined') {
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    // 탭이 숨겨졌을 때 - 물리 효과 일시정지
                    this.pauseEffects();
                } else {
                    // 탭이 다시 보일 때 - 물리 효과 재개
                    this.resumeEffects();
                }
            };
            
            // 기존 이벤트 리스너 제거 후 새로 추가
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = handleVisibilityChange;
            document.addEventListener('visibilitychange', this.visibilityHandler);
        }
        
        // 윈도우 포커스/블러 이벤트 처리
        if (typeof window !== 'undefined') {
            const handleFocus = () => this.resumeEffects();
            const handleBlur = () => this.pauseEffects();
            
            window.removeEventListener('focus', this.focusHandler);
            window.removeEventListener('blur', this.blurHandler);
            
            this.focusHandler = handleFocus;
            this.blurHandler = handleBlur;
            
            window.addEventListener('focus', this.focusHandler);
            window.addEventListener('blur', this.blurHandler);
        }
    }
    
    // 🔧 누락된 메소드: 사용자 활동 추적 설정
    setupUserActivityTracking() {
        const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        
        const updateActivity = () => {
            this.lastUserActivity = Date.now();
            this.userInactiveTime = 0;
        };
        
        // 이벤트 리스너 등록
        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
    }
    
    // 🔧 누락된 메소드: 프레임 스킵 판단 로직 (개선됨)
    shouldSkipFrame(frameElapsed, deltaTime) {
        // 성능 기반 프레임 스킵 결정
        const targetFrameTime = this.frameInterval;
        
        // 🔧 더 관대한 프레임 스킵 조건 (0.8 → 0.5)
        if (frameElapsed < targetFrameTime * 0.5) {
            return true;
        }
        
        // 파워 세이브 모드에서 프레임 스킵 (더 관대하게)
        if (this.powerSaveMode && frameElapsed < targetFrameTime * 1.2) {
            return true;
        }
        
        // 백그라운드 모드에서 더 많은 프레임 스킵
        if (this.backgroundMode && frameElapsed < targetFrameTime * 1.5) {
            return true;
        }
        
        // 🔧 사용자 비활성 상태 조건 완화 (30초 → 2분)
        const inactiveTime = Date.now() - this.lastUserActivity;
        if (inactiveTime > 120000 && frameElapsed < targetFrameTime * 2) { // 2분 비활성
            return true;
        }
        
        // 🔧 극단적인 델타타임 방지
        if (deltaTime > 100 || deltaTime < 0) {
            return true;
        }
        
        return false;
    }
    
    // 🔧 누락된 메소드: 성능 통계 업데이트
    updatePerformanceStats(deltaTime) {
        // 프레임 시간 기록
        this.performanceStats.frameTimeHistory.push(deltaTime);
        
        // 최대 100개 기록 유지
        if (this.performanceStats.frameTimeHistory.length > 100) {
            this.performanceStats.frameTimeHistory.shift();
        }
        
        // 평균 프레임 시간 계산
        const total = this.performanceStats.frameTimeHistory.reduce((a, b) => a + b, 0);
        this.performanceStats.averageFrameTime = total / this.performanceStats.frameTimeHistory.length;
        
        // 메모리 사용량 추정 (간략한 계산)
        this.performanceStats.memoryUsage = this.nodeStates.size * 64 + this.performanceStats.frameTimeHistory.length * 8;
        
        // 성능 모드 자동 조정
        if (this.performanceStats.averageFrameTime > 33.33) { // 30fps 미만
            this.performanceMode = 'low';
        } else if (this.performanceStats.averageFrameTime > 20) { // 50fps 미만
            this.performanceMode = 'medium';
        } else {
            this.performanceMode = 'high';
        }
    }
    
    // 🔧 누락된 메소드: 장기 실행 관리
    manageLongTermExecution() {
        const currentTime = Date.now();
        this.runTime = currentTime - this.startTime;
        
        // 주기적 정리 (5분마다)
        if (currentTime - this.lastCleanupTime > this.cleanupInterval) {
            this.performCleanup();
            this.lastCleanupTime = currentTime;
        }
        
        // 최대 실행 시간 체크 (24시간)
        if (this.runTime > this.maxRunTime) {
            this.restartSystem();
        }
        
        // 사용자 비활성 상태 추적
        this.userInactiveTime = currentTime - this.lastUserActivity;
        
        // 1시간 이상 비활성 상태에서는 파워 세이브 모드 활성화
        if (this.userInactiveTime > 3600000) {
            this.powerSaveMode = true;
        } else {
            this.powerSaveMode = false;
        }
    }
    
    // 🔧 누락된 메소드: 안전한 효과 적용
    safeApplyEffect(effectFunction, effectName) {
        try {
            effectFunction();
        } catch (error) {
            console.warn(`Error applying ${effectName} effect:`, error);
            // 효과 실패 시 해당 효과만 비활성화
            this.disableEffect(effectName);
        }
    }
    
    // 🔧 헬퍼 메소드들
    performCleanup() {
        // 메모리 정리
        this.performanceStats.frameTimeHistory = this.performanceStats.frameTimeHistory.slice(-50);
        
        // 노드 상태 검증 및 정리
        const validNodeIds = new Set(this.nodes.map(n => n.id));
        for (const nodeId of this.nodeStates.keys()) {
            if (!validNodeIds.has(nodeId)) {
                this.nodeStates.delete(nodeId);
            }
        }
    }
    
    restartSystem() {
        this.startTime = Date.now();
        this.runTime = 0;
        this.frameCount = 0;
        this.performanceStats.frameTimeHistory = [];
    }
    
    disableEffect(effectName) {
        switch (effectName) {
            case 'vibration':
                this.vibrationActive = false;
                break;
            case 'magnetic field':
                this.magneticFieldActive = false;
                break;
            case 'pulse':
                this.pulseActive = false;
                break;
            case 'attraction':
                this.attractionActive = false;
                break;
            case 'forces':
                // 힘 적용은 비활성화하지 않음
                break;
        }
    }
    
    updatePhysics(deltaTime) {
        try {
            const dt = Math.min(deltaTime / 16.67, 2); // 60fps 기준 정규화
            
            // 🔧 더 엄격한 조건 확인
            if (dt < 0.1 || dt > 10 || !this.isActive) {
                return;
            }
            
            // 네트워크가 유효한지 확인
            if (!this.network || !this.network.body || !this.network.body.nodeIndices) {
                return;
            }
            
            // 🔧 노드 상태 확인
            if (!this.nodes || this.nodes.length === 0) {
                return;
            }
            
            // 물리 효과 적용
            if (this.vibrationActive) {
                this.safeApplyEffect(() => this.applyVibrationEffect(dt), 'vibration');
            }
            
            if (this.magneticFieldActive) {
                this.safeApplyEffect(() => this.applyMagneticField(dt), 'magnetic field');
            }
            
            if (this.pulseActive) {
                this.safeApplyEffect(() => this.applyPulseEffect(dt), 'pulse');
            }
            
            if (this.attractionActive) {
                this.safeApplyEffect(() => this.applyAttractionEffect(dt), 'attraction');
            }
            
            this.safeApplyEffect(() => this.applyForces(dt), 'forces');
            
            // 자동 복구 시스템을 위한 프레임 타임 업데이트
            this.lastPhysicsUpdateTime = Date.now();
            
            
        } catch (error) {
            console.warn('Physics update error:', error);
            // 에러가 발생해도 시뮬레이션을 완전히 중단하지 않음
        }
    }
    
    safeApplyEffect(effectFunction, effectName) {
        try {
            effectFunction();
        } catch (error) {
            console.warn(`Physics ${effectName} effect error:`, error);
            // 개별 효과 에러는 다른 효과들의 동작을 방해하지 않음
        }
    }
    
    // 🌪️ 진동 효과
    startContinuousVibration() {
        this.vibrationActive = true;
    }
    
    stopVibration() {
        this.vibrationActive = false;
    }
    
    applyVibrationEffect(deltaTime) {
        const time = Date.now() * 0.001; // 초 단위
        const globalTime = time * 0.5; // 전체적인 진동 리듬
        
        this.nodes.forEach(node => {
            const state = this.nodeStates.get(node.id);
            if (!state) return;
            
            // 🌟 그룹별 고유 진동 패턴과 강화된 설정
            let frequency = 0.5;
            let amplitude = this.vibrationIntensity;
            let vibrationPattern = 'sine'; // 기본 패턴
            
            switch(node.group) {
                case 'value1':
                    frequency = 0.9;
                    amplitude *= 1.4; // 🌟 더 강한 진동
                    vibrationPattern = 'pulse'; // 🌟 펄스 타입 진동
                    break;
                case 'value2':
                    frequency = 0.7;
                    amplitude *= 1.0;
                    vibrationPattern = 'wave'; // 🌟 파동 타입 진동
                    break;
                case 'value3':
                    frequency = 1.1;
                    amplitude *= 1.6; // 🌟 가장 강한 진동
                    vibrationPattern = 'circular'; // 🌟 원형 진동
                    break;
            }
            
            let vibrationX = 0, vibrationY = 0;
            
            // 🌟 진동 패턴별 다양한 효과
            switch(vibrationPattern) {
                case 'pulse': // 💓 펄스 진동 - 간헐적이고 강한 진동
                    const pulseIntensity = Math.max(0, Math.sin(time * frequency * 0.5)) * 2;
                    const pulseBase = Math.sin(time * frequency * 4 + state.vibrationPhase);
                    vibrationX = pulseBase * amplitude * pulseIntensity;
                    vibrationY = Math.cos(time * frequency * 3 + state.vibrationPhase) * amplitude * pulseIntensity * 0.7;
                    break;
                    
                case 'wave': // 🌊 파동 진동 - 부드럽고 연속적인 진동
                    const waveModulation = 1 + 0.5 * Math.sin(globalTime + state.vibrationPhase * 0.1);
                    vibrationX = Math.sin(time * frequency + state.vibrationPhase) * amplitude * waveModulation;
                    vibrationY = Math.sin(time * frequency * 1.3 + state.vibrationPhase + Math.PI/3) * amplitude * waveModulation * 0.8;
                    break;
                    
                case 'circular': // 🌀 원형 진동 - 회전하는 진동
                    const radius = amplitude * (1 + 0.3 * Math.sin(globalTime));
                    const angle = time * frequency * 2 + state.vibrationPhase;
                    vibrationX = Math.cos(angle) * radius;
                    vibrationY = Math.sin(angle) * radius;
                    break;
                    
                default: // 🎵 기본 사인파 진동 - 향상된 버전
                    const intensityModulation = 1 + 0.4 * Math.sin(globalTime * 0.3);
                    vibrationX = Math.sin(time * frequency + state.vibrationPhase) * amplitude * intensityModulation;
                    vibrationY = Math.cos(time * frequency * 0.7 + state.vibrationPhase) * amplitude * intensityModulation * 0.6;
                    break;
            }
            
            // 🌟 동적 강도 조절 - 시간에 따른 강도 변화
            const dynamicIntensity = 0.7 + 0.3 * Math.sin(globalTime * 0.2 + node.id * 0.1);
            
            // 🌟 최종 진동 힘 적용
            state.force.x += vibrationX * dynamicIntensity;
            state.force.y += vibrationY * dynamicIntensity;
            
            // 🌟 진동 잔향 효과 - 이전 진동이 점차 감쇠
            if (!state.vibrationDecay) state.vibrationDecay = {x: 0, y: 0};
            state.vibrationDecay.x = state.vibrationDecay.x * 0.95 + vibrationX * 0.05;
            state.vibrationDecay.y = state.vibrationDecay.y * 0.95 + vibrationY * 0.05;
            state.force.x += state.vibrationDecay.x * 0.2;
            state.force.y += state.vibrationDecay.y * 0.2;
        });
    }
    
    // 🧲 자기장 효과
    toggleMagneticField() {
        this.magneticFieldActive = !this.magneticFieldActive;
        return this.magneticFieldActive;
    }
    
    applyMagneticField(deltaTime) {
        const positions = this.network.getPositions();
        
        this.nodes.forEach(nodeA => {
            const stateA = this.nodeStates.get(nodeA.id);
            if (!stateA || !positions[nodeA.id]) return;
            
            this.nodes.forEach(nodeB => {
                if (nodeA.id === nodeB.id) return;
                
                const stateB = this.nodeStates.get(nodeB.id);
                if (!stateB || !positions[nodeB.id]) return;
                
                const dx = positions[nodeB.id].x - positions[nodeA.id].x;
                const dy = positions[nodeB.id].y - positions[nodeA.id].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 200 && distance > 10) {
                    const magneticForce = this.magneticFieldStrength * 
                        stateA.magneticCharge * stateB.magneticCharge / (distance * distance);
                    
                    const forceX = (dx / distance) * magneticForce;
                    const forceY = (dy / distance) * magneticForce;
                    
                    stateA.force.x += forceX;
                    stateA.force.y += forceY;
                }
            });
        });
    }
    
    // 🌊 파동 효과
    togglePulseEffect() {
        this.pulseActive = !this.pulseActive;
        return this.pulseActive;
    }
    
    applyPulseEffect(deltaTime) {
        const time = Date.now() * 0.002;
        const waveSpeed = 3.0;
        const waveAmplitude = 8.0;
        
        const positions = this.network.getPositions();
        
        this.nodes.forEach(node => {
            const state = this.nodeStates.get(node.id);
            if (!state || !positions[node.id]) return;
            
            // 중심점에서의 거리 계산
            const centerX = 0, centerY = 0;
            const dx = positions[node.id].x - centerX;
            const dy = positions[node.id].y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 파동 효과 계산
            const wave = Math.sin(time * waveSpeed - distance * 0.01) * waveAmplitude;
            const angle = Math.atan2(dy, dx);
            
            state.force.x += Math.cos(angle) * wave;
            state.force.y += Math.sin(angle) * wave;
        });
    }
    
    // ⚡ 인력 효과
    toggleAttractionEffect() {
        this.attractionActive = !this.attractionActive;
        return this.attractionActive;
    }
    
    applyAttractionEffect(deltaTime) {
        const positions = this.network.getPositions();
        
        // 그룹별 중심점 계산
        const groupCenters = { value1: {x: 0, y: 0, count: 0}, value2: {x: 0, y: 0, count: 0}, value3: {x: 0, y: 0, count: 0} };
        
        this.nodes.forEach(node => {
            if (positions[node.id] && groupCenters[node.group]) {
                groupCenters[node.group].x += positions[node.id].x;
                groupCenters[node.group].y += positions[node.id].y;
                groupCenters[node.group].count++;
            }
        });
        
        // 중심점 평균 계산
        Object.keys(groupCenters).forEach(key => {
            if (groupCenters[key].count > 0) {
                groupCenters[key].x /= groupCenters[key].count;
                groupCenters[key].y /= groupCenters[key].count;
            }
        });
        
        // 각 노드를 그룹 중심으로 끌어당김
        this.nodes.forEach(node => {
            const state = this.nodeStates.get(node.id);
            if (!state || !positions[node.id] || !groupCenters[node.group]) return;
            
            const center = groupCenters[node.group];
            if (center.count === 0) return;
            
            const dx = center.x - positions[node.id].x;
            const dy = center.y - positions[node.id].y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (distance > 20) { // 너무 가까우면 인력 중지
                const attractionForce = 3.0;
                state.force.x += (dx / distance) * attractionForce;
                state.force.y += (dy / distance) * attractionForce;
            }
        });
    }
    
    // 💥 폭발 효과
    triggerExplosion(groupKey, clickPosition) {
        if (this.explosionInProgress) return;
        
        const groupNodeIds = this.valueCourseIds[groupKey];
        if (!groupNodeIds || groupNodeIds.length === 0) return;
        
        this.explosionInProgress = true;
        
        // 폭발 중심점 계산
        let centerX = 0, centerY = 0;
        const positions = this.network.getPositions();
        
        groupNodeIds.forEach(nodeId => {
            if (positions[nodeId]) {
                centerX += positions[nodeId].x;
                centerY += positions[nodeId].y;
            }
        });
        
        centerX /= groupNodeIds.length;
        centerY /= groupNodeIds.length;
        
        // 폭발 애니메이션
        this.createExplosionWave(centerX, centerY);
        
        // 노드들에 폭발력 적용
        groupNodeIds.forEach(nodeId => {
            const state = this.nodeStates.get(nodeId);
            if (!state || !positions[nodeId]) return;
            
            const dx = positions[nodeId].x - centerX;
            const dy = positions[nodeId].y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            const explosionMagnitude = this.explosionForce / distance;
            state.force.x += (dx / distance) * explosionMagnitude * 100;
            state.force.y += (dy / distance) * explosionMagnitude * 100;
        });
        
        // 2초 후 폭발 상태 리셋
        setTimeout(() => {
            this.explosionInProgress = false;
        }, 2000);
    }
    
    triggerExplosionAtPosition(canvasPos) {
        // 캔버스 좌표를 네트워크 좌표로 변환
        let networkPos;
        try {
            networkPos = this.network.canvasToDOM ? 
                this.network.canvasToDOM(canvasPos) : 
                canvasPos; // 변환 함수가 없으면 원본 좌표 사용
        } catch (e) {
            networkPos = canvasPos; // 오류 발생 시 원본 좌표 사용
        }
        
        this.explosionInProgress = true;
        
        // 폭발 애니메이션
        this.createExplosionWave(networkPos.x, networkPos.y);
        
        // 모든 노드에 폭발력 적용
        const positions = this.network.getPositions();
        
        this.nodes.forEach(node => {
            const state = this.nodeStates.get(node.id);
            if (!state || !positions[node.id]) return;
            
            const dx = positions[node.id].x - networkPos.x;
            const dy = positions[node.id].y - networkPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            
            if (distance < 300) {
                const explosionMagnitude = this.explosionForce * (300 - distance) / 300;
                state.force.x += (dx / distance) * explosionMagnitude * 50;
                state.force.y += (dy / distance) * explosionMagnitude * 50;
            }
        });
        
        setTimeout(() => {
            this.explosionInProgress = false;
        }, 2000);
    }
    
    createExplosionWave(centerX, centerY) {
        // 시각적 폭발 효과 생성
        const container = this.network.body.container;
        const rect = container.getBoundingClientRect();
        
        const wave = document.createElement('div');
        wave.style.position = 'absolute';
        wave.style.left = centerX + 'px';
        wave.style.top = centerY + 'px';
        wave.style.width = '10px';
        wave.style.height = '10px';
        wave.style.borderRadius = '50%';
        wave.style.border = '3px solid #ff6b35';
        wave.style.background = 'radial-gradient(circle, rgba(255,107,53,0.3) 0%, transparent 70%)';
        wave.style.pointerEvents = 'none';
        wave.style.zIndex = '1000';
        wave.style.transform = 'translate(-50%, -50%)';
        wave.style.animation = 'explosionWave 1s ease-out forwards';
        
        container.appendChild(wave);
        
        // 1초 후 제거
        setTimeout(() => {
            if (wave.parentNode) {
                wave.parentNode.removeChild(wave);
            }
        }, 1000);
    }
    
    // 힘 적용 - vis-network 호환 버전
    applyForces(deltaTime) {
        let needsSimulation = false;
        
        this.nodeStates.forEach((state, nodeId) => {
            const body = this.network.body.nodes[nodeId];
            if (!body || !body.options || !body.options.physics) return;
            
            // 속도 업데이트 (가속도 = 힘 / 질량)
            const mass = 1.0;
            const velocityDeltaX = (state.force.x / mass) * deltaTime * 0.01;
            const velocityDeltaY = (state.force.y / mass) * deltaTime * 0.01;
            
            // 감쇠 적용
            const damping = 0.98;
            state.velocity.x = (state.velocity.x + velocityDeltaX) * damping;
            state.velocity.y = (state.velocity.y + velocityDeltaY) * damping;
            
            // vis-network 물리 body에 직접 속도 적용 (작은 값으로)
            if (Math.abs(state.velocity.x) > 0.01 || Math.abs(state.velocity.y) > 0.01) {
                body.vx = (body.vx || 0) + state.velocity.x * 0.1;
                body.vy = (body.vy || 0) + state.velocity.y * 0.1;
                needsSimulation = true;
            }
            
            // 힘 리셋
            state.force.x = 0;
            state.force.y = 0;
        });
        
        // 물리 시뮬레이션 재시작 (필요한 경우에만)
        if (needsSimulation) {
            try {
                if (this.network.physics && this.network.physics.physicsEnabled) {
                    this.network.physics.startSimulation();
                } else if (this.network.startSimulation) {
                    this.network.startSimulation();
                }
            } catch (e) {
                console.warn('Physics simulation restart failed:', e);
            }
        }
    }
    
    // 효과 제어 메서드
    setVibrationIntensity(intensity) {
        this.vibrationIntensity = Math.max(0, Math.min(10, intensity));
    }
    
    setMagneticFieldStrength(strength) {
        this.magneticFieldStrength = Math.max(0, Math.min(20, strength));
    }
    
    setExplosionForce(force) {
        this.explosionForce = Math.max(5, Math.min(50, force));
    }
    
    // 시스템 제어
    toggleSystem() {
        this.isActive = !this.isActive;
        return this.isActive;
    }
    
    pauseEffects() {
        this.isActive = false;
        
        // 애니메이션 루프도 일시정지 (성능 최적화)
        this.stopAnimationLoop();
    }
    
    resumeEffects() {
        this.isActive = true;
        
        // 애니메이션 루프 재시작
        if (!this.loopStarted) {
            this.startAnimationLoop();
        }
        
        // 진동 효과가 활성화되어 있었다면 재시작
        if (this.vibrationActive) {
            this.startContinuousVibration();
        }
    }
    
    resetEffects() {
        this.vibrationActive = false;
        this.magneticFieldActive = false;
        this.explosionInProgress = false;
        this.pulseActive = false;
        this.attractionActive = false;
        
        // 모든 노드 상태 리셋
        this.nodeStates.forEach(state => {
            state.velocity = { x: 0, y: 0 };
            state.force = { x: 0, y: 0 };
        });
    }
    
    destroy() {
        
        // 애니메이션 루프 중단
        this.stopAnimationLoop();
        
        // 모든 효과 리셋
        this.resetEffects();
        
        // 이벤트 리스너 정리
        this.cleanupEventListeners();
        
        // 상태 정리
        this.isActive = false;
        this.nodeStates.clear();
    }
    
    cleanupEventListeners() {
        // 페이지 가시성 이벤트 리스너 제거
        if (this.visibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }
        
        // 윈도우 포커스/블러 이벤트 리스너 제거
        if (this.focusHandler && typeof window !== 'undefined') {
            window.removeEventListener('focus', this.focusHandler);
            this.focusHandler = null;
        }
        
        if (this.blurHandler && typeof window !== 'undefined') {
            window.removeEventListener('blur', this.blurHandler);
            this.blurHandler = null;
        }
        
        // 자동 복구 타이머 정리
        if (this.recoveryInterval) {
            clearInterval(this.recoveryInterval);
            this.recoveryInterval = null;
        }
    }
    
    setupAutoRecovery() {
        // 주기적으로 물리 시뮬레이션 상태 확인 및 복구
        this.lastPhysicsUpdateTime = Date.now();
        this.stuckCounter = 0;
        
        this.recoveryInterval = setInterval(() => {
            const now = Date.now();
            const timeSinceLastUpdate = now - this.lastPhysicsUpdateTime;
            
            // 🔧 더 관대한 시간 임계값으로 조정 (10초 → 15초)
            if (this.isActive && timeSinceLastUpdate > 15000) {
                this.stuckCounter++;
                console.warn(`Physics simulation appears stuck (${this.stuckCounter}). Last update: ${timeSinceLastUpdate}ms ago`);
                
                // 🔧 복구 시도 횟수 증가 (3 → 5)
                if (this.stuckCounter >= 5) {
                    this.fullRestart();
                    this.stuckCounter = 0;
                } else {
                    this.restartAnimationLoop();
                }
                
                this.lastPhysicsUpdateTime = now;
            } else if (timeSinceLastUpdate < 5000) {
                // 🔧 정상 작동 시 카운터 리셋 (더 관대한 임계값)
                this.stuckCounter = 0;
            }
        }, 15000); // 🔧 체크 간격 증가 (10초 → 15초)
    }
    
    fullRestart() {
        
        // 기존 시스템 정리
        this.stopAnimationLoop();
        
        // 상태 초기화
        this.initializeNodeStates();
        
        // 시스템 재시작
        this.isActive = true;
        this.startAnimationLoop();
        
        // 활성화된 효과들 복원
        if (this.vibrationActive) {
            this.startContinuousVibration();
        }
    }
}
*/

// 물리 효과 제어 패널 제거됨
/*
function createPhysicsControlPanel() {
    // 기존 패널이 있으면 제거
    const existingPanel = document.getElementById('physicsControlPanel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'physicsControlPanel';
    panel.style.display = 'none'; // 처음에는 숨김
    panel.innerHTML = `
        <div style="
            position: fixed;
            top: 80px;
            right: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 15px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10001;
            color: white;
            font-family: 'Segoe UI', sans-serif;
            min-width: 250px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        ">
            <h4 style="margin: 0 0 12px 0; font-size: 16px; text-align: center;">🌟 물리 효과 제어</h4>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; margin-bottom: 5px;">진동 강도: <span id="vibrationValue">2.0</span></label>
                <input type="range" id="vibrationSlider" min="0" max="10" step="0.5" value="2.0" 
                       style="width: 100%; accent-color: #ff6b35;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; margin-bottom: 5px;">자기장 강도: <span id="magneticValue">5.0</span></label>
                <input type="range" id="magneticSlider" min="0" max="20" step="1" value="5.0" 
                       style="width: 100%; accent-color: #4ecdc4;">
            </div>
            
            <div style="margin-bottom: 10px;">
                <label style="display: block; font-size: 12px; margin-bottom: 5px;">폭발 강도: <span id="explosionValue">20.0</span></label>
                <input type="range" id="explosionSlider" min="5" max="50" step="2.5" value="20.0" 
                       style="width: 100%; accent-color: #ff6b35;">
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <button id="toggleVibration" style="
                    flex: 1; 
                    padding: 8px; 
                    border: none; 
                    border-radius: 6px; 
                    background: #4ecdc4; 
                    color: white; 
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">🌪️ 진동 ON</button>
                <button id="toggleMagnetic" style="
                    flex: 1; 
                    padding: 8px; 
                    border: none; 
                    border-radius: 6px; 
                    background: #95a5a6; 
                    color: white; 
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">🧲 자기장 OFF</button>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <button id="randomExplosion" style="
                    flex: 1; 
                    padding: 8px; 
                    border: none; 
                    border-radius: 6px; 
                    background: #e74c3c; 
                    color: white; 
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">💥 랜덤 폭발</button>
                <button id="resetEffects" style="
                    flex: 1; 
                    padding: 8px; 
                    border: none; 
                    border-radius: 6px; 
                    background: #34495e; 
                    color: white; 
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">🔄 리셋</button>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <button id="pulseEffect" style="
                    flex: 1; 
                    padding: 8px; 
                    border: none; 
                    border-radius: 6px; 
                    background: #9b59b6; 
                    color: white; 
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">🌊 파동</button>
                <button id="attractionMode" style="
                    flex: 1; 
                    padding: 8px; 
                    border: none; 
                    border-radius: 6px; 
                    background: #f39c12; 
                    color: white; 
                    cursor: pointer;
                    font-size: 11px;
                    transition: all 0.2s;
                ">⚡ 인력</button>
            </div>
            
            <div style="margin-top: 12px; font-size: 10px; opacity: 0.8; text-align: center;">
                💡 더블클릭으로 폭발 효과!
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // 이벤트 리스너 설정
    setupPhysicsControlEvents();
}

function setupPhysicsControlEvents() {
    // 슬라이더 이벤트
    document.getElementById('vibrationSlider').addEventListener('input', function(e) {
        const value = parseFloat(e.target.value);
        document.getElementById('vibrationValue').textContent = value.toFixed(1);
        if (window.physicsEffects) {
            window.physicsEffects.setVibrationIntensity(value);
        }
    });
    
    document.getElementById('magneticSlider').addEventListener('input', function(e) {
        const value = parseFloat(e.target.value);
        document.getElementById('magneticValue').textContent = value.toFixed(1);
        if (window.physicsEffects) {
            window.physicsEffects.setMagneticFieldStrength(value);
        }
    });
    
    document.getElementById('explosionSlider').addEventListener('input', function(e) {
        const value = parseFloat(e.target.value);
        document.getElementById('explosionValue').textContent = value.toFixed(1);
        if (window.physicsEffects) {
            window.physicsEffects.setExplosionForce(value);
        }
    });
    
    // 버튼 이벤트
    document.getElementById('toggleVibration').addEventListener('click', function() {
        if (window.physicsEffects) {
            if (window.physicsEffects.vibrationActive) {
                window.physicsEffects.stopVibration();
                this.innerHTML = '🌪️ 진동 OFF';
                this.style.background = '#95a5a6';
            } else {
                window.physicsEffects.startContinuousVibration();
                this.innerHTML = '🌪️ 진동 ON';
                this.style.background = '#4ecdc4';
            }
        }
    });
    
    document.getElementById('toggleMagnetic').addEventListener('click', function() {
        if (window.physicsEffects) {
            const isActive = window.physicsEffects.toggleMagneticField();
            this.innerHTML = isActive ? '🧲 자기장 ON' : '🧲 자기장 OFF';
            this.style.background = isActive ? '#3498db' : '#95a5a6';
        }
    });
    
    document.getElementById('randomExplosion').addEventListener('click', function() {
        if (window.physicsEffects) {
            const container = window.physicsEffects.network.body.container;
            const rect = container.getBoundingClientRect();
            const randomPos = {
                x: Math.random() * rect.width,
                y: Math.random() * rect.height
            };
            window.physicsEffects.triggerExplosionAtPosition(randomPos);
        }
    });
    
    document.getElementById('resetEffects').addEventListener('click', function() {
        if (window.physicsEffects) {
            window.physicsEffects.resetEffects();
            
            // 진동 버튼 상태 리셋
            const vibBtn = document.getElementById('toggleVibration');
            vibBtn.innerHTML = '🌪️ 진동 OFF';
            vibBtn.style.background = '#95a5a6';
            
            // 자기장 버튼 상태 리셋  
            const magBtn = document.getElementById('toggleMagnetic');
            magBtn.innerHTML = '🧲 자기장 OFF';
            magBtn.style.background = '#95a5a6';
            
            // 파동 버튼 상태 리셋
            const pulseBtn = document.getElementById('pulseEffect');
            pulseBtn.innerHTML = '🌊 파동 OFF';
            pulseBtn.style.background = '#95a5a6';
            
            // 인력 버튼 상태 리셋
            const attractBtn = document.getElementById('attractionMode');
            attractBtn.innerHTML = '⚡ 인력 OFF';
            attractBtn.style.background = '#95a5a6';
        }
    });
    
    // 파동 효과 버튼
    document.getElementById('pulseEffect').addEventListener('click', function() {
        if (window.physicsEffects) {
            const isActive = window.physicsEffects.togglePulseEffect();
            this.innerHTML = isActive ? '🌊 파동 ON' : '🌊 파동 OFF';
            this.style.background = isActive ? '#8e44ad' : '#95a5a6';
        }
    });
    
    // 인력 효과 버튼
    document.getElementById('attractionMode').addEventListener('click', function() {
        if (window.physicsEffects) {
            const isActive = window.physicsEffects.toggleAttractionEffect();
            this.innerHTML = isActive ? '⚡ 인력 ON' : '⚡ 인력 OFF';
            this.style.background = isActive ? '#e67e22' : '#95a5a6';
        }
    });
}
*/

// CSS 애니메이션 제거됨
/*
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes explosionWave {
        0% {
            width: 10px;
            height: 10px;
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
        100% {
            width: 200px;
            height: 200px;
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.5);
        }
    }
    
    #physicsControlPanel button:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    #physicsControlPanel input[type="range"]::-webkit-slider-thumb {
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    
    #physicsControlPanel {
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    #physicsControlPanel button:active {
        transform: translateY(-1px) scale(0.98);
    }
    
    .physics-particle {
        position: absolute;
        width: 4px;
        height: 4px;
        background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        animation: particleFloat 2s ease-out forwards;
    }
    
    @keyframes particleFloat {
        0% {
            opacity: 1;
            transform: scale(1);
        }
        100% {
            opacity: 0;
            transform: scale(0.2) translateY(-50px);
        }
    }
`;
document.head.appendChild(styleSheet);
*/

// 🌟 인터랙티브 레전드 생성 함수
function createInteractiveLegend() {
    // 공통가치대응 탭이 활성화되어 있는지 확인
    const commonValuesTab = document.getElementById('commonValues');
    if (!commonValuesTab || !commonValuesTab.classList.contains('active')) {
        return; // 공통가치대응 탭이 활성화되지 않았으면 레전드 생성하지 않음
    }
    
    // 기존 레전드가 있으면 제거
    const existingLegend = document.getElementById('network-legend');
    if (existingLegend) {
        existingLegend.remove();
    }
    
    // 네트워크 그래프 컨테이너 찾기
    const networkContainer = document.getElementById('commonValuesNetworkGraph');
    if (!networkContainer) {
        return; // 네트워크 그래프가 없으면 레전드 생성하지 않음
    }
    
    // 네트워크 그래프 컨테이너의 위치를 relative로 설정 (absolute 포지셔닝을 위해)
    if (networkContainer.style.position !== 'relative') {
        networkContainer.style.position = 'relative';
    }
    
    // 레전드 컨테이너 생성
    const legend = document.createElement('div');
    legend.id = 'network-legend';
    legend.className = 'network-legend';
    legend.style.cssText = `
        position: absolute;
        bottom: 20px;
        right: 20px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        padding: 6px 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        display: flex;
        gap: 16px;
        align-items: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px;
        transition: all 0.3s ease;
        pointer-events: auto;
    `;
    
    // 레전드 제목
    const title = document.createElement('div');
    // title.style.cssText = `
    //     font-weight: 600;
    //     color: #333;
    //     margin-right: 16px;
    //     font-size: 15px;
    // `;
    // title.textContent = '연결';
    legend.appendChild(title);
    
    // 연결 유형별 레전드 아이템들
    const legendItems = [
        {
            type: 'year-semester',
            label: '학년-학기 연결',
            lineClass: 'legend-line-solid',
            description: '같은 학년-학기에 개설되는 교과목들'
        },
        {
            type: 'subject-type',
            label: '과목분류 연결',
            lineClass: 'legend-line-dashed',
            description: '같은 과목분류에 속하는 교과목들'
        }
    ];
    
    legendItems.forEach(item => {
        const itemContainer = document.createElement('div');
        itemContainer.className = 'legend-item';
        itemContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
        `;
        
        // 호버 효과
        itemContainer.addEventListener('mouseenter', function() {
            this.style.background = '#f0f8ff';
            this.style.transform = 'translateY(-2px)';
            highlightEdgeType(item.type);
        });
        
        itemContainer.addEventListener('mouseleave', function() {
            this.style.background = 'transparent';
            this.style.transform = 'translateY(0)';
            unhighlightEdgeType();
        });
        
        // 선 스타일 표시
        const line = document.createElement('div');
        line.className = item.lineClass;
        line.style.cssText = `
            width: 40px;
            height: 3px;
            border-radius: 2px;
            background: ${item.type === 'year-semester' ? '#4CAF50' : '#2196F3'};
            ${item.type === 'subject-type' ? 'background: repeating-linear-gradient(to right, #2196F3 0, #2196F3 4px, transparent 4px, transparent 8px);' : ''}
        `;
        
        // 라벨
        const label = document.createElement('span');
        label.textContent = item.label;
        label.style.cssText = `
            color: #555;
            font-weight: 500;
            white-space: nowrap;
        `;
        
        // 툴팁
        const tooltip = document.createElement('div');
        tooltip.className = 'legend-tooltip';
        tooltip.textContent = item.description;
        tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            z-index: 1001;
            margin-bottom: 8px;
        `;
        
        // 툴팁 화살표
        const arrow = document.createElement('div');
        arrow.style.cssText = `
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid #333;
        `;
        tooltip.appendChild(arrow);
        
        // 툴팁 표시/숨김
        itemContainer.addEventListener('mouseenter', function() {
            tooltip.style.opacity = '1';
        });
        
        itemContainer.addEventListener('mouseleave', function() {
            tooltip.style.opacity = '0';
        });
        
        itemContainer.appendChild(line);
        itemContainer.appendChild(label);
        itemContainer.appendChild(tooltip);
        legend.appendChild(itemContainer);
    });
    
    // 레전드를 네트워크 그래프 컨테이너에 추가
    networkContainer.appendChild(legend);
    
    // 레전드가 그래프 영역을 벗어나지 않도록 위치 조정
    setTimeout(() => {
        const legendRect = legend.getBoundingClientRect();
        const containerRect = networkContainer.getBoundingClientRect();
        
        // 레전드가 컨테이너를 벗어나는 경우 위치 조정
        if (legendRect.right > containerRect.right) {
            legend.style.right = '10px';
        }
        if (legendRect.bottom > containerRect.bottom) {
            legend.style.bottom = '10px';
        }
        if (legendRect.left < containerRect.left) {
            legend.style.left = '10px';
            legend.style.right = 'auto';
        }
        if (legendRect.top < containerRect.top) {
            legend.style.top = '10px';
            legend.style.bottom = 'auto';
        }
    }, 50);
    
    // 애니메이션 효과
    legend.style.opacity = '0';
    legend.style.transform = 'translateY(20px)';
    setTimeout(() => {
        legend.style.opacity = '1';
        legend.style.transform = 'translateY(0)';
    }, 100);
}

// 🌟 엣지 타입별 하이라이트 함수
function highlightEdgeType(edgeType) {
    if (!window.network) return;
    
    const edges = window.network.body.data.edges.get();
    const edgeUpdateArray = [];
    
    // 과목분류별 색상 정의
    const subjectTypeColors = {
        '설계': '#9e9e9e',
        '디지털': '#a1887f',
        '역사': '#d84315',
        '이론': '#00897b',
        '도시': '#c2185b',
        '사회': '#5e35b1',
        '기술': '#ef6c00',
        '실무': '#43a047',
        '비교과': '#757575'
    };
    
    edges.forEach(edge => {
        let shouldHighlight = false;
        
        if (edgeType === 'year-semester') {
            // 실선 엣지 (학년-학기 연결)
            shouldHighlight = !edge.dashes;
        } else if (edgeType === 'subject-type') {
            // 점선 엣지 (과목분류 연결)
            shouldHighlight = edge.dashes === true;
        }
        
        if (shouldHighlight) {
            let highlightColor = '#4CAF50'; // 기본 녹색 (학년-학기)
            
            if (edgeType === 'subject-type' && edge.title) {
                // 과목분류 연결인 경우 title에서 과목분류 추출
                let subjectType;
                const subjectTypeMatch = edge.title.match(/^([^\-]+)\s*-/);
                if (subjectTypeMatch) {
                    subjectType = subjectTypeMatch[1].trim();
                } else {
                    // 하이픈이 없으면 전체 title을 과목분류로 사용
                    subjectType = edge.title.trim();
                }
                
                // 해당 과목분류의 색상 사용
                if (subjectType && subjectTypeColors[subjectType]) {
                    highlightColor = subjectTypeColors[subjectType];
                }
            }
            
            // 🌟 원래 스타일 저장 (첫 번째 하이라이트 시에만) - 정확한 원본 그래프 스타일 보존
            if (!edge.originalColor && edge.originalWidth === undefined) {
                // 🎯 원본 그래프의 정확한 색상 정보 저장
                if (edge.color && typeof edge.color === 'object') {
                    // 현재 color 객체가 있으면 완전히 복사
                    edge.originalColor = {
                        color: edge.color.color,
                        opacity: edge.color.opacity !== undefined ? edge.color.opacity : 1
                    };
                } else if (edge.dashes) {
                    // 점선 엣지의 기본 원본 그래프 색상
                    edge.originalColor = {
                        color: '#9e9e9e',
                        opacity: 0.5
                    };
                } else {
                    // 실선 엣지의 기본 원본 그래프 색상 (#bdbdbd)
                    edge.originalColor = {
                        color: '#bdbdbd',
                        opacity: 1
                    };
                }
                
                // 🎯 원본 그래프의 정확한 width 저장
                edge.originalWidth = edge.width || (edge.dashes ? 1.5 : 3);
            }
            
            edgeUpdateArray.push({
                id: edge.id,
                width: edge.dashes ? 2 : 3, // 점선은 2px, 실선은 3px
                color: { 
                    color: edge.dashes ? highlightColor : '#595959ff', // 점선은 과목분류 색상, 실선은 검은색
                    opacity: 0.8
                }
            });
        } else {
            // 🌟 하이라이트되지 않는 엣지는 정확한 원본 그래프 스타일로 복원
            const originalStyle = {
                id: edge.id,
                width: edge.originalWidth || (edge.dashes ? 1.5 : 3)
            };
            
            // 🎯 원본 그래프의 정확한 색상 복원
            if (edge.originalColor && typeof edge.originalColor === 'object') {
                originalStyle.color = {
                    color: edge.originalColor.color,
                    opacity: edge.originalColor.opacity !== undefined ? edge.originalColor.opacity : 1
                };
            } else {
                // 기본 색상
                if (edge.dashes) {
                    originalStyle.color = {
                        color: '#9e9e9e',
                        opacity: 0.5
                    };
                } else {
                    // 실선 엣지는 원본 그래프 기본 색상 (#bdbdbd)
                    originalStyle.color = {
                        color: '#bdbdbd',
                        opacity: 1
                    };
                }
            }
            
            // 🎯 점선 엣지의 기타 속성들 복원
            if (edge.dashes) {
                originalStyle.dashes = true;
                originalStyle.arrows = { 
                    to: { enabled: true, scaleFactor: 0.35 },
                    from: { enabled: true, scaleFactor: 0.35 }
                };
                originalStyle.smooth = { type: 'curvedCW', roundness: 0.2 };
            }
            
            edgeUpdateArray.push(originalStyle);
        }
    });
    
    if (edgeUpdateArray.length > 0) {
        window.network.body.data.edges.update(edgeUpdateArray);
    }
}

// 🌟 엣지 하이라이트 해제 함수 - 완전한 원본 그래프 스타일 복원
function unhighlightEdgeType() {
    if (!window.network) return;
    
    const edges = window.network.body.data.edges.get();
    const edgeUpdateArray = [];
    
    edges.forEach(edge => {
        // 🌟 원래 그래프의 정확한 엣지 스타일로 완전 복원
        const originalStyle = {
            id: edge.id
        };
        
        // 🌟 저장된 원본 width 복원 또는 정확한 원본 그래프 기본값 사용
        if (edge.originalWidth !== undefined && edge.originalWidth !== null) {
            originalStyle.width = edge.originalWidth;
        } else {
            // 🎯 원본 그래프의 정확한 width: 점선 1.5px, 실선 3px
            originalStyle.width = edge.dashes ? 1.5 : 3;
        }
        
        // 🌟 저장된 원본 color 복원 또는 정확한 원본 그래프 기본값 사용
        if (edge.originalColor && typeof edge.originalColor === 'object') {
            // 원본 색상이 저장되어 있으면 완전히 복원
            originalStyle.color = {
                color: edge.originalColor.color,
                opacity: edge.originalColor.opacity !== undefined ? edge.originalColor.opacity : 1
            };
        } else {
            // 🎯 원본 그래프의 정확한 색상: 점선은 회색 0.5 투명도, 실선은 #bdbdbd
            if (edge.dashes) {
                originalStyle.color = {
                    color: '#9e9e9e',
                    opacity: 0.5
                };
            } else {
                // 실선 엣지는 원본 그래프 기본 색상 (#bdbdbd)
                originalStyle.color = {
                    color: '#bdbdbd',
                    opacity: 1
                };
            }
        }
        
        // 🌟 기타 원본 속성들도 복원
        if (edge.dashes) {
            originalStyle.dashes = true;
            // 점선 엣지의 경우 원본 그래프의 화살표와 smooth 설정 복원
            originalStyle.arrows = { 
                to: { enabled: true, scaleFactor: 0.35 },
                from: { enabled: true, scaleFactor: 0.35 }
            };
            originalStyle.smooth = { type: 'curvedCW', roundness: 0.2 };
        }
        
        edgeUpdateArray.push(originalStyle);
    });
    
    if (edgeUpdateArray.length > 0) {
        window.network.body.data.edges.update(edgeUpdateArray);
        
        // 🌟 복원 후 원본 스타일 정보 정리 (메모리 절약)
        setTimeout(() => {
            const updatedEdges = window.network.body.data.edges.get();
            const cleanupArray = [];
            
            updatedEdges.forEach(edge => {
                if (edge.originalColor || edge.originalWidth !== undefined) {
                    const cleanEdge = { ...edge };
                    delete cleanEdge.originalColor;
                    delete cleanEdge.originalWidth;
                    cleanupArray.push(cleanEdge);
                }
            });
            
            if (cleanupArray.length > 0) {
                window.network.body.data.edges.update(cleanupArray);
            }
        }, 100);
    }
}

// 전역 함수로 노출
window.setupValueColumnEvents = setupValueColumnEvents;
window.highlightValueGroupInGraph = highlightValueGroupInGraph;
window.unhighlightValueGroupInGraph = unhighlightValueGroupInGraph;

// 파일 끝에서 init 함수를 전역으로 노출
window.init = init;

// init()은 window.onload에서 호출되므로 여기서는 제거

/* =========================================================
   v2.1 모바일: 지도형 팬·줌 표 뷰어 (여러 표를 하나로 묶어 함께 줌/팬)
   - 넓은 표를 지도처럼: 초기 높이 맞춤 -> 핀치/버튼 확대 -> 드래그 이동.
   - 수행평가 매트릭스는 본표 + 하단 보조표(교양/타과전공)를 한 무대(stage)로
     묶어 함께 확대/이동한다.
   - 모바일(<=768px)에서만 활성. 데스크톱에선 원래 구조로 복원.
   ========================================================= */
(function setupTableMapViewers() {
    function matrixVp() {
        var mt = document.querySelector('#matrix .matrix-table');
        if (!mt) return null;
        var el = mt.parentElement;
        while (el && el.id !== 'matrix') {
            if (!el.classList.contains('map-stage') && el.querySelector('.matrix-extra-table')) return el;
            el = el.parentElement;
        }
        return mt.parentElement;
    }
    // 표가 stage로 감싸진 뒤에도 항상 '진짜' 뷰포트(스테이지 밖 첫 조상)를 반환해야 한다.
    // parentElement를 그대로 쓰면 stage 자신이 vp가 되어 stage-in-stage 무한 중첩이 생긴다.
    function vpOutsideStage(table) {
        if (!table) return null;
        var p = table.parentElement;
        while (p && p.classList && p.classList.contains('map-stage')) p = p.parentElement;
        return p;
    }
    var CONFIGS = [
        { host: '#matrix', getVp: matrixVp },
        { host: '#curriculum', getVp: function () { return vpOutsideStage(document.querySelector('#curriculum .curriculum-table')); } },
        { host: '#commonValues', getVp: function () { return vpOutsideStage(document.querySelector('#commonValues .common-values-table')); } }
    ];
    var isMobile = function () { return window.matchMedia('(max-width: 768px)').matches; };
    var state = new WeakMap();

    function tabsH() { var t = document.querySelector('.tabs'); return t ? Math.round(t.getBoundingClientRect().height) : 56; }
    function getStage(vp) { return vp.querySelector(':scope > .map-stage'); }

    function ensureStage(vp) {
        var stage = getStage(vp);
        if (stage) return stage;
        stage = document.createElement('div');
        stage.className = 'map-stage';
        stage.style.transformOrigin = '0 0';
        stage.style.position = 'relative';
        [].slice.call(vp.children).forEach(function (k) {
            // 컨트롤·기존 stage(중첩 방지)·표 제목줄(축소되면 안 됨)은 옮기지 않는다.
            if (k.classList.contains('map-ctrls')) return;
            if (k.classList.contains('map-stage')) return;
            if (k.classList.contains('matrix-header-bar')) return;
            stage.appendChild(k);
        });
        vp.appendChild(stage);
        // stage 안으로 들어간 제목줄이 있으면 vp 최상단(스케일 밖)으로 꺼낸다.
        var hb = stage.querySelector('.matrix-header-bar');
        if (hb) vp.insertBefore(hb, vp.firstChild);
        // 내부 스크롤/높이 제한을 풀어 전체가 한 면으로 보이게 한다.
        [].slice.call(stage.querySelectorAll('div')).forEach(function (d) {
            var ox = getComputedStyle(d).overflowX;
            if (ox === 'auto' || ox === 'scroll') { d.dataset.mapOv = '1'; d.style.overflow = 'visible'; d.style.height = ''; d.style.maxHeight = ''; }
        });
        // 보조표 폭을 본표와 동일하게 → 열 배치가 데스크톱과 같은 비율로 유지
        var ex = stage.querySelector('.matrix-extra-table');
        var t0 = stage.querySelector('table');
        if (ex && t0 && ex !== t0) {
            ex.dataset.mapW = ex.style.width || '';
            ex.style.width = t0.offsetWidth + 'px';
        }
        return stage;
    }
    function unwrapStage(vp) {
        var stage = getStage(vp);
        if (!stage) return;
        [].slice.call(stage.querySelectorAll('[data-map-ov]')).forEach(function (d) { d.style.overflow = ''; delete d.dataset.mapOv; });
        var ex = stage.querySelector('.matrix-extra-table');
        if (ex && ex.dataset.mapW !== undefined) { ex.style.width = ex.dataset.mapW; delete ex.dataset.mapW; }
        [].slice.call(stage.children).forEach(function (k) { vp.insertBefore(k, stage); });
        stage.remove();
    }

    function firstTableH(vp) {
        var st = getStage(vp); if (!st) return 1;
        var t = st.querySelector('table');
        return t ? t.offsetHeight : (st.scrollHeight || 1);
    }
    function contentW(vp) { var st = getStage(vp); return st ? Math.max(st.scrollWidth, st.offsetWidth) : 1; }
    function contentH(vp) { var st = getStage(vp); return st ? Math.max(st.scrollHeight, st.offsetHeight) : 1; }

    function clampState(vp) {
        var s = state.get(vp); if (!s) return;
        var cw = contentW(vp) * s.scale, ch = contentH(vp) * s.scale;
        var vw = vp.clientWidth, vh = vp.clientHeight;
        // 제목줄(스케일 밖, stage 위)이 차지하는 높이만큼 가용 높이를 줄인다
        var st = getStage(vp);
        var avail = vh - (st ? st.offsetTop : 0);
        s.tx = cw <= vw ? (vw - cw) / 2 : Math.min(0, Math.max(vw - cw, s.tx));
        s.ty = ch <= avail ? 0 : Math.min(0, Math.max(avail - ch, s.ty));
    }
    function applyT(vp) {
        var s = state.get(vp), st = getStage(vp); if (!s || !st) return;
        clampState(vp);
        st.style.transform = 'translate(' + s.tx + 'px,' + s.ty + 'px) scale(' + s.scale + ')';
    }
    function fit(vp) {
        var s = state.get(vp); if (!s) return;
        var st = getStage(vp);
        var avail = vp.clientHeight - (st ? st.offsetTop : 0); // 제목줄 아래 가용 높이
        var fitW = vp.clientWidth / contentW(vp);
        var fitH = avail / firstTableH(vp);  // 첫 표(본표)가 가용 높이를 채우고, 아래 표는 팬으로
        s.min = Math.max(0.05, Math.min(1, fitW));
        s.scale = Math.max(s.min, Math.min(1.5, fitH));
        s.tx = 0; s.ty = 0; applyT(vp);
    }
    function setScale(vp, ns, cx, cy) {
        var s = state.get(vp); if (!s) return;
        cx = (cx == null) ? vp.clientWidth / 2 : cx;
        cy = (cy == null) ? vp.clientHeight / 2 : cy;
        ns = Math.max(s.min, Math.min(s.max, ns));
        s.tx = cx - (cx - s.tx) * (ns / s.scale);
        s.ty = cy - (cy - s.ty) * (ns / s.scale);
        s.scale = ns; applyT(vp);
    }

    function bind(vp) {
        if (vp.dataset.mapBound) return; vp.dataset.mapBound = '1';
        var s = state.get(vp);
        vp.addEventListener('pointerdown', function (e) {
            if (!vp.dataset.mapOn) return;
            try { vp.setPointerCapture(e.pointerId); } catch (x) {}
            s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            vp.style.cursor = 'grabbing';
        });
        vp.addEventListener('pointermove', function (e) {
            if (!vp.dataset.mapOn || !s.pts.has(e.pointerId)) return;
            var prev = s.pts.get(e.pointerId); s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            var rect = vp.getBoundingClientRect();
            if (s.pts.size === 1) { s.tx += e.clientX - prev.x; s.ty += e.clientY - prev.y; applyT(vp); }
            else if (s.pts.size >= 2) {
                var a = Array.from(s.pts.values());
                var dist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
                var mx = (a[0].x + a[1].x) / 2 - rect.left, my = (a[0].y + a[1].y) / 2 - rect.top;
                if (s.lastDist) setScale(vp, s.scale * dist / s.lastDist, mx, my);
                s.lastDist = dist;
            }
        });
        function up(e) { s.pts.delete(e.pointerId); if (s.pts.size < 2) s.lastDist = 0; if (s.pts.size === 0) vp.style.cursor = 'grab'; }
        vp.addEventListener('pointerup', up);
        vp.addEventListener('pointercancel', up);
        vp.addEventListener('wheel', function (e) {
            if (!vp.dataset.mapOn) return; e.preventDefault();
            var rect = vp.getBoundingClientRect();
            setScale(vp, s.scale * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX - rect.left, e.clientY - rect.top);
        }, { passive: false });
    }

    function ensureControls(vp) {
        if (vp.querySelector(':scope > .map-ctrls')) return;
        var c = document.createElement('div');
        c.className = 'map-ctrls';
        c.innerHTML =
            '<button type="button" data-a="fit" aria-label="전체 맞추기">⤢</button>' +
            '<button type="button" data-a="in" aria-label="확대">+</button>' +
            '<button type="button" data-a="out" aria-label="축소">−</button>';
        c.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        c.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            var a = b.getAttribute('data-a'), s = state.get(vp);
            if (a === 'fit') fit(vp);
            else if (a === 'in') setScale(vp, s.scale * 1.3);
            else setScale(vp, s.scale / 1.3);
        });
        vp.appendChild(c);
    }

    function enable(vp) {
        var s = state.get(vp);
        vp.dataset.mapOn = '1';
        vp.style.height = 'calc(100vh - ' + tabsH() + 'px)';
        vp.style.maxHeight = 'none';
        vp.style.setProperty('overflow', 'hidden', 'important');
        vp.style.position = 'relative';
        vp.style.touchAction = 'none';
        vp.style.cursor = 'grab';
        vp.style.userSelect = 'none';
        vp.style.webkitUserSelect = 'none';
        ensureStage(vp);
        ensureControls(vp);
        var w = contentW(vp);
        if (s.lastW !== w) { s.lastW = w; fit(vp); } else { applyT(vp); }
    }
    function disable(vp) {
        delete vp.dataset.mapOn;
        vp.style.removeProperty('overflow');
        ['height', 'maxHeight', 'position', 'touchAction', 'cursor', 'userSelect', 'webkitUserSelect'].forEach(function (p) { vp.style[p] = ''; });
        unwrapStage(vp);
        var c = vp.querySelector(':scope > .map-ctrls'); if (c) c.remove();
        var s = state.get(vp); if (s) s.lastW = -1;
    }

    function refresh() {
        CONFIGS.forEach(function (cfg) {
            var vp = cfg.getVp(); if (!vp) return;
            if (!state.has(vp)) state.set(vp, { scale: 1, tx: 0, ty: 0, min: 0.2, max: 4, pts: new Map(), lastDist: 0, lastW: -1 });
            bind(vp);
            var host = document.querySelector(cfg.host);
            var visible = host && getComputedStyle(host).display !== 'none' && vp.clientWidth > 0;
            if (isMobile() && visible && !(host && host.classList.contains('fullscreen-active'))) enable(vp);
            else disable(vp);
        });
    }
    var deb; function refreshDeb() { clearTimeout(deb); deb = setTimeout(refresh, 160); }

    function init() {
        refresh();
        CONFIGS.forEach(function (cfg) {
            var host = document.querySelector(cfg.host);
            if (host) new MutationObserver(refreshDeb).observe(host, { childList: true, subtree: true });
        });
        window.addEventListener('resize', refreshDeb);
        if (typeof window.showTab === 'function' && !window.showTab.__mapWrapped) {
            var orig = window.showTab;
            window.showTab = function () { var r = orig.apply(this, arguments); refreshDeb(); return r; };
            window.showTab.__mapWrapped = true;
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 300); });
    else setTimeout(init, 300);
    window.addEventListener('load', function () { setTimeout(refresh, 800); });
})();


/* =========================================================
   v2.1 모바일: 교과목 추가/일반모드 버튼을 필터 카드 안으로 통합
   - 모바일에서는 .courses-controls 를 .filters 카드의 첫 줄로 이동,
     데스크톱에서는 원래 위치(필터 카드 앞)로 복원.
   ========================================================= */
(function integrateCoursesControls() {
    function groupByLabel(f, label) {
        var gs = f.querySelectorAll('.filter-group');
        for (var i = 0; i < gs.length; i++) { var l = gs[i].querySelector('label'); if (l && l.textContent.trim() === label) return gs[i]; }
        return null;
    }
    function apply() {
        var mobile = window.matchMedia('(max-width: 768px)').matches;
        var f = document.querySelector('#courses .filters'); if (!f) return;
        var cc = document.querySelector('.courses-controls');
        var addBtn = document.querySelector('.btn-add');
        var modeBtn = document.querySelector('.btn-edit-mode-courses');
        var gYear = groupByLabel(f, '학년'), gSem = groupByLabel(f, '학기'),
            gDiv = groupByLabel(f, '구분'), gCat = groupByLabel(f, '과목분류'), gSearch = groupByLabel(f, '검색');
        var gChg = f.querySelector('.change-status-filter');

        if (mobile) {
            // 행1: 학년·학기·과목분류 / 행2: 구분·일반모드·검색 / 행3: 변경상태(전체폭)
            if (modeBtn && modeBtn.parentElement !== f) f.appendChild(modeBtn);   // 일반모드를 필터 그리드로
            if (addBtn) addBtn.style.display = 'none';                            // 교과목 추가 숨김
            if (cc) cc.style.display = 'none';                                    // 빈 컨트롤 바 숨김
            if (gDiv) gDiv.style.display = '';                                    // 구분 다시 표시
            var ord = [[gYear, '1'], [gSem, '2'], [gCat, '3'], [gDiv, '4'], [modeBtn, '5'], [gSearch, '6'], [gChg, '7']];
            ord.forEach(function (m) { if (m[0]) m[0].style.order = m[1]; });
            if (gSearch) gSearch.style.gridColumn = 'auto';
            if (gChg) gChg.style.gridColumn = '1 / -1';
        } else {
            if (modeBtn && cc && modeBtn.parentElement !== cc) cc.appendChild(modeBtn);
            [gYear, gSem, gDiv, gCat, gSearch, gChg, modeBtn, addBtn, cc].forEach(function (el) {
                if (el) { el.style.order = ''; el.style.gridColumn = ''; el.style.display = ''; }
            });
        }
        // '변경없음' 체크박스는 표시 (이전에 숨겼던 것 복원)
        ['#courses .change-status-checkboxes .inline-checkbox', '.matrix-filters .modern-checkbox'].forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                if ((el.textContent || '').trim().indexOf('변경없음') === 0) el.style.display = '';
            });
        });
    }
    var deb; function applyDeb() { clearTimeout(deb); deb = setTimeout(apply, 150); }
    function init() {
        apply();
        window.addEventListener('resize', applyDeb);
        if (typeof window.showTab === 'function' && !window.showTab.__ccWrapped) {
            var orig = window.showTab;
            window.showTab = function () { var r = orig.apply(this, arguments); applyDeb(); return r; };
            window.showTab.__ccWrapped = true;
        }
        var host = document.getElementById('courses');
        if (host) new MutationObserver(applyDeb).observe(host, { childList: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 400); });
    else setTimeout(init, 400);
    window.addEventListener('load', function () { setTimeout(apply, 900); });
})();

/* =========================================================
   v2.1 모바일: '필터 초기화'와 '변경사항 표시'를 한 줄에 (매트릭스 탭)
   ========================================================= */
(function integrateResetViewmode() {
    var TABS = ['#matrix', '#curriculum', '#commonValues'];
    var isMobile = function () { return window.matchMedia('(max-width: 768px)').matches; };
    var orig = new WeakMap();
    function remember(el) { if (el && !orig.has(el)) orig.set(el, { parent: el.parentElement, next: el.nextSibling }); }
    function restore(el) {
        var o = orig.get(el); if (!o || !o.parent) return;
        var ref = (o.next && o.next.parentElement === o.parent) ? o.next : null;
        if (el.parentElement !== o.parent || el.nextSibling !== ref) o.parent.insertBefore(el, ref);
    }
    function apply() {
        TABS.forEach(function (sel) {
            var host = document.querySelector(sel); if (!host) return;
            var mf = host.querySelector('.matrix-filters');
            var reset = mf ? mf.querySelector('.btn-reset') : null;
            var vm = host.querySelector('.view-mode-switch');
            if (!vm) return;
            if (reset) remember(reset);
            remember(vm);
            // 분야/구분 토글이 있는 색상기준 줄 (이수모형·공통가치)
            var cms = host.querySelector('.color-mode-switch');
            var hasColorToggle = cms && cms.querySelector('[class*="toggle-switch"]');
            // 캡션/분야토글은 이동 후엔 .toggles-row 에 있으므로 host 전체에서 찾는다
            var caption = [].slice.call(host.querySelectorAll('.color-mode-switch > span, .toggles-row > span')).find(function (s) { return /색상\s*기준/.test(s.textContent); }) || null;
            var fieldTog = host.querySelector('.color-mode-switch [class*="toggle-switch"], .toggles-row > [class*="toggle-switch"]');
            hasColorToggle = !!fieldTog;
            if (isMobile()) {
                if (hasColorToggle) {
                    // 색상기준(캡션+토글)과 변경표시 토글을 컨트롤 카드 아래(표 위)에
                    // 오른쪽 정렬로 나란히 배치
                    if (caption) remember(caption);
                    remember(fieldTog);
                    var mc = host.querySelector('.matrix-controls');
                    var trow = host.querySelector(':scope .toggles-row');
                    if (!trow) {
                        trow = document.createElement('div');
                        trow.className = 'toggles-row';
                        if (mc && mc.parentNode) mc.parentNode.insertBefore(trow, mc.nextSibling);
                        else host.insertBefore(trow, host.firstChild);
                    }
                    if (caption && caption.parentElement !== trow) trow.appendChild(caption);
                    if (fieldTog.parentElement !== trow) trow.appendChild(fieldTog);
                    if (vm.parentElement !== trow) trow.appendChild(vm);
                } else if (mf) {
                    // 매트릭스: 변경표시 토글을 첫 줄(학년) 오른쪽 공백에 우측 정렬로
                    var firstSec = mf.querySelector('.filter-section');
                    if (firstSec && vm.parentElement !== firstSec) firstSec.appendChild(vm);
                }
            } else {
                if (reset) restore(reset);
                if (caption) restore(caption);
                if (fieldTog) restore(fieldTog);
                restore(vm);
                if (mf) { var row2 = mf.querySelector(':scope > .reset-vm-row'); if (row2) row2.remove(); }
                var trow2 = host.querySelector(':scope .toggles-row'); if (trow2) trow2.remove();
            }
        });
    }
    var deb; function applyDeb() { clearTimeout(deb); deb = setTimeout(apply, 160); }
    function init() {
        apply();
        window.addEventListener('resize', applyDeb);
        if (typeof window.showTab === 'function' && !window.showTab.__rvmWrapped) {
            var o = window.showTab;
            window.showTab = function () { var r = o.apply(this, arguments); applyDeb(); return r; };
            window.showTab.__rvmWrapped = true;
        }
        TABS.forEach(function (sel) { var h = document.querySelector(sel); if (h) new MutationObserver(applyDeb).observe(h, { childList: true, subtree: true }); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 450); });
    else setTimeout(init, 450);
    window.addEventListener('load', function () { setTimeout(apply, 950); });
})();

/* =========================================================
   v2.1 모바일: '변경사항 표시' 버튼을 토글 스위치로 표시
   - 모바일에서 각 탭의 .view-mode-switch 버튼 옆에 토글 UI를 만들고,
     클릭 시 원본 버튼을 프록시로 눌러 기존 로직을 그대로 사용한다.
   ========================================================= */
(function viewmodeToggleUI() {
    var isMobile = function () { return window.matchMedia('(max-width: 768px)').matches; };
    function stateOn(host) {
        // true = 변경사항 표시 모드
        try {
            if (host === '#matrix') return !!showChangesModeMatrix;
            if (host === '#curriculum') return !!showChangesModeCurriculum;
            if (host === '#commonValues') return !!showChangesModeCommonValues;
        } catch (e) { /* 변수 미정의 시 기본값 */ }
        return true;
    }
    function sync(host) {
        var hostEl = document.querySelector(host); if (!hostEl) return;
        var vm = hostEl.querySelector('.view-mode-switch'); if (!vm) return;
        var btn = vm.querySelector('.btn'); if (!btn) return;
        var tg = vm.querySelector('.vm-toggle');
        if (!isMobile()) { if (tg) tg.remove(); return; }
        if (!tg) {
            tg = document.createElement('div');
            tg.className = 'vm-toggle';
            tg.setAttribute('role', 'switch');
            tg.innerHTML = '<div class="vm-slider"></div><span class="vm-text"></span>';
            tg.addEventListener('click', function () { btn.click(); setTimeout(function () { sync(host); }, 60); });
            vm.appendChild(tg);
        }
        var on = stateOn(host);
        tg.classList.toggle('on', on);
        tg.setAttribute('aria-checked', on ? 'true' : 'false');
        tg.querySelector('.vm-text').textContent = '변경표시';
    }
    function syncAll() { ['#matrix', '#curriculum', '#commonValues'].forEach(sync); }
    var deb; function syncDeb() { clearTimeout(deb); deb = setTimeout(syncAll, 180); }
    function init() {
        syncAll();
        window.addEventListener('resize', syncDeb);
        if (typeof window.showTab === 'function' && !window.showTab.__vmtWrapped) {
            var o = window.showTab;
            window.showTab = function () { var r = o.apply(this, arguments); syncDeb(); return r; };
            window.showTab.__vmtWrapped = true;
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
    else setTimeout(init, 500);
    window.addEventListener('load', function () { setTimeout(syncAll, 1000); });
})();
