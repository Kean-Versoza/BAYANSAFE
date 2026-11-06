import { spawn } from 'node:child_process';
await import('./server/env.js');

const base = 'http://localhost:3101';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDir = 'C:/Users/acer/AppData/Local/Temp/opencode/chrome-cdp-vw-' + Date.now();
const port = 9966 + Math.floor(Math.random() * 200);

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

await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.enable');
await send('Page.navigate', { url: `${base}/` });
await sleep(4000);

const r = await send('Runtime.evaluate', {
  expression: `JSON.stringify({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, mq700: window.matchMedia('(max-width:700px)').matches, mq1024: window.matchMedia('(max-width:1024px)').matches })`,
  returnByValue: true,
});
console.log(r.result.result.value);

ws.close();
proc.kill();
try {} catch {}
await sleep(200);
