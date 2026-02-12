let board;
let game;
let engine;
let puzzles = [];
let currentPuzzle;
let currentTheme = "wikipedia";

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
  draggable: true,
  position: "start",
  pieceTheme: function (piece) {
    return "img/chesspieces/" + currentTheme + "/" + piece + ".png";
  },
  onDrop: onDrop
});

  document.getElementById("newBtn").onclick = newGame;
  newGame();
}

  document.getElementById("themeSelect").onchange = function (e) {
    currentTheme = e.target.value;
    board.position(game.fen()); // taşları yeniden çiz
};

function newGame() {
  applyBoardTheme();
  pickRandomTheme();

  currentPuzzle = puzzles[Math.floor(Math.random() * puzzles.length)];
  game.load(currentPuzzle.fen);
  applyThemeWithFade();

  if (game.turn() === "b") {
    window.setTimeout(engineMove, 300);
  }
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

  window.setTimeout(engineMove, 300);
}

function engineMove() {
  if (checkGameEndAndRestart()) return;

  engine.postMessage("position fen " + game.fen());
  engine.postMessage("go depth 18");
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

    board.position(game.fen());

    playMoveSound(engineMoveObj);

    checkGameEndAndRestart();
  }
}

function pickRandomTheme() {
  let newTheme;
  do {
    newTheme = themes[Math.floor(Math.random() * themes.length)];
  } while (newTheme === currentTheme);

  currentTheme = newTheme;
  document.getElementById("themeSelect").value = currentTheme;

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
    message = "♟️ MAT!";
    mateSound.currentTime = 0;
    mateSound.play();
  } else if (isDraw) {
    message = "🤝 BERABERLİK";
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

function applyThemeWithFade() {
  const boardEl = document.getElementById("board");

  // fade-out
  boardEl.classList.remove("show");

  setTimeout(() => {
    board.position(game.fen());
    boardEl.classList.add("show");
  }, 400);
}

function playMoveSound(move) {
  if (!move) return;

  if (game.in_check()) {
    checkSound.currentTime = 0;
    checkSound.play();
    return;
  }

  if (move.captured) {
    captureSound.currentTime = 0;
    captureSound.play();
  } else {
    moveSound.currentTime = 0;
    moveSound.play();
  }
}