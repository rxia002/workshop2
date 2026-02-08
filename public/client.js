// client.js
const socket = io();

let players = {};   // 所有玩家数据
let myId;

// 接收已有玩家
socket.on('currentPlayers', (data) => {
  players = data;
  myId = socket.id;
});

// 新玩家加入
socket.on('newPlayer', (data) => {
  players[data.id] = data.data;
});

// 玩家断开
socket.on('playerDisconnected', (id) => {
  delete players[id];
});

// 玩家位置更新
socket.on('playersUpdate', (data) => {
  players = data;
});

// 发送自己的位置
function sendPosition(x, y){
  socket.emit('update', {x, y});
}

