import { useStudent } from "./StudentContext";
import PixelAvatar from "./PixelAvatar";
import { avatarOptions } from "./db";
import { wardrobe, isUnlocked, normalizeAvatar } from "./avatarItems";

const labels = { skin: "Skin", hair: "Hair colour", hairStyle: "Hair style", outfit: "Outfit", accessory: "Accessory" };
const colourKeys = ["skin", "hair", "outfit"];

export default function Profile() {
  const { user, xp, levelInfo, capabilities, ledger, auditLog, certificates, setAvatar, resetDemo } = useStudent();
  const av = user.avatar;
  const set = (k, v) => setAvatar(normalizeAvatar({ ...av, [k]: v }, xp));
  const equip = (kind, item) => { if (!isUnlocked(item, xp)) return; setAvatar(normalizeAvatar({ ...av, [kind === "outfit" ? "outfitId" : "accessory"]: item.id }, xp)); };
  const denials = auditLog.filter((a) => a.action === "claim_denied" || a.action === "points_changed").slice(0, 5);

  return (
    <div className="container">
      <h1 className="page-title">Profile</h1>

      <div className="profile-layout">
        <div className="panel avatar-panel">
          <PixelAvatar avatar={av} size={180} />
          <h2 className="profile-name">{user.name}</h2>
          <p className="profile-sub">{user.university}<br />{user.course}</p>
          <span className="level-badge">✦ Lv.{levelInfo.level} {levelInfo.title}</span>
          <div className="xp-hero">
            <div className="xp-hero-value">{xp.toLocaleString()} <small>XP</small></div>
            <div className="progress-track light"><div className="progress-fill" style={{ width: `${levelInfo.pct}%` }} /></div>
            <p className="xp-hero-label">{levelInfo.to ? `${levelInfo.toNext} XP to ${levelInfo.nextTitle}` : "Max level reached"}</p>
          </div>
        </div>

        <div className="panel">
          <h2 className="subsection-title" style={{ marginTop: 0 }}>▣ Avatar studio</h2><p className="muted">Earn XP to unlock gear forever. XP is never spent.</p>
          {["skin", "hair", "hairStyle"].map((key) => (
            <div className="editor-row" key={key}>
              <span className="editor-label">{labels[key]}</span>
              <div className="editor-options">
                {avatarOptions[key].map((opt) =>
                  colourKeys.includes(key) ? (
                    <button key={opt} className={`swatch${av[key] === opt ? " active" : ""}`} style={{ background: opt }} onClick={() => set(key, opt)} aria-label={`${labels[key]} ${opt}`} />
                  ) : (
                    <button key={opt} className={`chip small${av[key] === opt ? " active" : ""}`} onClick={() => set(key, opt)}>{opt}</button>
                  )
                )}
              </div>
            </div>
          ))}
          {Object.entries(wardrobe).map(([kind, items]) => <section className="wardrobe-section" key={kind}>
            <h3 className="subsection-title">{kind === "outfit" ? "▦ Outfits" : "✧ Accessories"}</h3>
            <div className="wardrobe-grid">{items.map(item => {
              const unlocked = isUnlocked(item, xp);
              const selected = kind === "outfit" ? (av.outfitId || "tee") === item.id : (av.accessory || "none") === item.id;
              return <button key={item.id} disabled={!unlocked} onClick={() => equip(kind, item)} className={`wardrobe-item ${selected ? "equipped" : ""} ${unlocked ? "" : "locked"}`} title={unlocked ? `Equip ${item.name}` : `Unlock at ${item.xp} XP`}>
                <span className="wardrobe-icon" style={{ background: item.color || "#f3effd" }}>{kind === "outfit" ? "▦" : item.id === "none" ? "–" : "✧"}</span>
                <strong>{item.name}</strong><small>{selected ? "✓ Equipped" : unlocked ? "Unlocked" : `LOCKED · ${item.xp} XP`}</small>
              </button>;
            })}</div>
          </section>)}
          <p className="muted" style={{marginTop:16,fontSize:12}}>Pixel avatar inspired by <a href="https://www.avatarsinpixels.com/" target="_blank" rel="noreferrer">Avatars in Pixels ↗</a>.</p>
        </div>
      </div>

      <div className="profile-layout two">
        <div className="panel">
          <h2 className="subsection-title" style={{ marginTop: 0 }}>Skills & interests</h2>
          <div className="tag-row">{user.skills.map((s) => <span className="tag tag-accent" key={s}>{s}</span>)}</div>
          <div className="tag-row" style={{ marginTop: 10 }}>{user.interests.map((s) => <span className="tag" key={s}>{s}</span>)}</div>
          <h2 className="subsection-title">Unlocked features</h2>
          {capabilities.map((c) => (
            <div className="ledger-line" key={c.id}><span>{c.unlocked ? "◇" : "◆"} {c.label}</span><span className={c.unlocked ? "pill-done" : "pill-pending"}>{c.unlocked ? "Unlocked" : `Level ${c.minLevel}`}</span></div>
          ))}
        </div>
        <div className="panel">
          <h2 className="subsection-title" style={{ marginTop: 0 }}>Certificates (sample data)</h2><p className="muted">Illustrative certificate examples, not independently verified by the Alumable API.</p>
          {certificates.map((c) => (
            <div className="ledger-line" key={c.id}><span>✦ {c.title}<small className="muted"> · {c.issuer}</small></span><span className={c.status === "verified" ? "pill-done" : "pill-pending"}>{c.status === "verified" ? "Verified" : "Pending"}</span></div>
          ))}
        </div>
      </div>

      <div className="section-heading"><h2>XP history</h2></div>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Date</th><th>Activity</th><th>Points</th><th>Balance</th></tr></thead>
          <tbody>
            {ledger.slice(0, 12).map((t) => (
              <tr key={t.id}>
                <td>{new Date(t.createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</td>
                <td>{t.reason}{t.assignmentId && <span className="tag tag-accent" style={{ marginLeft: 8 }}>Assigned</span>}</td>
                <td className="ledger-pts">+{t.points}</td>
                <td>{t.balanceAfter.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section-heading"><h2>Fair-play log</h2></div>
      <div className="panel">
        {denials.map((a) => (
          <div className="ledger-line" key={a.id}><span>▣ {a.message}</span><small className="muted">{new Date(a.at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</small></div>
        ))}
        <button className="btn btn-primary" style={{ width: "auto", padding: "10px 18px" }} onClick={resetDemo}>↻ Refresh account data</button>
      </div>
    </div>
  );
}
