const ledgerSeed = [
  { id: "tx1", activityId: null, points: 100, reason: "Welcome bonus", createdAt: "2026-08-12T09:00:00.000Z" },
  { id: "tx2", activityId: "complete_profile", points: 50, reason: "Complete your profile", createdAt: "2026-08-14T09:00:00.000Z" },
  { id: "tx3", activityId: "upload_certificate", points: 150, reason: "Certificate: Google Analytics", createdAt: "2026-08-20T09:00:00.000Z" },
  { id: "tx4", activityId: "upload_certificate", points: 100, reason: "Certificate: Canva Design Fundamentals", createdAt: "2026-09-01T09:00:00.000Z" },
  { id: "tx5", activityId: "upload_certificate", points: 75, reason: "Certificate: HubSpot Content Marketing", createdAt: "2026-09-05T09:00:00.000Z" },
  { id: "tx6", activityId: null, points: 250, reason: "Course completed: Canva Design Fundamentals", createdAt: "2026-09-08T09:00:00.000Z" },
  { id: "tx7", activityId: null, points: 200, reason: "Course completed: Google Analytics", createdAt: "2026-09-10T09:00:00.000Z" },
  { id: "tx8", activityId: null, points: 100, reason: "Gig completed: Poster design", createdAt: "2026-09-12T09:00:00.000Z" },
  { id: "tx9", activityId: null, points: 100, reason: "Gig completed: Product photos", createdAt: "2026-09-16T09:00:00.000Z" },
  { id: "tx10", activityId: null, points: 100, reason: "Gig completed: Social captions", createdAt: "2026-09-20T09:00:00.000Z" },
  { id: "tx11", activityId: "daily_checkin", points: 25, reason: "Daily check-in", createdAt: "2026-09-27T09:00:00.000Z" },
];

let running = 0;
const xpTransactions = ledgerSeed.map((t) => {
  running += t.points;
  return { ...t, userId: "u1", assignmentId: null, type: "award", balanceAfter: running };
});

