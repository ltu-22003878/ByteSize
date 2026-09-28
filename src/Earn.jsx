import { useState } from "react";
import { useStudent } from "./StudentContext";

const gigCategories = ["All", "Design", "Writing", "Marketing"];

function ClaimButton({ check, points, onClick }) {
  if (check.ok)
    return <button className="btn btn-claim" onClick={onClick}>Complete & claim ⚡{points ?? check.points}</button>;
  if (check.code === "already_claimed")
    return <button className="btn btn-earned" disabled>✓ Claimed</button>;
  if (check.code === "locked")
    return <button className="btn btn-locked" disabled>🔒 {check.message}</button>;
  return (
    <>
      <button className="btn btn-blocked" onClick={onClick}>🛡️ Blocked by fair-play rules</button>
      <p className="activity-warn">{check.message}</p>
    </>
  );
}

export default function Earn() {
  const {
    user, xp, activities, assignments, checkActivity, claim, capabilities, dailyXp, dailyCap,
    gigs, applications, toggleApply,
  } = useStudent();
  const [cat, setCat] = useState("All");
  const [copied, setCopied] = useState(false);

  const openAssignments = assignments.filter((a) => a.status === "open");
  const filteredGigs = cat === "All" ? gigs : gigs.filter((g) => g.tags.includes(cat));
  const capOf = (id) => capabilities.find((c) => c.id === id);

  function copyCode() {
    navigator.clipboard?.writeText(user.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="container">
      <div className="section-heading" style={{ marginTop: 0 }}>
        <div>
          <h1 className="page-title">Earn</h1>
          <p className="page-subtitle">Complete activities to earn XP, or pitch for real paid gigs.</p>
        </div>
        <span className="pill pill-xp">⚡ {xp.toLocaleString()} XP</span>
      </div>

      <div className="panel cap-panel">
        <div className="cap-top">
          <strong>Daily XP</strong>
          <span>{dailyXp} / {dailyCap} XP today</span>
        </div>
        <div className="progress-track light"><div className="progress-fill" style={{ width: `${Math.min((dailyXp / dailyCap) * 100, 100)}%` }} /></div>
        <p className="cap-note">Fair-play rules: each activity has daily limits and there's a daily XP cap, so XP can't be farmed.</p>
      </div>

      <h2 className="subsection-title">Level unlocks</h2>
      <div className="cap-grid">
        {capabilities.map((c) => (
          <div className={`cap-chip${c.unlocked ? " on" : ""}`} key={c.id}>
            <span>{c.unlocked ? "🔓" : "🔒"}</span>
            <div><strong>{c.label}</strong><small>Level {c.minLevel}</small></div>
          </div>
        ))}
      </div>

      {openAssignments.length > 0 && (
        <>
          <h2 className="subsection-title">Assigned to you</h2>
          <div className="card-grid cols-2">
            {openAssignments.map((as) => {
              const act = activities.find((a) => a.id === as.activityId);
              const check = checkActivity(as.activityId, as.id);
              return (
                <div className="activity-card assigned" key={as.id}>
                  <div className="activity-top">
                    <span className="tag tag-accent">{as.assignerRole} · {as.assignedBy}</span>
                    <span className="pill pill-xp">⚡ {check.ok ? check.points : act.baseXp + as.bonusXp}</span>
                  </div>
                  <h3 className="activity-title">{act.title}</h3>
                  <p className="activity-desc">{as.note}</p>
                  <p className="activity-meta">Due {as.dueDate} · includes +{as.bonusXp} bonus XP</p>
                  <ClaimButton check={check} onClick={() => claim(as.activityId, as.id)} />
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2 className="subsection-title">XP activities</h2>
      <div className="card-grid cols-3">
        {activities.map((a) => {
          const check = checkActivity(a.id);
          return (
            <div className={`activity-card${check.code === "already_claimed" ? " claimed" : ""}${check.code === "locked" ? " locked" : ""}`} key={a.id}>
              <div className="activity-top">
                <span className="tag">{a.category}</span>
                <span className="pill pill-xp">⚡ {check.ok ? check.points : a.baseXp}</span>
              </div>
              <h3 className="activity-title">{a.title}</h3>
              <p className="activity-desc">{a.description}</p>
              <p className="activity-meta">⏱ {a.duration}{a.requiresCapability && ` · ${capOf(a.requiresCapability)?.label}`}</p>
              {a.id === "refer_friend" && (
                <button className="code-chip" onClick={copyCode}>{user.referralCode} · {copied ? "Copied ✓" : "Copy"}</button>
              )}
              <ClaimButton check={check} onClick={() => claim(a.id)} />
            </div>
          );
        })}
      </div>

      <div className="section-heading"><h2 className="subsection-title" style={{ margin: 0 }}>Find a gig</h2></div>
      <div className="chip-row">
        {gigCategories.map((c) => (
          <button key={c} className={`chip${cat === c ? " active" : ""}`} onClick={() => setCat(c)}>{c}</button>
        ))}
      </div>
      <div className="card-grid cols-3">
        {filteredGigs.map((g) => {
          const cap = capOf(g.requiresCapability);
          const locked = cap && !cap.unlocked;
          const applied = applications.includes(g.id);
          return (
            <div className={`gig-card${locked ? " locked" : ""}`} key={g.id}>
              <div className="gig-top">
                <h3 className="gig-title">{g.title}</h3>
                <span className="tier-badge">{g.tier}</span>
              </div>
              <p className="gig-poster">{g.posterName} · {g.posterOrg}</p>
              <p className="gig-desc">{g.description}</p>
              <p className="gig-meta">⏱ {g.timeframe} <span className="gig-pay">{g.pay}</span></p>
              <div className="tag-row">{g.tags.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
              <div className="gig-footer">
                <span className="gig-posted">{g.postedAgo}</span>
                {locked ? (
                  <span className="lock-note">🔒 Level {cap.minLevel} to unlock</span>
                ) : (
                  <button className={applied ? "btn-pitch applied" : "btn-pitch"} onClick={() => toggleApply(g.id)}>
                    {applied ? "✓ Applied" : "➤ Pitch now"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
