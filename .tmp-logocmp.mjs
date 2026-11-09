import { spawn } from 'node:child_process';
await import('./server/env.js');

const base = 'http://localhost:3101';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDir = 'C:/Users/acer/AppData/Local/Temp/opencode/chrome-cdp-logocmp-' + Date.now();
const port = 9962 + Math.floor(Math.random() * 200);

const proc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', `--user-data-dir=${userDir}`,
  `--remote-debugging-port=${port}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let list;
for (let i = 0; i < 40; i++) {
  try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.length) break; } catch {}
  await sleep(250);
}
if (!list?.length) throw new Error('no target');

const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));

let id = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve) => pending.set(callId, resolve));
};

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.enable');

for (const path of ['/', '/account']) {
  await send('Page.navigate', { url: `${base}${path}` });
  await sleep(4000);
  // For home, scroll to about section
  if (path === '/') {
    await send('Runtime.evaluate', { expression: `document.getElementById('about')?.scrollIntoView({block:'start'});` });
    await sleep(1000);
  }
  const r = await send('Runtime.evaluate', {
    expression: `(() => { const l=document.querySelector('.logo img'); if(!l) return JSON.stringify({logo:null}); const lr=l.getBoundingClientRect(); const cs=getComputedStyle(l); return JSON.stringify({logoHeight:Math.round(lr.height), logoTop:Math.round(lr.top), logoLeft:Math.round(lr.left), opacity:cs.opacity, visibility:cs.visibility}); })()`,
    returnByValue: true,
  });
  console.log(path, r.result.result.value);
}

ws.close();
proc.kill();
try {} catch {}
await sleep(200);
