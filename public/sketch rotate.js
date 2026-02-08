// ---------------------------
// 外星生物 + 漂浮发光食物（彩色，多人版）- 陀螺仪控制改造版
// ---------------------------
let numPoints = 10;
let foods = [];
let maxFoods = 30;
let foodCount = 0;
// 调试用，确认myId是否正确
let debugMyId = '';

// ========== 陀螺仪控制核心全局变量 ==========
let gyroBeta = 0, gyroGamma = 0; // 陀螺仪角度（beta:前后倾斜, gamma:左右倾斜）
let smoothFactor = 0.15; // 防抖平滑系数，0~1，越小移动越平滑
let lastSendTime = 0; // 节流用：上次发送位置的时间
const SEND_INTERVAL = 30; // 节流间隔(ms)，贴合课程要求，减少联网请求
// ===========================================

// 多人联网必备（原有全局变量，需保留）
let socket;
let players = {};
let myId;
let myColor;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  // 初始化socket.io连接（多人联网核心，原有逻辑）
  socket = io();
  myColor = random(360); // 随机生成玩家颜色
  initSocketEvents(); // 初始化socket事件

  // ========== 开启陀螺仪监听 ==========
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', handleGyro);
    // 部分浏览器需要请求传感器权限
    DeviceOrientationEvent.requestPermission?.().then(permission => {
      if (permission !== 'granted') {
        alert('请开启传感器权限，否则无法使用陀螺仪控制！');
      }
    }).catch(err => console.log('传感器权限请求失败：', err));
  } else {
    alert('你的设备不支持陀螺仪，将自动切换为鼠标拖动控制');
  }
  // ====================================
}

function draw() {
  background(0, 20); // 半透明背景，保留拖影效果

  // 绘制计数文字
  drawFoodCounter();

  // 绘制所有玩家的外星生物
  for (let id in players) {
    let p = players[id];
    drawAlien(p.x, p.y, p.color, p.size);
    // 调试：当前玩家生物标红点点，确认myId对应正确
    if (id === myId) {
      fill(255, 0, 0);
      noStroke();
      ellipse(p.x, p.y, 10, 10);
    }
  }

  // 更新并绘制所有食物
  for (let i = foods.length - 1; i >= 0; i--) {
    let f = foods[i];
    // 食物漂浮+轻微晃动效果
    f.pos.x += f.vx;
    f.pos.y += f.vy;
    f.pos.x += sin(millis() * 0.001 + f.offset) * 0.2;
    f.pos.y += cos(millis() * 0.001 + f.offset) * 0.2;

    // 绘制发光渐变食物
    push();
    noStroke();
    for (let s = 5; s > 0; s--) {
      fill(f.hue, 80, 100, map(s, 5, 0, 0, 80));
      ellipse(f.pos.x, f.pos.y, f.size * s / 5);
    }
    pop();

    // 核心：碰撞检测（吃到食物计数+移除食物）
    if (myId && players[myId]) {
      let me = players[myId];
      let distance = dist(me.x, me.y, f.pos.x, f.pos.y);
      if (distance < me.size * 0.8) { // 扩大碰撞范围，提升体验
        foodCount++;
        foods.splice(i, 1);
        break;
      }
    }

    // 食物超出屏幕自动移除
    if (f.pos.x < -20 || f.pos.x > width + 20 || f.pos.y < -20 || f.pos.y > height + 20) {
      foods.splice(i, 1);
    }
  }

  // 自动生成新食物（保持数量不超过maxFoods）
  if (foods.length < maxFoods && random() < 0.02) {
    foods.push({
      pos: createVector(random(width), random(height)),
      size: random(6, 12),
      hue: random(40, 180),
      vx: random(-0.2, 0.2),
      vy: random(-0.2, 0.2),
      offset: random(1000)
    });
  }

  // ========== 陀螺仪核心：更新位置+节流发送 ==========
  if (myId && players[myId]) {
    let pos = gyroToPos(); // 陀螺仪角度转画布坐标
    // 更新本地玩家位置
    players[myId].x = pos.x;
    players[myId].y = pos.y;
    // 节流发送：每隔30ms发送一次，避免频繁联网
    let now = millis();
    if (now - lastSendTime > SEND_INTERVAL) {
      sendPosition(pos.x, pos.y);
      lastSendTime = now;
    }
  }
  // ==================================================
}

