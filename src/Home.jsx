import { Link } from "react-router-dom";
import { useStudent } from "./StudentContext";

export default function Home() {
  const { user, xp, levelInfo, capabilities, levels, activities, checkActivity, claim, ledger } =
    useStudent();

  const nextCap = capabilities.find((c) => !c.unlocked);
  const nextCapXp = nextCap ? levels.find((l) => l.level === nextCap.minLevel).minXp - xp : 0;

  const quests = activities
    .filter((a) => checkActivity(a.id).ok || a.type === "daily")
    .slice(0, 4);

  return (
    <div className="container">
      <div className="hero-row">
        <div>
          <p className="greeting-label">Good morning</p>
          <h1 className="greeting-name">{user.firstName} ✨</h1>
          <p className="page-lede">Here's where you're at. Keep earning XP to unlock new opportunities.</p>
        </div>
        <Link to="/earn" className="btn-cta">⚡ Earn more XP</Link>
      </div>

      <div className="dashboard-grid">
        <div className="level-card">
          <div className="level-card-top">
            <div className="level-trophy">🏆</div>
            <div className="level-info">
              <p className="level-title">Level {levelInfo.level} · {levelInfo.title}</p>
              <p className="level-xp">{xp.toLocaleString()} XP total</p>
            </div>
            {levelInfo.to && <span className="level-remaining">{levelInfo.toNext} XP to {levelInfo.nextTitle}</span>}
          </div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${levelInfo.pct}%` }} /></div>
          <div className="progress-labels">
            <span>{levelInfo.from.toLocaleString()} XP</span>
            <span>{levelInfo.to ? `${levelInfo.to.toLocaleString()} XP` : "Max level"}</span>
          </div>
        </div>

        <div className="unlock-banner">
          <div className="unlock-icon">{nextCap ? "🔒" : "🔓"}</div>
          <div className="unlock-copy">
            <p className="unlock-eyebrow">{nextCap ? `UNLOCKS AT LEVEL ${nextCap.minLevel}` : "ALL UNLOCKED"}</p>
            <p className="unlock-title">{nextCap ? nextCap.label : "You've unlocked everything"}</p>
            {nextCap && <p className="unlock-sub">{nextCapXp} XP away</p>}
          </div>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="stat-icon">🔥</div><div className="stat-value">{user.streak}</div><div className="stat-label">Day streak</div></div>
        <div className="stat-card"><div className="stat-icon">💼</div><div className="stat-value">{user.gigsDone}</div><div className="stat-label">Gigs done</div></div>
        <div className="stat-card"><div className="stat-icon">📈</div><div className="stat-value">#{user.ranking}</div><div className="stat-label">Ranking</div></div>
      </div>

      <div className="section-heading">
        <h2>Today's challenges</h2>
        <Link to="/earn" className="link-add">See all activities →</Link>
      </div>
      <div className="card-grid cols-2">
        {quests.map((a) => {
          const c = checkActivity(a.id);
          return (
            <button key={a.id} className={`list-row list-row-btn${c.ok ? "" : " done-row"}`} disabled={!c.ok} onClick={() => claim(a.id)}>
              <div className={`list-row-icon${c.ok ? "" : " done"}`}>{c.ok ? "○" : "✓"}</div>
              <div className="list-row-body">
                <p className="list-row-title">{a.title}</p>
                <p className="list-row-meta">⏱ {a.duration}</p>
              </div>
              {c.ok ? <span className="pill pill-xp">⚡ {c.points}</span> : <span className="pill-done">Done</span>}
            </button>
          );
        })}
      </div>

      <div className="section-heading"><h2>Recent XP</h2><Link to="/profile" className="link-add">Full history →</Link></div>
      <div className="panel">
        {ledger.slice(0, 4).map((t) => (
          <div className="ledger-line" key={t.id}>
            <span>{t.reason}</span>
            <span className="ledger-pts">+{t.points} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}
