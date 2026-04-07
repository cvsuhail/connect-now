export type AdminUser = {
  id: string;
  email: string;
  nickname: string;
  photoUrl: string;
  lastSeenAt: number;
};

export type UserReport = {
  id: string;
  reporterEmail: string;
  reporterNickname: string;
  reportedPeerId: string;
  reportedNickname: string;
  reason: string;
  createdAt: number;
  status: "open" | "banned" | "ignored";
};

export type UserBan = {
  id: string;
  targetEmail: string;
  durationSeconds: number;
  createdAt: number;
  expiresAt: number;
  reason: string;
};

export type OutboundNotification = {
  id: string;
  type: "email" | "push" | "both";
  title: string;
  body: string;
  recipients: string[];
  createdAt: number;
};

type AdminStore = {
  users: AdminUser[];
  reports: UserReport[];
  bans: UserBan[];
  notifications: OutboundNotification[];
};

const STORE_KEY = "connect-now-admin-store";

const emptyStore: AdminStore = {
  users: [],
  reports: [],
  bans: [],
  notifications: [],
};

export const readAdminStore = (): AdminStore => {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return emptyStore;
  try {
    const parsed = JSON.parse(raw) as AdminStore;
    return {
      users: parsed.users || [],
      reports: parsed.reports || [],
      bans: parsed.bans || [],
      notifications: parsed.notifications || [],
    };
  } catch {
    return emptyStore;
  }
};

const writeAdminStore = (next: AdminStore) => {
  localStorage.setItem(STORE_KEY, JSON.stringify(next));
};

export const registerAuthenticatedUser = (user: { email?: string; id: string; nickname?: string; photoUrl?: string }) => {
  if (!user.email) return;
  const store = readAdminStore();
  const existing = store.users.find((u) => u.email.toLowerCase() === user.email!.toLowerCase());
  const nextUser: AdminUser = {
    id: user.id,
    email: user.email,
    nickname: user.nickname || user.email.split("@")[0],
    photoUrl: user.photoUrl || "",
    lastSeenAt: Date.now(),
  };
  if (!existing) {
    store.users.unshift(nextUser);
  } else {
    Object.assign(existing, nextUser);
  }
  writeAdminStore(store);
};

export const addReport = (input: Omit<UserReport, "id" | "createdAt" | "status">) => {
  const store = readAdminStore();
  store.reports.unshift({
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    status: "open",
  });
  writeAdminStore(store);
};

export const addBan = (targetEmail: string, durationSeconds: number, reason: string) => {
  const now = Date.now();
  const store = readAdminStore();
  store.bans.unshift({
    id: crypto.randomUUID(),
    targetEmail: targetEmail.toLowerCase(),
    durationSeconds,
    createdAt: now,
    expiresAt: now + durationSeconds * 1000,
    reason,
  });
  writeAdminStore(store);
};

export const getActiveBanForEmail = (email?: string) => {
  if (!email) return null;
  const now = Date.now();
  const store = readAdminStore();
  return (
    store.bans.find((ban) => ban.targetEmail === email.toLowerCase() && ban.expiresAt > now) || null
  );
};

export const markReportStatus = (reportId: string, status: UserReport["status"]) => {
  const store = readAdminStore();
  const item = store.reports.find((r) => r.id === reportId);
  if (!item) return;
  item.status = status;
  writeAdminStore(store);
};

export const queueNotification = (input: Omit<OutboundNotification, "id" | "createdAt">) => {
  const store = readAdminStore();
  store.notifications.unshift({
    ...input,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  });
  writeAdminStore(store);
};
