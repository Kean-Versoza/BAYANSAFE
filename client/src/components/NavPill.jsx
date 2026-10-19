const TABS = [
  { target: 'home', label: 'HOME' },
  { target: 'about', label: 'ABOUT' },
  { target: 'registration', label: 'REGISTER' },
];

/** Fixed pill navigation that follows the section currently on screen. */
export default function NavPill({ active, onJump }) {
  return (
    <nav className="nav-pill">
      {TABS.map((tab) => (
        <a
          key={tab.target}
          href={`#${tab.target}`}
          data-target={tab.target}
          className={active === tab.target ? 'active' : undefined}
          onClick={(event) => {
            event.preventDefault();
            onJump(tab.target);
          }}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}
