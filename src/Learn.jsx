import { useState } from "react";
import { useStudent } from "./StudentContext";

const cats = ["All", "Skills", "Industry", "Digital & Tools"];

export default function Learn() {
  const { xp, courses, completeModule, certificates, db } = useStudent();
  const [active, setActive] = useState("All");
  const modXp = db.activities.find((a) => a.id === "learn_module").baseXp;
  const shown = active === "All" ? courses : courses.filter((c) => c.category === active);
  const recommended = courses.find((c) => c.modulesDone === 0);

  return (
    <div className="container">
      <div className="section-heading" style={{ marginTop: 0 }}>
        <div>
          <h1 className="page-title">Learn</h1>
          <p className="page-subtitle">Finish modules to earn {modXp} XP each, and collect certificates along the way.</p>
        </div>
        <span className="pill pill-xp">⚡ {xp.toLocaleString()} XP</span>
      </div>

      {recommended && (
        <div className="recommend-banner">
          <div>
            <p className="unlock-eyebrow">RECOMMENDED FOR YOU</p>
            <h3>{recommended.title}</h3>
            <p className="activity-desc">{recommended.modulesTotal} modules · builds on your marketing and design skills.</p>
          </div>
          <button className="btn-cta" onClick={() => completeModule(recommended.id)}>▷ Start course</button>
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
                <button className="btn btn-primary" onClick={() => completeModule(c.id)}>
                  {c.modulesDone > 0 ? "→ Complete next module" : "▷ Start course"} (+{modXp} XP)
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="section-heading"><h2>Your certificates</h2></div>
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
