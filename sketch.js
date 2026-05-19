// ============================================================
//  AI 手勢辨識剪刀石頭布遊戲 — sketch.js
//  攝影機影像顯示於畫布中央（60% 寬高）
//  繼續/結束手勢：✋ 張開手掌靜止 2 秒 = 繼續 | ✊ 握拳靜止 2 秒 = 結束
// ============================================================

// ── 全域狀態 ─────────────────────────────────────────────────
let video;
let hands;
let camera;
let landmarks = [];

// 遊戲狀態機
// 'READY' → 'COUNTDOWN' → 'DETECT' → 'RESULT' → 'MENU'
let gameState = 'READY';
let playerGesture = 'none';   // scissors / rock / paper
let aiChoice     = 'none';
let roundResult  = '';        // win / lose / draw
let score        = { win: 0, lose: 0, draw: 0 };

// 倒數計時
let countdownVal = 3;
let countdownTimer = 0;

// 遊戲結果停留
let resultTimer = 0;
const RESULT_HOLD = 2000; // ms

// 選單手勢（繼續/結束）
let menuGesture      = 'none';   // 'open' | 'fist' | 'none'
let menuGestureStart = 0;
const MENU_HOLD_MS   = 2000;     // 需靜止 2 秒
let menuProgress     = 0;        // 0~1 進度條

// 畫布
let W, H;
let camW, camH;   // 顯示影像大小 (60%)
let camX, camY;   // 影像左上角

// ── p5 setup ─────────────────────────────────────────────────
function setup() {
  W = windowWidth;
  H = windowHeight;
  createCanvas(W, H);
  textFont('monospace');

  camW = W * 0.60;
  camH = H * 0.60;
  camX = (W - camW) / 2;
  camY = (H - camH) / 2;

  // 建立隱藏 video 元素
  video = createCapture(VIDEO, videoReady);
  video.size(640, 480);
  video.hide();

  // MediaPipe Hands 初始化
  hands = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6
  });
  hands.onResults(onHandResults);
}

function videoReady() {
  camera = new Camera(video.elt, {
    onFrame: async () => { await hands.send({ image: video.elt }); },
    width: 640,
    height: 480
  });
  camera.start();
}

// ── MediaPipe 回呼 ────────────────────────────────────────────
function onHandResults(results) {
  landmarks = results.multiHandLandmarks?.[0] || [];
}

// ── 手勢辨識 ─────────────────────────────────────────────────
function classifyGesture(lm) {
  if (!lm || lm.length < 21) return 'none';

  const fingerTips  = [8, 12, 16, 20];
  const fingerMids  = [6, 10, 14, 18];
  const thumbTip    = lm[4];
  const thumbBase   = lm[2];

  const extCount = fingerTips.filter((tip, i) =>
    lm[tip].y < lm[fingerMids[i]].y
  ).length;

  const thumbOut = thumbTip.x < thumbBase.x;  // 右手

  if (extCount === 0) return 'rock';
  if (extCount >= 4)  return 'paper';
  if (extCount === 2 && lm[8].y < lm[6].y && lm[12].y < lm[10].y) return 'scissors';
  return 'none';
}

// 選單手勢：open=5指伸展, fist=0指伸展
function classifyMenuGesture(lm) {
  if (!lm || lm.length < 21) return 'none';
  const fingerTips = [8, 12, 16, 20];
  const fingerMids = [6, 10, 14, 18];
  const ext = fingerTips.filter((tip, i) => lm[tip].y < lm[fingerMids[i]].y).length;
  if (ext >= 4) return 'open';
  if (ext === 0) return 'fist';
  return 'none';
}

// ── 主繪圖迴圈 ───────────────────────────────────────────────
function draw() {
  background(10, 10, 20);

  drawCamera();
  drawHandOverlay();

  if      (gameState === 'READY')     drawReady();
  else if (gameState === 'COUNTDOWN') drawCountdown();
  else if (gameState === 'DETECT')    drawDetect();
  else if (gameState === 'RESULT')    drawResult();
  else if (gameState === 'MENU')      drawMenu();
}

