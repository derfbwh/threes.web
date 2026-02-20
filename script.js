const gridEl = document.getElementById('grid'); // NEW: Grabbing the main grid wrapper for the bump

const gridBg = document.getElementById('grid-background');
const tileContainer = document.getElementById('tile-container');
const scoreElement = document.getElementById('score');
const bestScoreElement = document.getElementById('best-score');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const nextTileEl = document.getElementById('next-tile');
const themeToggleBtn = document.getElementById('theme-toggle');

// Layout constants (must match CSS)
const TILE_W = 65;
const TILE_H = 90;
const GAP = 10;

let tiles = {}; // Store tiles by a unique ID
let board = Array(4).fill().map(() => Array(4).fill(null)); // Stores tile IDs
let score = 0;
let bestScore = localStorage.getItem('threesBestScore') || 0;
let isDarkMode = localStorage.getItem('threesDarkMode') === 'true';
let tileCounter = 0;
let isAnimating = false;
let deck = []; // Stores our upcoming balanced cards

// Convert grid coordinates to pixel translations
const getTranslateX = (c) => c * (TILE_W + GAP) + GAP;
const getTranslateY = (r) => r * (TILE_H + GAP) + GAP;

function init() {
    // Apply saved theme preference on load
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerText = '☀️ Light Mode';
    }

    bestScoreElement.innerText = bestScore;

    // Build background grid
    for(let i = 0; i < 16; i++) {
        let cell = document.createElement('div');
        cell.classList.add('cell-bg');
        gridBg.appendChild(cell);
    }
    
    // Initial tiles
    for(let i = 0; i < 7; i++) addRandomTile();
}

function updateScore(pointsToAdd) {
    if (pointsToAdd === 0) {
        score = 0; 
    } else {
        score += pointsToAdd;
        
        // NEW: Trigger the score pop animation
        scoreElement.classList.add('score-pop');
        setTimeout(() => scoreElement.classList.remove('score-pop'), 150);
    }
        
    scoreElement.innerText = score;
    
    if (score > bestScore) {
        bestScore = score;
        bestScoreElement.innerText = bestScore;
        localStorage.setItem('threesBestScore', bestScore);
    }
}

// Scans the board to find the current highest tile
function getMaxTile() {
    let max = 0;
    for (let id in tiles) {
        if (tiles[id].val > max) max = tiles[id].val;
    }
    return max;
}

// Determines the value of the bonus card based on your highest tile
function getBonusCard(maxTile) {
    let possibleBonuses = [];
    let val = 6;
    
    // Calculate valid bonus cards (up to maxTile / 8)
    while (val <= maxTile / 8) {
        possibleBonuses.push(val);
        val *= 2;
    }
    
    // Pick one of the valid bonus cards at random
    return possibleBonuses[Math.floor(Math.random() * possibleBonuses.length)];
}

// Helper to guarantee the deck always has cards in it
function ensureDeck() {
    if (deck.length === 0) {
        deck = [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3];
        
        // Fisher-Yates shuffle
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        // Bonus Card Injection
        let maxTile = getMaxTile();
        if (maxTile >= 48) {
            // 50% chance to spawn one bonus card per 12-card deck
            if (Math.random() < 0.5) { 
                let bonusCardVal = getBonusCard(maxTile);
                
                // Insert the bonus card at a random position in the deck
                let insertPos = Math.floor(Math.random() * (deck.length + 1));
                deck.splice(insertPos, 0, bonusCardVal);
            }
        }
    }
}

// Draws the card and updates the UI
function getNextCard() {
    ensureDeck();
    let card = deck.pop();
    
    // Immediately refill if we just took the last card so we can peek at the next one
    ensureDeck(); 
    updateNextTileIndicator();
    
    return card;
}

// Peeks at the top card and changes the mini-tile's color
function updateNextTileIndicator() {
    ensureDeck();
    let nextVal = deck[deck.length - 1]; // Peek at the top card
    
    // Reset the class to remove old colors, keeping 'mini-tile'
    nextTileEl.className = 'mini-tile';
    
    if (nextVal >= 6) {
        // It's a bonus card! Show a plus sign instead of the number.
        nextTileEl.innerText = '+';
        nextTileEl.classList.add('tile-3plus'); 
    } else {
        // Standard card
        nextTileEl.innerText = nextVal;
        if (nextVal === 1) nextTileEl.classList.add('tile-1');
        else if (nextVal === 2) nextTileEl.classList.add('tile-2');
        else nextTileEl.classList.add('tile-3plus');
    }
}

