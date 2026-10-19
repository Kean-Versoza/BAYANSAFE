/**
 * Skeleton loader engine.
 *
 * Ported 1:1 from the original inline <script> in `templates/base.html`.
 * Everything here is deliberately imperative: the loader measures the *real*
 * DOM (rects, text line boxes, transparent PNG bounds) and paints matching
 * grey boxes on top of it. React owns the `#pageSkeleton` container, this
 * module owns what goes inside it.
 */

// Settings
export const SHOW_LOADER_ON_NAV = true; // true: skeleton flashes on a nav jump. false: smooth scroll only
export const MIN_SHOW = 450; // ms the skeleton stays after the page loads
export const LEAVE_DELAY = 300; // ms the skeleton fades in before a nav jump
export const NAV_LOADER_MS = 400; // ms the skeleton stays after a nav jump
export const FORM_LOADER_MS = 700; // ms the registration form shows a skeleton when it opens (0 = off)

/** Maps a hash / section id to the page view the skeleton should draw. */
export function viewFor(id) {
  id = String(id || '').replace('#', '');
  return id === 'about' || id === 'registration' ? id : 'home';
}

/* =========================================================
   SKELETON BUILDER: measures the real page, so it always lines up
   ========================================================= */

const inkCache = {};

function px(n) {
  return Math.round(n * 10) / 10 + 'px';
}

function put(parent, cls, x, y, w, h, radius) {
  const d = document.createElement('div');
  d.className = cls;
  d.style.left = px(x);
  d.style.top = px(y);
  d.style.width = px(w);
  d.style.height = px(h);
  if (radius) d.style.borderRadius = radius;
  parent.appendChild(d);
  return d;
}

// A box that copies an element's size, position and corner shape
function paintBox(parent, o, el, cls) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  put(parent, cls || 'sk', r.left - o.x, r.top - o.y, r.width, r.height, getComputedStyle(el).borderRadius);
}

// One bar per real line of text, with the real width of that line
function textLines(el) {
  const rects = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const list = range.getClientRects();
    for (let i = 0; i < list.length; i++) {
      if (list[i].width > 1 && list[i].height > 1) rects.push(list[i]);
    }
  }
  rects.sort((a, b) => a.top - b.top || a.left - b.left);
  const lines = [];
  rects.forEach((r) => {
    const last = lines[lines.length - 1];
    if (last) {
      const overlap = Math.min(last.bottom, r.bottom) - Math.max(last.top, r.top);
      if (overlap > 0.5 * Math.min(last.bottom - last.top, r.bottom - r.top)) {
        last.left = Math.min(last.left, r.left);
        last.right = Math.max(last.right, r.right);
        last.top = Math.min(last.top, r.top);
        last.bottom = Math.max(last.bottom, r.bottom);
        return;
      }
    }
    lines.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
  });
  return lines;
}

function paintLines(parent, o, el) {
  if (!el) return;
  const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
  const h = Math.max(6, fs * 0.7);
  textLines(el).forEach((l) => {
    const cy = (l.top + l.bottom) / 2;
    put(parent, 'sk sk-line', l.left - o.x, cy - h / 2 - o.y, l.right - l.left, h, h / 2 + 'px');
  });
}

// Visible part of an image (ignores any transparent padding inside the PNG)
function inkRect(img) {
  const r = img.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!img.complete || !nw || !nh) return { x: r.left, y: r.top, w: r.width, h: r.height };

  let b = inkCache[img.currentSrc];
  if (!b) {
    b = { x0: 0, y0: 0, x1: 1, y1: 1 };
    try {
      const c = document.createElement('canvas');
      c.width = nw;
      c.height = nh;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, nw, nh).data;
      let minX = nw;
      let minY = nh;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < nh; y++) {
        for (let x = 0; x < nw; x++) {
          if (data[(y * nw + x) * 4 + 3] > 24) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= 0) {
        b = { x0: minX / nw, y0: minY / nh, x1: (maxX + 1) / nw, y1: (maxY + 1) / nh };
      }
    } catch {
      /* tainted canvas or decoding problem: fall back to the full box */
    }
    inkCache[img.currentSrc] = b;
  }

  const s = Math.min(r.width / nw, r.height / nh); // object-fit: contain
  const dw = nw * s;
  const dh = nh * s;
  const ox = r.left + (r.width - dw) / 2;
  const oy = r.top + (r.height - dh) / 2;
  return { x: ox + b.x0 * dw, y: oy + b.y0 * dh, w: (b.x1 - b.x0) * dw, h: (b.y1 - b.y0) * dh };
}

function paintInk(parent, o, img, radius) {
  if (!img) return;
  const b = inkRect(img);
  if (b.w < 2 || b.h < 2) return;
  put(parent, 'sk', b.x - o.x, b.y - o.y, b.w, b.h, radius);
}

// Everything inside the registration card (title, fields, checkbox, button)
export function paintFormContents(parent, o, form) {
  paintLines(parent, o, form.querySelector('.form-title'));
  form
    .querySelectorAll('input[type="email"], input[type="text"], input[type="password"]')
    .forEach((inp) => paintBox(parent, o, inp, 'sk'));

  const terms = form.querySelector('.terms');
  if (terms) {
    paintBox(parent, o, terms.querySelector('input'), 'sk');
    paintLines(parent, o, terms);
  }

  paintBox(parent, o, form.querySelector('.btn-submit'), 'sk');
}

/**
 * Fills the skeleton container with boxes that mirror the given view
 * ("home" | "about" | "registration").
 */
export function buildSkeleton(sk, id) {
  if (!sk) return;
  sk.textContent = '';

  const sec = document.getElementById(id) || document.getElementById('home');
  if (!sec) return;

  const fixed = { x: 0, y: 0 }; // nav, logo, cookie bar stay on screen
  const flow = { x: 0, y: sec.getBoundingClientRect().top }; // after the jump the section top is the screen top

  // nav pill + its three tabs
  const nav = document.querySelector('.nav-pill');
  paintBox(sk, fixed, nav, 'sk-pill');
  if (nav) nav.querySelectorAll('a').forEach((a) => paintBox(sk, fixed, a, 'sk'));

  // brand logo (not on Home)
  if (id !== 'home') paintInk(sk, fixed, document.querySelector('#about .logo img'), '0.6rem');

  if (id === 'home') {
    paintInk(sk, flow, sec.querySelector('.main-banner img'), '1rem');
    paintLines(sk, flow, sec.querySelector('.tagline'));
  } else if (id === 'about') {
    paintBox(sk, flow, sec.querySelector('.panel'), 'sk-card');
    sec.querySelectorAll('.disaster-icon').forEach((ic) => paintBox(sk, flow, ic, 'sk'));
    sec.querySelectorAll('.panel p, .panel li').forEach((el) => paintLines(sk, flow, el));
  } else {
    const form = sec.querySelector('.reg-form');
    if (form && !form.classList.contains('hidden-form')) {
      paintBox(sk, flow, form, 'sk-card');
      paintFormContents(sk, flow, form);
    } else {
      paintBox(sk, flow, sec.querySelector('#openFormBtn'), 'sk');
    }
    paintLines(sk, flow, sec.querySelector('.tagline'));
  }

  // cookie bar, when it is showing
  const cb = document.getElementById('cookieBanner');
  if (cb && !cb.hidden) {
    paintBox(sk, fixed, cb, 'sk-cookie');
    paintLines(sk, fixed, cb.querySelector('p'));
    paintBox(sk, fixed, cb.querySelector('button'), 'sk');
  }
}
