import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createSeedDb } from "./db";
import {
  getBalance, getLevelInfo, getCapabilities, getDailyXp, checkClaim,
  claimActivity, advanceCourse, toggleApplication,
} from "./xpEngine";

const Ctx = createContext(null);
const KEY = "alumable-db-v1";
const USER_ID = "u1";

function loadDb() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === 1) return parsed;
    }
  } catch {
    
  }
  return createSeedDb();
}

function claimToast(r) {
  if (!r.ok) return { type: "warn", message: r.message };
  let msg = `+${r.points} XP — ${r.title}`;
  if (r.leveledUp) msg += ` · Level up! You're now ${r.newLevelTitle}`;
  if (r.unlocked?.length) msg += ` · Unlocked: ${r.unlocked.join(", ")}`;
  if (r.courseComplete) msg += ` · Certificate earned: ${r.courseComplete}`;
  return { type: r.leveledUp ? "levelup" : "success", message: msg };
}

export function StudentProvider({ children }) {
  const [db, setDb] = useState(loadDb);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      
    }
  }, [db]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const user = db.users.find((u) => u.id === USER_ID);
  const xp = getBalance(db, USER_ID);
  const levelInfo = getLevelInfo(db, xp);
  const capabilities = getCapabilities(db, xp);

  const value = useMemo(() => {
    const show = (r) => setToast({ id: Date.now(), ...claimToast(r) });

    return {
      db,
      user,
      xp,
      levelInfo,
      capabilities,
      levels: db.levels,
      dailyXp: getDailyXp(db, USER_ID),
      dailyCap: db.xpRules.dailyXpCap,
      activities: db.activities,
      assignments: db.assignments.filter((a) => a.userId === USER_ID),
      ledger: [...db.xpTransactions].filter((t) => t.userId === USER_ID).reverse(),
      auditLog: db.auditLog,
      courses: db.courses,
      certificates: db.certificates,
      gigs: db.gigs,
      applications: db.applications,
      conversations: db.conversations,
      toast,
      dismissToast: () => setToast(null),

      checkActivity: (activityId, assignmentId = null) =>
        checkClaim(db, USER_ID, activityId, { assignmentId }),

      claim: (activityId, assignmentId = null) => {
        const { db: next, result } = claimActivity(db, USER_ID, activityId, { assignmentId });
        setDb(next);
        show(result);
        return result;
      },

      completeModule: (courseId) => {
        const { db: next, result } = advanceCourse(db, USER_ID, courseId);
        setDb(next);
        show(result);
      },

      toggleApply: (gigId) => {
        const { db: next, result } = toggleApplication(db, USER_ID, gigId);
        setDb(next);
        setToast({
          id: Date.now(),
          type: result.ok ? "success" : "warn",
          message: result.ok ? (result.applied ? "Pitch sent!" : "Pitch withdrawn.") : result.message,
        });
      },

      setAvatar: (avatar) =>
        setDb((d) => {
          const next = structuredClone(d);
          next.users.find((u) => u.id === USER_ID).avatar = avatar;
          return next;
        }),

      sendMessage: (convId, text) =>
        setDb((d) => {
          const next = structuredClone(d);
          const c = next.conversations.find((x) => x.id === convId);
          c.messages.push({ from: "me", text, time: "Just now" });
          c.lastMessage = text;
          c.time = "Just now";
          c.unread = false;
          return next;
        }),

      markRead: (convId) =>
        setDb((d) => {
          if (!d.conversations.find((x) => x.id === convId)?.unread) return d;
          const next = structuredClone(d);
          next.conversations.find((x) => x.id === convId).unread = false;
          return next;
        }),

      resetDemo: () => {
        setDb(createSeedDb());
        setToast({ id: Date.now(), type: "success", message: "Demo data reset." });
      },
    };
  }, [db, toast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudent must be used inside StudentProvider");
  return ctx;
}