function createTileElement(id, val, r, c) {
    let el = document.createElement('div');
    el.classList.add('tile', val === 1 ? 'tile-1' : val === 2 ? 'tile-2' : 'tile-3plus');
    
    // NEW: Add the pop-in animation
    el.classList.add('appear');
    setTimeout(() => el.classList.remove('appear'), 250); 

    el.id = `tile-${id}`;
    el.innerText = val;
    el.style.transform = `translate(${getTranslateX(c)}px, ${getTranslateY(r)}px)`;
    tileContainer.appendChild(el);
    return el;
}

function addRandomTile(specificRow = null, specificCol = null) {
    let emptyCells = [];
    for(let r = 0; r < 4; r++){
        for(let c = 0; c < 4; c++){
            if(!board[r][c]) emptyCells.push({r, c});
        }
    }
    
    if(emptyCells.length === 0) return;

    // Filter by specific row/col if provided (used for spawning after moves)
    if (specificRow !== null) emptyCells = emptyCells.filter(cell => cell.r === specificRow);
    if (specificCol !== null) emptyCells = emptyCells.filter(cell => cell.c === specificCol);

    if(emptyCells.length > 0) {
        let cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        
        // Pull from our balanced deck
        let tileVal = getNextCard(); 
        
        tileCounter++;
        let id = tileCounter;
        
        tiles[id] = { id, val: tileVal, r: cell.r, c: cell.c, el: createTileElement(id, tileVal, cell.r, cell.c) };
        board[cell.r][cell.c] = id;
    }
}

function canMerge(v1, v2) {
    if (v1 === 1 && v2 === 2) return true;
    if (v1 === 2 && v2 === 1) return true;
    if (v1 >= 3 && v1 === v2) return true;
    return false;
}

function checkGameOver() {
    // 1. If there's an empty space, the game is not over
    for(let r = 0; r < 4; r++) {
        for(let c = 0; c < 4; c++) {
            if(!board[r][c]) return false;
        }
    }

    // 2. Check for horizontal merges
    for(let r = 0; r < 4; r++) {
        for(let c = 0; c < 3; c++) {
            let val1 = tiles[board[r][c]].val;
            let val2 = tiles[board[r][c+1]].val;
            if(canMerge(val1, val2)) return false;
        }
    }

    // 3. Check for vertical merges
    for(let c = 0; c < 4; c++) {
        for(let r = 0; r < 3; r++) {
            let val1 = tiles[board[r][c]].val;
            let val2 = tiles[board[r+1][c]].val;
            if(canMerge(val1, val2)) return false;
        }
    }

    // If we reach here, the board is full and no merges are possible
    return true;
}

function restartGame() {
    // Hide the overlay
    gameOverEl.classList.remove('show');
    
    // Clear the DOM
    tileContainer.innerHTML = '';
    
    // Reset variables
    tiles = {};
    board = Array(4).fill().map(() => Array(4).fill(null));
    updateScore(0);
    tileCounter = 0;
    deck = []; // Empty the deck so it reshuffles cleanly
    
    // Respawn initial tiles
    for(let i = 0; i < 7; i++) addRandomTile();
}

