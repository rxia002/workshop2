// ---------------------------
// 外星生物 + 漂浮发光食物（彩色，多人版）
// ---------------------------

let numPoints = 10;       
let foods = [];           
let maxFoods = 30;        
let foodCount = 0;        
// 新增：调试用，确认myId是否正确
let debugMyId = '';

function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
}

function draw() {
  background(0, 20);

  // 绘制计数文字
  drawFoodCounter();

  // 绘制所有玩家生物
  for(let id in players){
    let p = players[id];
    drawAlien(p.x, p.y, p.color, p.size);
    // 调试：给当前玩家的生物标个小点点，确认myId对应正确
    if(id === myId){
      fill(255,0,0);
      noStroke();
      ellipse(p.x, p.y, 10, 10);
    }
  }

  // 更新食物
  for (let i = foods.length-1; i >= 0; i--) {
    let f = foods[i];
    f.pos.x += f.vx;
    f.pos.y += f.vy;
    f.pos.x += sin(millis()*0.001 + f.offset) * 0.2;
    f.pos.y += cos(millis()*0.001 + f.offset) * 0.2;

    // 绘制食物
    push();
    noStroke();
    for(let s=5; s>0; s--){
      fill(f.hue, 80, 100, map(s,5,0,0,80));
      ellipse(f.pos.x, f.pos.y, f.size * s/5);
    }
    pop();

    // ---------------------------
    // 核心修复：碰撞检测+计数逻辑
    // ---------------------------
    // 先确认当前玩家存在
    if(myId && players[myId]){
      let me = players[myId];
      // 扩大碰撞判定范围（生物size的0.8倍，避免判定太严）
      let distance = dist(me.x, me.y, f.pos.x, f.pos.y);
      if(distance < me.size * 0.8){
        foodCount++; // 直接计数，不用再判断id
        console.log('吃到食物！当前计数：', foodCount); // 控制台打印，方便调试
        foods.splice(i,1);
        break;
      }
    }

    // 超出屏幕消失
    if(f.pos.x<-20 || f.pos.x>width+20 || f.pos.y<-20 || f.pos.y>height+20){
      foods.splice(i,1);
    }
  }

  // 生成新食物
  if(foods.length < maxFoods && random() < 0.02){
    foods.push({
      pos: createVector(random(width), random(height)),
      size: random(6,12),
      hue: random(40,180),
      vx: random(-0.2,0.2),
      vy: random(-0.2,0.2),
      offset: random(1000)
    });
  }

  // 发送位置
  if(myId && players[myId]){
    sendPosition(mouseX, mouseY);
  }
}

// 绘制计数文字（保留）
function drawFoodCounter() {
  fill(255);        
  textSize(18);     
  text(`吃掉：${foodCount}`, 20, 40);
  // 调试：显示当前myId，确认是否获取到
  // text(`当前玩家ID：${myId || '未获取'}`, 20, 80);
}

// 以下原有代码不变
function drawAlien(centerX, centerY, hue, size){
  let numPoints = 30;
  let angles = [];
  let offsets = [];

  for(let i=0;i<numPoints;i++){
    angles.push(TWO_PI / numPoints * i);
    offsets.push(random(1000));
  }

  stroke(hue, 80, 100, 90);
  strokeWeight(1);
  noFill();
  beginShape();
  for(let i=0;i<numPoints;i++){
    let angle = angles[i];
    let t = millis() * 0.0001 + offsets[i];
    let r = size + sin(t + i*0.1) * (size*0.3);
    let x = centerX + cos(angle) * r;
    let y = centerY + sin(angle) * r;
    curveVertex(x, y);
  }
  endShape(CLOSE);

  for(let i=0;i<numPoints;i+=1){
    let angle = angles[i];
    let t = millis() * 0.002 + offsets[i];
    let r = size/2 + sin(t*3 + i*0.1) * (size*0.25);
    let x = centerX + cos(angle)*r;
    let y = centerY + sin(angle)*r;
    stroke(hue, 60, 100, 50);
    point(x, y);
  }
}

function mouseDragged() {
  if(myId && players[myId]){
    players[myId].x = mouseX;
    players[myId].y = mouseY;
    sendPosition(mouseX, mouseY);
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}