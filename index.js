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
  const Names = new Map();
  const NameSet = new Set();
  let connectionId = 0;

// server constants
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({server});

// client app is a SPA served from static files
app.use(express.static(path.resolve(APP_ROOT, 'public')));

wss.on('connection', (ws, req) => {
  const ip = req.connection.remoteAddress;
  const id = connectionId++;
  const connection = {ws,ip,id};
  Members.add(connection);
  ws.on('message', data => broadcast(data, ip, id));
  ws.on('close', () => close(connection));
  ws.on('error', () => close(connection));
  log({newConnection:{at:Date.now(), ip, id}});
});

server.listen(PORT, err => {
  if ( err ) {
    throw err;
  } 
  log({server:{upAt:Date.now(), port:PORT}});
});

function broadcast(data, ip, id) {
  if ( typeof data == "string" ) {
    data = JSON.parse(data);
  }

  data.at = Date.now();

  // add username saved for this connection 
    // if instead we let clients send with messages letting clients send 
    // they could impersonate anyone
  data.username = Names.get(id);

  // keep track of name changes
  if ( data.newUsername ) {
    updateName(data, id);
  }

  log({broadcast:{data, id, from:ip}});

  Members.forEach(connection => {
    try {
      connection.ws.send(JSON.stringify(data)); 
    } catch(e) {
      close(connection);
    }
  });
}

function updateName(data, id) {
  if ( NameSet.has(data.newUsername) ) {
    data.newUsername += '.' + (Math.random()*10000).toString(36);
    data.automaticUpdate = true;
  }
  NameSet.add(data.newUsername);
  // and don't forget to free the old one
  const username = Names.get(id);
  NameSet.delete(username);
  Names.set(id, data.newUsername);
}

function log(obj) {
  if ( SILENT ) return;
  console.log(JSON.stringify(obj,null,2));
}

function close(connection) {
  Members.delete(connection);
  const {ip,id} = connection;

  log({disconnection:{at:Date.now(), ip,id}});

  broadcast({disconnection:true}, ip, id);

  const username = Names.get(id);
  Names.delete(id);
  NameSet.delete(username);
}
