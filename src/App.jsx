import { Routes, Route, Navigate, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import Header from './Header';
import Toast from './Toast';
import Home from './Home';
import Learn from './Learn';
import Earn from './Earn';
import Messages from './Messages';
import Profile from './Profile';
import Diary from './Diary';
import About from './About';
import RoleLogin from './RoleLogin';
import { PartnerLogin, PartnerPortal } from './Partner';
import { clearPartnerSession, getPartnerSession } from './api';
import { useStudent } from './StudentContext';
export default function App() {
 const [session,setSession]=useState(()=>getPartnerSession());
 const location=useLocation();
 const { loading, error, reload } = useStudent();
 // Visual preference only. No change to authentication, XP or API behavior.
 const [theme, setTheme] = useState(() => {
  try { return localStorage.getItem('alumable-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
 });
 useEffect(() => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try { localStorage.setItem('alumable-theme', theme); } catch { /* storage optional */ }
 }, [theme]);
 const themeControl = <button type="button" className="arcade-theme-toggle" onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} aria-pressed={theme === 'light'}><span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>{theme === 'dark' ? 'Light mode' : 'Night mode'}</button>;
 const withTheme = (page) => <>{page}{themeControl}</>;
 const logout=()=>{clearPartnerSession();setSession(null);window.location.assign('/');};
 if(location.pathname==='/partner/login'||location.pathname==='/login') return withTheme(<PartnerLogin onSuccess={setSession}/>);
 if(!session?.token) return withTheme(<RoleLogin/>);
 if(session.role==='educator'||session.role==='employer') return withTheme(<Routes><Route path="/partner/*" element={<PartnerPortal/>}/><Route path="*" element={<Navigate to="/partner" replace/>}/></Routes>);
 if (loading) return withTheme(<main className="arcade-status-page" role="status"><h1>Loading your adventure…</h1><p>Synchronising your account with the Alumable API.</p></main>);
 if (error) return withTheme(<main className="arcade-status-page" role="alert"><h1>Account unavailable</h1><p>{error}</p><p>Your XP has not been changed. Start the backend if necessary and try again.</p><button className="arcade-button arcade-button-gold" onClick={reload}>Retry connection</button></main>);
 return withTheme(<div className="site"><Header onLogout={logout}/><main><Routes><Route path="/" element={<Home/>}/><Route path="/learn" element={<Learn/>}/><Route path="/earn" element={<Earn/>}/><Route path="/messages" element={<Messages/>}/><Route path="/profile" element={<Profile/>}/><Route path="/diary" element={<Diary/>}/><Route path="/about" element={<About/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></main><Toast/></div>);
}
