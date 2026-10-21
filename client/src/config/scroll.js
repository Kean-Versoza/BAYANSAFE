/**
 * Scroll sensitivity for the one-page-at-a-time controller, per device.
 *
 * The main page turns at most ONE page per scroll gesture, so "sensitivity"
 * here is how much scrolling a gesture has to cover before the page turns: a
 * SMALLER number makes the page turn sooner.
 *
 * A trackpad and a mouse wheel are counted in their own natural units, because
 * they report scroll distance completely differently - a trackpad streams
 * dozens of tiny (often fractional) deltas per swipe, a wheel sends one big
 * delta per notch:
 *
 *   trackpad.turnAt   scrolled PIXELS that turn one page
 *   mouse.turnAt      wheel NOTCHES that turn one page
 *
 * `afterTurn` is the same measurement for a gesture that starts right after a
 * turn. It is what stops a flick's inertial tail - or a fast wheel spin - from
 * flipping a second page, so it is normally a little larger than `turnAt`.
 *
 * `idle` is the pause that separates one gesture from the next. Raise it if you
 * want fast repeated input to count as a single gesture; lower it if a scroll
 * that has clearly stopped is not being accepted quickly enough.
 *
 * The detected device is published as <html data-input-device="trackpad|mouse">
 * so you can confirm it in devtools. If it guesses wrong on your hardware, set
 * `force` and it will stop guessing.
 */
const scrollSensitivity = {
  /** 'trackpad', 'mouse', or null to detect the device automatically. */
  force: null,

  /** Touchpads, Magic Mouse, and anything else with smooth high-res deltas. */
  trackpad: {
    turnAt: 35, // scrolled pixels that turn one page
    afterTurn: 45, // ...for a gesture starting right after a turn
    idle: 100, // pause (ms) that ends a gesture
  },

  /** Classic clicky mouse wheels: one big delta per notch. */
  mouse: {
    turnAt: 1, // wheel notches that turn one page (1 = every notch flips a page)
    afterTurn: 1, // ...for a gesture starting right after a turn
    idle: 100, // pause (ms) that ends a gesture
  },
};

export default scrollSensitivity;
