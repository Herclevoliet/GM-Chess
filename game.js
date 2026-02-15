let playerColor = "w";
let board;
let game;
let engine;
let puzzles = [];
let currentPuzzle;
let selectedSquare = null;
let lastMove = null;
let currentTheme = "wikipedia";
let puzzleHistory = [];
let currentPuzzleIndex = -1;

const moveSound = new Audio("sounds/move.mp3");
const captureSound = new Audio("sounds/capture.mp3");
const checkSound = new Audio("sounds/check.mp3");
const mateSound = new Audio("sounds/mate.mp3");

const themes = [
  "wikipedia",
  "alpha",
  "uscf",
];

const boardThemes = [
  "board-color-1",
  "board-color-2",
  "board-color-3",
  "board-color-4"
];

let currentBoardTheme = null;

function pickRandomBoardTheme() {
  let newTheme;
  do {
    newTheme = boardThemes[Math.floor(Math.random() * boardThemes.length)];
  } while (newTheme === currentBoardTheme);

  currentBoardTheme = newTheme;
  return newTheme;
}

function applyBoardTheme() {
    const boardContainer = document.getElementById("board");
    boardContainer.classList.remove(...boardThemes);
    boardContainer.classList.add(pickRandomBoardTheme());
}

fetch("puzzles.json")
  .then(res => res.json())
  .then(data => {
    puzzles = data;
    initGame();
  });

function initGame() {
  game = new Chess();
  engine = new Worker("engine/stockfish-17.1-single-a496a04.js");

  engine.onmessage = handleEngineMessage;

  engine.postMessage("uci");
  engine.postMessage("isready");

board = Chessboard("board", {
  draggable: false,
  position: "start",
  pieceTheme: function (piece) {
    return "img/chesspieces/" + currentTheme + "/" + piece + ".png";
  }
});

  newGame();
}

document.getElementById("board").addEventListener("click", function (e) {
  const squareEl = e.target.closest(".square-55d63");
  if (!squareEl) return;

  const square = squareEl.getAttribute("data-square");
  if (!square) return;

  onSquareClick(square);
});

function newGame() {
  applyBoardTheme();
  pickRandomTheme();

  currentPuzzleIndex = Math.floor(Math.random() * puzzles.length);
  currentPuzzle = puzzles[currentPuzzleIndex];

  puzzleHistory.push(currentPuzzleIndex);

  loadPuzzle(currentPuzzle);
}

function loadPuzzle(puzzle) {
  game = new Chess();
  game.load(puzzle.fen);

  playerColor = game.turn();

  board.position(game.fen());

  if (playerColor === "w") {
    board.orientation("white");
  } else {
    board.orientation("black");
  }

  applyThemeWithFade();
}

function onDrop(source, target) {
  let move = game.move({
    from: source,
    to: target,
    promotion: "q"
  });

  if (move === null) return "snapback";

  board.position(game.fen());

  playMoveSound(move);

  if (checkGameEndAndRestart()) return;

  window.setTimeout(engineMove, 500);
}

function engineMove() {
  if (game.turn() === playerColor) return;
  if (checkGameEndAndRestart()) return;

  engine.postMessage("position fen " + game.fen());
  engine.postMessage("go depth 10");
}

function handleEngineMessage(e) {
  console.log("ENGINE:", e.data);
  if (typeof e.data !== "string") return;

  if (e.data.startsWith("bestmove")) {
    let move = e.data.split(" ")[1];
    if (move === "(none)") return;

    const engineMoveObj = game.move({
      from: move.substring(0, 2),
      to: move.substring(2, 4),
      promotion: "q"
    });

  lastMove = engineMoveObj;

  board.position(game.fen());
  playMoveSound(engineMoveObj);

  highlightLastMove();

  if (checkGameEndAndRestart()) return;

  handleCheckState();   
  }
}

function pickRandomTheme() {
  let newTheme;
  do {
    newTheme = themes[Math.floor(Math.random() * themes.length)];
  } while (newTheme === currentTheme);

  currentTheme = newTheme;

  applyThemeWithFade();
}

function checkGameEndAndRestart() {
  if (!game.game_over()) return false;

  const isMate = game.in_checkmate();
  const isDraw =
    game.in_draw() ||
    game.in_stalemate() ||
    game.in_threefold_repetition() ||
    game.insufficient_material();

  let message = "";

  if (isMate) {
    message = "♟️ MATE!";
    mateSound.currentTime = 0;
    mateSound.play();
  } else if (isDraw) {
    message = "🤝 DRAW!";
  } else {
    return false;
  }

  showMessage(message);

  setTimeout(() => {
    hideMessage();
    newGame();
  }, 1200);

  return true;
}

function showMessage(text) {
  const msg = document.getElementById("gameMessage");
  msg.textContent = text;
  msg.classList.add("show");
}

function hideMessage() {
  const msg = document.getElementById("gameMessage");
  msg.classList.remove("show");
}

