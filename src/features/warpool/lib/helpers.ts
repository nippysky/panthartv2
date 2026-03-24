import type {
  HistoryFilterValue,
  QueueFilterValue,
  QueueStatus,
  WarpoolHistoryItem,
  WarpoolQueue,
} from "@/src/features/warpool/types";

export function clampPercent(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function shortAddress(address?: string | null) {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function barWidth(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function queueStatusTone(status: QueueStatus) {
  switch (status) {
    case "Open":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "Filling":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200";
    case "Locked":
      return "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-200";
    case "Battle Ready":
      return "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-200";
    case "Settled":
      return "border-foreground/15 bg-foreground/5 text-foreground/75";
    case "Closed":
      return "border-border bg-background text-foreground/70";
    default:
      return "border-border bg-background text-foreground/75";
  }
}

export function matchesQueueFilter(
  queue: WarpoolQueue,
  search: string,
  filter: QueueFilterValue
) {
  const query = search.trim().toLowerCase();

  const matchesSearch =
    query.length === 0 ||
    queue.title.toLowerCase().includes(query) ||
    queue.format.toLowerCase().includes(query) ||
    queue.stake.toLowerCase().includes(query) ||
    queue.highlight.toLowerCase().includes(query) ||
    queue.slug.toLowerCase().includes(query);

  const matchesStatus = filter === "all" ? true : queue.status === filter;

  return matchesSearch && matchesStatus;
}

export function matchesHistoryFilter(
  item: WarpoolHistoryItem,
  search: string,
  filter: HistoryFilterValue
) {
  const query = search.trim().toLowerCase();

  const matchesSearch =
    query.length === 0 ||
    item.id.toLowerCase().includes(query) ||
    item.queue.toLowerCase().includes(query) ||
    item.winner.toLowerCase().includes(query) ||
    item.prize.toLowerCase().includes(query);

  const matchesStatus = filter === "all" ? true : item.status === filter;

  return matchesSearch && matchesStatus;
}

export function formatRemaining(ms: number) {
  if (ms <= 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(parsed);
}