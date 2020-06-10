# [:bowl_with_spoon:	bulgogi](https://github.com/cris691/bulgogi)

#### [![version](https://img.shields.io/npm/v/bulgogi.svg?label=&color=0080FF)](https://github.com/cris691/bulgogi/releases/latest) ![npm downloads](https://img.shields.io/npm/dt/bulgogi)

**bulgogi** is the no-framework render function proof of concept.

## Features

- minimal footprint
- nest views
- immediate mode GUI
- imperfectly save and restore focus

## Features (of ommission)

- JSX
- state management
- lifecycle hooks
- props
- cute declarative/imperative attribute syntax (*I'm lookin' at you, Vue*)
- pages of README about how absolutely f##cking brilliant this amazing new framework is
- sexyness and trendiness

## Contribute

Yes, please contribute. But not to "add new awesome feature X", and stretch and extend the poor code until it's all bent out of shape and has a breakdown trying to people please everybody all the time.

Instead, submit thoughtful issues and PRs that aim to improve the code quality, simplicity, portability, developer experience, performance, and so on. Funnily enough, there's a lot of work there that can make a big impact. :smiley:

When evaluating issues/features/fixes, consider the following in order of importance:

Does my issue/PR increase:

- code quality
- simplicity
- portability
- dev experience
- performance

## Get it? Just kidding. "How to" get it.

```console
npm i --save bulgogi
```

## In its entirety

```javascript
  const parser = new DOMParser();

  const consistentFocus = imperfectlySaveAndRestoreFocus();

  function toDOM(markup) {
    return parser.parseFromString(markup, 'text/html');
  }

  export function update(view, state) {
    consistentFocus.next();
    
    const docEl = toDOM(view(state)).documentElement;
    document.documentElement.replaceWith(docEl);

    consistentFocus.next();
  }

  function *imperfectlySaveAndRestoreFocus() {
    while(true) {
      const active = document.activeElement;
      let selectionStart,selectionEnd;
      if ( active ) {
        ({selectionStart,selectionEnd} = active);
      }

      yield;

      if ( active ) {
        const newActive = document.querySelector(imperfectlyGetSelector(active));
        if ( newActive ) {
          newActive.focus();
          try {
            Object.assign(newActive,{selectionStart,selectionEnd});
          } catch(e) {}
        }
      }

      yield;
    }
  }

  function imperfectlyGetSelector(el) {
    // the first html to our selector does not help specificity
    return `${
      el.parentElement && el.parentElement.localName != 'html' ? 
        `${imperfectlyGetSelector(el.parentElement)} > ` : ''  
    }${
      el.localName
    }${
      el.id ? `#${el.id.replace(/\./g, '\\\\.')}` : ''
    }${
      el.classList.length ? `.${[...el.classList].join('.')}` : ''
    }${
      el.name ? `[name="${el.name}"]` : ''
    }`;
  }
```

## Docs `update(view, state)` via example

```javascript
  import {update} from './b.js';

  let counter = 0;

  runTest();
  setInterval(runTest, 2000);

  function runTest() {
    update(Test, {counter:counter++});
  }

  function Test(state) {
    return `
      <article class=excellent>
        <h1>An Article Title</h1>
        ${Test2(state)}
      </article>
    `
  }

  function Test2({counter}) {
    return `
      <form method=GET action=/hello>
        <input type=number name=xchakka value=${counter}>
        <input type=text name=bigloo value=${counter}>
        <button onclick=runFormTest(this,event,onclick,name,xchakka);>Do it</button>
      </form>
    `;
  }

  function runFormTest(...a) { 
    return (console.log(...a), a[1].preventDefault(), false) 
  }; 

  self.runFormTest = runFormTest;
```

## Benefits

- not a framework, just 1 function from a file with < 90 SLOC. 
- write HTML with templates
- use inline (HTML attribute) event handlers functions
- use format `oneventname=myHandler(<...my args>)` instead of `oneventname=<...my code>` because you can inject special variables from the attribute handler scope as parameters to your function without having them pollute the scope of your function`
  - benefits include useful variables available in scope of the attribute value like:
    - event: the Event that fired
    - this: the event target the handler is attached to
    - `<elprop>`: the property named by `elprop` of the element its attached to, overrides
    - `<name>`: the form control named by `name` of any `form` ancestor, overrides
    - `<docprop>`: the property named by `docprop` of any document ancestor
  - details about which elements are reflected to the document or window, [here](https://developer.mozilla.org/en-US/docs/Web/Guide/Events/Event_handlers) and [here](https://html.spec.whatwg.org/multipage/webappapis.html#event-handlers-on-elements,-document-objects,-and-window-objects)
  
--------

![bulgogi really wants you, it even grew a moustache for you](https://user-images.githubusercontent.com/22254235/83939389-2d86b480-a80f-11ea-87a0-b49c154f6d1f.jpg)


# *bulgogi!*
