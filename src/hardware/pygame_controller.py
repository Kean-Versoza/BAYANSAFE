"""Optional USB HID joystick/buttons adapter using Pygame's standard input API.

The first connected controller is used.  Its analog stick gives completely
free (360 degree) movement, and its four face buttons are translated to the
keyboard actions the game already understands:

    button 1  next / confirm / pick up / equip      -> Return
    button 2  back / cancel / throw / unequip       -> Backspace
    button 3  select / objective                    -> Tab
    button 4  start / pause                         -> P

Custom serial boards should implement the same key-event contract after their
protocol and pinout are confirmed.
"""
import pygame


class PygameController:
    """Translate one joystick into keyboard events for the whole game.

    ``BUTTON_ACTIONS`` is the single source of truth for the four buttons.
    The key column stays in sync with the bindings used by the menu states and
    by ``StoryLevelState.handle_event`` / ``BaseLevel.handle_input``.
    """

    BUTTON_ACTIONS = {
        # physical button: (semantic action, key posted to the game)
        0: ("confirm",   pygame.K_RETURN),     # next / confirm / pick up / equip
        1: ("back",      pygame.K_BACKSPACE),  # back / cancel / throw / unequip
        2: ("objective", pygame.K_TAB),        # select / objective
        3: ("pause",     pygame.K_p),          # start / pause
    }

    # Kept for code/tests that referred to the old attribute name.
    DEFAULT_BUTTONS = {button: key for button, (_, key) in BUTTON_ACTIONS.items()}

    DEFAULT_DEADZONE = 0.28

    def __init__(self, deadzone=DEFAULT_DEADZONE, repeat_delay=0.36, repeat_rate=0.16):
        pygame.joystick.init()
        self.deadzone = float(deadzone)
        self.repeat_delay = float(repeat_delay)
        self.repeat_rate = float(repeat_rate)
        self.buttons = dict(self.DEFAULT_BUTTONS)
        self.devices = []
        self.active_axes = {}
        self.repeat_timers = {}
        self.button_state = {}
        self._refresh()

    # ------------------------------------------------------------------
    # Device management
    # ------------------------------------------------------------------
    def _refresh(self):
        count = pygame.joystick.get_count()
        if count != len(self.devices):
            for device in self.devices:
                try:
                    device.quit()
                except pygame.error:
                    pass
            self.devices.clear()
            self.active_axes.clear()
            self.repeat_timers.clear()
            self.button_state.clear()
        while len(self.devices) < count:
            joystick = pygame.joystick.Joystick(len(self.devices))
            joystick.init()
            self.devices.append(joystick)

    def _clear_state(self):
        self.devices.clear()
        self.active_axes.clear()
        self.repeat_timers.clear()
        self.button_state.clear()

    # ------------------------------------------------------------------
    # Analog stick
    # ------------------------------------------------------------------
    def axis(self, index=0):
        """Return the raw value of axis *index*, or 0.0 when unavailable."""
        if not self.devices:
            return 0.0
        try:
            if self.devices[0].get_numaxes() > index:
                return self.devices[0].get_axis(index)
        except pygame.error:
            self._clear_state()
        return 0.0

    def analog_vector(self, deadzone=None):
        """Return ``(x, y)`` from the first stick.

        Values inside the deadzone are zeroed; everything else is passed
        through unchanged, so diagonal and in-between directions are kept.
        This is what gives omnidirectional movement (see
        ``Player.get_direction``).
        """
        zone = self.deadzone if deadzone is None else float(deadzone)
        x, y = self.axis(0), self.axis(1)
        if abs(x) <= zone:
            x = 0.0
        if abs(y) <= zone:
            y = 0.0
        return x, y

    def _post_key(self, key):
        return pygame.event.Event(pygame.KEYDOWN, key=key, repeat=False)

    # ------------------------------------------------------------------
    # Event translation
    # ------------------------------------------------------------------
    def poll_events(self, dt):
        """Translate stick directions and button edges to game key events."""
        self._refresh()
        if not self.devices:
            self.active_axes.clear()
            self.repeat_timers.clear()
            self.button_state.clear()
            return []
        joystick = self.devices[0]
        events = []
        axes = {}
        try:
            if joystick.get_numaxes() >= 2:
                x, y = joystick.get_axis(0), joystick.get_axis(1)
                # Digital directions are only used for menu navigation;
                # in-game movement reads the raw analog value instead.
                axes[pygame.K_LEFT] = x < -self.deadzone
                axes[pygame.K_RIGHT] = x > self.deadzone
                axes[pygame.K_UP] = y < -self.deadzone
                axes[pygame.K_DOWN] = y > self.deadzone
        except pygame.error:
            self._clear_state()
            return []
        for key, active in axes.items():
            was_active = self.active_axes.get(key, False)
            if active:
                self.repeat_timers[key] = self.repeat_timers.get(key, 0.0) - dt
                if not was_active or self.repeat_timers[key] <= 0:
                    events.append(self._post_key(key))
                    self.repeat_timers[key] = self.repeat_delay if not was_active else self.repeat_rate
            else:
                self.repeat_timers.pop(key, None)
            self.active_axes[key] = active
        for button, key in self.buttons.items():
            try:
                active = button < joystick.get_numbuttons() and bool(joystick.get_button(button))
            except pygame.error:
                active = False
            if active and not self.button_state.get(button, False):
                events.append(self._post_key(key))
            self.button_state[button] = active
        return events
