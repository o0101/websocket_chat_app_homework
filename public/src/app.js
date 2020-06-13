// imports
  import * as Views from './views.js';
  import * as Config from './config.js';
  import {
    merge, 
    update, 
    toDOM,
    clone, 
    log, 
    logError
  } from './helpers.js';

// declarations
  // useful constants
    const inlineEventHandlerFunctions = {
      sendMessage, saveSettings
    };

    const Routes = new Set([
      'chat',
      'settings'
    ]);

  // state constants 
    const DefaultSettings = {
      username: 'cris',
      colorscheme: 'light',
      timeformat: 'ampm',
      sendhotkey: 'none',
      language: 'en'
    };

    const State = {
      settings: clone(DefaultSettings),
      chat: {
        unreadCount: 0,
        messages: []
      },
      view : {
        saySettingsSaved: false,
        showUnreadCount: false
      }
    };

  // module scoped variables
    let reconnectDelay = Config.InitialReconnectDelay;
    let socket;

loadChatApp();

// start the app
  function loadChatApp() {
    loadSettings();
    addRouteHandler();
    installUnreadBlinker();

    Object.assign(self, inlineEventHandlerFunctions);
    // Notes
      // we will call these functions
      // from inline event handlers (e.g <a onclick="...) 
      // And to be accessible in those handlers, they needed to be in global scope

    // render existing route at startup
    drawRoute({newURL:location.href+''});

    connectToServer();
  }

// draw the app
  // main draw function
  function draw(newState = {}) {
    merge(State, clone(newState));
    update(Views.App, State);

    // logging new state can get lengthy
    // log({newState});
  }

  // functions for rendering stuff outside <body>
    function drawTitle(newState = {}) {
      merge(State, clone(newState));
      document.title = Views.AppTitle(State);
    }

    function drawLanguage() {
      document.documentElement.lang = State.settings.language;
    }

    function drawColorScheme(newSettings, oldSettings) {
      const doc = document.documentElement;
      if ( oldSettings ) {
        doc.classList.remove(oldSettings.colorscheme);
      }
      doc.classList.add(newSettings.colorscheme);
    }

// change route when hash fragment changes
  function addRouteHandler() {
    self.onhashchange = drawRoute;
  }

  function drawRoute({newURL}) {
    const route = (new URL(newURL)).hash.slice(1);

    if ( ! route || ! Routes.has(route) ) {
      // chat is the default route
      return location.hash = '#chat';
    }

    if ( route == 'settings' ) {
      loadSettings();
    }

    draw({route});
    drawTitle();
    // title also depends on the route
  }

// communicate over websocket
  function connectToServer() {
    const ws = new WebSocket(`ws://${location.host}/`);

    ws.onmessage = receiveMessage;

    ws.onopen = () => {
      log({websocketConnected:ws.url});
      // let the server know we are here, and our preferred username
      send({code:Config.myCode,newUsername:State.settings.username});
      reconnectDelay = Config.InitialReconnectDelay;
    };

    ws.onclose = ws.onerror = c => {
      logError({message: 'No connection to server. Reconnecting...', event: c});
      setTimeout(connectToServer, reconnectDelay *= Config.ExponentialBackoff);
    }

    socket = ws;
  }

  function receiveMessage(messageEvent) {
    let {data} = messageEvent;

    try {
      data = JSON.parse(data);
    } catch(e) {
      logError({exception:e, data});
      return;
    }

    if ( messagesUnreadable() ) {
      State.chat.unreadCount += 1;
    } else {
      State.chat.unreadCount = 0;
    }

    // if server has updated my username to an unused one
    if ( data.newUsername && data.automaticUpdate && data.code == Config.myCode ) {
      // persist the new username it to my settings
      persist({username:data.newUsername});
    }

    // messages with 'fromMe' go on my side of the chat
    if ( data.username == State.settings.username ) {
      data.fromMe = true;
    }

    // work out the format to display this message (and save it)
    data.viewType = computeViewType(data);

    // we can't redraw the whole view here
    // because messages might come too fast, 
    // and our simple render process is too slow
    // so the fast updates will break textarea input
    // so instead we just merge state
    merge(State, {
      'chat.messages': State.chat.messages.concat([data])
    });

    // and then create a single message view
    const messageDom = toDOM(Views.ChatMessage(data)).querySelector('li');
    // and insert it into the list
    const list = document.querySelector('ul.chat');
    list.insertAdjacentElement('beforeEnd', messageDom);

    // even tho this breaks our notion 'render the whole tree at once'
    // it works well for performance

    Views.focusComposer();

    // if we're roughly in the last 'page' of scrolled messages
    if ( (list.scrollHeight - list.scrollTop) <= 1.618*list.clientHeight ) {
      // bring the latest into view
      messageDom.scrollIntoView();
    } // otherwise we might be scrolling back into history and don't want to be jolted
  }

  function sendMessage(submission) {
    const form = submission.target.closest('form'); 
    const {message:{value:message}} = form;

    if ( submission.type == 'submit' ) {
      submission.preventDefault();
    }

    const data = {
      message
    };

    if( data.message.trim().length == 0 ) {
      return alert(`What would you like to say?`); 
    }

    try {
      send(data);
      form.message.value = '';
    } catch(e) {
      logError({message:`Error sending message`, data, exception:e});
    }
  }

  function send(o) {
    socket.send(JSON.stringify(o));
  }

