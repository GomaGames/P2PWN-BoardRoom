const express = require('express');
const app = express();
const { clientConnected } = require('./client-handler');

const { Server : WebSocketServer } = require('ws');
// const Server = require('ws').WebSocketServer;
const server = require('http').createServer();
const wss = new WebSocketServer({ server });


app.use(express.static('./public'));
app.get('/api/hello', (req, res) => {
  const hello = 'world';
  res.json({ hello });
});

wss.on('connection', clientConnected)

server.on('request', app);

module.exports = server;
