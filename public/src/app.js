import {merge, update} from './b.js';

// declarations
  // config constants
    const SilenceLogs = true;
    const InitialReconnectDelay = 1000;
    const ExponentialBackoff = 1.618;
    // right now we only use myCode for checking if a name update is ours 
    const myCode = (Date.now()*Math.random()).toString(36);

  // app state constants 
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

    // log for errors
    const Errors = [];

  // global funcs for inline event handlers
    const globalFuncs = {
      sendMessage, saveSettings
    };

  // convenience for empty strings
    const _ = '';

  let reconnectDelay = InitialReconnectDelay;
  let socket;

loadChatApp();

// start the app
  function loadChatApp() {
    loadSettings();
    addRouteHandler();
    installUnreadBlinker();

    // global scope is accessible to inline event handlers
    Object.assign(globalThis, globalFuncs);

    // render existing route at startup
    drawRoute({newURL:location.href+''});

    connectToServer();
  }

// save new state and draw the app
  // main draw function
  function draw(newState = {}) {
    merge(State, clone(newState));
    update(App, State);

    // logging new state can get lengthy
    // log({newState});
  }

  // functions for rendering stuff outside <body>
    function drawTitle(newState = {}) {
      merge(State, clone(newState));
      document.title = AppTitle(State);
    }

    function drawLanguage(newState = {}) {
      merge(State, clone(newState));
      document.documentElement.lang = State.settings.language;
    }

    function drawColorScheme(newState = {}) {
      const doc = document.documentElement;
      doc.classList.remove(State.settings.colorscheme);
      merge(State, clone(newState));
      doc.classList.add(State.settings.colorscheme);
    }

// render different views
  function App(state) {
    let currentView;

    switch(state.route) {
      case 'chat':
        currentView = Chat;
        break;
      case 'settings':
        currentView = Settings;
        break;
      default:
        currentView = Chat;
        break;
    }

    return `
      <article class=app>
        <nav class=routes>
          <ul>
            <li><a href=#chat 
              ${state.route == 'chat' ? 'class=active' : _}>Chat</a>
            <li><a href=#settings 
              ${state.route == 'settings' ? 'class=active' : _}>Settings</a>
          </ul>
        </nav>
        <section class=current-view>
        ${currentView(state)}
        </section>
      </article>
    `
  }

  function Chat(state) {
    focusComposer();

    return `
      <ul class=chat>
        ${state.chat.messages.length ? 
            state.chat.messages.map(msg => ChatMessage(msg)).join('\n') 
          :
            `<li class=room-note>No chat history</li>`
        }
      </ul>
      <form class=messager onsubmit=sendMessage(event);>
        <textarea required class=composer
          aria-label="Message composer" 
          autofocus 
          name=message placeholder="Enter message"></textarea>
        <button aria-label="Send message">Send</button>
      </form>
    `;
  }

  function ChatMessage({message, at, newUsername, username, disconnection, fromMe, viewType}) {
    const fullTime = getClockTime(at, State.settings.timeformat);

    switch(viewType) {
      case 'note.nameChange':
        return `
          <li class=room-note> 
            <p>${safe(username)} changed their name to ${safe(newUsername)}</p>
            <div class=metadata>
              <time datetime=${safe(at)}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'note.newMember':
        return `
          <li class=room-note> 
            <p>${safe(newUsername)} entered the room.</p>
            <div class=metadata>
              <time datetime=${safe(at)}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'note.disconnection':
        return `
          <li class=room-note> 
            <p>${safe(username)} left the room.</p>
            <div class=metadata>
              <time datetime=${safe(at)}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'chat.message':
        return `
          <li class="message ${fromMe? 'from-me' : ''}">
            <p>${safe(message)}</p>
            <div class=metadata>
              <cite rel=author>${safe(username)}</cite>
              <time datetime=${safe(at)}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'log.unknownMessageType':
      default:
        log({unknownMessageType: {message, at, newUsername, username, disconnection, fromMe, viewType}});
        break;
    }
  }

  function Settings(state) {
    loadSettings();

    const {settings: {
      username,
      colorscheme,
      timeformat,
      sendhotkey,
      language
    }} = state;
    // convenience for form control boolean attributes
    const C = 'checked', S = 'selected';

    return `
      <form id=settings class=settings onreset=saveSettings(event); onchange=saveSettings(event);>
        <fieldset name=notification>
          <legend>${state.view.saySettingsSaved ? 'Saved' : ''}</legend>
          <p>
            <label>
              User name
              <br>
              <input type=text name=username placeholder="guest0001" value=${safe(username)}>
            </label>
          <p>
            <label>
              Interface color
            </label>
            <br>
            <label>
              <input type=radio name=colorscheme value=light 
                ${colorscheme == 'light' ? C : _}>
              Light
            </label>
            <label>
              <input type=radio name=colorscheme value=dark 
                ${colorscheme == 'dark' ? C : _}>
              Dark
            </label>
          <p>
            <label>
              Clock display
            </label>
            <br>
            <label>
              <input type=radio name=timeformat value=ampm 
                ${timeformat == 'ampm' ? C : _}>
              12 Hours
            </label>
            <label>
              <input type=radio name=timeformat value=military 
                ${timeformat == 'military' ? C : _}>
              24 Hours
            </label>
          <p>
            <label> 
              Send messages on <kbd>CTRL</kbd>+<kbd>ENTER</kbd>
            </label>
            <br>
            <label>
              <input type=radio name=sendhotkey value=ctrlsend 
                ${sendhotkey == 'ctrlsend' ? C : _}>
              On
            </label>
            <label>
              <input type=radio name=sendhotkey value=none 
                ${sendhotkey == 'none' ? C : _}>
              Off
            </label>
          <p>
            <label>
              Language
              <br>
              <select name=language>
                <option ${language == 'en' ? S : _} value=en>English</option>
                <option ${language == 'zh' ? S : _} value=zh>Chinese</option>
              </select>
            </label>
        </fieldset>
      </form>
      <button class=defaults type=reset form=settings>Reset to defaults</button>
    `;

    // note the values of language options need to be valid codes that can be applied to html.lang attribute 
  }

  function AppTitle (state) {
    let title = 'Chat App Homework';

    if ( state.route ) {
      title += ` - ${state.route}`;
    }

    if ( state.view.showUnreadCount && state.chat.unreadCount ) {
      title = `(${state.chat.unreadCount}) ` + title;
    }

    return title;
  }

