import { useNavigate } from 'react-router';
const roles = [
  { role: 'student', icon: '⚔', name: 'Student', summary: 'Complete quests, develop skills and unlock gigs.', action: 'START ADVENTURE', theme: 'amber' },
  { role: 'educator', icon: '✦', name: 'Educator', summary: 'Create activities, assign work and review claims.', action: 'ENTER PORTAL', theme: 'blue' },
  { role: 'employer', icon: '▣', name: 'Employer', summary: 'Discover students and manage opportunities.', action: 'ENTER PORTAL', theme: 'green' },
];
export default function RoleLogin() {
  const navigate = useNavigate();
  return <main className="arcade-login">
    <div className="arcade-login-stars" aria-hidden="true" />
    <div className="login-topline"><img src="/alumable-logo.png" alt="" /><span>alumable</span><span className="login-topline-tag">GAMIFICATION ENGINE</span></div>
    <div className="login-layout login-layout-compact">
      <section className="login-choose-panel">
        <span className="arcade-kicker">✦ LEVEL UP IN REAL LIFE ✦</span>
        <p className="login-tagline">Earn XP. Build skills. Unlock real opportunities.</p>
        <span className="arcade-kicker">◈ PLAYER SELECT ◈</span>
        <h2>Choose your <span>path.</span></h2>
        <p className="login-help">Pick your role to continue to the existing Alumable sign-in system.</p>
        <div className="role-options">
          {roles.map((item, index) => <button key={item.role} className={`role-card arcade-role-card ${item.theme}`} onClick={() => navigate(`/login?role=${item.role}`)}>
            <span className="role-number">0{index + 1}</span><span className="role-symbol" aria-hidden="true">{item.icon}</span>
            <span className="role-copy"><strong>{item.name}</strong><small>{item.summary}</small></span>
            <span className="role-arrow" aria-hidden="true">→</span>
          </button>)}
        </div>
        <div className="login-note"><span>▣</span> Use the demo credentials from the project README. The API must be running for login.</div>
      </section>
    </div>
    <p className="login-copyright">ALUMABLE <span>✦</span> REAL SKILLS. REAL PEOPLE. REAL OPPORTUNITIES.</p>
  </main>;
}
