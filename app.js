const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
// 新增：引入内置的 child_process 模块（无需安装依赖）
const { exec } = require('child_process');

const PORT = 3000;

// 告诉 express 静态文件在 public 文件夹
app.use(express.static(__dirname + '/public'));

// 存储所有玩家信息
let players = {};

io.on('connection', (socket) => {
  console.log('new player:', socket.id);

  // 初始化玩家数据
  players[socket.id] = {
    x: 0,
    y: 0,
    color: Math.floor(Math.random() * 360),  // HSB 色相
    size: 30 + Math.random() * 20            // 生物大小略有不同
  };

  // 发送所有玩家信息给新玩家
  socket.emit('currentPlayers', players);

  // 广播新玩家加入
  socket.broadcast.emit('newPlayer', {id: socket.id, data: players[socket.id]});

  // 接收玩家位置更新
  socket.on('update', (data) => {
    if(players[socket.id]){
      players[socket.id].x = data.x;
      players[socket.id].y = data.y;
      io.emit('playersUpdate', players); // 同步给所有人
    }
  });

  // 玩家断开
  socket.on('disconnect', () => {
    console.log('player leave:', socket.id);
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

http.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`服务器启动 ${url}`);

  // 核心新增：自动打开浏览器（兼容 Windows/Mac/Linux）
  let openCommand;
  // 判断系统类型，执行对应打开命令
  if (process.platform === 'win32') {
    openCommand = `start ${url}`; // Windows 系统
  } else if (process.platform === 'darwin') {
    openCommand = `open ${url}`; // Mac 系统
  } else {
    openCommand = `xdg-open ${url}`; // Linux 系统
  }

  // 执行打开浏览器的命令，捕获错误避免程序崩溃
  exec(openCommand, (err) => {
    if (err) {
      console.log('自动打开浏览器失败，请手动访问：', url);
    }
  });
});