// change route when hash fragment changes
  function addRouteHandler() {
    self.onhashchange = drawRoute;
  }

  function drawRoute({newURL}) {
    const route = (new URL(newURL)).hash.slice(1);
    draw({route});
  }

// communicate over websocket
  function connectToServer() {
    const ws = new WebSocket(`ws://${location.host}/`);
    ws.onmessage = receiveMessage;
    ws.onopen = c => {
      log({websocketConnected:ws.url});
      send({code:myCode,newUsername:State.settings.username});
      reconnectDelay = InitialReconnectDelay;
    };
    ws.onclose = ws.onerror = c => {
      logError({message: 'No connection to server. Reconnecting...', event: c});
      setTimeout(connectToServer, reconnectDelay *= ExponentialBackoff);
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

    if ( Number.isNaN(Number(data.at)) ) {
      logError({badMessage:data});
      return;
    }

    if ( messagesUnreadable() ) {
      State.chat.unreadCount += 1;
    } else {
      State.chat.unreadCount = 0;
    }

    // if server has updated my username to an unused one
    if ( data.newUsername && data.automaticUpdate && data.code == myCode ) {
      // persist the new username it to my settings
      persist({username:data.newUsername});
    }

    // messages with 'fromMe' true go on my side of the chat
    if ( data.username == State.settings.username ) {
      data.fromMe = true;
    }

    // work out the format to display this message
    data.viewType = computeViewType(data);

    draw({
      'chat.messages': [data].concat(State.chat.messages)
    });
  }

  function sendMessage(submission) {
    submission.preventDefault();
    const {message:{value:message}} = submission.target;

    const data = {
      message
    };

    try {
      send(data);
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
    
    if ( event.type == 'reset' ) {
      const proceed = globalThis.APP_TESTING || confirm(`This resets your settings to defaults. Are you sure?`);
      if ( proceed ) {
        persist(clone(DefaultSettings)); 
      } else {
        return;
      }
    } else {
      const formData = new FormData(event.currentTarget);
      const newSettings = {}; 

      for( const [key, value] of formData.entries() ) {
        newSettings[key] = value;
      }

      // server accounts for usernames, so we need to send a change
        if ( newSettings.username != State.settings.username ) {
          send({code:myCode, newUsername: newSettings.username});
        }

      persist(newSettings);

      // we don't use draw here because these use <html> tag, and draw only renders from <body>
      drawColorScheme();
      drawLanguage();

      log({newSettings});
    }

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

    Object.assign(State.settings, settings);

    // some settings we need to apply (they will not be drawn with render)
    drawColorScheme();
    drawLanguage();
  }

  function persist(newSettings) {
    merge(State.settings, newSettings);
    localStorage.setItem('app-settings', JSON.stringify(State.settings));
  }

// UI behaviours 
  // ensure textarea is focused
  function focusComposer() {
    // setTimeout ensures we wait until after render
    setTimeout(() => {
      const composer = document.querySelector('form.messager .composer'); 
      if ( composer instanceof HTMLTextAreaElement && document.activeElement != composer ) {
        // autofocus attribute fails in some cases including when hash fragment present
        composer.focus();
      }
    }, 0);
  }

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
  function log(o) {
    if ( SilenceLogs ) return;
    console.log(JSON.stringify(o,null,2));
  }

  function logError(e) {
    Errors.push(e);

    if ( SilenceLogs ) return;

    console.error(e.message);
    console.info("Last error", e);
  }

  // mitigate XSS
  function safe(s = '') {
    return (s+'').replace(/"/g, '&quot;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
  }

  // is the chat view invisible?
  function messagesUnreadable() {
    return State.route != 'chat' || document.hidden;
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // format timestamp into a 12 or 24 clock time 
    function getClockTime(timestamp, mode) {
      const dateAt = new Date(timestamp);
      let hour = dateAt.getHours();
      let minute = dateAt.getMinutes();
      let hourStr, minuteStr, half = '';

      if ( mode == 'ampm' ) {
        half = 'AM';
        if ( hour > 12 ) {
          hour -= 12;
          half = 'PM';
        } else if ( hour == 12 ) {
          half = 'PM';
        }
      }

      hourStr = hour.toString().padStart(2, '0');
      minuteStr = minute.toString().padStart(2, '0');

      return `${hourStr}:${minuteStr} ${half}`;
    }

  // when a message arrives determine the view to use
    function computeViewType({message, at, newUsername, username, disconnection, fromMe}) {
      const viewType = 
        disconnection ?                                       'note.disconnection' :
        newUsername && username && username != newUsername ?  'note.nameChange' :
        newUsername ?                                         'note.newMember' : 
        message ?                                             'chat.message' :
                                                              'log.unknownMessageType'
      ;

      // if we had the server do this
      // client view logic and server logic would be coupled

      return viewType;
    }

