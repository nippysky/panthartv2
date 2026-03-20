import type {
  ApiResponse,
  WarpoolBattlePayload,
  WarpoolHistoryPayload,
  WarpoolLensPreviewPayload,
  WarpoolQueueAssetsPayload,
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

  const res = await fetch(
    `/api/warpool/queues/${encodeURIComponent(slug)}${qs}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

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

export async function fetchWarpoolQueueAssets(
  queueSlug: string,
  walletAddress: string
): Promise<WarpoolQueueAssetsPayload> {
  const qs = `?walletAddress=${encodeURIComponent(walletAddress)}`;

  const res = await fetch(
    `/api/warpool/queues/${encodeURIComponent(queueSlug)}/assets${qs}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  return parseApiResponse<WarpoolQueueAssetsPayload>(res);
}

export async function fetchWarpoolLensPreview(params: {
  queueSlug: string;
  walletAddress: string;
  comradeTokenId: string;
  relicTokenId?: string | null;
}): Promise<WarpoolLensPreviewPayload> {
  const qs = new URLSearchParams({
    walletAddress: params.walletAddress,
    comradeTokenId: params.comradeTokenId,
  });

  if (params.relicTokenId) {
    qs.set("relicTokenId", params.relicTokenId);
  }

  const res = await fetch(
    `/api/warpool/queues/${encodeURIComponent(params.queueSlug)}/lens?${qs.toString()}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  return parseApiResponse<WarpoolLensPreviewPayload>(res);
}