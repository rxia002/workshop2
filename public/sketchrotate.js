// ---------------------------
// 外星生物 + 漂浮发光食物（彩色，多人版）- 陀螺仪控制（修复版）
// 关键修复：
// 1) iOS 必须用户手势后 requestPermission
// 2) 不要在这里重写 sendPosition（否则会把 client.js 的正确版本覆盖掉）
// ---------------------------

let foods = [];
let maxFoods = 30;
let foodCount = 0;

// ===== 陀螺仪全局变量 =====
let gyroBeta = 0;   // 前后倾斜
let gyroGamma = 0;  // 左右倾斜
let smoothFactor = 0.15;

let lastSendTime = 0;
const SEND_INTERVAL = 30;

// 权限/支持状态
let gyroSupported = false;
let needsIOSPermission = false;
let gyroEnabled = false;

// UI 提示层
let permissionOverlay = null;

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  gyroSupported = !!window.DeviceOrientationEvent;

  if (!gyroSupported) {
    // 没陀螺仪就靠鼠标拖动（你后面 mouseDragged 有写）
    console.log("❌ 设备不支持陀螺仪，自动切换鼠标控制");
    return;
  }

  // iOS (Safari) 需要 requestPermission，且必须在用户手势里调用
  needsIOSPermission =
    typeof DeviceOrientationEvent.requestPermission === "function";

  if (needsIOSPermission) {
    // 先显示“点一下开启”的提示层
    showPermissionOverlay();
  } else {
    // Android / 其他：直接开启监听
    enableGyro();
  }
}

function draw() {
  background(0, 20);

  drawFoodCounter();

  // 绘制所有玩家外星生物
  for (let id in players) {
    let p = players[id];
    let hx = (p?.x ?? width / 2);
    let hy = (p?.y ?? height / 2);
    let hc = (p?.color ?? 200);
    let hs = (p?.size ?? 26);

    drawAlien(hx, hy, hc, hs);

    // 标记自己（红点）
    if (id === myId) {
      fill(0, 0, 100);
      noStroke();
      ellipse(hx, hy, 10, 10);
    }
  }

  // 更新并绘制食物
  for (let i = foods.length - 1; i >= 0; i--) {
    let f = foods[i];

    f.pos.x += f.vx;
    f.pos.y += f.vy;
    f.pos.x += sin(millis() * 0.001 + f.offset) * 0.2;
    f.pos.y += cos(millis() * 0.001 + f.offset) * 0.2;

    push();
    noStroke();
    for (let s = 5; s > 0; s--) {
      fill(f.hue, 80, 100, map(s, 5, 0, 0, 80));
      ellipse(f.pos.x, f.pos.y, (f.size * s) / 5);
    }
    pop();

    // 吃到食物
    if (myId && players[myId]) {
      let me = players[myId];
      let d = dist(me.x, me.y, f.pos.x, f.pos.y);
      if (d < me.size * 0.8) {
        foodCount++;
        foods.splice(i, 1);
        break;
      }
    }

    // 超出屏幕移除
    if (
      f.pos.x < -20 || f.pos.x > width + 20 ||
      f.pos.y < -20 || f.pos.y > height + 20
    ) {
      foods.splice(i, 1);
    }
  }

  // 自动生成食物
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

  // ===== 用陀螺仪控制自己的位置 + 节流发送 =====
  if (gyroEnabled && myId && players[myId]) {
    let pos = gyroToPos();
    players[myId].x = pos.x;
    players[myId].y = pos.y;

    let now = millis();
    if (now - lastSendTime > SEND_INTERVAL) {
      // 注意：这里调用的是 client.js 里的 sendPosition（emit 'update'）
      sendPosition(pos.x, pos.y);
      lastSendTime = now;
    }
  }

  // 如果还没开权限，屏幕上给一点提示（不挡画面）
  if (needsIOSPermission && !gyroEnabled) {
    push();
    fill(0, 0, 100, 80);
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text("点一下屏幕开启陀螺仪（iPhone 必须授权）", width / 2, height - 30);
    pop();
  }
}

