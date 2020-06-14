# Chat App Homework

A very simple chat app in Node.JS, JavaScript, HTML and CSS. Does not use any framework.

Server is a very simple websocket broadcast server that also tracks usernames to prevent impersonation and conflicts.

Client is a simple JS app that works cross-browser and provides a nice user interface.

# Running

Clone this repo and

```console
npm i && npm test
```

Alternately, [see the demo](http://boogeh.com)

# Features

- [X] Chat page
- [X] Settings page
- [X] Responsive layout across all devices
- [X] Works on latest Chrome, Firefox and Safari
- [X] Chat tab blinking title with unread count
- [X] Working settings for username, color scheme, clock display, and send hotkey.
- [X] Design based on mockups
- [X] No automatic code generation tools used
- [X] Clean, small, modular code
- [X] Working code 
- [X] Tests main functionality of members joining and leaving, and sending messages

# Things that are different

- No optional features. My focus was keeping it simple.
- No React. No framework at all. I requested this and it was okayed.
- No need for CSS preprocessors (CSS here is very simple).
- No need for TypeScript. I used `tsc --checkJs` to check for issues and fixed any. 
- No need for state management. 

# Development Notes

- Most bugs that occured were not type related bugs but due to cross-browser differnces in CSS, layout.
- Adding explicit types would only take more typing and lengthen this homework assignment for no good reason. 
- Adding React would also be unnecessary. This is a simple app, with small components and only 2 routes. There's no need for added complexity. Also, it was related to me that 'no framework would be best IMO'.
- Adding CSS preprocessors would also be unnecessary, the CSS is very simple.
