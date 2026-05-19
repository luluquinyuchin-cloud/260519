// ============================================================
//  AI 手勢辨識剪刀石頭布遊戲 — sketch.js  (Popup Card 設計版)
// ============================================================

let video, hands, camera;
let landmarks = [];

let gameState     = 'READY';
let playerGesture = 'none';
let aiChoice      = 'none';
let roundResult   = '';
let score         = { win: 0, lose: 0, draw: 0 };
let cameraStarted = false;

let countdownTimer = 0;
let resultTimer    = 0;
const RESULT_HOLD  = 2200;

let menuGesture      = 'none';
let menuGestureStart = 0;
const MENU_HOLD_MS   = 2000;
let menuProgress     = 0;

let detectStart = 0;
const DETECT_WINDOW = 1500;

// 畫布 & 影像
let W, H, camW, camH, camX, camY;
// HUD 彈出卡片
let panelW, panelH, panelX, panelY;
// 入場動畫
let panelScale = 0.88;

// ── setup ────────────────────────────────────────────────────
function setup() {
  W = windowWidth; H = windowHeight;
  createCanvas(W, H);
  textFont('monospace');
  frameRate(60);
  recalcLayout();

  video = createCapture(VIDEO, videoReady);
  video.size(camW, camH);
  video.hide();

  hands = new Hands({
    locateFile: (file) => {
      return `libraries/mediapipe/${file}`;
    }
  });
  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.55,
    minTrackingConfidence: 0.5
  });
  hands.onResults(r => { landmarks = r.multiHandLandmarks?.[0] || []; });
}

function recalcLayout() {
  camW = W * 0.60; camH = H * 0.60;
  camX = (W - camW) / 2;
  camY = (H - camH) / 2 + 20;   // 稍微往下，留空間給卡片
  panelW = camW;
  panelH = 172;
  panelX = camX;
  panelY = camY - panelH - 12;
}

function videoReady() {
  camera = new Camera(video.elt, {
    onFrame: async () => {
      await hands.send({ image: video.elt });
    },
    width: camW,
    height: camH
  });
  camera.start()
    .then(() => { cameraStarted = true; })
    .catch(err => { console.error("攝影機啟動失敗:", err); });
}

// ── 手勢辨識 ─────────────────────────────────────────────────
function classifyGesture(lm) {
  if (!lm || lm.length < 21) return 'none';
  const tips = [8,12,16,20], mids = [6,10,14,18];
  const ext = tips.filter((t,i) => lm[t].y < lm[mids[i]].y).length;
  if (ext === 0) return 'rock';
  if (ext >= 4)  return 'paper';
  if (ext === 2 && lm[8].y < lm[6].y && lm[12].y < lm[10].y) return 'scissors';
  return 'none';
}
function classifyMenuGesture(lm) {
  if (!lm || lm.length < 21) return 'none';
  const tips = [8,12,16,20], mids = [6,10,14,18];
  const ext = tips.filter((t,i) => lm[t].y < lm[mids[i]].y).length;
  if (ext >= 4) return 'open';
  if (ext === 0) return 'fist';
  return 'none';
}

// ── draw ─────────────────────────────────────────────────────
function draw() {
  background(13, 13, 17);
  drawSubtleGrid();
  drawCameraFrame();
  drawHandOverlay();
  drawHUDPanel();
  drawSideStatus();
  drawScoreCard();
}

// 背景微網格
function drawSubtleGrid() {
  stroke(255, 255, 255, 5);
  strokeWeight(0.5);
  let step = 40;
  for (let x = 0; x < W; x += step) line(x, 0, x, H);
  for (let y = 0; y < H; y += step) line(0, y, W, y);
}

// ── 攝影機畫面（圓角 + 柔光邊框）───────────────────────────
function drawCameraFrame() {
  // 外光暈（疊多層）
  noFill();
  for (let i = 10; i > 0; i--) {
    stroke(255, 255, 255, i * 1.5);
    strokeWeight(i * 1.8);
    rect(camX, camY, camW, camH, 14);
  }

  push();
  translate(camX + camW, camY);
  scale(-1, 1);
  if (cameraStarted && video.elt.readyState >= 2) {
    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.roundRect(0, 0, camW, camH, 12);
    drawingContext.clip();
    image(video, 0, 0, camW, camH);
    drawingContext.restore();
  } else {
    // 載入中的視覺提示
    fill(30, 30, 40);
    rect(0, 0, camW, camH, 12);
    fill(255, 150);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("正在尋找攝影機並載入模型...", camW/2, camH/2);
  }
  pop();

  // 亮邊框
  noFill();
  stroke(255, 255, 255, 45);
  strokeWeight(1.5);
  rect(camX, camY, camW, camH, 14);
}

