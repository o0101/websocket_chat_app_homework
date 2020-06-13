// imports
  import {log} from './helpers.js';

// convenience constant for empty strings
  const _ = '';

// render different views
  export function App(state) {
    let currentView;

    switch(state.route) {
      case 'settings':  currentView = Settings;     break;
      default:
      case 'chat':      currentView = Chat;         break;
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
    let sendhotkey = '';

    if ( state.settings.sendhotkey == 'ctrlenter' ) {
      sendhotkey = `onkeypress="event.code == 'Enter' && event.ctrlKey && sendMessage(event);"`;
    }

    focusComposer();

    return `
      <ul class=chat>
        ${state.chat.messages.length ? 
            state.chat.messages.map(msg => ChatMessage(msg, state.settings.timeformat)).join('\n') 
          :
            `<li class=room-note><q cite=acct:app@client>No chat history</q></li>`
        }
      </ul>
      <form class=messager onsubmit=sendMessage(event); ${sendhotkey}>
        <textarea required class=composer
          aria-label="Message composer" 
          autofocus 
          maxlength=1200
          name=message placeholder="Enter message"></textarea>
        <button aria-label="Send message">Send</button>
      </form>
    `;
  }

  function ChatMessage({message, at, newUsername, username, memberCount, disconnection, fromMe, viewType}, timeformat) {
    const iso8601 = new Date(at).toISOString();
    const fullTime = getClockTime(at, timeformat);

    switch(viewType) {
      case 'note.nameChange':
        return `
          <li class=room-note> 
            <q cite=acct:app@server>${safe(username)} changed their name to ${safe(newUsername)}</q>
            <div class=metadata>
              <time datetime=${iso8601}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'note.newMember':
        return `
          <li class=room-note> 
            <q cite=acct:app@server>
              ${safe(newUsername)} entered the room.
              <br>
              ${safe(memberCount)} total members.
            </q>
            <div class=metadata>
              <time datetime=${iso8601}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'note.disconnection':
        return `
          <li class=room-note> 
            <q cite=acct:app@server>${safe(username)} left the room.</q>
            <div class=metadata>
              <time datetime=${iso8601}>${fullTime}</time>
            </div>
          </li>
        `;
      case 'chat.message':
        return `
          <li class="message ${fromMe? 'from-me' : ''}">
            <q cite=acct:${username}>${safe(message)}</q>
            <div class=metadata>
              <cite rel=author>${safe(username)}</cite>
              <time datetime=${iso8601}>${fullTime}</time>
            </div>
          </li>
        `;
      default:
      case 'log.unknownMessageType':
        log({unknownMessageType: {message, at, newUsername, username, disconnection, fromMe, viewType}});
        break;
    }
  }

  function Settings(state) {
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
              <input type=text name=username maxlength=40 placeholder="guest0001" value=${safe(username)}>
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
              <input type=radio name=sendhotkey value=ctrlenter 
                ${sendhotkey == 'ctrlenter' ? C : _}>
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

    // note the value attributes of language <option>s above 
    // need to be valid codes that can be applied to html.lang attribute 
  }

  // a view function for document.title
    // this may seem strange but it keeps
    // consistency with the idea of the view (markup + other stuff including title)
    // is a function of state 
  export function AppTitle (state) {
    let title = 'Chat App Homework';

    if ( state.route ) {
      title += ` - ${state.route}`;
    }

    if ( state.view.showUnreadCount && state.chat.unreadCount ) {
      title = `(${state.chat.unreadCount}) ` + title;
    }

    return title;
  }

// helpers
  // Notes
    // This fixes unreliable autofocus attribute to ensure message composer is focused
    // autofocus attribute fails in some cases including when hash fragment present
  function focusComposer() {
    setTimeout(() => {
      const composer = document.querySelector('form.messager .composer'); 
      if ( composer instanceof HTMLTextAreaElement && document.activeElement != composer ) {
        composer.focus();
      }
    }, 0);
    // setTimeout ensured we wait until after render
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
      hourStr = hour.toString();
    } else {
      hourStr = hour.toString().padStart(2, '0');
    }

    minuteStr = minute.toString().padStart(2, '0');

    return `${hourStr}:${minuteStr} ${half}`;
  }

  // mitigate XSS
  function safe(userContent = '') {
    return (userContent+'').replace(/"/g, '&quot;').replace(/>/g, '&gt;').replace(/</g, '&lt;');
  }