// ========== 陀螺仪事件处理（防抖+范围限制） ==========
function handleGyro(e) {
  // 防抖算法：避免生物因陀螺仪微小抖动而飘移
  gyroBeta = gyroBeta * (1 - smoothFactor) + (e.beta || 0) * smoothFactor;
  gyroGamma = gyroGamma * (1 - smoothFactor) + (e.gamma || 0) * smoothFactor;
  // 限制角度范围，避免手机过度倾斜，适配画布尺寸
  gyroBeta = constrain(gyroBeta, -90, 90);
  gyroGamma = constrain(gyroGamma, -60, 60);
}

// ========== 陀螺仪角度 → 画布坐标映射 ==========
function gyroToPos() {
  // 左右gamma(-60~60) → 画布X轴(0~width)
  let x = map(gyroGamma, -60, 60, 0, width);
  // 前后beta(-90~90) → 画布Y轴(0~height)
  let y = map(gyroBeta, -90, 90, 0, height);
  // 限制坐标在画布内，防止生物跑出屏幕
  x = constrain(x, 0, width);
  y = constrain(y, 0, height);
  return createVector(x, y);
}
// ==============================================

// 绘制吃食物计数文字（保留原有样式）
function drawFoodCounter() {
  fill(255);
  textSize(18);
  text(`吃掉：${foodCount}`, 20, 40);
  // 可选：显示当前玩家ID
  // text(`玩家ID：${myId || '未连接'}`, 20, 80);
}

// 绘制外星生物（原有核心效果，完全保留）
function drawAlien(centerX, centerY, hue, size) {
  let numPoints = 30;
  let angles = [];
  let offsets = [];

  for (let i = 0; i < numPoints; i++) {
    angles.push(TWO_PI / numPoints * i);
    offsets.push(random(1000));
  }

  // 绘制生物外轮廓（动态波动）
  stroke(hue, 80, 100, 90);
  strokeWeight(1);
  noFill();
  beginShape();
  for (let i = 0; i < numPoints; i++) {
    let angle = angles[i];
    let t = millis() * 0.0001 + offsets[i];
    let r = size + sin(t + i * 0.1) * (size * 0.3);
    let x = centerX + cos(angle) * r;
    let y = centerY + sin(angle) * r;
    curveVertex(x, y);
  }
  endShape(CLOSE);

  // 绘制生物发光点点
  for (let i = 0; i < numPoints; i += 1) {
    let angle = angles[i];
    let t = millis() * 0.002 + offsets[i];
    let r = size / 2 + sin(t * 3 + i * 0.1) * (size * 0.25);
    let x = centerX + cos(angle) * r;
    let y = centerY + sin(angle) * r;
    stroke(hue, 60, 100, 50);
    point(x, y);
  }
}

// 发送玩家位置到服务器（原有逻辑，完全保留）
function sendPosition(x, y) {
  socket.emit('playerPosition', { x: x, y: y });
}

// 初始化Socket.io事件（多人联网核心，原有逻辑，完全保留）
function initSocketEvents() {
  // 连接成功获取自身ID
  socket.on('connect', () => {
    myId = socket.id;
    debugMyId = myId;
    // 向服务器发送自身初始信息
    socket.emit('newPlayer', { color: myColor, size: random(20, 30), x: width / 2, y: height / 2 });
  });

  // 接收所有玩家信息
  socket.on('allPlayers', (data) => {
    players = data;
  });

  // 接收新玩家加入
  socket.on('newPlayerJoined', (player) => {
    players[player.id] = player;
  });

  // 接收玩家位置更新
  socket.on('playerMoved', (data) => {
    if (players[data.id]) {
      players[data.id].x = data.x;
      players[data.id].y = data.y;
    }
  });

  // 接收玩家断开连接
  socket.on('playerLeft', (id) => {
    delete players[id];
  });

  // 断开连接清空
  socket.on('disconnect', () => {
    players = {};
    myId = null;
  });
}

// 备用：鼠标拖动控制（设备不支持陀螺仪时生效）
function mouseDragged() {
  if (myId && players[myId] && !window.DeviceOrientationEvent) {
    players[myId].x = mouseX;
    players[myId].y = mouseY;
    sendPosition(mouseX, mouseY);
  }
}

// 窗口大小自适应
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}