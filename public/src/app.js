import {update} from './b.js';

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
        messages: []
      },
      view : {
        saySettingsSaved: false
      }
    };

    // log for errors
    const Errors = [];

  // global funcs for inline event handlers
    const globalFuncs = {
      sendMessage, saveSettings
    };

  let reconnectDelay = InitialReconnectDelay;
  let socket;

loadChatApp();

// start the app
  function loadChatApp() {
    // global scope is accessible to inline event handlers
    Object.assign(globalThis, globalFuncs);
    loadSettings();
    addRouteHandlers();
    // render any existing route at startup
    self.onhashchange({newURL:location.href+''});
    connectToServer();
  }

// save new state and draw it
  function draw(newState = {}) {
    // logging new state can get lengthy
    // log({newState});
    Object.assign(State, clone(newState));
    update(App, State);
  }

// render different components
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
              class="${state.route == 'chat' ? 'active' : ''}">Chat</a>
            <li><a href=#settings 
              class="${state.route == 'settings' ? 'active' : ''}">Settings</a>
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
    scrollToLatest();
    return `
      <ul class=chat>
        ${state.chat.messages.length ? 
            state.chat.messages.map(msg => ChatMessage(msg)).join('\n') 
          :
            `<li class=room-note>No chat history</li>`
        }
      </ul>
      <form class=messager onsubmit=sendMessage(event);>
        <textarea class=composer required autofocus name=message placeholder="Enter message"></textarea>
        <button>Send</button>
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
              <time datetime=${at}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'note.newMember':
        return `
          <li class=room-note> 
            <p>${safe(newUsername)} entered the room.</p>
            <div class=metadata>
              <time datetime=${at}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'note.disconnection':
        return `
          <li class=room-note> 
            <p>${safe(username)} left the room.</p>
            <div class=metadata>
              <time datetime=${at}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'chat.message':
        return `
          <li class="message ${fromMe? 'from-me' : ''}">
            <p>${safe(message)}</p>
            <div class=metadata>
              <cite rel=author>${safe(username)}</cite>
              <time datetime=${at}>${fullTime}</time>
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
    const C = 'checked', S = 'selected', _ = '';

    return `
      <form id=settings class=settings onreset=saveSettings(event); onchange=saveSettings(event);>
        <fieldset name=notification>
          <legend>${state.view.saySettingsSaved ? 'Saved' : ''}</legend>
          <p>
            <label>
              User name
              <br>
              <input type=text name=username placeholder="guest0001" value=${username}>
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

// change route when hash fragment changes
  function addRouteHandlers() {
    self.onhashchange = ({newURL}) => {
      const route = (new URL(newURL)).hash.slice(1);
      draw({
        route
      });
    };
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
    data = JSON.parse(data);

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

    draw({chat:{
      messages: State.chat.messages.concat([data]) 
    }});
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

      log({newSettings});

      // server accounts for usernames, so we need to send a change
        if ( newSettings.username != State.settings.username ) {
          send({code:myCode, newUsername: newSettings.username});
        }

      // we don't use draw here because these use <html> tag, and draw only renders from <body>
        if ( newSettings.colorscheme != State.settings.colorscheme ) {
          const doc = document.documentElement;
          doc.classList.remove(State.settings.colorscheme);
          doc.classList.add(newSettings.colorscheme);
        }

        if ( newSettings.language != State.settings.language ) {
          const doc = document.documentElement;
          doc.lang = newSettings.language;
        }

      persist(newSettings);
    }

    // note that settings are saved
    draw({view:{saySettingsSaved: true}});
    setTimeout(() => draw({view:{saySettingsSaved: false}}), 1618);
  }

  function persist(newSettings) {
    Object.assign(State.settings, newSettings);
    localStorage.setItem('app-settings', JSON.stringify(State.settings));
  }

  function loadSettings() {
    let settings = localStorage.getItem('app-settings');
    if ( ! settings ) {
      settings = DefaultSettings; 
    } else {
      settings = JSON.parse(settings);
    }
    Object.assign(State.settings, clone(settings));

    // some settings we need to apply (they will not be drawn with render)
    document.documentElement.classList.add(State.settings.colorscheme);
    document.documentElement.lang = State.settings.language;
  }

// focus message composer and scroll to latest message
  // ensure textarea is focused
  function focusComposer() {
    // setTimeout ensures we wait until after render
    setTimeout(() => {
      const composer = document.querySelector('form.messager .composer'); 
      if ( !!composer && document.activeElement != composer ) {
        // autofocus attribute fails in some cases including when hash fragment present
        composer.focus();
      }
    }, 0);
  }

  function scrollToLatest() {
    setTimeout(() => {
      const latest = document.querySelector('ul.chat li:last-of-type'); 
      if ( latest ) {
        latest.scrollIntoView();
      }
    }, 0);
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

  function safe(s = '') {
    return s.replace(/"/g, '&quot;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  // format timestamp into a 12 or 24 clock time 
    function getClockTime(timestamp, mode) {
      const dateAt = new Date(timestamp);
      const time = dateAt.toLocaleTimeString(navigator.language, {timeStyle:'short'}).trim();
      const [clockTime, half] = time.split(/\s+/g);
      const [hour,minute] = clockTime.split(/:/g);

      if ( mode == 'ampm' ) {
        return `${hour}:${minute} ${half}`;
      } else {
        return `${(parseInt(hour) + (half == 'PM' ? 12 : 0))%24}:${minute}`;
      }
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