// ── 攝影機畫面（中央 60%）────────────────────────────────────
function drawCamera() {
  push();
  // 鏡像翻轉（selfie 模式）
  translate(camX + camW, camY);
  scale(-1, 1);
  if (video.loadedmetadata || video.elt.readyState >= 2) {
    image(video, 0, 0, camW, camH);
  }
  pop();

  // 邊框
  noFill();
  stroke(0, 220, 180);
  strokeWeight(2);
  rect(camX, camY, camW, camH, 8);
}

// ── 手部骨架疊加 ─────────────────────────────────────────────
function drawHandOverlay() {
  if (!landmarks.length) return;

  const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
  ];

  stroke(0, 255, 180, 160);
  strokeWeight(1.5);
  for (let [a, b] of connections) {
    const ax = camX + camW - landmarks[a].x * camW;
    const ay = camY + landmarks[a].y * camH;
    const bx = camX + camW - landmarks[b].x * camW;
    const by = camY + landmarks[b].y * camH;
    line(ax, ay, bx, by);
  }

  noStroke();
  fill(0, 255, 180);
  for (let lm of landmarks) {
    const px = camX + camW - lm.x * camW;
    const py = camY + lm.y * camH;
    ellipse(px, py, 6, 6);
  }
}

// ── READY 畫面 ───────────────────────────────────────────────
function drawReady() {
  drawScoreboard();
  drawTitle('剪刀石頭布', '按 SPACE 開始');

  fill(255);
  textSize(14);
  textAlign(CENTER, CENTER);
  text('[ 鍵盤 SPACE 或點擊畫面開始 ]', W/2, H * 0.88);
}

// ── 倒數 ─────────────────────────────────────────────────────
function drawCountdown() {
  let elapsed = millis() - countdownTimer;
  let remaining = ceil((3000 - elapsed) / 1000);

  if (remaining <= 0) {
    gameState = 'DETECT';
    detectStart = millis();
    return;
  }

  drawScoreboard();

  // 大倒數數字
  push();
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(120);
  text(remaining, W/2, H * 0.12);
  fill(255);
  textSize(22);
  text('準備出拳！', W/2, H * 0.22);
  pop();
}

let detectStart = 0;
const DETECT_WINDOW = 1500; // ms 內鎖定手勢

// ── 辨識中 ───────────────────────────────────────────────────
function drawDetect() {
  let elapsed = millis() - detectStart;
  let g = classifyGesture(landmarks);

  if (elapsed > DETECT_WINDOW) {
    // 時間到，鎖定
    playerGesture = (g !== 'none') ? g : 'rock';
    aiChoice      = randomChoice();
    roundResult   = judgeRound(playerGesture, aiChoice);
    score[roundResult]++;
    resultTimer = millis();
    gameState   = 'RESULT';
    return;
  }

  drawScoreboard();
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(28);
  text('出拳！', W/2, H * 0.12);

  fill(255);
  textSize(20);
  text('目前偵測：' + gestureName(g), W/2, H * 0.19);

  // 進度條
  let prog = elapsed / DETECT_WINDOW;
  noFill();
  stroke(100);
  strokeWeight(4);
  rect(camX, camY + camH + 16, camW, 10, 5);
  fill(50, 220, 140);
  noStroke();
  rect(camX, camY + camH + 16, camW * prog, 10, 5);
}

// ── 結果 ─────────────────────────────────────────────────────
function drawResult() {
  if (millis() - resultTimer > RESULT_HOLD) {
    menuGesture      = 'none';
    menuGestureStart = 0;
    menuProgress     = 0;
    gameState = 'MENU';
    return;
  }

  drawScoreboard();

  const resultText = { win: '🎉 你贏了！', lose: '😢 你輸了！', draw: '🤝 平手！' };
  const resultColor = { win: [50, 255, 120], lose: [255, 80, 80], draw: [255, 200, 50] };

  push();
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(52);
  text(resultText[roundResult], W/2, H * 0.12);

  fill(255);
  textSize(26);
  text(`你：${gestureName(playerGesture)}   vs   AI：${gestureName(aiChoice)}`, W/2, H * 0.22);
  pop();
}

