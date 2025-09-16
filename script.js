const canvas = document.getElementById('boardCanvas');
const ctx = canvas.getContext('2d');
const turnText = document.getElementById('turnText');
const currentPlayerText = document.getElementById('currentPlayerText');
const messageEl = document.getElementById('message');
const sizeSelect = document.getElementById('sizeSelect');
const restartBtn = document.getElementById('restartBtn');
const undoBtn = document.getElementById('undoBtn');
const toggleCoords = document.getElementById('toggleCoords');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const roomInfoEl = document.getElementById('roomInfo');

let gridSize = parseInt(sizeSelect.value, 10);
let cellSize = Math.floor(canvas.width / (gridSize + 1));
let padding = cellSize;

let board = [];
let moves = [];
let current = 1; // 1=black, 2=white
let myPlayer = null; // 1 or 2. 자신의 플레이어 번호
let showCoords = false;
let gameOver = false;
let gameId = null; // 현재 참여 중인 게임 ID

// 게임 상태를 파이어베이스에 업데이트
function syncGameState() {
  if (!gameId) return;
  const gameRef = database.ref('games/' + gameId);
  gameRef.update({
    board: board,
    moves: moves,
    current: current,
    gameOver: gameOver,
    winner: gameOver ? myPlayer : null
  });
}

// 파이어베이스에서 게임 상태를 받아와 로컬에 반영
function setupFirebaseListeners() {
  if (!gameId) return;
  const gameRef = database.ref('games/' + gameId);

  gameRef.on('value', (snapshot) => {
    const gameState = snapshot.val();
    if (gameState) {
      if (gameState.status === 'playing') {
        roomInfoEl.textContent = '게임 시작!';
      } else {
        roomInfoEl.textContent = '상대방을 기다리는 중... 방 ID: ' + gameId;
      }
      
      board = gameState.board || board;
      moves = gameState.moves || moves;
      current = gameState.current;
      gameOver = gameState.gameOver || false;
      
      updateTurnText();
      drawBoard();
      
      if (gameOver) {
        if (gameState.winner) {
           messageEl.textContent = (gameState.winner === 1 ? 'Black (●)' : 'White (○)') + " 승리!";
        } else {
           messageEl.textContent = "게임이 종료되었습니다.";
        }
      } else {
        messageEl.textContent = '';
      }
    }
  });

  gameRef.onDisconnect().remove();
}

function initBoard() {
  cellSize = Math.floor(canvas.width / (gridSize + 1));
  padding = cellSize;
  board = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
  moves = [];
  current = 1;
  gameOver = false;
  drawBoard();
}

function updateTurnText() {
  let playerColor = myPlayer === 1 ? '흑돌(●)' : '백돌(○)';
  turnText.textContent = current === 1 ? 'Black' : 'White';
  currentPlayerText.innerHTML = (myPlayer ? '당신: ' + playerColor + ' ' : '') + (current === myPlayer ? '차례입니다!' : '상대방 차례');
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#e6b45b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#6a4b2a";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < gridSize; i++) {
    const x = padding + i * cellSize;
    ctx.moveTo(x, padding);
    ctx.lineTo(x, padding + (gridSize - 1) * cellSize);
  }
  for (let j = 0; j < gridSize; j++) {
    const y = padding + j * cellSize;
    ctx.moveTo(padding, y);
    ctx.lineTo(padding + (gridSize - 1) * cellSize, y);
  }
  ctx.stroke();

  if (showCoords) {
    ctx.fillStyle = "#333";
    ctx.font = Math.max(10, Math.floor(cellSize * 0.35)) + "px Arial";
    for (let i = 0; i < gridSize; i++) {
      ctx.fillText(i + 1, padding + i * cellSize - 6, padding - 6);
      ctx.fillText(String.fromCharCode(65 + i), padding - 16, padding + i * cellSize + 6);
    }
  }

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const v = board[y][x];
      if (v !== 0) drawStone(x, y, v);
    }
  }
}

