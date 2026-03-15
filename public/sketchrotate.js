// Food system
let foods = [];
let maxFoods = 30;
let foodCount = 0;

// Gyroscope control variables
// Device orientation values
let gyroBeta = 0;   // front/back tilt
let gyroGamma = 0;  // left/right tilt
let smoothFactor = 0.15;

let lastSendTime = 0;
const SEND_INTERVAL = 30;

let targetMouseX = 0;
let targetMouseY = 0;

// Gyroscope capability flags
let gyroSupported = false; // Whether the device supports DeviceOrientationEvent
let needsIOSPermission = false; // Whether IOS requires permission for the gyroscope
let gyroEnabled = false; // Whther the gyroscope is currently active
let isTouchDevice = false;

// Permission UI overlay
let permissionOverlay = null;


function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);

  targetMouseX = width / 2;
  targetMouseY = height / 2;

  // Check whether this is a touch device
  isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // Check whether this broswer supports device orientation sensors
  gyroSupported = !!window.DeviceOrientationEvent;

  if(!isTouchDevice){
    console.log("Desktop detected. Mouse control will be used.");
    return;
  }

  if (!gyroSupported) {
    console.log("❌ Device does not support gyrscoepe and mouse control will be used.");
    return;
  }

  // iOS Safari requires permission from a user gesture
  needsIOSPermission =
    typeof DeviceOrientationEvent.requestPermission === "function";

  if (needsIOSPermission) {
    showPermissionOverlay();
  } else {
    // Android and others browsers can enable directly
    enableGyro();
  }
}

function draw() {
  background(0, 20);

  drawFoodCounter();

  drawPlayers();
  updateAndDrawFoods();
  updateGyroControl();
  updateMouseControl();

  // Show a small instruction if iOS permission has not been granted yet
  if (needsIOSPermission && !gyroEnabled){
    push();
    fill(0, 0, 100, 80);
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text(
      "Tap the scrren to enable gyroscope",
      width / 2,
      height - 30
    );
    pop();
  }
}

// Draw all Players
function drawPlayers(){
  for(let id in players) {
    let p = players[id];

    let hx = p?.x ?? width / 2;
    let hy = p?.y ?? height / 2;
    let hc = p?.color ?? 200;
    let hs = p?.size ?? 26;

    drawAlien(hx, hy, hc, hs);

    if (id === myId){
      fill(0, 0, 100);
      noStroke();
      ellipse(hx, hy, 10, 10);
    }
  }
}

// Draw new food and update
function updateAndDrawFoods(){
  // update existing foods from back to front
  for(let i = foods.length - 1; i >=0; i--){
    let f = foods[i];

    // Slow drifting movement
    f.pos.x += f.vx;
    f.pos.y += f.vy;

    // Small floating motion
    f.pos.x += sin(millis() * 0.001 + f.offset) * 0.2;
    f.pos.y += cos(millis() * 0.001 + f.offset) * 0.2;

    // Draw glowing layered circles
    push();
    noStroke();
    for(let s = 5; s > 0; s--){
      fill(f.hue, 80, 100, map(s, 5, 0, 0, 80));
      ellipse(f.pos.x, f.pos.y, (f.size * s) / 5);
    }
    pop();

    // Check if the local player eats the food
    if(myId && players[myId]){
      let me = players[myId];
      let d = dist(me.x, me.y, f.pos.x, f.pos.y);

      if(d < me.size * 0.8){
        foodCount++;
        foods.splice(i, 1);
        break;
      }
    }

    // Remove food if it goes off-screen
    if(
      f.pos.x < -20 || f.pos.x > width + 20 ||
      f.pos.y < -20 || f.pos.y > height + 20
    ){
      foods.splice(i, 1);
    }
  }

  // Spawn new food if there are too few particles
  if(foods.length < maxFoods && random() < 0.02){
    foods.push({
      pos: createVector(random(width), random(height)),
      size: random(6, 12),
      hue: random(40, 180),
      vx: random(-0.2, 0.2),
      vy: random(-0.2, 0.2),
      offset: random(1000)
    });
  }
}

