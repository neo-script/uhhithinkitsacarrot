/* Configuration */
const GRID_SIZE = 8;
const ANIMATION_DURATION = 300; // ms

/* State */
let board = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
let score = 0;
let bestScore = localStorage.getItem('block8x8_best') || 0;
let currentPieces = []; // The 3 pieces in hand

/* DOM Elements */
const boardEl = document.getElementById('board');
const pieceContainer = document.getElementById('piece-container');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const dragProxy = document.getElementById('drag-proxy');
const modal = document.getElementById('game-over-modal');
const finalScoreEl = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');

/* Shape Definitions (0/1 matrices) */
const SHAPES = [
    [[1]], // Dot
    [[1,1,1,1]], // Line 4
    [[1,1,1],[0,1,0]], // T-shape
    [[1,1],[1,1]], // Square
    [[1,1,0],[0,1,1]], // Z-shape
    [[0,1,1],[1,1,0]], // S-shape
    [[1,0,0],[1,1,1]], // L-shape
    [[0,0,1],[1,1,1]], // J-shape
    [[1,1]], // Small Line 2
    [[1,1,1]], // Line 3
    [[1,1],[1,0]] // Corner
];

/* --- Initialization --- */
function init() {
    renderBoard();
    updateScoreUI();
    spawnPieces();
    
    // Global event listeners for drag end (in case mouse goes off screen)
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('touchmove', moveDrag, { passive: false });
    
    restartBtn.addEventListener('click', restartGame);
}

function restartGame() {
    board = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
    score = 0;
    updateScoreUI();
    
    // Clear visual board
    const cells = document.querySelectorAll('.cell');
    cells.forEach(c => {
        c.className = 'cell';
    });

    modal.classList.add('hidden');
    spawnPieces();
}

/* --- Rendering --- */
function renderBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            boardEl.appendChild(cell);
        }
    }
}

function updateScoreUI() {
    scoreEl.innerText = score;
    bestScoreEl.innerText = bestScore;
}

/* --- Piece Generation --- */
function spawnPieces() {
    pieceContainer.innerHTML = '';
    currentPieces = [];
    
    // Create 3 random pieces
    for (let i = 0; i < 3; i++) {
        const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        const id = 'piece-' + Date.now() + '-' + i;
        
        currentPieces.push({ id, shape, placed: false });
        
        const wrapper = document.createElement('div');
        wrapper.className = 'piece-wrapper';
        
        const pieceEl = document.createElement('div');
        pieceEl.className = 'draggable-piece';
        pieceEl.dataset.id = id;
        pieceEl.dataset.index = i;
        
        // Render mini-grid for the piece
        pieceEl.style.gridTemplateColumns = `repeat(${shape[0].length}, 1fr)`;
        
        shape.forEach(row => {
            row.forEach(val => {
                const pCell = document.createElement('div');
                if (val) pCell.className = 'piece-cell';
                pieceEl.appendChild(pCell);
            });
        });

        // Attach drag start
        pieceEl.addEventListener('mousedown', startDrag);
        pieceEl.addEventListener('touchstart', startDrag, { passive: false });

        wrapper.appendChild(pieceEl);
        pieceContainer.appendChild(wrapper);
    }
    
    checkGameOver();
}

/* --- Drag & Drop Logic --- */
let isDragging = false;
let currentDragPiece = null; // Data object
let currentDragElement = null; // Original DOM element
let dragOffsetX = 0;
let dragOffsetY = 0;