export const seedDb = {
  version: 1,

  users: [
    {
      id: "u1",
      name: "Priya Sharma",
      firstName: "Priya",
      role: "student",
      university: "University of Melbourne",
      course: "Bachelor of Commerce · 3rd Year",
      streak: 7,
      lastCheckin: "2026-09-27",
      gigsDone: 3,
      ranking: 12,
      referralCode: "PRIYA-MEL26",
      skills: ["Marketing", "Canva", "Copywriting", "Excel", "Google Analytics"],
      interests: ["Brand design", "Content strategy", "Startups"],
      avatar: { skin: "#e0ac69", hair: "#2b2320", hairStyle: "short", outfit: "#7c3aed", accessory: "glasses" },
    },
  ],

  // Level thresholds (Aashmi / Dersima)
  levels: [
    { level: 1, title: "Newcomer", minXp: 0 },
    { level: 2, title: "Explorer", minXp: 250 },
    { level: 3, title: "Builder", minXp: 600 },
    { level: 4, title: "Rising Star", minXp: 1000 },
    { level: 5, title: "Pro", minXp: 2000 },
  ],

  // Level -> capability mapping (Dersima)
  capabilities: [
    { id: "cap_paid_gigs", label: "Apply for paid gigs", minLevel: 2 },
    { id: "cap_featured_gigs", label: "Featured gigs", minLevel: 3 },
    { id: "cap_mock_interview", label: "AI mock interviews", minLevel: 4 },
    { id: "cap_employer_challenges", label: "Employer-sponsored challenges", minLevel: 5 },
  ],

  // Anti-abuse rules (Dersima)
  xpRules: { dailyXpCap: 500, streakBonusPerDay: 3, streakBonusMaxDays: 5, maxActivityPoints: 1000 },

  // Fixed Phase 1 activity list (Sharis)
  activities: [
    { id: "daily_checkin", title: "Daily check-in", description: "Check in each day to keep your streak going. Longer streaks earn a bonus.", category: "Daily", duration: "1 min", baseXp: 10, type: "daily", dailyLimit: 1, cooldownMinutes: 0, requiresCapability: null, active: true },
    { id: "complete_profile", title: "Complete your profile", description: "Fill in your bio, skills and interests so companies can find you.", category: "Profile", duration: "5 min", baseXp: 50, type: "one_time", dailyLimit: 1, cooldownMinutes: 0, requiresCapability: null, active: true },
    { id: "upload_certificate", title: "Upload a certificate", description: "Add a certificate from an external provider for verification.", category: "Certificates", duration: "5 min", baseXp: 75, type: "repeatable", dailyLimit: 2, cooldownMinutes: 0, requiresCapability: null, active: true },
    { id: "learn_module", title: "Finish a Learn module", description: "Complete a module in any course on the Learn page.", category: "Learning", duration: "30 min", baseXp: 50, type: "repeatable", dailyLimit: 3, cooldownMinutes: 0, requiresCapability: null, active: true },
    { id: "portfolio_piece", title: "Add a portfolio piece", description: "Showcase a project, essay or design you're proud of.", category: "Portfolio", duration: "1 hr", baseXp: 150, type: "repeatable", dailyLimit: 1, cooldownMinutes: 0, requiresCapability: null, active: true },
    { id: "refer_friend", title: "Refer a friend", description: "Invite a classmate to Alumable with your referral code.", category: "Community", duration: "2 min", baseXp: 120, type: "one_time", dailyLimit: 1, cooldownMinutes: 0, requiresCapability: null, active: true },
    { id: "mock_interview", title: "Complete a mock interview", description: "Practise with an AI-guided mock interview.", category: "Career", duration: "20 min", baseXp: 180, type: "repeatable", dailyLimit: 1, cooldownMinutes: 0, requiresCapability: "cap_mock_interview", active: true },
    { id: "employer_challenge", title: "Employer-sponsored challenge", description: "A real brief set by a partner company.", category: "Employer", duration: "2 hr", baseXp: 300, type: "repeatable", dailyLimit: 1, cooldownMinutes: 0, requiresCapability: "cap_employer_challenges", active: true },
  ],

  // Activities assigned by educators / employers (Sharis)
  assignments: [
    { id: "as1", userId: "u1", activityId: "portfolio_piece", assignedBy: "Dr. Helen Lee", assignerRole: "Educator", note: "Add your best marketing case study to your portfolio.", dueDate: "2026-10-02", bonusXp: 25, status: "open" },
    { id: "as2", userId: "u1", activityId: "upload_certificate", assignedBy: "Greenleaf Café", assignerRole: "Employer", note: "Upload a design-related certificate for our gig shortlist.", dueDate: "2026-10-05", bonusXp: 15, status: "open" },
  ],

  // XP transaction ledger — every point awarded is recorded here (Sharis)
  xpTransactions,

  // Guardrail / security events (Dersima)
  auditLog: [
    { id: "au1", action: "points_changed", userId: null, activityId: "portfolio_piece", code: "points_changed", message: "Portfolio piece value changed 120 → 150 XP (past awards unchanged).", at: "2026-09-15T08:00:00.000Z" },
  ],

  courses: [
    { id: "co1", provider: "ALUMABLE", title: "Professional Communication", category: "Skills", modulesTotal: 4, modulesDone: 2 },
    { id: "co2", provider: "ALUMABLE", title: "Digital Marketing Fundamentals", category: "Industry", modulesTotal: 6, modulesDone: 0 },
    { id: "co3", provider: "CANVA", title: "Canva Design Fundamentals", category: "Digital & Tools", modulesTotal: 5, modulesDone: 5 },
    { id: "co4", provider: "GOOGLE", title: "Google Analytics Certified", category: "Digital & Tools", modulesTotal: 1, modulesDone: 1 },
  ],

  certificates: [
    { id: "ce1", title: "Google Analytics Certified", issuer: "Google", date: "Jun 2026", status: "verified" },
    { id: "ce2", title: "Canva Design Fundamentals", issuer: "Canva", date: "Apr 2026", status: "verified" },
    { id: "ce3", title: "HubSpot Content Marketing", issuer: "HubSpot Academy", date: "Mar 2026", status: "verified" },
    { id: "ce4", title: "Excel Advanced (self-uploaded)", issuer: "Microsoft / Coursera", date: "Feb 2026", status: "pending" },
  ],

  gigs: [
    { id: "g1", title: "Logo redesign for a café rebrand", posterName: "Jake R.", posterOrg: "Greenleaf Café owner", description: "Need a fresh logo for our inner-city café. Brand colours and reference images ready.", tier: "Starter", timeframe: "3–5 days", pay: "$80 fixed", tags: ["Design", "Branding"], postedAgo: "11h ago", requiresCapability: "cap_paid_gigs" },
    { id: "g2", title: "3 blog posts on sustainable living", posterName: "Emma K.", posterOrg: "EcoNest blog editor", description: "800-word posts targeting Melbourne millennials. Topic list provided.", tier: "Starter", timeframe: "1 week", pay: "$60 fixed", tags: ["Writing", "Content"], postedAgo: "3h ago", requiresCapability: "cap_paid_gigs" },
    { id: "g3", title: "Instagram content calendar", posterName: "Zara T.", posterOrg: "Fold Studio", description: "Plan four weeks of posts for a small fashion label launching in Melbourne.", tier: "Featured", timeframe: "1 month", pay: "$120 fixed", tags: ["Marketing", "Design"], postedAgo: "1d ago", requiresCapability: "cap_featured_gigs" },
    { id: "g4", title: "Landing page copy for a SaaS launch", posterName: "Dev P.", posterOrg: "Northwind Labs", description: "Sharp, conversion-focused copy for a B2B product launch page.", tier: "Pro", timeframe: "2 weeks", pay: "$300 fixed", tags: ["Writing", "Marketing"], postedAgo: "2d ago", requiresCapability: "cap_employer_challenges" },
  ],

  applications: [],

  conversations: [
    { id: "m1", name: "Jake R. — Greenleaf Café", unread: true, time: "2:14 PM", lastMessage: "Sounds great, can you share a couple of examples?", messages: [
      { from: "them", text: "Hey! Saw your pitch on the logo redesign gig.", time: "1:58 PM" },
      { from: "them", text: "Do you have a portfolio I could look at?", time: "1:58 PM" },
      { from: "me", text: "Yep, I'll send a few pieces through today.", time: "2:10 PM" },
      { from: "them", text: "Sounds great, can you share a couple of examples?", time: "2:14 PM" },
    ] },
    { id: "m2", name: "Alumable Careers Team", unread: false, time: "Yesterday", lastMessage: "Your certificate has been verified 🎉", messages: [
      { from: "them", text: "Hi Priya, thanks for uploading your certificate.", time: "Yesterday" },
      { from: "them", text: "Your certificate has been verified 🎉", time: "Yesterday" },
    ] },
    { id: "m3", name: "Emma K. — EcoNest", unread: false, time: "Mon", lastMessage: "Thanks for the pitch, I'll get back to you by Friday.", messages: [
      { from: "me", text: "Hi Emma, I'd love to write those blog posts.", time: "Mon" },
      { from: "them", text: "Thanks for the pitch, I'll get back to you by Friday.", time: "Mon" },
    ] },
  ],
};

export const avatarOptions = {
  skin: ["#f5cfa0", "#e0ac69", "#c68642", "#8d5524", "#5a3825"],
  hair: ["#2b2320", "#5a3825", "#8b5e34", "#c9a15a", "#c2410c"],
  hairStyle: ["short", "long", "curly", "bald"],
  outfit: ["#7c3aed", "#10b981", "#3b82f6", "#f59e0b", "#ef4444"],
  accessory: ["none", "glasses", "cap"],
};

export const createSeedDb = () => structuredClone(seedDb);