// save and load settings
  function saveSettings(event) {
    if ( event.type == 'submit' || event.type == 'reset' ) {
      event.preventDefault();
    } 

    let newSettings;
    
    if ( event.type == 'reset' ) {
      const proceed = globalThis.APP_TESTING || confirm(`This resets your settings to defaults. Are you sure?`);
      if ( proceed ) {
        newSettings = clone(DefaultSettings);
      } else {
        return;
      }
    } else {
      const formData = new FormData(event.currentTarget);
      newSettings = {};

      // Note
        // <FormData>.entries() doesn't work on Edge 17, but does on Edge 18 
        // Plus, Edge was not in the browser list for this homework
      for( const [key, value] of formData.entries() ) {
        newSettings[key] = value;
      }

      // fix empty username
      if ( newSettings.username == '' ) {
        logError({message:'Empty username'});
        event.currentTarget.username.value = newSettings.username = Math.round((Date.now()*Math.random())%10000).toString(36)
        alert(`Username can't be empty`);
      }
    }

    // server accounts for usernames, so we need to send a change
    if ( newSettings.username != State.settings.username ) {
      send({code:Config.myCode, newUsername: newSettings.username});
    }

    log({newSettings});

    drawLanguage();
    drawColorScheme(newSettings, State.settings);

    persist(newSettings);

    // say we saved settings
    draw({'view.saySettingsSaved': true});
    setTimeout(() => draw({'view.saySettingsSaved': false}), 1618);
  }

  function loadSettings() {
    const storedSettings = localStorage.getItem('app-settings');
    let settings;
    
    if ( storedSettings ) {
      try {
        settings = JSON.parse(storedSettings);
      } catch(e) {
        logError({storedSettings, exception:e});
      }
    }

    if ( ! settings ) {
      settings = clone(DefaultSettings);
    }

    // we are loading settings so it's ok to overwrite
    Object.assign(State.settings, settings);

    // some settings we need to apply (they will not be drawn with render)
    drawColorScheme(State.settings);
    drawLanguage();
  }

  function persist(newSettings) {
    merge(State.settings, newSettings);
    localStorage.setItem('app-settings', JSON.stringify(State.settings));
  }

// title blinker
  function installUnreadBlinker() {
    let animate = false;

    document.onvisibilitychange = animateTitle;
    self.addEventListener('hashchange', animateTitle);

    animateTitle();
    
    function animateTitle() {
      if ( messagesUnreadable() ) {
        animate = true;
        showUnreadInTitle();
      } else {
        animate = false; 
        drawTitle({
          'chat.unreadCount' : 0,
          'view.showUnreadCount' : false
        });
      }
    }

    function showUnreadInTitle() {
      if ( State.chat.unreadCount ) {
        drawTitle({'view.showUnreadCount': true});
      }
      if ( animate ) {
        setTimeout(clearUnreadFromTitle, 1000);
      }
    }

    function clearUnreadFromTitle() {
      if ( State.view.showUnreadCount ) {
        drawTitle({'view.showUnreadCount': false});
      }
      if ( animate ) {
        setTimeout(showUnreadInTitle, 500);
      }
    }
  }

// helpers
  // is the chat view invisible?
  function messagesUnreadable() {
    return State.route != 'chat' || document.hidden;
  }

  // when a message arrives determine the view to use
  function computeViewType({message, newUsername, username, disconnection}) {
    const viewType = 
      disconnection ?                                       'note.disconnection' :
      newUsername && username && username != newUsername ?  'note.nameChange' :
      newUsername ?                                         'note.newMember' : 
      message ?                                             'chat.message' :
                                                            'log.unknownMessageType'
    ;

    // if we had the server do this
    // client view logic and server logic would be coupled
    // so we do it here

    return viewType;
  }

