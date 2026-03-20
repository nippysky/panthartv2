import type {
  ApiResponse,
  WarpoolActionResult,
  WarpoolBattlePayload,
  WarpoolHistoryPayload,
  WarpoolQueuePayload,
  WarpoolQueuesPayload,
} from "@/src/features/warpool/types";

async function parseApiResponse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!json) {
    throw new Error("Invalid server response.");
  }

  if (!json.ok) {
    throw new Error(json.message || "Something went wrong.");
  }

  return json.data;
}

export async function fetchWarpoolQueues(): Promise<WarpoolQueuesPayload> {
  const res = await fetch("/api/warpool/queues", {
    method: "GET",
    cache: "no-store",
  });

  return parseApiResponse<WarpoolQueuesPayload>(res);
}

export async function fetchWarpoolQueueBySlug(
  slug: string,
  walletAddress?: string | null
): Promise<WarpoolQueuePayload> {
  const qs = walletAddress
    ? `?walletAddress=${encodeURIComponent(walletAddress)}`
    : "";

  const res = await fetch(`/api/warpool/queues/${encodeURIComponent(slug)}${qs}`, {
    method: "GET",
    cache: "no-store",
  });

  if (res.status === 404) {
    return { queue: null, eligibility: null };
  }

  return parseApiResponse<WarpoolQueuePayload>(res);
}

export async function fetchWarpoolBattle(
  poolId: string,
  walletAddress?: string | null
): Promise<WarpoolBattlePayload> {
  const qs = walletAddress
    ? `?walletAddress=${encodeURIComponent(walletAddress)}`
    : "";

  const res = await fetch(
    `/api/warpool/battles/${encodeURIComponent(poolId)}${qs}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  if (res.status === 404) {
    return { battle: null, eligibility: null };
  }

  return parseApiResponse<WarpoolBattlePayload>(res);
}
export async function fetchWarpoolHistory(): Promise<WarpoolHistoryPayload> {
  const res = await fetch("/api/warpool/history", {
    method: "GET",
    cache: "no-store",
  });

  return parseApiResponse<WarpoolHistoryPayload>(res);
}

export async function reserveWarpoolQueueSlot(
  queueSlug: string,
  walletAddress?: string | null
): Promise<WarpoolActionResult> {
  const res = await fetch(
    `/api/warpool/queues/${encodeURIComponent(queueSlug)}/reserve`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ walletAddress }),
    }
  );

  return parseApiResponse<WarpoolActionResult>(res);
}

export async function confirmWarpoolParticipation(
  poolId: string,
  walletAddress?: string | null
): Promise<WarpoolActionResult> {
  const res = await fetch(
    `/api/warpool/battles/${encodeURIComponent(poolId)}/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ walletAddress }),
    }
  );

  return parseApiResponse<WarpoolActionResult>(res);
}

export async function claimWarpoolResult(
  poolId: string,
  walletAddress?: string | null
): Promise<WarpoolActionResult> {
  const res = await fetch(
    `/api/warpool/battles/${encodeURIComponent(poolId)}/claim`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ walletAddress }),
    }
  );

  return parseApiResponse<WarpoolActionResult>(res);
}