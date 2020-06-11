import {update} from './b.js';

const DefaultSettings = {
  username: 'cris'
};

const State = {
  settings: {
    username: 'cris'
  },
  chat: {
    messages: []
  }
};

const globalFuncs = {
  sendMessage, saveSettings
};

const InitialReconnectDelay = 1000;
const ExponentialBackoff = 1.618;
const code = (Date.now()*Math.random()).toString(36);
let reconnectDelay = InitialReconnectDelay;
let socket;

start();

// function to run on load
  function start() {
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

  function ChatMessage({message, at, newUsername, username, disconnection, fromMe}) {
    const dateAt = new Date(at);
    const time = dateAt.toLocaleTimeString(navigator.language, {timeStyle:'short'}).trim();
    const [clockTime, half] = time.split(/\s+/g);
    const [hour,minute] = clockTime.split(/:/g);
    const fullTime = `${hour}:${minute} ${half}`;
    if ( newUsername && username && username != newUsername ) {
      return `
        <li class=room-note> 
          <p>${safe(username)} changed their name to ${safe(newUsername)}</p>
          <div class=metadata>
            <time datetime=${at}>${fullTime}</time>
          </div>
        </li>
      `;
    } else if ( newUsername ) {
      return `
        <li class=room-note> 
          <p>${safe(newUsername)} entered the room.</p>
          <div class=metadata>
            <time datetime=${at}>${fullTime}</time>
          </div>
        </li>
      `;
    } else if ( disconnection ) {
      return `
        <li class=room-note> 
          <p>${safe(username)} left the room.</p>
          <div class=metadata>
            <time datetime=${at}>${fullTime}</time>
          </div>
        </li>
      `;
    } else {
      return `
        <li class="message ${fromMe? 'from-me' : ''}">
          <p>${safe(message)}</p>
          <div class=metadata>
            <cite rel=author>${safe(username)}</cite>
            <time datetime=${at}>${fullTime}</time>
          </div>
        </li>
      `;
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
      send({code,newUsername:State.settings.username});
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

    if ( data.newUsername && data.automaticUpdate && data.code == code ) {
      persist({username:data.newUsername});
    }

    if ( data.username == State.settings.username ) {
      data.fromMe = true;
    }

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
      send({code, newUsername: newSettings.username});
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
    console.log(JSON.stringify(o,null,2));
  }

  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function safe(s = '') {
    return s.replace(/"/g, '&quot;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
  }
