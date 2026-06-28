export interface LearnedMoment {
  userId: string;
  weekStart: string;
  text: string;
  updatedAt: number;
}

const store = new Map<string, LearnedMoment>();

function key(userId: string, weekStart: string) {
  return `${userId}:${weekStart}`;
}

export function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10);
}

export function getLearnedMoment(userId: string, week = weekStart()): LearnedMoment | null {
  return store.get(key(userId, week)) || null;
}

export function setLearnedMoment(userId: string, text: string, week = weekStart()): LearnedMoment {
  const entry: LearnedMoment = {
    userId,
    weekStart: week,
    text: text.trim(),
    updatedAt: Date.now(),
  };
  store.set(key(userId, week), entry);
  return entry;
}

export function listLearnedMoments(userId: string): LearnedMoment[] {
  return Array.from(store.values()).filter((m) => m.userId === userId);
}