// Control System: Phones use gyroscope, and computers follow the mouse
function updateGyroControl(){
  // Only run if gyroscope control is active
  if(!gyroEnabled) return;

  // Make sure local player exist
  if(!myId || !players[myId]) return;

  // Convert device tilt into screen coordinates
  let pos = gyroToPos();

  // Update local player position immediately
  players[myId].x = pos.x;
  players[myId].y = pos.y;

  // Send position update to the server at a limited rate
  let now = millis();
  if(now - lastSendTime > SEND_INTERVAL){
    sendPosition(pos.x, pos.y);
    lastSendTime = now;
  }
}

// iOS Permission logic
function touchStarted() {
  if (!gyroSupported) return;

  // On iOS, permission must be requested after a user gesture
  if (needsIOSPermission && !gyroEnabled) {
    DeviceOrientationEvent.requestPermission()
      .then((res) => {
        if (res === "granted") {
          hidePermissionOverlay();
          enableGyro();
          console.log("✅ Gyroscope permission granted");
        } else {
          console.log("❌ User denied gyroscope permission");
        }
      })
      .catch((err) => {
        console.log("❌ requestPermission failed：", err);
      });
  }

  return false;
}

// Enable Gyroscope
function enableGyro() {
  window.addEventListener("deviceorientation", handleGyro, true);
  gyroEnabled = true;
}

// Handle Gyroscope data
function handleGyro(e) {
  // Use 0 if sensor values are missing
  let b = (typeof e.beta === "number") ? e.beta : 0;
  let g = (typeof e.gamma === "number") ? e.gamma : 0;

  // Smooth values to reduce sudden jumps
  gyroBeta = gyroBeta * (1 - smoothFactor) + b * smoothFactor;
  gyroGamma = gyroGamma * (1 - smoothFactor) + g * smoothFactor;

  // Keep values within a useful range
  gyroBeta = constrain(gyroBeta, -90, 90);
  gyroGamma = constrain(gyroGamma, -60, 60);
}

// Convert gyro values to screen position
function gyroToPos() {
  let x = map(gyroGamma, -60, 60, 0, width);
  let y = map(gyroBeta, -90, 90, 0, height);
  return createVector(constrain(x, 0, width), constrain(y, 0, height));
}

// Permission overlay UI
function showPermissionOverlay() {
  permissionOverlay = createDiv("Tap the screen to enable gyroscope<br>(iPhone requires permission)");
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
            console.log("✅ Gyroscope enabled");
          } else {
            console.log("❌ User denied permission");
          }
        })
        .catch((err) => console.log("❌ requestPermission failed：", err));
    } else {
      // Non-iOS devices can enable directly
      hidePermissionOverlay();
      enableGyro();
    }
  };

  permissionOverlay.elt.addEventListener("click", request, { once: true });
  permissionOverlay.elt.addEventListener("touchend", request, { once: true });
}


function hidePermissionOverlay() {
  if (permissionOverlay) {
    permissionOverlay.remove();
    permissionOverlay = null;
  }
}

// Score display
function drawFoodCounter() {
  fill(0, 0, 100);
  textSize(18);
  textAlign(LEFT, TOP);
  text(`Consumed：${foodCount}`, 20, 20);
}

// Drawing Alien
function drawAlien(centerX, centerY, hue, size) {
  let numPoints = 30;
  let angles = [];
  let offsets = [];

  for (let i = 0; i < numPoints; i++) {
    angles.push((TWO_PI / numPoints) * i);
    offsets.push(random(1000));
  }

  // Outer wavy outline
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

  // Inner sparkling points
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

function updateMouseControl(){
  // Only use mouse control when gyroscope is not enabled
  if(gyroEnabled) return;

  // Make sure the local player exists
  if(!myId || !players[myId]) return;

  // Smoothly move the player toward the mouse position
  players[myId].x = lerp(players[myId].x, targetMouseX, 0.1);
  players[myId].y = lerp(players[myId].y, targetMouseY, 0.1);

  // Send the smoothed position to the server
  let now = millis();
  if(now - lastSendTime > SEND_INTERVAL){
    sendPosition(players[myId].x, players[myId].y);
    lastSendTime = now;
  }
}

function mouseMoved(){
  targetMouseX = constrain(mouseX, 0, width);
  targetMouseY = constrain(mouseY, 0, height);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
