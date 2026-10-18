import { useState } from "react";
import { useStudent } from "./StudentContext";

const cats = ["All", "Skills", "Industry", "Digital & Tools"];

export default function Learn() {
  const { xp, courses, completeModule, certificates, db, checkActivity, busy } = useStudent();
  const [active, setActive] = useState("All");
  const moduleActivity = db.activities.find((a) => a.id === "learn_module");
  const modXp = moduleActivity?.baseXp ?? 50;
  const shown = active === "All" ? courses : courses.filter((c) => c.category === active);
  const recommended = courses.find((c) => c.modulesDone === 0);

  return (
    <div className="container">
      <div className="section-heading" style={{ marginTop: 0 }}>
        <div>
          <h1 className="page-title">Learn</h1>
          <p className="page-subtitle">Complete demo learning modules to request XP from the server (subject to daily limits).</p>
        </div>
        <span className="pill pill-xp">⚡ {xp.toLocaleString()} XP</span>
      </div>

      {recommended && checkActivity("learn_module")?.ok && (
        <div className="recommend-banner">
          <div>
            <p className="unlock-eyebrow">RECOMMENDED FOR YOU</p>
            <h3>{recommended.title}</h3>
            <p className="activity-desc">{recommended.modulesTotal} modules · builds on your marketing and design skills.</p>
          </div>
          <button className="btn-cta" onClick={() => completeModule(recommended.id)} disabled={busy}>▷ Start course</button>
        </div>
      )}

      <div className="chip-row">
        {cats.map((c) => (
          <button key={c} className={`chip${active === c ? " active" : ""}`} onClick={() => setActive(c)}>{c}</button>
        ))}
      </div>

      <div className="card-grid cols-3">
        {shown.map((c) => {
          const pct = Math.round((c.modulesDone / c.modulesTotal) * 100);
          const done = c.modulesDone === c.modulesTotal;
          return (
            <div className="course-card" key={c.id}>
              <p className="course-provider">{c.provider}</p>
              <h3 className="course-title">{c.title}</h3>
              <p className="course-bonus">{done ? "✓ Certificate earned" : `${c.modulesTotal} modules`}</p>
              <div className="course-modules"><span>{c.modulesDone}/{c.modulesTotal} modules</span><span>{pct}%</span></div>
              <div className="progress-track light"><div className={`progress-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} /></div>
              {done ? (
                <button className="btn btn-earned" disabled>🏅 Certificate earned</button>
              ) : (
                <button className="btn btn-primary" onClick={() => completeModule(c.id)} disabled={busy || !checkActivity("learn_module")?.ok}>
                  {c.modulesDone > 0 ? "→ Complete next module" : "▷ Start course"} (up to +{modXp} XP)
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-heading"><h2>Example certificates</h2></div><p className="muted">These are demonstration examples; certificate verification is not connected to the API.</p>
      <div className="card-grid cols-2">
        {certificates.map((c) => (
          <div className="list-row" key={c.id}>
            <div className={`list-row-icon${c.status === "verified" ? " done" : " pending"}`}>🎖</div>
            <div className="list-row-body"><p className="list-row-title">{c.title}</p><p className="list-row-meta">{c.issuer} · {c.date}</p></div>
            <span className={c.status === "verified" ? "pill-done" : "pill-pending"}>{c.status === "verified" ? "Verified" : "Pending review"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
