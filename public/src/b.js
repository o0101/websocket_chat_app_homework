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
    el.parentElement && el.parentElement.localName != 'html' ? `${imperfectlyGetSelector(el.parentElement)} > ` : ''  
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

