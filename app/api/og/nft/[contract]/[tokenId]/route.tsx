/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

async function fetchNFT(baseUrl: string, contract: string, tokenId: string) {
  try {
    const res = await fetch(
      `${baseUrl}/api/nft/${encodeURIComponent(contract)}/${encodeURIComponent(tokenId)}`,
      { cache: "no-store" }
    );

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function ipfsToHttp(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${url.replace("ipfs://", "")}`;
  }
  return url;
}

export async function GET(req: NextRequest, ctx: any) {
  const { contract, tokenId } = ctx.params;

  const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const data = await fetchNFT(baseUrl, contract, tokenId);

  const nft = data?.nft;
  const collection = data?.collection;

  const title = nft?.name || `Token #${tokenId}`;
  const collectionName = collection?.name || "Collection";

  const image =
    ipfsToHttp(nft?.image) ||
    ipfsToHttp(nft?.animation_url) ||
    null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          color: "white",
          padding: "40px",
          gap: "40px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: NFT Image */}
        <div
          style={{
            width: "55%",
            height: "100%",
            borderRadius: "24px",
            overflow: "hidden",
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {image ? (
            <img
              src={image}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div>No Image</div>
          )}
        </div>

        {/* Right: Info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "45%",
          }}
        >
          <div>
            <div style={{ fontSize: 28, opacity: 0.7 }}>
              {collectionName}
            </div>

            <div
              style={{
                fontSize: 56,
                fontWeight: 700,
                marginTop: 12,
                lineHeight: 1.1,
              }}
            >
              {title}
            </div>
          </div>

          <div style={{ fontSize: 20, opacity: 0.6 }}>
            {contract.slice(0, 6)}...{contract.slice(-4)}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}