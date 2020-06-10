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

