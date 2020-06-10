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

let socket;

start();

// function to run on load
  function start() {
    draw();
    connectToServer();
    addRouteHandlers();
    Object.assign(globalThis, globalFuncs);
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
            <li><a href=#chat>Chat</a>
            <li><a href=#settings>Settings</a>
          </ul>
        </nav>
        <section class=current-view>
        ${currentView(state)}
        </section>
      </article>
    `
  }

  function Chat(state) {
    return `
      <ul>
        ${state.chat.messages.length ? 
            state.chat.messages.map(msg => ChatMessage(msg)).join('\n') 
          :
            `<div class=room-note>No chat history</div>`
        }
      </ul>
      <form onsubmit=sendMessage(event);>
        <textarea autofocus name=message></textarea>
        <button>Send</button>
      </form>
    `;
  }

  function ChatMessage(msg) {
    return `
      <li class=message>
        <p>${msg}</p>
        <cite rel=author>user</cite>
        <date>Now</date>
      </li>
    `;
  }

  function Settings(state) {
    return `
      <form onsubmit=saveSettings(event);>
        <fieldset>
          <legend>Settings</legend>
          <p>
            <label>
              Username
              <input type=text name=username placeholder=username value=${state.settings.username}>
            </label>
          <p>
            <button>Save</button>
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
    ws.onopen = c => console.log('Connected to server', c);
    ws.onclose = c => alert('No connection to server');
    ws.onerror = c => alert('Error connecting to server');
    socket = ws;
  }

  function receiveMessage(messageEvent) {
    const {data:message} = messageEvent;
    draw({chat:{
      messages: State.chat.messages.concat([message]) 
    }});
  }

  function sendMessage(submission) {
    submission.preventDefault();
    const {message:{value:message}} = submission.target;

    try {
      socket.send(message);
    } catch(e) {
      alert('Error sending message');
      console.warn(e);
    }
  }

// settings related
  function saveSettings(submission) {
    submission.preventDefault();
    localStorage.setItem('app-settings', JSON.stringify(State.settings));
  }

  function loadSettings() {
    let settings = localStorage.getItem('app-settings');
    if ( ! settings ) {
      settings = DefaultSettings; 
    }
    Objet.assign(State.settings, clone(settings));
  }

// helpers
  function log(o) {
    console.log(JSON.stringify(o,null,2));
  }
  function clone(o) {
    return JSON.parse(JSON.stringify(o));
  }
