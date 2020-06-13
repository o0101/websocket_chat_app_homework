const parser = new DOMParser();

const consistentFocus = imperfectlySaveAndRestoreFocus();

function toDOM(markup) {
  return parser.parseFromString(markup, 'text/html');
}

export function update(view, state) {
  consistentFocus.next();
  
  const body = toDOM(view(state)).body;
  document.body.replaceWith(body);

  consistentFocus.next();
}

// merge nesed properties into state
export function merge(state, newStateFlat) {
  // Notes
    // normally if we use Object.assign(state, newState), then
    // nested properties not specified in newState will be overwritten
    // so merge does a proper deep merge 
    // but it does it an easy way by requiring all nested property chains 
    // are already converted to flat strings
    // like prop1.prop2.prop3
  [...Object.entries(newStateFlat)].forEach(([key, value]) => {
    const path = key.split('.');
    const lastStep = path.pop();
    let root = state;
    for( const step of path ) {
      if ( ! root[step] ) {
        // fill in gaps
        root = {};
      } else {
        root = root[step];
      }
    }
    root[lastStep] = value;
  });
}

function *imperfectlySaveAndRestoreFocus() {
  while(true) {
    const active = document.activeElement;
    let selectionStart,selectionEnd;

    if ( active && active instanceof HTMLInputElement ) {
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

