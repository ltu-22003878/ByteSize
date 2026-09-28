import { Link } from "react-router-dom";
import { useStudent } from "./StudentContext";

export default function About() {
  const { levels, capabilities, dailyCap } = useStudent();
  return (
    <div className="container narrow">
      <h1 className="page-title">About Alumable</h1>
      <p className="page-lede">Alumable is where earning meets learning. It connects students with real, paid gigs while they study, so you graduate with experience, a portfolio and connections, not just credentials.</p>

      <div className="card-grid cols-3">
        <div className="panel"><h3>💼 Earn flexibly</h3><p className="activity-desc">Short paid projects that fit around your studies.</p></div>
        <div className="panel"><h3>🎨 Build a portfolio</h3><p className="activity-desc">Every gig is also a learning opportunity and adds real work to your profile.</p></div>
        <div className="panel"><h3>🤝 Grow your network</h3><p className="activity-desc">It's who you know, not just what you know.</p></div>
      </div>

      <h2 className="subsection-title">How XP works</h2>
      <div className="panel">
        <p className="activity-desc" style={{ marginTop: 0 }}>Complete activities to earn XP. XP moves you up levels, and each level unlocks new opportunities. To keep things fair there's a daily cap of {dailyCap} XP and per-activity limits.</p>
        <table className="table">
          <thead><tr><th>Level</th><th>XP needed</th><th>Unlocks</th></tr></thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.level}>
                <td>{l.level} · {l.title}</td>
                <td>{l.minXp.toLocaleString()}</td>
                <td>{capabilities.filter((c) => c.minLevel === l.level).map((c) => c.label).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="subsection-title">Alumable Careers Bootcamp</h2>
      <div className="panel">
        <p className="activity-desc" style={{ marginTop: 0 }}>A free, in-person program for university and TAFE students to build human skills and confidence. Melbourne CBD, every Wednesday 5–7pm, 12 Aug – 28 Oct 2026.</p>
        <a className="btn-cta inline" href="https://bootcamp.alumable.com" target="_blank" rel="noreferrer">Learn more about the Bootcamp</a>
      </div>

      <h2 className="subsection-title">Behind the gamification engine</h2>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Area</th><th>What it does</th><th>Built by</th></tr></thead>
          <tbody>
            <tr><td>XP engine</td><td>Activity completion → XP, calculation rules, level progression, unit tests</td><td>Aashmi</td></tr>
            <tr><td>Activities, API & data</td><td>Phase 1 activity list, assignments, XP ledger, mock database, referral</td><td>Sharis</td></tr>
            <tr><td>Levels, unlocks & security</td><td>Level thresholds, unlock mapping, point-change edge cases, anti-farming guardrails</td><td>Dersima</td></tr>
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 20 }}><Link to="/" className="link-add">← Back to Home</Link></p>
    </div>
  );
}
