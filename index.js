import express from 'express';
import path from 'path';
import http from 'http';
import WebSocket from 'ws';

// config constants
  const SILENT = false;
  const DEFAULT_PORT = 8080;
  const PORT = process.env.LSD_PORT || Number(process.argv[2] || DEFAULT_PORT);
  const APP_ROOT = path.dirname(path.resolve(process.mainModule.filename));

// state constants
  const Members = new Set();

// server constants
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({server});

// client app is a SPA served from static files
app.use(express.static(path.resolve(APP_ROOT, 'public')));

wss.on('connection', (ws, req) => {
  const ip = req.connection.remoteAddress;
  Members.add({ws,ip});
  ws.on('message', message => broadcoast(message));
  log({newConnection:{at:Date.now(), ip}});
});

server.listen(PORT, err => {
  if ( err ) {
    throw err;
  } 
  log({server:{upAt:Date.now(), port:PORT}});
});

function broadcast(message) {
  Members.forEach(({ws}) => {
    ws.send(message); 
  });
}

function log(obj) {
  if ( SILENT ) return;
  console.log(JSON.stringify(obj,null,2));
}