function move(direction) {
    if (isAnimating) return; // Prevent moves while sliding
    
    let merges = [];
    let moves = [];
    let linesMoved = [];

    // Helper to process a single line movement
    const processLine = (r, c, dr, dc) => {
        let currentId = board[r][c];
        if (!currentId) return false;

        let nextR = r + dr;
        let nextC = c + dc;
        
        if (nextR < 0 || nextR > 3 || nextC < 0 || nextC > 3) return false;

        let nextId = board[nextR][nextC];
        
        if (!nextId) {
            // Slide into empty space
            moves.push({ id: currentId, toR: nextR, toC: nextC });
            board[nextR][nextC] = currentId;
            board[r][c] = null;
            return true;
        } else if (canMerge(tiles[currentId].val, tiles[nextId].val)) {
            // Merge
            let newVal = tiles[currentId].val + tiles[nextId].val;
            updateScore(newVal);
            
            // The moving tile gets flagged to be destroyed, the static tile upgrades
            merges.push({ movingId: currentId, staticId: nextId, toR: nextR, toC: nextC, newVal });
            board[r][c] = null;
            return true;
        }
        return false;
    };

    // Iterate board based on direction. 
    if (direction === 'ArrowLeft') {
        for (let r = 0; r < 4; r++) {
            let lineMoved = false;
            for (let c = 1; c < 4; c++) if (processLine(r, c, 0, -1)) lineMoved = true;
            if (lineMoved) linesMoved.push(r);
        }
    } else if (direction === 'ArrowRight') {
        for (let r = 0; r < 4; r++) {
            let lineMoved = false;
            for (let c = 2; c >= 0; c--) if (processLine(r, c, 0, 1)) lineMoved = true;
            if (lineMoved) linesMoved.push(r);
        }
    } else if (direction === 'ArrowUp') {
        for (let c = 0; c < 4; c++) {
            let lineMoved = false;
            for (let r = 1; r < 4; r++) if (processLine(r, c, -1, 0)) lineMoved = true;
            if (lineMoved) linesMoved.push(c);
        }
    } else if (direction === 'ArrowDown') {
        for (let c = 0; c < 4; c++) {
            let lineMoved = false;
            for (let r = 2; r >= 0; r--) if (processLine(r, c, 1, 0)) lineMoved = true;
            if (lineMoved) linesMoved.push(c);
        }
    }
    
    // NEW: The "Juice" Bump for an invalid move
    if (moves.length === 0 && merges.length === 0) {
        gridEl.classList.add(`bump-${direction}`);
        setTimeout(() => gridEl.classList.remove(`bump-${direction}`), 100);
        return; // Exit out, nothing moved
    }

    if (moves.length > 0 || merges.length > 0) {
        isAnimating = true;

        // Apply visual translations for standard moves
        moves.forEach(m => {
            tiles[m.id].r = m.toR;
            tiles[m.id].c = m.toC;
            tiles[m.id].el.style.transform = `translate(${getTranslateX(m.toC)}px, ${getTranslateY(m.toR)}px)`;
        });

        // Apply visual translations for merges
        merges.forEach(m => {
            tiles[m.movingId].el.style.transform = `translate(${getTranslateX(m.toC)}px, ${getTranslateY(m.toR)}px)`;
            // Elevate z-index so the moving tile slides "over" the static one properly
            tiles[m.movingId].el.style.zIndex = "10"; 
        });

        // Wait for CSS transition to finish before cleaning up DOM
		setTimeout(() => {
            merges.forEach(m => {
                // Update the surviving static tile
                tiles[m.staticId].val = m.newVal;
                let el = tiles[m.staticId].el;
                el.innerText = m.newVal;
                
                // NEW: Add the 'pop' class to celebrate the merge
                el.className = 'tile tile-3plus pop'; 
                setTimeout(() => el.classList.remove('pop'), 150); 
                
                // Remove the consumed tile
                tiles[m.movingId].el.remove();
                delete tiles[m.movingId];
            });

            // Spawn new tile on the edge opposite to the swipe
            let spawnCol = direction === 'ArrowLeft' ? 3 : direction === 'ArrowRight' ? 0 : null;
            let spawnRow = direction === 'ArrowUp' ? 3 : direction === 'ArrowDown' ? 0 : null;
            
            // Pick a random line that actually moved
            if (linesMoved.length > 0) {
                let randomLine = linesMoved[Math.floor(Math.random() * linesMoved.length)];
                if (spawnCol !== null) addRandomTile(randomLine, spawnCol);
                if (spawnRow !== null) addRandomTile(spawnRow, randomLine);
            }

            isAnimating = false;

            // Check for game over after animations and spawning finish
            if (checkGameOver()) {
                finalScoreEl.innerText = score;
                gameOverEl.classList.add('show');
            }
        }, 150); // Matches the 0.15s CSS transition time
    }
}

// Listen for keyboard arrow presses
window.addEventListener('keydown', e => {
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        move(e.key);
    }
});

// Theme Toggle Listener
themeToggleBtn.addEventListener('click', () => {
    isDarkMode = !isDarkMode;
    
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerText = '☀️ Light Mode';
    } else {
        document.body.classList.remove('dark-mode');
        themeToggleBtn.innerText = '🌙 Dark Mode';
    }
    
    // Save preference to local storage
    localStorage.setItem('threesDarkMode', isDarkMode);
});

// Start the game!
init();