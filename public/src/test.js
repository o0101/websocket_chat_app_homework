import {update} from './b.js';

// constants and state
  // module constants
    // config constants
      // silence logging 
      const Silent = false;
      const InitialReconnectDelay = 1000;
      const ExponentialBackoff = 1.618;
      // a unique code to identify the client 
      // right now we only use this for checking if server updated our name 
      const myCode = (Date.now()*Math.random()).toString(36);

    // functions saved in global scope so they are accessible as inline event handlers
      const globalFuncs = {
        sendMessage, saveSettings
      };

  // app state (chat and settings)
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
      }
    };

  // module variables
    let reconnectDelay = InitialReconnectDelay;
    let socket;

loadChatApp();

// function to run on load
  function loadChatApp() {
    Object.assign(globalThis, globalFuncs);
    loadSettings();
    addRouteHandlers();
    // render any existing route at startup
    self.onhashchange({newURL:location.href+''});
    connectToServer();
  }

// main render function
  function draw(newState = {}) {
    log({newState});
    Object.assign(State, clone(newState));
    update(App, State);
  }

// views
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
            <li><a id=chat href=#chat 
              class="${state.route == 'chat' ? 'active' : ''}">Chat</a>
            <li><a id=settings href=#settings 
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
        <textarea id=composer autofocus name=message placeholder="Enter message"></textarea>
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

    return `
      <form class=settings onsubmit=saveSettings(event);>
        <fieldset>
          <p>
            <label>
              User name
              <br>
              <input type=text name=username placeholder="guest0001" value=${state.settings.username}>
            </label>
          <p>
            <label for=light>
              Interface color
            </label>
            <br>
            <label>
              <input id=light type=radio name=colorscheme value=light checked>
              Light
            </label>
            <label>
              <input type=radio name=colorscheme value=dark>
              Dark
            </label>
          <p>
            <label for=ampm>
              Clock display
            </label>
            <br>
            <label>
              <input id=ampm type=radio name=timeformat value=ampm checked>
              12 Hours
            </label>
            <label>
              <input type=radio name=timeformat value=military>
              24 Hours
            </label>
          <p>
            <label for=ctrlsend>
              Send messages on <kbd>CTRL</kbd>+<kbd>ENTER</kbd>
            </label>
            <br>
            <label>
              <input id=ctrlsend type=radio name=sendhotkey value=ctrlsend>
              On
            </label>
            <label>
              <input type=radio name=sendhotkey value=none checked>
              Off
            </label>
          <p>
            <label>
              Language
              <br>
              <select name=language>
                <option selected value=en>English</option>
                <option value=zh>Chinese</option>
              </select>
            </label>
          <p>
            <button>Save</button>
        </fieldset>
        <fieldset>
          <button>Reset to defaults</button>
        </fieldset>
      </form>
    `;
  }

// route related
  function addRouteHandlers() {
    self.onhashchange = ({newURL}) => {
      const route = (new URL(newURL)).hash.slice(1);
      draw({
        route
      });
    };
  }

// communication related 
  function connectToServer() {
    const ws = new WebSocket(`ws://${location.host}/`);
    ws.onmessage = receiveMessage;
    ws.onopen = c => {
      console.log(`Connected to server ${ws.url}`);
      send({code:myCode,newUsername:State.settings.username});
      reconnectDelay = InitialReconnectDelay;
    };
    ws.onclose = ws.onerror = c => {
      console.warn('No connection to server. Reconnecting...');
      setTimeout(connectToServer, reconnectDelay *= ExponentialBackoff);
    }
    ws.addEventListener('error', c => console.error('Error connecting to server'));
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
      alert('Error sending message');
      console.warn(e);
    }
  }

  function send(o) {
    socket.send(JSON.stringify(o));
  }

// settings related
  function saveSettings(submission) {
    if ( submission ) {
      submission.preventDefault();
    }

    const formData = new FormData(submission.target);
    const newSettings = {}; 

    for( const [key, value] of formData.entries() ) {
      newSettings[key] = value;
    }

    log({newSettings});
    // server accounts for usernames, so we need to send a change
    if ( newSettings.username != State.settings.username ) {
      send({code:myCode, newUsername: newSettings.username});
    }

    persist(newSettings);
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
  }

// behaviour related
  // ensure textarea is focused
    // required because sometimes autofocus attribute has issues, especially related to hash fragment presence
    // setTimeout is required to ensure it happens after DOM is present after a route change

  function focusComposer() {
    setTimeout(() => {
      const composer = document.querySelector('#composer'); 
      if ( document.activeElement != composer ) {
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
    if ( Silent ) return;
    console.log(JSON.stringify(o,null,2));
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function safe(s = '') {
    return s.replace(/"/g, '&quot;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
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

  // determine the view based on what's in the mesage
    // as well as chat messages, we can get other types of notes from the server
    // like a member joins the room, or changes their name, etc
    function computeViewType({message, at, newUsername, username, disconnection, fromMe}) {

      const viewType = 
        disconnection ?                                       'note.disconnection' :
        newUsername && username && username != newUsername ?  'note.nameChange' :
        newUsername ?                                         'note.newMember' : 
        message ?                                             'chat.message' :
                                                              'log.unknownMessageType'
      ;

      // doing it here (rather than having the server do this) 
      // as this decouples client view UI from server logic
      // also also saves a bit of processing on the server
      // We only save viewType to a message once it arrives, so we don't compute this on every re-render

      return viewType;
    }