function drawStone(cx, cy, player) {
  const xpos = padding + cx * cellSize;
  const ypos = padding + cy * cellSize;
  const r = Math.floor(cellSize * 0.42);
  ctx.beginPath();
  ctx.arc(xpos, ypos, r, 0, Math.PI * 2);
  if (player === 1) {
    ctx.fillStyle = "#000";
    ctx.fill();
  } else {
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#666";
    ctx.stroke();
  }
}

function getCellFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const cx = padding + i * cellSize;
      const cy = padding + j * cellSize;
      if (Math.abs(cx - x) <= cellSize * 0.5 && Math.abs(cy - y) <= cellSize * 0.5) {
        return { x: i, y: j };
      }
    }
  }
  return null;
}

function placeStone(x, y) {
  if (gameOver || current !== myPlayer) return;
  if (board[y][x] !== 0) return;
  
  board[y][x] = myPlayer;
  moves.push({ x, y, player: myPlayer });
  
  if (checkWin(x, y, myPlayer)) {
    gameOver = true;
  }
  
  current = myPlayer === 1 ? 2 : 1;
  syncGameState();
}

function checkWin(x, y, player) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (const [dx, dy] of dirs) {
    let count = 1;
    let nx = x + dx, ny = y + dy;
    while (inBounds(nx, ny) && board[ny][nx] === player) { count++; nx += dx; ny += dy; }
    nx = x - dx; ny = y - dy;
    while (inBounds(nx, ny) && board[ny][nx] === player) { count++; nx -= dx; ny -= dy; }
    if (count >= 5) return true;
  }
  return false;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < gridSize && y < gridSize;
}

canvas.addEventListener('click', (e) => {
  const cell = getCellFromEvent(e);
  if (!cell) return;
  placeStone(cell.x, cell.y);
});
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const cell = getCellFromEvent(e);
  if (!cell) return;
  placeStone(cell.x, cell.y);
});

// "방 만들기" 버튼 클릭 시
createRoomBtn.addEventListener('click', () => {
    initBoard();
    const newGameRef = database.ref('games').push();
    gameId = newGameRef.key;
    myPlayer = 1; // 방을 만든 사람은 흑돌(1)
    newGameRef.set({
        board: board,
        moves: [],
        current: 1,
        player1: true,
        player2: false,
        status: 'waiting',
    });
    setupFirebaseListeners();
    updateTurnText();
    roomInfoEl.textContent = '상대방을 기다리는 중... 방 ID: ' + gameId;
    messageEl.textContent = '친구에게 방 ID를 공유해주세요!';
});

// "참여하기" 버튼 클릭 시
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('방 ID를 입력하세요.');
        return;
    }
    const gameRef = database.ref('games/' + roomId);
    gameRef.once('value', (snapshot) => {
        const gameData = snapshot.val();
        if (gameData && gameData.status === 'waiting' && !gameData.player2) {
            gameId = roomId;
            myPlayer = 2; // 방에 참여한 사람은 백돌(2)
            gameRef.update({
                player2: true,
                status: 'playing',
            }).then(() => {
                initBoard();
                setupFirebaseListeners();
                updateTurnText();
                roomInfoEl.textContent = '게임 시작!';
                messageEl.textContent = '게임이 시작되었습니다. 흑돌부터 시작합니다.';
            });
        } else {
            alert('유효하지 않은 방 ID이거나 게임이 이미 시작되었습니다.');
        }
    });
});

restartBtn.addEventListener('click', () => {
  if (gameId) {
    if (confirm('게임을 재시작하시겠습니까? 상대방에게도 영향을 줍니다.')) {
      database.ref('games/' + gameId).remove().then(() => {
        gameId = null;
        myPlayer = null;
        initBoard();
        roomInfoEl.textContent = '';
        messageEl.textContent = '';
      });
    }
  } else {
    initBoard();
  }
});

undoBtn.addEventListener('click', () => {
  if (moves.length === 0 || gameOver || current !== myPlayer) return;
  const last = moves.pop();
  board[last.y][last.x] = 0;
  current = last.player;
  gameOver = false;
  messageEl.textContent = '';
  syncGameState();
});

toggleCoords.addEventListener('click', () => { showCoords = !showCoords; drawBoard(); });
sizeSelect.addEventListener('change', () => { gridSize = parseInt(sizeSelect.value, 10); initBoard(); });

initBoard();