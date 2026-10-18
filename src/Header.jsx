import { useState } from 'react';
import { Link, NavLink } from 'react-router';
import { useStudent } from './StudentContext';

const links = [
  { to: '/', label: 'Home', icon: '⌂', end: true },
  { to: '/learn', label: 'Learn', icon: '✧' },
  { to: '/earn', label: 'Earn & Gigs', icon: '⚔' },
  { to: '/messages', label: 'Messages', icon: '✉' },
  { to: '/diary', label: 'Diary', icon: '▤' },
  { to: '/profile', label: 'Profile', icon: '♙' },
  { to: '/about', label: 'About', icon: '✦' },
];

export default function Header({ onLogout }) {
  const [open, setOpen] = useState(false);
  const { xp, levelInfo } = useStudent();
  return <header className="site-header arcade-header">
    <div className="site-header-inner arcade-header-inner">
      <Link to="/" className="brand arcade-brand" onClick={() => setOpen(false)}>
        <img className="brand-mark" src="/alumable-logo.png" alt="" />
        <span>alumable<small>GAMIFICATION ENGINE</small></span>
      </Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        {links.map((item) => <NavLink key={item.to} end={item.end} to={item.to} className={({ isActive }) => `arcade-nav-link${isActive ? ' active' : ''}`}>
          <span aria-hidden="true">{item.icon}</span>{item.label}
        </NavLink>)}
      </nav>
      <div className="site-header-right">
        <span className="arcade-xp" title="Your current XP and level">✦ <strong>{xp.toLocaleString()}</strong> XP <i /> LVL {levelInfo.level}</span>
        <button className="header-switch" onClick={onLogout} title="Sign out of this account">↪ <span>Switch role</span></button>
        <button className={`hamburger-btn${open ? ' open' : ''}`} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span /><span /><span />
        </button>
      </div>
    </div>
    {open && <><button className="menu-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />
      <nav className="dropdown-menu" aria-label="Mobile navigation">
        {links.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `dropdown-link${isActive ? ' active' : ''}`} onClick={() => setOpen(false)}>{item.icon} &nbsp; {item.label}</NavLink>)}
        <button className="dropdown-link" onClick={() => { setOpen(false); onLogout(); }}>↪ Switch role</button>
      </nav></>}
  </header>;
}