// ====================== iOS 权限逻辑 ======================
// p5 的 touchStarted 是“用户手势”，iOS 允许在这里 requestPermission
function touchStarted() {
  if (!gyroSupported) return;

  if (needsIOSPermission && !gyroEnabled) {
    DeviceOrientationEvent.requestPermission()
      .then((res) => {
        if (res === "granted") {
          hidePermissionOverlay();
          enableGyro();
          console.log("✅ 陀螺仪权限已开启");
        } else {
          console.log("❌ 用户拒绝陀螺仪权限");
        }
      })
      .catch((err) => {
        console.log("❌ requestPermission 失败：", err);
      });
  }

  // 防止 iOS 触摸触发页面滚动（你 HTML 里也写了 touch-action:none）
  return false;
}

function enableGyro() {
  window.addEventListener("deviceorientation", handleGyro, true);
  gyroEnabled = true;
}

function handleGyro(e) {
  // 平滑滤波 + 默认值兜底
  let b = (typeof e.beta === "number") ? e.beta : 0;
  let g = (typeof e.gamma === "number") ? e.gamma : 0;

  gyroBeta = gyroBeta * (1 - smoothFactor) + b * smoothFactor;
  gyroGamma = gyroGamma * (1 - smoothFactor) + g * smoothFactor;

  gyroBeta = constrain(gyroBeta, -90, 90);
  gyroGamma = constrain(gyroGamma, -60, 60);
}

function gyroToPos() {
  let x = map(gyroGamma, -60, 60, 0, width);
  let y = map(gyroBeta, -90, 90, 0, height);
  return createVector(constrain(x, 0, width), constrain(y, 0, height));
}

// ====================== UI 覆盖层 ======================
function showPermissionOverlay() {
  permissionOverlay = createDiv("点一下屏幕开启陀螺仪<br>(iPhone 需要授权)");
  permissionOverlay.style("position", "fixed");
  permissionOverlay.style("left", "0");
  permissionOverlay.style("top", "0");
  permissionOverlay.style("width", "100vw");
  permissionOverlay.style("height", "100vh");
  permissionOverlay.style("display", "flex");
  permissionOverlay.style("align-items", "center");
  permissionOverlay.style("justify-content", "center");
  permissionOverlay.style("text-align", "center");
  permissionOverlay.style("font-size", "20px");
  permissionOverlay.style("line-height", "1.4");
  permissionOverlay.style("color", "white");
  permissionOverlay.style("background", "rgba(0,0,0,0.7)");
  permissionOverlay.style("z-index", "9999");
  permissionOverlay.style("cursor", "pointer");

  // ✅ 关键：点遮罩本身就触发授权（因为遮罩挡住了canvas）
  const request = () => {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      DeviceOrientationEvent.requestPermission()
        .then((res) => {
          if (res === "granted") {
            hidePermissionOverlay();
            enableGyro();
            console.log("✅ 陀螺仪权限已开启");
          } else {
            console.log("❌ 用户拒绝陀螺仪权限");
          }
        })
        .catch((err) => console.log("❌ requestPermission 失败：", err));
    } else {
      // Android / 非 iOS
      hidePermissionOverlay();
      enableGyro();
    }
  };

  // iOS 认 “触摸/点击” 都算用户手势
  permissionOverlay.elt.addEventListener("click", request, { once: true });
  permissionOverlay.elt.addEventListener("touchend", request, { once: true });
}


function hidePermissionOverlay() {
  if (permissionOverlay) {
    permissionOverlay.remove();
    permissionOverlay = null;
  }
}

// ====================== 原有函数：计数/外星生物 ======================
function drawFoodCounter() {
  fill(0, 0, 100);
  textSize(18);
  textAlign(LEFT, TOP);
  text(`吃掉：${foodCount}`, 20, 20);
}

function drawAlien(centerX, centerY, hue, size) {
  let numPoints = 30;
  let angles = [];
  let offsets = [];

  for (let i = 0; i < numPoints; i++) {
    angles.push((TWO_PI / numPoints) * i);
    offsets.push(random(1000));
  }

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

// 备用：鼠标拖动控制（没陀螺仪时）
function mouseDragged() {
  if (myId && players[myId] && !gyroSupported) {
    players[myId].x = mouseX;
    players[myId].y = mouseY;
    sendPosition(mouseX, mouseY);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