// ── 手部骨架 ─────────────────────────────────────────────────
function drawHandOverlay() {
  if (!landmarks.length) return;
  const conn = [
    [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];
  // 1. 繪製連線 (亮綠色)
  stroke(0, 255, 100); 
  strokeWeight(2.5);
  for (let [a,b] of conn) {
    line(
      camX + camW - landmarks[a].x * camW, camY + landmarks[a].y * camH,
      camX + camW - landmarks[b].x * camW, camY + landmarks[b].y * camH
    );
  }
  // 2. 繪製節點 (手腕點 0 為紅色，其餘為綠色)
  noStroke();
  for (let i = 0; i < landmarks.length; i++) {
    let x = camX + camW - landmarks[i].x * camW;
    let y = camY + landmarks[i].y * camH;
    if (i === 0) fill(255, 50, 50); // 手腕：紅色
    else fill(0, 255, 100);        // 其他：綠色
    ellipse(x, y, 8, 8);
  }
}

// ── HUD 彈出卡片（攝影機上方）───────────────────────────────
function drawHUDPanel() {
  panelScale = lerp(panelScale, 1.0, 0.10);

  push();
  // 以卡片中心做入場縮放
  let cx = panelX + panelW / 2;
  let cy = panelY + panelH / 2;
  translate(cx, cy);
  scale(panelScale);
  translate(-panelW / 2, -panelH / 2);

  drawCard(0, 0, panelW, panelH);

  if      (gameState === 'READY')     drawCardReady();
  else if (gameState === 'COUNTDOWN') drawCardCountdown();
  else if (gameState === 'DETECT')    drawCardDetect();
  else if (gameState === 'RESULT')    drawCardResult();
  else if (gameState === 'MENU')      drawCardMenu();

  pop();
}

// ── 卡片底板（毛玻璃風格）────────────────────────────────────
function drawCard(x, y, w, h, r = 16) {
  // 多層陰影
  for (let i = 18; i > 0; i--) {
    fill(0, 0, 0, i * 3.5);
    noStroke();
    rect(x - i * 0.4, y + i * 0.9, w + i * 0.8, h + i * 0.6, r + 2);
  }
  // 本體：深色半透明
  fill(18, 18, 24, 238);
  noStroke();
  rect(x, y, w, h, r);
  // 頂部高光條（給卡片「厚度感」）
  fill(255, 255, 255, 14);
  noStroke();
  rect(x + 1, y + 1, w - 2, h * 0.38, r, r, 0, 0);
  // 邊框
  noFill();
  stroke(255, 255, 255, 22);
  strokeWeight(1);
  rect(x, y, w, h, r);
}

// ── READY ────────────────────────────────────────────────────
function drawCardReady() {
  textAlign(CENTER, CENTER); noStroke();
  fill(255, 255, 255, 90); textSize(11);
  text('A I   手 勢 辨 識', panelW / 2, 26);

  // 細分隔線
  stroke(255, 255, 255, 20); strokeWeight(1);
  line(panelW * 0.2, 42, panelW * 0.8, 42); noStroke();

  fill(255); textSize(28);
  text('剪刀  ✌    石頭  ✊    布  ✋', panelW / 2, 90);

  fill(255, 255, 255, 100); textSize(11);
  text('按  SPACE  或點擊畫面開始', panelW / 2, 142);
}

// ── COUNTDOWN ────────────────────────────────────────────────
function drawCardCountdown() {
  let elapsed   = millis() - countdownTimer;
  let remaining = ceil((3000 - elapsed) / 1000);
  if (remaining <= 0) {
    gameState = 'DETECT'; detectStart = millis(); return;
  }
  textAlign(CENTER, CENTER); noStroke();
  fill(255, 255, 255, 90); textSize(11);
  text('準 備 出 拳', panelW / 2, 30);

  fill(255); textSize(88);
  text(remaining, panelW / 2, 108);
}

// ── DETECT ───────────────────────────────────────────────────
function drawCardDetect() {
  let elapsed = millis() - detectStart;
  let g = classifyGesture(landmarks);
  if (elapsed > DETECT_WINDOW) {
    playerGesture = g !== 'none' ? g : 'rock';
    aiChoice      = randomChoice();
    roundResult   = judgeRound(playerGesture, aiChoice);
    score[roundResult]++;
    resultTimer = millis(); gameState = 'RESULT'; return;
  }
  textAlign(CENTER, CENTER); noStroke();
  fill(255, 255, 255, 90); textSize(11);
  text('出  拳！', panelW / 2, 28);

  fill(255); textSize(24);
  text(gestureEmoji(g) + '  ' + gestureName(g), panelW / 2, 80);

  // 進度條底
  fill(35, 35, 45); noStroke();
  rect(40, 118, panelW - 80, 7, 4);
  // 進度
  fill(220); noStroke();
  rect(40, 118, (panelW - 80) * (elapsed / DETECT_WINDOW), 7, 4);

  fill(255, 255, 255, 60); textSize(11);
  text('辨識中，請保持手勢…', panelW / 2, 148);
}

// ── RESULT ───────────────────────────────────────────────────
function drawCardResult() {
  if (millis() - resultTimer > RESULT_HOLD) {
    menuGesture = 'none'; menuProgress = 0;
    gameState = 'MENU'; return;
  }
  const txt   = { win:'你 贏 了', lose:'你 輸 了', draw:'平 手' };
  const emoji = { win:'🎉', lose:'😢', draw:'🤝' };

  textAlign(CENTER, CENTER); noStroke();
  fill(255); textSize(22);
  text(emoji[roundResult] + '  ' + txt[roundResult], panelW / 2, 30);

  stroke(255, 255, 255, 18); strokeWeight(1);
  line(panelW * 0.15, 52, panelW * 0.85, 52); noStroke();

  // 兩欄
  fill(255, 255, 255, 70); textSize(11);
  text('AI', panelW * 0.27, 74);
  text('你', panelW * 0.73, 74);

  fill(255); textSize(40);
  text(gestureEmoji(aiChoice),      panelW * 0.27, 120);
  text(gestureEmoji(playerGesture), panelW * 0.73, 120);

  fill(255, 255, 255, 55); textSize(11);
  text(gestureName(aiChoice),      panelW * 0.27, 150);
  text(gestureName(playerGesture), panelW * 0.73, 150);

  fill(255, 255, 255, 30); textSize(14);
  text('vs', panelW * 0.5, 120);
}

// ── MENU ─────────────────────────────────────────────────────
function drawCardMenu() {
  textAlign(CENTER, CENTER); noStroke();
  fill(255, 255, 255, 90); textSize(11);
  text('繼 續 下 一 局 ？', panelW / 2, 26);

  stroke(255, 255, 255, 18); strokeWeight(1);
  line(panelW * 0.15, 42, panelW * 0.85, 42); noStroke();

  drawOptionPill(panelW * 0.28, 96, '✋', '繼續', menuGesture === 'open');
  drawOptionPill(panelW * 0.72, 96, '✊', '結束', menuGesture === 'fist');

  // 手勢偵測
  let mg = classifyMenuGesture(landmarks);
  if (mg !== 'none') {
    if (mg !== menuGesture) {
      menuGesture = mg; menuGestureStart = millis(); menuProgress = 0;
    } else {
      menuProgress = min((millis() - menuGestureStart) / MENU_HOLD_MS, 1);
      if (menuProgress >= 1) {
        if (menuGesture === 'open') { gameState = 'COUNTDOWN'; countdownTimer = millis(); }
        else { gameState = 'READY'; score = { win:0, lose:0, draw:0 }; }
        menuGesture = 'none'; menuProgress = 0; return;
      }
    }
  } else { menuGesture = 'none'; menuProgress = 0; }

  // 進度條
  if (menuGesture !== 'none') {
    let isOpen = menuGesture === 'open';
    fill(40, 40, 50); noStroke();
    rect(40, 144, panelW - 80, 7, 4);
    fill(isOpen ? color(180, 240, 210) : color(240, 110, 110)); noStroke();
    rect(40, 144, (panelW - 80) * menuProgress, 7, 4);
    fill(255, 255, 255, 90); textSize(11);
    text((isOpen ? '繼續中' : '結束中') + ' ' + floor(menuProgress * 100) + '%', panelW / 2, 164);
  } else {
    fill(255, 255, 255, 45); textSize(11);
    text('做手勢並保持靜止 2 秒', panelW / 2, 158);
  }
}

// ── 選項膠囊 ─────────────────────────────────────────────────
function drawOptionPill(cx, cy, emoji, label, active) {
  let pw = 112, ph = 52;
  push();
  translate(cx - pw / 2, cy - ph / 2);
  // 背景
  fill(active ? color(255,255,255,22) : color(28,28,36,255));
  noStroke();
  rect(0, 0, pw, ph, 12);
  // 邊框
  stroke(active ? color(255,255,255,70) : color(255,255,255,20));
  strokeWeight(1); noFill();
  rect(0, 0, pw, ph, 12);
  // 文字
  noStroke();
  fill(255, 255, 255, active ? 255 : 140);
  textAlign(CENTER, CENTER);
  textSize(20); text(emoji, pw/2, ph/2 - 7);
  textSize(11); text(label, pw/2, ph/2 + 14);
  pop();
}

// ── 左右兩側狀態顯示 ──────────────────────────────────────────
function drawSideStatus() {
  if (gameState !== 'DETECT' && gameState !== 'RESULT') return;

  push();
  textAlign(CENTER, CENTER);
  noStroke();
  let lx = camX / 2;           // 左側空白中心
  let rx = W - camX / 2;       // 右側空白中心
  let cy = camY + camH / 2;    // 攝影機垂直中心

  if (gameState === 'DETECT') {
    fill(255, 180); textSize(20);
    text('AI 思考中...', lx, cy);
  } else if (gameState === 'RESULT') {
    // 左側：AI
    fill(255, 120); textSize(14); text('AI 出拳', lx, cy - 70);
    fill(255);      textSize(80); text(gestureEmoji(aiChoice), lx, cy);
    fill(255, 180); textSize(20); text(gestureName(aiChoice), lx, cy + 70);

    // 右側：玩家
    fill(255, 120); textSize(14); text('你出拳', rx, cy - 70);
    fill(255);      textSize(80); text(gestureEmoji(playerGesture), rx, cy);
    fill(255, 180); textSize(20); text(gestureName(playerGesture), rx, cy + 70);
  }
  pop();
}

// ── 右下計分卡 ───────────────────────────────────────────────
function drawScoreCard() {
  let sw = 124, sh = 82;
  let sx = W - sw - 18, sy = H - sh - 18;
  push();
  drawCard(sx, sy, sw, sh, 12);
  textAlign(LEFT, TOP); noStroke(); textSize(13);
  fill(160, 235, 200); text(`勝  ${score.win}`,   sx + 16, sy + 12);
  fill(235, 120, 120); text(`負  ${score.lose}`,  sx + 16, sy + 36);
  fill(235, 205, 100); text(`平  ${score.draw}`,  sx + 16, sy + 58);
  pop();
}

// ── 輔助 ─────────────────────────────────────────────────────
function randomChoice() {
  return ['rock','paper','scissors'][floor(random(3))];
}
function judgeRound(p, a) {
  if (p === a) return 'draw';
  if ((p==='rock'&&a==='scissors')||(p==='scissors'&&a==='paper')||(p==='paper'&&a==='rock')) return 'win';
  return 'lose';
}
function gestureName(g) {
  return { rock:'石頭', paper:'布', scissors:'剪刀', none:'?' }[g] || g;
}
function gestureEmoji(g) {
  return { rock:'✊', paper:'✋', scissors:'✌️', none:'？' }[g] || g;
}

function keyPressed() {
  if (key === ' ' && gameState === 'READY') {
    gameState = 'COUNTDOWN'; countdownTimer = millis();
  }
}
function mousePressed() {
  if (gameState === 'READY') {
    gameState = 'COUNTDOWN'; countdownTimer = millis();
  } else if (gameState === 'MENU') {
    let pw = 112, ph = 52;
    // 判定「繼續」按鈕範圍 (✋)
    let c1x = panelX + panelW * 0.28;
    let c1y = panelY + 96;
    if (mouseX > c1x - pw/2 && mouseX < c1x + pw/2 &&
        mouseY > c1y - ph/2 && mouseY < c1y + ph/2) {
      gameState = 'COUNTDOWN';
      countdownTimer = millis();
      menuGesture = 'none'; menuProgress = 0;
    }
    // 判定「結束」按鈕範圍 (✊)
    let c2x = panelX + panelW * 0.72;
    let c2y = panelY + 96;
    if (mouseX > c2x - pw/2 && mouseX < c2x + pw/2 &&
        mouseY > c2y - ph/2 && mouseY < c2y + ph/2) {
      gameState = 'READY';
      score = { win: 0, lose: 0, draw: 0 };
      menuGesture = 'none'; menuProgress = 0;
    }
  }
}
function windowResized() {
  W = windowWidth; H = windowHeight;
  resizeCanvas(W, H);
  recalcLayout();
}