// ── 繼續/結束選單 ────────────────────────────────────────────
function drawMenu() {
  drawScoreboard();

  push();
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(30);
  text('遊戲暫停', W/2, H * 0.10);

  // 左側說明
  fill(255);
  textSize(18);
  text('✋ 張開手掌  →  繼續', W/2 - 120, H * 0.18);
  text('✊ 握拳        →  結束', W/2 + 120, H * 0.18);

  pop();

  // 偵測選單手勢
  let mg = classifyMenuGesture(landmarks);

  if (mg !== 'none') {
    if (mg !== menuGesture) {
      menuGesture      = mg;
      menuGestureStart = millis();
      menuProgress     = 0;
    } else {
      menuProgress = min((millis() - menuGestureStart) / MENU_HOLD_MS, 1);
      if (menuProgress >= 1) {
        if (menuGesture === 'open') {
          gameState = 'COUNTDOWN';
          countdownTimer = millis();
        } else {
          gameState = 'READY';
          score = { win: 0, lose: 0, draw: 0 };
        }
        menuGesture  = 'none';
        menuProgress = 0;
        return;
      }
    }
  } else {
    menuGesture  = 'none';
    menuProgress = 0;
  }

  // 進度條
  if (menuGesture !== 'none') {
    let barColor = menuGesture === 'open' ? [50, 255, 180] : [255, 80, 80];
    let label    = menuGesture === 'open' ? '繼續中…' : '結束中…';

    noFill();
    stroke(60);
    strokeWeight(6);
    rect(camX, camY + camH + 16, camW, 14, 7);

    fill(...barColor);
    noStroke();
    rect(camX, camY + camH + 16, camW * menuProgress, 14, 7);

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    noStroke();
    text(label + ' ' + floor(menuProgress * 100) + '%', W/2, camY + camH + 42);
  } else {
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(15);
    noStroke();
    text('請做出手勢後保持靜止 2 秒', W/2, camY + camH + 42);
  }
}

// ── UI 元件 ──────────────────────────────────────────────────
function drawScoreboard() {
  push();
  fill(20, 30, 40, 200);
  noStroke();
  rect(W - 180, 10, 168, 80, 10);

  textAlign(LEFT, TOP);
  textSize(15);
  fill(255);
  text(`勝：${score.win}`, W - 160, 22);
  text(`負：${score.lose}`, W - 160, 42);
  text(`平：${score.draw}`, W - 160, 62);
  pop();
}

function drawTitle(title, sub) {
  push();
  textAlign(CENTER, CENTER);
  fill(255);
  textSize(36);
  text(title, W/2, H * 0.10);
  fill(255);
  textSize(18);
  text(sub, W/2, H * 0.17);
  pop();
}

// ── 輔助函式 ─────────────────────────────────────────────────
function randomChoice() {
  return ['rock', 'paper', 'scissors'][floor(random(3))];
}

function judgeRound(p, a) {
  if (p === a) return 'draw';
  if ((p === 'rock'     && a === 'scissors') ||
      (p === 'scissors' && a === 'paper')    ||
      (p === 'paper'    && a === 'rock'))    return 'win';
  return 'lose';
}

function gestureName(g) {
  return { rock: '✊ 石頭', paper: '✋ 布', scissors: '✌ 剪刀', none: '❓' }[g] || g;
}

// ── 鍵盤 / 滑鼠觸發 ─────────────────────────────────────────
function keyPressed() {
  if (key === ' ' && (gameState === 'READY')) {
    gameState      = 'COUNTDOWN';
    countdownTimer = millis();
  }
}

function mousePressed() {
  if (gameState === 'READY') {
    gameState      = 'COUNTDOWN';
    countdownTimer = millis();
  }
}

function windowResized() {
  W = windowWidth; H = windowHeight;
  resizeCanvas(W, H);
  camW = W * 0.60; camH = H * 0.60;
  camX = (W - camW) / 2; camY = (H - camH) / 2;
}