import { Link } from 'react-router';
import { useStudent } from './StudentContext';
import PixelAvatar from './PixelAvatar';

const shortcuts = [
  { to: '/learn', icon: '⚔', title: 'BUILD SKILLS', detail: 'Courses & learning', theme: 'gold', action: 'Explore learning' },
  { to: '/earn', icon: '✦', title: 'EARN XP', detail: 'Activities & quests', theme: 'red', action: 'See activities' },
  { to: '/earn', icon: '▣', title: 'FIND GIGS', detail: 'Real opportunities', theme: 'green', action: 'Browse gigs' },
  { to: '/diary', icon: '▤', title: 'REFLECT', detail: 'Your learning journey', theme: 'blue', action: 'Open diary' },
];

function PanelTitle({ eyebrow, title, link, linkTitle }) {
  return <div className="arcade-panel-heading"><div><span className="panel-eyebrow">{eyebrow}</span><h2>{title}</h2></div>{link && <Link to={link}>{linkTitle || 'VIEW ALL'} <span aria-hidden="true">↗</span></Link>}</div>;
}

export default function Home() {
  const { user, xp, levelInfo, capabilities, levels, activities, checkActivity, claim, ledger, gigs, applications, courses } = useStudent();
  const nextCap = capabilities.find((cap) => !cap.unlocked);
  const threshold = nextCap ? levels.find((level) => level.level === nextCap.minLevel)?.minXp : null;
  const quests = activities.filter((activity) => activity.active && activity.id !== 'learn_module').slice(0, 4);
  const nextThreshold = levelInfo.to || levelInfo.from;
  const courseCount = courses.filter((course) => course.modulesDone === course.modulesTotal).length;
  const appliedIds = new Set(applications);

  return <div className="arcade-home">
    <div className="arcade-announcement"><span>✦ WELCOME TO YOUR ADVENTURE</span><span className="announcement-right">LEARN MORE · DO MORE · UNLOCK MORE ✧</span></div>

    <section className="arcade-hero arcade-hero-no-poster" aria-labelledby="home-title">
      <div className="arcade-hero-glow" aria-hidden="true" />
      <div className="arcade-hero-copy">
        <div className="hero-chapter"><span className="pulse-dot" /> PLAYER DASHBOARD <span className="hero-chapter-line">/</span> LEVEL {levelInfo.level}</div>
        <p className="hero-greeting">WELCOME BACK, {user.firstName.toUpperCase()}!</p>
        <h1 id="home-title">YOUR NEXT<br /><span>LEVEL</span> STARTS<br />HERE<span className="hero-final-dot">.</span></h1>
        <p className="hero-description">Complete quests, sharpen your skills, and work toward real-world opportunities. Every step earns progress.</p>
        <div className="hero-buttons"><Link className="arcade-button arcade-button-gold" to="/earn">✦ &nbsp; EARN XP <span>↗</span></Link><Link className="arcade-button arcade-button-outline" to="/learn">⚔ &nbsp; EXPLORE LEARNING <span>→</span></Link></div>
        <div className="hero-live"><span className="live-star">★</span><strong>{xp.toLocaleString()} XP</strong><span>earned so far</span><span className="hero-live-divider" /><strong>LVL {levelInfo.level}</strong><span>{levelInfo.title}</span></div>
      </div>

    </section>

    <section className="arcade-shortcuts" aria-label="Explore Alumable">
      {shortcuts.map((item) => <Link to={item.to} className={`arcade-shortcut ${item.theme}`} key={item.title} aria-label={item.action}>
        <div className="shortcut-icon">{item.icon}</div><div><h2>{item.title}</h2><p>{item.detail}</p></div><span className="shortcut-arrow">↗</span>
      </Link>)}
    </section>

    <section className="arcade-workspace" aria-label="Your progress and active quests">
      <article className="arcade-box arcade-player-box">
        <PanelTitle eyebrow="01 / YOUR CHARACTER" title="PLAYER STATUS" link="/profile" linkTitle="EDIT AVATAR" />
        <div className="player-identity"><div className="player-avatar"><PixelAvatar avatar={user.avatar} size={116} /><span className="avatar-level">LV {levelInfo.level}</span></div><div><span className="player-tag">✦ ADVENTURER</span><h3>{user.name}</h3><p>{user.course || 'Alumable student'}</p><div className="player-level-name">♛ {levelInfo.title}</div></div></div>
        <div className="player-progress-label"><span>EXPERIENCE POINTS</span><strong>{xp.toLocaleString()} {levelInfo.to ? `/ ${nextThreshold.toLocaleString()}` : ''} XP</strong></div>
        <div className="arcade-progress" role="progressbar" aria-label="Progress to next level" aria-valuenow={Math.round(levelInfo.pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${levelInfo.pct}%` }} /></div>
        <p className="progress-next">{levelInfo.to ? `${levelInfo.toNext.toLocaleString()} XP until ${levelInfo.nextTitle}` : 'Maximum level reached!'} <span>✦</span></p>
        <div className="player-stats"><div><span className="stat-picto">🔥</span><strong>{user.streak}</strong><small>Day streak</small></div><div><span className="stat-picto">⚔</span><strong>{courseCount}</strong><small>Courses done</small></div><div><span className="stat-picto">▣</span><strong>{user.gigsDone}</strong><small>Gigs done</small></div></div>
      </article>

      <article className="arcade-box arcade-quest-box">
        <PanelTitle eyebrow="02 / COMPLETE & LEVEL UP" title="AVAILABLE QUESTS" link="/earn" linkTitle="ALL QUESTS" />
        <p className="box-explainer">Choose an activity to earn XP. XP claims are verified by the backend API.</p>
        <div className="arcade-quest-list">
          {quests.map((activity, index) => {
            const result = checkActivity(activity.id);
            return <div className={`arcade-quest ${!result.ok ? 'quest-unavailable' : ''}`} key={activity.id}>
              <div className="quest-medal">{['✦','⚔','▤','★'][index]}</div>
              <div className="quest-desc"><h3>{activity.title}</h3><p>{activity.category} <span>·</span> {activity.duration}</p></div>
              <div className="quest-actions"><span className="quest-points">+{result.ok ? result.points : activity.baseXp} XP</span>
                <button className="quest-claim" disabled={!result.ok || activity.id === 'learn_module'} title={result.ok ? `Claim ${activity.title}` : result.message} onClick={() => claim(activity.id)}>{activity.id === 'learn_module' ? 'OPEN LEARN' : result.ok ? 'CLAIM →' : 'LOCKED / DONE'}</button></div>
            </div>;
          })}
        </div>
        <div className="quest-footer">✧ Small actions. Big opportunities. <Link to="/earn">KEEP EXPLORING →</Link></div>
      </article>

      <article className="arcade-box arcade-unlock-box">
        <PanelTitle eyebrow="03 / WHAT'S NEXT" title="NEXT UNLOCK" />
        <div className="unlock-art"><span className="unlock-rays">✧</span><div className="unlock-castle">♜</div><span className="unlock-stars">✦ ★ ✧</span></div>
        <span className="unlock-tag">{nextCap ? `REACH LEVEL ${nextCap.minLevel}` : 'ALL CAPABILITIES UNLOCKED'}</span>
        <h3>{nextCap ? nextCap.label : 'You unlocked everything!'}</h3>
        <p>{nextCap && threshold != null ? `${Math.max(0, threshold - xp).toLocaleString()} more XP needed to unlock this feature.` : 'Keep building your skills and earning XP.'}</p>
        <Link className="unlock-link" to="/earn">EARN MORE XP <span>↗</span></Link>
      </article>
    </section>

    <section className="arcade-lower">
      <article className="arcade-box arcade-gigs-box">
        <PanelTitle eyebrow="04 / GROW BEYOND THE GAME" title="REAL-WORLD OPPORTUNITIES" link="/earn" linkTitle="EXPLORE ALL" />
        <div className="arcade-gig-cards">{gigs.slice(0, 3).map((gig, i) => <div className={`arcade-gig ${['copper','blue','forest'][i]}`} key={gig.id}>
          <div className="gig-top"><span>▣ {gig.tier.toUpperCase()}</span><span>✦</span></div><h3>{gig.title}</h3><p>{gig.posterOrg}</p><div className="gig-tags">{gig.tags?.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="gig-bottom"><strong>{gig.pay}</strong><Link to="/earn">{appliedIds.has(gig.id) ? 'VIEW APPLICATION' : 'VIEW GIG'} ↗</Link></div>
        </div>)}</div>
        <p className="gigs-disclaimer">Demo opportunities from the backend dataset. Eligibility and applications are managed by the API on the Earn page.</p>
      </article>
      <article className="arcade-box arcade-history-box">
        <PanelTitle eyebrow="05 / YOUR JOURNEY" title="RECENT XP" link="/profile" linkTitle="FULL HISTORY" />
        {ledger.length ? <div className="arcade-history-list">{ledger.slice(0, 5).map((item) => <div className="history-item" key={item.id}><span className="history-star">✦</span><div><strong>{item.reason}</strong><small>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</small></div><span className="history-points">+{item.points} XP</span></div>)}</div> : <p className="empty-history">No XP transactions yet. Complete an activity to get started.</p>}
      </article>
    </section>
    <footer className="arcade-footer"><span>✦ ALUMABLE / GAMIFICATION ENGINE</span><span>LEARN · BUILD · CONNECT · GROW</span><Link to="/about">ABOUT THE PROJECT ↗</Link></footer>
  </div>;
}