function startDrag(e) {
    e.preventDefault();
    if (isDragging) return;

    // Identify input type
    const touch = e.type === 'touchstart' ? e.touches[0] : e;
    const target = e.currentTarget;
    
    const idx = target.dataset.index;
    if (currentPieces[idx].placed) return;

    isDragging = true;
    currentDragElement = target;
    currentDragPiece = currentPieces[idx];

    // Get piece dimensions to center it under finger
    const rect = target.getBoundingClientRect();
    dragOffsetX = touch.clientX - rect.left;
    dragOffsetY = touch.clientY - rect.top;

    // Setup Proxy
    dragProxy.innerHTML = '';
    dragProxy.className = 'drag-proxy'; // Reset class
    dragProxy.style.gridTemplateColumns = target.style.gridTemplateColumns;
    
    // Copy cells to proxy with different styling
    Array.from(target.children).forEach(child => {
        const div = document.createElement('div');
        if (child.classList.contains('piece-cell')) {
            div.className = 'proxy-cell';
        }
        dragProxy.appendChild(div);
    });

    // Determine cell size based on board width
    const boardRect = boardEl.getBoundingClientRect();
    const cellSize = (boardRect.width - 10) / GRID_SIZE; // Approx
    
    // Size the proxy cells to match board cells
    const proxyCells = dragProxy.querySelectorAll('.proxy-cell');
    proxyCells.forEach(c => {
        c.style.width = cellSize + 'px';
        c.style.height = cellSize + 'px';
    });

    // Hide original, show proxy
    currentDragElement.style.opacity = '0';
    dragProxy.classList.remove('hidden');
    
    moveDrag(e); // Snap immediately
}

function moveDrag(e) {
    if (!isDragging) return;
    e.preventDefault();

    const touch = e.type === 'touchmove' ? e.touches[0] : e;
    
    // Update proxy position
    const x = touch.clientX - dragOffsetX;
    const y = touch.clientY - dragOffsetY;
    
    dragProxy.style.left = `${x}px`;
    dragProxy.style.top = `${y}px`;

    // Highlight Board Area
    highlightHover(touch.clientX, touch.clientY);
}

function endDrag(e) {
    if (!isDragging) return;
    
    // Try to place
    const touch = e.type === 'touchend' ? e.changedTouches[0] : e;
    const placed = tryPlacePiece(touch.clientX, touch.clientY);

    if (placed) {
        // Remove piece from hand
        currentDragElement.remove();
        currentDragPiece.placed = true;
        
        // Check if hand is empty
        if (currentPieces.every(p => p.placed)) {
            setTimeout(spawnPieces, 500);
        } else {
            checkGameOver();
        }
    } else {
        // Return to hand animation could go here
        currentDragElement.style.opacity = '1';
    }

    // Cleanup
    isDragging = false;
    dragProxy.classList.add('hidden');
    clearHighlights();
    currentDragElement = null;
    currentDragPiece = null;
}

/* --- Game Logic --- */

function highlightHover(x, y) {
    clearHighlights();
    
    // Find board cell under cursor (roughly center of piece)
    const proxyRect = dragProxy.getBoundingClientRect();
    const centerX = proxyRect.left + proxyRect.width / 2;
    const centerY = proxyRect.top + proxyRect.height / 2;

    // Use elementFromPoint to find the specific grid cell
    // We hide dragProxy momentarily to peek behind it, but pointer-events: none handles that usually
    const elements = document.elementsFromPoint(centerX, centerY);
    const cellEl = elements.find(el => el.classList.contains('cell'));

    if (!cellEl) return;

    const r = parseInt(cellEl.dataset.r);
    const c = parseInt(cellEl.dataset.c);

    // Calculate offset based on piece shape center vs top-left
    // Simplified: We assume user grabs roughly center. 
    // Let's refine: The piece top-left is at proxyRect.left.
    
    // Better Logic: Calculate Grid Index relative to Board
    const boardRect = boardEl.getBoundingClientRect();
    const cellWidth = boardRect.width / GRID_SIZE;
    
    const relX = proxyRect.left - boardRect.left;
    const relY = proxyRect.top - boardRect.top;
    
    const startC = Math.round(relX / cellWidth);
    const startR = Math.round(relY / cellWidth);

    if (canPlace(currentDragPiece.shape, startR, startC)) {
        drawGhost(currentDragPiece.shape, startR, startC);
    }
}

function clearHighlights() {
    const cells = document.querySelectorAll('.cell.hover');
    cells.forEach(c => c.classList.remove('hover'));
}

function drawGhost(shape, startR, startC) {
    shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val) {
                const cell = getCellEl(startR + r, startC + c);
                if (cell) cell.classList.add('hover');
            }
        });
    });
}

