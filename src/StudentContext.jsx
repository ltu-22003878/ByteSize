import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { createSeedDb } from './db';
import { normalizeAvatar } from './avatarItems';
import { api, getPartnerSession } from './api';

// Student XP and every claim now come from SQLite via the authenticated API.
// The static dataset supplies only illustrative profile, certificate and messaging copy.
// In particular, the old `alumable-db-v1` localStorage key is deliberately ignored.
const Ctx = createContext(null);
const demo = createSeedDb();
const levelSeed = demo.levels;

function messageFor(result) {
  if (result.status === 'pending') return { type: 'success', message: `${result.activityTitle} submitted for educator marking. XP is pending approval.` };
  let message = `+${result.points} XP — ${result.activityTitle}`;
  if (result.leveledUp) message += ` · Level up! Level ${result.level}`;
  if (result.unlocked?.length) message += ` · Unlocked: ${result.unlocked.join(', ')}`;
  return { type: result.leveledUp ? 'levelup' : 'success', message };
}

export function StudentProvider({ children }) {
  const location = useLocation();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (getPartnerSession()?.role !== 'student') {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [me, activities, assignments, ledger, gigs, courses, auditLog] = await Promise.all([
        api('/api/me'), api('/api/activities'), api('/api/assignments'),
        api('/api/ledger'), api('/api/gigs'), api('/api/courses'), api('/api/audit'),
      ]);
      setSnapshot({ me, activities, assignments, ledger, gigs, courses, auditLog });
      setError('');
    } catch (err) {
      setSnapshot(null); // Never fall back silently to a fake, locally awarded XP total.
      setError(err.message || 'Unable to load the student account.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Logging in changes the URL; returning to the dashboard refreshes the API data.
  // Session is only used for authentication; student progress is not in web storage.
  useEffect(() => {
    if (location.pathname !== '/login' && location.pathname !== '/partner/login') reload();
  }, [location.pathname === '/login' || location.pathname === '/partner/login', reload]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (type, message) => setToast({ id: Date.now(), type, message });

  const perform = async (request, successMessage = null) => {
    if (busy) return { ok: false, message: 'Please wait for the previous request.' };
    setBusy(true);
    try {
      const result = await request();
      await reload();
      setToast({ id: Date.now(), ...(successMessage ? { type: 'success', message: successMessage } : messageFor(result)) });
      return { ok: true, ...result };
    } catch (err) {
      notify('warn', err.message || 'Request failed');
      await reload();
      return { ok: false, message: err.message || 'Request failed' };
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => {
    const me = snapshot?.me;
    const xp = me?.xpTotal ?? 0;
    // Use the server's level, remaining XP and progress, not a second client XP engine.
    const currentLevel = levelSeed.find(l => l.level === me?.level) || levelSeed[0];
    const nextLevel = levelSeed.find(l => l.level === me?.nextLevel);
    const levelInfo = {
      level: me?.level ?? 1,
      title: me?.levelTitle ?? currentLevel.title,
      from: currentLevel.minXp,
      to: nextLevel?.minXp ?? null,
      toNext: me?.xpToNext ?? 0,
      pct: Math.round((me?.progress ?? 0) * 100),
      nextTitle: me?.nextLevelTitle ?? null,
    };
    const isDemoPriya = me?.user?.email === 'priya@example.com';
    const base = isDemoPriya ? demo.users[0] : {
      university: 'Alumable', course: 'Alumable student', skills: [], interests: [],
      gigsDone: 0, referralCode: '', ranking: null,
    };
    const user = { ...base, ...(me?.user || {}), id: String(me?.user?.id ?? ''),
      firstName: (me?.user?.name || 'Student').split(' ')[0],
      streak: me?.streak ?? 0, gigsDone: me?.completedGigs ?? 0,
      avatar: normalizeAvatar(me?.avatar || demo.users[0].avatar, xp),
    };
    const activities = (snapshot?.activities || []).map((a) => ({
      ...a, active: true, requiresCapability: a.requiresCapability || null,
    }));
    const gigs = (snapshot?.gigs || []).map((g) => ({ ...g, postedAgo: 'Demo listing' }));
    const assignments = snapshot?.assignments || [];
    const applications = gigs.filter((g) => g.applied).map((g) => g.id);
    return {
      loading, error, busy, reload,
      user, xp, levelInfo, levels: levelSeed,
      dailyXp: me?.dailyXp ?? 0, dailyCap: me?.dailyXpCap ?? 500,
      capabilities: me?.capabilities || [],
      activities, assignments,
      ledger: snapshot?.ledger || [], auditLog: snapshot?.auditLog || [],
      courses: snapshot?.courses || [], certificates: isDemoPriya ? demo.certificates.map(c => ({ ...c, status: "sample" })) : [],
      gigs, applications,
      conversations: [], // Messages use the live /api/messages service directly.
      db: { ...demo, activities },
      toast, dismissToast: () => setToast(null),
      checkActivity: (activityId, assignmentId = null) => {
        const activity = activities.find((a) => a.id === activityId);
        if (!activity) return { ok: false, code: 'not_found', message: 'Activity not available.' };
        if (assignmentId != null) {
          const assignment = assignments.find((a) => String(a.id) === String(assignmentId));
          if (!assignment || assignment.status !== 'open') return { ok: false, code: 'bad_assignment', message: 'This assignment is not open.' };
          return { ...activity.check, points: (activity.check?.points ?? activity.baseXp) + assignment.bonusXp };
        }
        return activity.check;
      },
      claim: (activityId, assignmentId = null) => {
        if (activityId === 'learn_module' && assignmentId == null) {
          notify('warn', 'Complete a module from the Learn page to earn its XP.');
          return Promise.resolve({ ok: false, message: 'Open Learn to complete a module.' });
        }
        let evidence;
        const act = activities.find((a) => a.id === activityId);
        if (act?.requiresMarking) {
          evidence = window.prompt('Provide a short description of the work to submit for educator marking (required):');
          if (!evidence?.trim()) return Promise.resolve({ ok: false, message: 'Evidence is required.' });
        }
        return perform(() => api(`/api/activities/${encodeURIComponent(activityId)}/claim`, {
          method: 'POST', body: JSON.stringify({ ...(assignmentId == null ? {} : { assignmentId: Number(assignmentId) }), ...(evidence ? { evidence } : {}) }),
        }));
      },
      completeModule: (courseId) => perform(() => api('/api/activities/learn_module/claim', {
        method: 'POST', body: JSON.stringify({ courseId }),
      })),
      toggleApply: (gigId) => {
        const applied = applications.includes(gigId);
        return perform(() => api(`/api/gigs/${encodeURIComponent(gigId)}/${applied ? 'withdraw' : 'apply'}`, {
          method: 'POST', body: '{}',
        }), applied ? 'Application withdrawn.' : 'Gig application saved.');
      },
      setAvatar: (config) => perform(() => api('/api/me/avatar', {
        method: 'PUT', body: JSON.stringify(normalizeAvatar(config, xp)),
      }), 'Avatar saved to your account.'),
      resetDemo: () => reload(), // Never wipe database history from a profile screen.
      sendMessage: () => notify('warn', 'Open Messages to send messages using the account API.'),
      markRead: () => {},
    };
  }, [snapshot, loading, error, busy, toast, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStudent must be used inside StudentProvider');
  return ctx;
}
