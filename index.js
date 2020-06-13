// imports
  // main nodejs builtin imports
    import http from 'http';
    import path from 'path';

  // main 3rd-party imports
    import WebSocket from 'ws';
    import express from 'express';
    import helmet from 'helmet';

  // helper imports
    import {fileURLToPath} from 'url';

// constants
  // config constants
    const SILENT = false;
    const DEFAULT_PORT = 8080;
    const PORT = process.env.LSD_PORT || Number(process.argv[2] || DEFAULT_PORT);
    const APP_ROOT = path.dirname(path.resolve(require.main.filename));

  // room constants
    const Members = new Set();
    const Names = new Map();
    const NameSet = new Set();
    let connectionId = 0;

  // server constants
    const Log = [];
    const app = express();
    const server = http.createServer(app);
    const wss = new WebSocket.Server({server});

// main code
  if ( weAreMainModule() ) {
    start();
  }

// exports 
  // main server start function
  export function start() {
    // a bit of security
    app.use(helmet());
    // client app is a SPA served from static files
    app.use(express.static(path.resolve(APP_ROOT, 'public')));

    wss.on('connection', joinRoom);
    
    server.listen(PORT, err => {
      if ( err ) throw err;
      log({server:{upAt:Date.now(), port:PORT}});
    });
  }

// room functions
  function joinRoom(ws, req) {
    const ip = req.connection.remoteAddress;
    const id = connectionId++;
    const connection = {ws,ip,id};

    Members.add(connection);

    ws.on('message', data => broadcast(data, ip, id));
    ws.on('close', () => leaveRoom(connection));
    ws.on('error', () => leaveRoom(connection));

    log({newConnection:{at:Date.now(), ip, id}});
  }

  // receive and broadcast all messages
  function broadcast(data, ip, id) {
    if ( typeof data == "string" ) {
      if ( data.length > 5000 ) {
        log({message:`Data too long ${data.length}, ip, id`});
        return;
      }
      try {
        data = JSON.parse(data);
      } catch(e) {
        log({exception:e,data});      
        return;
      }
    }

    data.at = Date.now();

    if ( data.message && data.message.length > 5000 ) {
      log({message:`Message too long ${data.message.length}, ip, id`});
      return;
    }

    // add username server-side so clients can't impersonate
    data.username = Names.get(id);

    // and keep track of name changes
    if ( data.newUsername ) {
      updateName(data, id);
      if ( ! data.username ) {
        // if there's no existing username the member just joined so
        data.memberCount = Members.size;  
      }
    }

    log({broadcast:{data, id, from:ip}});

    Members.forEach(connection => {
      try {
        connection.ws.send(JSON.stringify(data)); 
      } catch(e) {
        leaveRoom(connection);
      }
    });
  }

  function leaveRoom(connection) {
    Members.delete(connection);
    const {ip,id} = connection;

    log({disconnection:{at:Date.now(), ip,id}});

    broadcast({disconnection:true}, ip, id);

    const username = Names.get(id);
    Names.delete(id);
    NameSet.delete(username);
  }

// helpers
  // server keeps a record of names to prevent conflicts and impersonation
  function updateName(data, id) {
    if ( data.newUsername.length > 40 ) {
      data.newUsername = data.newUsername.slice(0, 40);
    }

    if ( NameSet.has(data.newUsername) ) {
      // generate a random unused username
      data.newUsername = Math.round((Math.random()*Date.now()%10000000)).toString(36);
      // tell the client we automatically changed their username to an unused one
      data.automaticUpdate = true;
    }
    NameSet.add(data.newUsername);
    // and don't forget to free the old one
    const username = Names.get(id);
    NameSet.delete(username);
    Names.set(id, data.newUsername);
  }

  function log(obj) {
    Log.push(obj);
    if ( Log.length > 10000 ) {
      Log.shift();
    }
    if ( SILENT ) return;
    console.log(JSON.stringify(obj,null,2));
  }

  // provides esmodules-era answer to the question, is this module called directly or imported?
  function weAreMainModule() {
    return fileURLToPath(import.meta.url) == process.argv[1];
  }

