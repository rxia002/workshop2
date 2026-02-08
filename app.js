// 先确保顶部依赖正确引入（之前的代码可能漏了，补上）
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// 托管 public 文件夹（前端文件目录，必须有）
app.use(express.static(path.join(__dirname, 'public')));

// 全局存储所有玩家（必须在 io.on 外面定义）
let players = {};

// 监听玩家连接（核心逻辑修改）
io.on('connection', (socket) => {
  console.log('new player:', socket.id);

  // 1. 关键修改：监听前端发送的 "newPlayer" 事件（接收前端的颜色、大小、初始位置）
  socket.on('newPlayer', (playerData) => {
    // 用前端传的玩家数据初始化（而非后端固定 x:0,y:0），和前端保持一致
    players[socket.id] = {
      x: playerData.x,       // 前端传的初始 X（画布中间）
      y: playerData.y,       // 前端传的初始 Y（画布中间）
      size: playerData.size, // 前端传的随机大小（20~30）
      color: playerData.color// 前端传的随机颜色（0~360）
    };

    // 2. 关键修改：发送 "allPlayers" 事件（前端监听的是这个名），回传所有玩家数据
    socket.emit('allPlayers', players);

    // 广播新玩家加入（事件名 "newPlayerJoined" 要和前端监听的一致，前端已处理）
    socket.broadcast.emit('newPlayerJoined', {
      id: socket.id,
      data: players[socket.id]
    });
  });

  // 接收玩家位置更新（事件名 "playerPosition" 要和前端发送的一致，前端发的是这个）
  socket.on('playerPosition', (data) => {
    if (players[socket.id]) {
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      // 同步给所有玩家（事件名 "playerMoved" 要和前端监听的一致，前端已处理）
      io.emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  // 玩家断开连接（事件名 "playerLeft" 和前端一致，前端已处理）
  socket.on('disconnect', () => {
    console.log('player leave:', socket.id);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

// 监听端口（必须用 http.listen，且用 Render 的环境变量端口）
const port = process.env.PORT || 3000;
http.listen(port, () => {
  console.log(`服务运行在端口 ${port}`);
});
