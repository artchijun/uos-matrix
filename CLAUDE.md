# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
UOSARCH 교과목 관리 시스템 - A course management system for architecture curriculum with Firebase integration for data persistence and version control.

## Development Commands

### Running the Application
Since this is a client-side web application, it requires a web server:
```bash
# Using Python (if available)
python -m http.server 8000

# Using Node.js http-server (if installed)
npx http-server -p 8000

# Or open index.html directly in a browser
```

## Architecture Overview

### Data Flow and State Management
The application follows a hybrid data persistence pattern:
1. **Primary Storage**: Firebase Realtime Database (when online)
2. **Fallback Storage**: localStorage (offline mode)
3. **Sync Strategy**: Automatic sync from local to Firebase when connection restored

Key global state variables:
- `courses[]` - Main course data array
- `versions{}` - Version history object
- `currentVersion` - Active version identifier
- `changeHistory[]` - Tracks uncommitted changes
- `firebaseInitialized` / `isOnline` - Connection state flags

### Initialization Flow
```
window.onload → init() → initializeFirebase() → loadAllDataFromFirebase() → initializeUI() → renderCourses()/renderMatrix()/etc.
```

### Tab System Architecture
The application uses a tab-based interface with distinct responsibilities:

1. **교과목 관리 (Course Management)** - `showTab('courses')`
   - CRUD operations for courses
   - Drag-and-drop reordering in edit mode
   - Real-time filtering and search

2. **수행평가 매트릭스 (Performance Matrix)** - `showTab('matrix')`
   - 18 performance criteria columns
   - Inline cell editing with change tracking
   - Excel/PDF export with custom formatting

3. **이수모형 (Curriculum Model)** - `showTab('curriculum')`
   - Semester-based course placement
   - Color coding by category or subject type
   - Drag-and-drop course blocks between cells

4. **분석 및 통계 (Analysis)** - `showTab('analysis')`
   - Auto-calculated statistics
   - Chart.js visualizations
   - Performance criteria coverage analysis

5. **공통가치대응 (Common Values)** - `showTab('commonValues')`
   - Network graph visualization (vis-network)
   - Course categorization by common values
   - Drag-and-drop block management

### Edit Mode System
Each tab has independent edit mode controls:
- `toggleEditMode()` - Matrix tab
- `toggleEditModeCourses()` - Courses tab  
- `toggleEditModeCurriculum()` - Curriculum tab
- `toggleEditModeCommonValues()` - Common values tab

### Change Tracking System
- Changes are tracked in `changeHistory[]` array
- Visual indicators show pending changes
- Batch confirmation via `confirmAllChanges()`
- Changes persist to Firebase on confirmation

### Version Control Implementation
- Versions stored in `versions{}` object with timestamps
- Each version contains complete snapshot of:
  - Course data
  - Matrix cell data
  - Curriculum placements
  - Common values assignments
- Version navigation: `previousVersion()` / `nextVersion()`
- Version save: `saveVersion()` with name and description

### Export System
- **Excel Export**: Uses SheetJS library
  - Preserves cell formatting and merged cells
  - Includes all tabs as separate sheets
- **PDF Export**: Uses jsPDF with autotable plugin
  - Handles Korean text rendering
  - Maintains table structure

### Firebase Integration Points
- Connection monitoring via `.info/connected` ref
- Automatic retry with `syncLocalDataToFirebase()`
- Path structure:
  - `/courses` - Course data
  - `/versions` - Version history
  - `/currentVersion` - Active version
  - `/matrixData` - Matrix cell contents
  - `/curriculumData` - Curriculum placements

### Event Handling Patterns
- Inline cell editing uses blur/keydown events
- Drag-and-drop via HTML5 draggable API
- Table sorting via click handlers on headers
- Real-time filtering via input/change events