import { useEffect } from 'react';
import scrollSensitivity from '../config/scroll';

const SETTLE_MS = 300; // how long the stricter after-turn threshold applies
const NOTCH_PX = 100; // scroll distance a mouse-wheel notch usually reports
const PAGE_TURN_MS = 390; // how long one page turn takes
const SCROLL_EPSILON = 3; // movement we did not make = someone else scrolled
const SWIPE_MIN_PX = 38; // shortest touch swipe that turns a page
const SWIPE_FRACTION = 0.1; // ...or that fraction of the screen

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function isTypingNode(node) {
  if (!node) return false;
  if (node.isContentEditable) return true;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function activatesWithSpace(node) {
  if (!node) return false;
  if (node.tagName === 'BUTTON' || node.tagName === 'SUMMARY') return true;
  if (node.tagName === 'INPUT' && ['checkbox', 'radio', 'button', 'submit'].includes(node.type)) {
    return true;
  }
  return node.getAttribute?.('role') === 'button';
}

/**
 * Guess which device produced a wheel event. A trackpad streams many small,
 * often fractional deltas; a mouse wheel sends whole notches (100px in Chrome,
 * a few lines elsewhere). When a single event is ambiguous we keep the previous
 * answer, so the device only changes on real evidence.
 */
function detectDevice(event, previous) {
  if (event.deltaMode !== 0) return 'mouse'; // line/page deltas = classic wheel
  const x = Math.abs(event.deltaX);
  const y = Math.abs(event.deltaY);
  if (y !== 0 && !Number.isInteger(event.deltaY)) return 'trackpad'; // high-res
  if (y > 0 && y < 40) return 'trackpad'; // small increments
  if (x !== 0 && y !== 0) return 'trackpad'; // two-finger diagonal gesture
  if (y >= 100 && y % 100 === 0) return 'mouse'; // a whole notch
  if (y >= 120 && y % 120 === 0) return 'mouse';
  return previous;
}

/**
 * One-page-at-a-time scrolling for the main page.
 *
 * This hook is the only thing allowed to scroll the main page: wheel, touch
 * swipes and the arrow/page/space keys all route through one rAF turn that is
 * strictly monotonic (ease-out, no overshoot) and lands exactly on a screen
 * boundary. CSS scroll-snap is deliberately *not* used - the browser's own
 * snapping is what pulls the page back after a partial gesture, and it can
 * skip screens on a fling.
 *
 * Wheel/trackpad rules - and they matter, because a trackpad flick keeps
 * firing wheel events long after the fingers leave the pad:
 *   - the device is detected per event and each device has its own sensitivity
 *     (see config/scroll.js): trackpad thresholds are pixels, wheel thresholds
 *     are notches;
 *   - a gesture ends only on a direction change or a pause of that device's
 *     idle time, so an accelerating flick, a fast mouse spin and a long
 *     inertial tail all count as ONE gesture and turn exactly ONE page;
 *   - wheel speed is never used to guess a new gesture - a flick accelerates
 *     as it starts, and treating that as "new" is what caused double turns;
 *   - while the page is turning, only a clearly separate gesture (pause or
 *     reversal) is remembered, so nothing is dropped but nothing is skipped;
 *   - for SETTLE_MS after a turn a resumed tail must travel further before it
 *     may turn again, so one flick can never be split into two pages.
 *
 * Stops: every section top, plus an "end reveal" stop for a section taller
 * than the screen (so its lower half stays reachable), plus the document
 * bottom for the footer. When all sections fit - the common case - there is
 * exactly one stop per screen.
 */
export default function usePageSnap() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('snap-scroll');

    let frame = 0;
    let animating = false;
    let expected = window.scrollY;
    let pendingDirection = 0;

    const getTargets = () => {
      const viewport = window.innerHeight;
      const stops = [];

      document.querySelectorAll('.section').forEach((node) => {
        const top = Math.round(node.offsetTop);
        stops.push(top);
        if (node.offsetHeight > viewport + 2) {
          stops.push(Math.round(top + node.offsetHeight - viewport));
        }
      });

      stops.push(Math.round(document.documentElement.scrollHeight - viewport));
      return [...new Set(stops)].filter((top) => top >= 0).sort((a, b) => a - b);
    };

    const nearestIndex = (targets, position) => {
      let index = 0;
      let best = Infinity;
      targets.forEach((top, i) => {
        const distance = Math.abs(top - position);
        if (distance < best) {
          best = distance;
          index = i;
        }
      });
      return index;
    };

    const stopAnimation = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      animating = false;
      expected = window.scrollY;
    };

    const animateTo = (top) => {
      stopAnimation();

      const start = window.scrollY;
      const distance = top - start;

      if (Math.abs(distance) < 1 || prefersReducedMotion()) {
        window.scrollTo({ top, behavior: 'instant' });
        const queued = pendingDirection;
        pendingDirection = 0;
        if (queued) turn(queued);
        return;
      }

      const startedAt = performance.now();
      animating = true;
      expected = start;

      const step = (now) => {
        // A nav jump / scrollbar drag / focus scroll took over: yield to it.
        if (Math.abs(window.scrollY - expected) > SCROLL_EPSILON) {
          stopAnimation();
          pendingDirection = 0;
          return;
        }

        const progress = Math.min(1, (now - startedAt) / PAGE_TURN_MS);
        const eased = 1 - (1 - progress) ** 3; // ease-out, never overshoots
        window.scrollTo({ top: start + distance * eased, behavior: 'instant' });
        expected = window.scrollY;

        if (progress < 1) {
          frame = requestAnimationFrame(step);
        } else {
          finishTurn();
        }
      };

      frame = requestAnimationFrame(step);
    };

    const finishTurn = () => {
      stopAnimation();
      const queued = pendingDirection;
      pendingDirection = 0;
      if (queued) turn(queued);
    };

    const turn = (direction) => {
      const targets = getTargets();
      const index = nearestIndex(targets, window.scrollY);
      const next = Math.min(targets.length - 1, Math.max(0, index + direction));

      if (next === index) {
        pendingDirection = 0;
        return;
      }

      animateTo(targets[next]);
    };

    const requestTurn = (direction) => {
      if (animating) {
        if (!pendingDirection) pendingDirection = direction;
        return;
      }
      turn(direction);
    };

    /* ------------------------------ mouse / trackpad --------------------- */
    let accumulated = 0;
    let lastWheelAt = 0;
    let gestureDirection = 0;
    let spent = false; // the gesture in progress has already turned its page
    let lastTurnAt = -Infinity;
    let device = scrollSensitivity.force || 'trackpad';
    root.dataset.inputDevice = device;

    const onWheel = (event) => {
      if (event.ctrlKey) return; // pinch-zoom
      // Two-finger horizontal trackpad gestures are left to the browser.
      if (!event.shiftKey && Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

      const raw = event.shiftKey && !event.deltaY ? event.deltaX : event.deltaY;
      if (!raw) return;
      event.preventDefault();

      const detected = scrollSensitivity.force || detectDevice(event, device);
      if (detected !== device) {
        device = detected;
        root.dataset.inputDevice = device;
      }
      const settings = scrollSensitivity[device];

      // Normalise line/page deltas (other engines) to pixels.
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
      const delta = raw * scale;
      const direction = delta > 0 ? 1 : -1;

      // Trackpads count in pixels; a wheel counts in notches, so "one notch per
      // page" means exactly one click however the browser chose to report it.
      const travelled =
        device === 'mouse' ? Math.max(1, Math.round(Math.abs(delta) / NOTCH_PX)) : Math.abs(delta);

      const now = performance.now();
      const gap = now - lastWheelAt;
      lastWheelAt = now;

      // A gesture ends on a direction change or a pause. Inertial momentum
      // keeps firing with tiny gaps, so it stays inside the same gesture and
      // can never turn a second page.
      const fresh =
        gap > settings.idle || (gestureDirection !== 0 && direction !== gestureDirection);

      if (fresh) {
        gestureDirection = direction;
        accumulated = 0;
        spent = false;
      } else if (spent) {
        return; // this gesture has already had its page
      }

      accumulated += direction * travelled;
      // Soon after a turn a resumed tail must travel a deliberate flick's worth
      // before it may turn again, so one flick can never split into two pages.
      const needed = now - lastTurnAt < SETTLE_MS ? settings.afterTurn : settings.turnAt;
      if (Math.abs(accumulated) < needed) return;

      accumulated = 0;
      spent = true;
      lastTurnAt = now;

      if (animating) {
        // The page is already moving: remember at most one extra turn.
        if (!pendingDirection) pendingDirection = direction;
        return;
      }
      turn(direction);
    };

    /* -------------------------------- touch ------------------------------ */
    // 0 = idle, 1 = we own this finger (vertical), 2 = browser owns it
    let touchMode = 0;
    let touchY = 0;

    const onTouchStart = (event) => {
      if (event.touches.length > 1) {
        touchMode = 2; // pinch-zoom: stay out of the way
      } else if (event.touches.length === 1 && touchMode === 0) {
        touchMode = 1;
        touchY = event.touches[0].clientY;
      }
    };

    const onTouchMove = (event) => {
      if (touchMode !== 1) return;
      if (event.touches.length > 1) {
        touchMode = 2;
        return;
      }
      // The page never drifts under the finger: no native scroll means no
      // rubber-band to spring back afterwards.
      event.preventDefault();
    };

    const onTouchEnd = (event) => {
      if (event.touches.length > 0) return;
      const mode = touchMode;
      touchMode = 0;
      if (mode !== 1) return;

      const deltaY = (event.changedTouches[0]?.clientY ?? touchY) - touchY;
      const threshold = Math.max(SWIPE_MIN_PX, window.innerHeight * SWIPE_FRACTION);
      if (Math.abs(deltaY) < threshold) return; // too small: the page holds still

      requestTurn(deltaY < 0 ? 1 : -1);
    };

    const onTouchCancel = () => {
      touchMode = 0;
    };

    /* ------------------------------- keyboard ---------------------------- */
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;

      // Caret keys inside a field stay native.
      if (isTypingNode(document.activeElement)) return;

      const down =
        event.key === 'ArrowDown' || event.key === 'PageDown' ||
        (event.key === ' ' && !event.shiftKey);
      const up =
        event.key === 'ArrowUp' || event.key === 'PageUp' ||
        (event.key === ' ' && event.shiftKey);
      const jump = event.key === 'Home' || event.key === 'End';

      if (!down && !up && !jump) return;
      // Space must still activate a focused button.
      if (event.key === ' ' && activatesWithSpace(document.activeElement)) return;

      event.preventDefault();
      if (event.repeat) return; // holding a key still moves one page per press

      if (jump) {
        pendingDirection = 0;
        const targets = getTargets();
        animateTo(event.key === 'Home' ? targets[0] : targets[targets.length - 1]);
        return;
      }

      requestTurn(down ? 1 : -1);
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      stopAnimation();
      root.classList.remove('snap-scroll');
      delete root.dataset.inputDevice;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
