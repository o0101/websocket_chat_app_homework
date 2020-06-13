import runLoadTest from './loadTest.js';
import runMessageTest from './messageTest.js';

testAll();

async function testAll() {
  const results = {};
  console.group('Running all tests...');
  results.messageTest = await runMessageTest();
  results.loadTest = await runLoadTest();
  console.groupEnd();
  console.log('Completed all tests!');
  const pass = Object.values(results).every(x => x);
  if ( ! pass ) {
    alert(JSON.stringify({fail:{results}},null,2));
    console.warn(JSON.stringify({fail:{results}},null,2));
  } else {
    console.info(`Passes all tests`);
  }
}


