import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useStudent } from "./StudentContext";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/learn", label: "Learn" },
  { to: "/earn", label: "Earn" },
  { to: "/messages", label: "Messages" },
  { to: "/profile", label: "Profile" },
  { to: "/about", label: "About" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { xp, levelInfo } = useStudent();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <NavLink to="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">A</span>
          <span className="brand-name">Alumable</span>
        </NavLink>

        <div className="site-header-right">
          <span className="pill pill-xp header-xp-pill">
            ⚡ {xp.toLocaleString()} XP · Lv.{levelInfo.level}
          </span>

          <button
            className={`hamburger-btn${open ? " open" : ""}`}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {open && (
        <>
          <button
            className="menu-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <nav className="dropdown-menu">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `dropdown-link${isActive ? " active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