function handleCheckState() {
  console.log("CHECK?", game.in_check?.(), game.isCheck?.());

  if (
    (game.in_check && game.in_check()) ||
    (game.isCheck && game.isCheck())
  ) {
    console.log("CHECK DETECTED");
    checkSound.currentTime = 0;
    checkSound.play();
    showTemporaryMessage("⚠️ CHECK!", 900);
  }
}

function showTemporaryMessage(text, duration = 800) {
  showMessage(text);

  setTimeout(() => {
    hideMessage();
  }, duration);
}

function applyThemeWithFade() {
  const boardEl = document.getElementById("board");

  boardEl.classList.remove("show");

  setTimeout(() => {
    board.position(game.fen());
    boardEl.classList.add("show");
  }, 400);
}

function playMoveSound(move) {
  if (!move) return;

  if (move.captured) {
    captureSound.currentTime = 0;
    captureSound.play();
  } else {
    moveSound.currentTime = 0;
    moveSound.play();
  }
}

function restartGame() {
  console.log("Restart clicked");

  if (!currentPuzzle) return;

  engine.terminate();

  engine = new Worker("engine/stockfish-17.1-single-a496a04.js");
  engine.onmessage = handleEngineMessage;
  engine.postMessage("uci");
  engine.postMessage("isready");

  game = new Chess();
  game.load(currentPuzzle.fen);
  
  playerColor = game.turn();

  if (playerColor === "w") {
    board.orientation("white");
  } else {
    board.orientation("black");
}

  board.position(currentPuzzle.fen);
}

function onSquareClick(square) {
  const piece = game.get(square);

  if (!selectedSquare) {
    if (!piece || piece.color !== playerColor) return;

    selectSquare(square);
    return;
  }

  if (piece && piece.color === playerColor) {
    selectSquare(square);
    return;
  }

  const move = game.move({
    from: selectedSquare,
    to: square,
    promotion: "q"
  });

  if (!move) return;

  lastMove = move;

  board.position(game.fen());
  playMoveSound(move);

  clearSelection();
  highlightLastMove();

  if (checkGameEndAndRestart()) return;

  handleCheckState();   
  setTimeout(engineMove, 900);
}

function highlightSquare(square) {
  const squareEl = document.querySelector(`#board .square-${square}`);
  if (squareEl) {
    squareEl.style.boxShadow = "inset 0 0 10px 4px rgba(255,255,0,0.7)";
  }
}

function selectSquare(square) {
  clearSelection();
  selectedSquare = square;

  highlightSelected(square);
  highlightLegalMoves(square);
}

function clearSelection() {
  selectedSquare = null;
  document.querySelectorAll(".square-55d63").forEach(el => {
    el.classList.remove("selected-square");
    el.classList.remove("legal-move");
    el.classList.remove("pulse");
  });
}

function highlightLegalMoves(square) {
  const moves = game.moves({
    square: square,
    verbose: true
  });

  moves.forEach(move => {
    const squareEl = document.querySelector(
      `#board .square-${move.to}`
    );
    if (squareEl) {
      squareEl.classList.add("legal-move");
    }
  });
}

function highlightSelected(square) {
  const squareEl = document.querySelector(
    `#board .square-${square}`
  );

  if (!squareEl) return;

  squareEl.classList.add("selected-square");

  const piece = game.get(square);
  if (piece) {
    squareEl.classList.add("pulse");
  }
}

function highlightLastMove() {
  if (!lastMove) return;

  clearLastMoveHighlight();

  const fromEl = document.querySelector(
    `#board .square-${lastMove.from}`
  );
  const toEl = document.querySelector(
    `#board .square-${lastMove.to}`
  );

  if (fromEl) fromEl.classList.add("last-move");
  if (toEl) toEl.classList.add("last-move");
}

function clearHighlights() {
  document.querySelectorAll("#board .square-55d63").forEach(el => {
    el.style.boxShadow = "";
  });
}

document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM ready");

  const newBtn = document.getElementById("newBtn");
  const restartBtn = document.getElementById("restartBtn");
  const flipBtn = document.getElementById("flipBtn");
  const prevBtn = document.getElementById("prevBtn");

  console.log("Buttons:", newBtn, restartBtn);

  newBtn.addEventListener("click", newGame);
  restartBtn.addEventListener("click", restartGame);
  flipBtn.addEventListener("click", switchSide);
  prevBtn.addEventListener("click", loadPreviousPuzzle);
});

window.addEventListener("resize", function () {
  if (board) board.resize();
});

function switchSide() {
  playerColor = playerColor === "w" ? "b" : "w";

  if (playerColor === "w") {
    board.orientation("white");
  } else {
    board.orientation("black");
  }

  setTimeout(engineMove, 400);
}

function loadPreviousPuzzle() {
  if (puzzleHistory.length < 2) return;

  puzzleHistory.pop();

  const prevIndex = puzzleHistory[puzzleHistory.length - 1];
  currentPuzzleIndex = prevIndex;
  currentPuzzle = puzzles[prevIndex];

  loadPuzzle(currentPuzzle);
}

function clearLastMoveHighlight() {
  document.querySelectorAll("#board .last-move").forEach(el => {
    el.classList.remove("last-move");
  });
}