function tryPlacePiece(x, y) {
    const boardRect = boardEl.getBoundingClientRect();
    const proxyRect = dragProxy.getBoundingClientRect();
    const cellWidth = boardRect.width / GRID_SIZE;
    
    const relX = proxyRect.left - boardRect.left;
    const relY = proxyRect.top - boardRect.top;
    
    const startC = Math.round(relX / cellWidth);
    const startR = Math.round(relY / cellWidth);

    if (canPlace(currentDragPiece.shape, startR, startC)) {
        placePiece(currentDragPiece.shape, startR, startC);
        return true;
    }
    return false;
}

function canPlace(shape, r, c) {
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                const checkR = r + i;
                const checkC = c + j;
                // Out of bounds
                if (checkR < 0 || checkR >= GRID_SIZE || checkC < 0 || checkC >= GRID_SIZE) return false;
                // Already filled
                if (board[checkR][checkC]) return false;
            }
        }
    }
    return true;
}

function placePiece(shape, startR, startC) {
    // 1. Update Data & UI
    shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val) {
                board[startR + r][startC + c] = 1;
                const cell = getCellEl(startR + r, startC + c);
                cell.classList.add('filled');
            }
        });
    });

    // 2. Score for placement
    const pieceScore = shape.flat().reduce((a, b) => a + b, 0);
    score += pieceScore;

    // 3. Check Lines
    checkLines();
    
    updateScoreUI();
}

function checkLines() {
    let linesCleared = 0;
    const rowsToClear = [];
    const colsToClear = [];

    // Check Rows
    for (let r = 0; r < GRID_SIZE; r++) {
        if (board[r].every(val => val === 1)) {
            rowsToClear.push(r);
        }
    }

    // Check Cols
    for (let c = 0; c < GRID_SIZE; c++) {
        let full = true;
        for (let r = 0; r < GRID_SIZE; r++) {
            if (board[r][c] === 0) {
                full = false;
                break;
            }
        }
        if (full) colsToClear.push(c);
    }

    const uniqueCellsToClear = new Set();

    rowsToClear.forEach(r => {
        for(let c=0; c<GRID_SIZE; c++) uniqueCellsToClear.add(`${r},${c}`);
    });
    colsToClear.forEach(c => {
        for(let r=0; r<GRID_SIZE; r++) uniqueCellsToClear.add(`${r},${c}`);
    });

    if (uniqueCellsToClear.size > 0) {
        // Animation Phase
        uniqueCellsToClear.forEach(key => {
            const [r, c] = key.split(',').map(Number);
            const cell = getCellEl(r, c);
            cell.classList.add('clearing');
            // Remove filled class immediately so it looks like it's popping
            cell.classList.remove('filled');
        });

        // Logic Phase (after animation)
        setTimeout(() => {
            uniqueCellsToClear.forEach(key => {
                const [r, c] = key.split(',').map(Number);
                board[r][c] = 0;
                const cell = getCellEl(r, c);
                cell.className = 'cell'; // Reset classes
            });
        }, ANIMATION_DURATION);
        
        // Scoring: 10 points per cell + bonus for multi-lines
        const totalCleared = uniqueCellsToClear.size;
        const comboBonus = (rowsToClear.length + colsToClear.length) * 10;
        score += (totalCleared * 10) + comboBonus;
        
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('block8x8_best', bestScore);
        }
        updateScoreUI();
    }
}

function checkGameOver() {
    // Check if any remaining piece can fit anywhere
    const remainingPieces = currentPieces.filter(p => !p.placed);
    if (remainingPieces.length === 0) return; // Will spawn new ones shortly

    let canMove = false;
    
    for (let p of remainingPieces) {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (canPlace(p.shape, r, c)) {
                    canMove = true;
                    break;
                }
            }
            if (canMove) break;
        }
        if (canMove) break;
    }

    if (!canMove) {
        finalScoreEl.innerText = score;
        modal.classList.remove('hidden');
    }
}

function getCellEl(r, c) {
    return document.querySelector(`.cell[data-r='${r}'][data-c='${c}']`);
}

// Start
init();
