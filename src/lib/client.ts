// src/lib/client.ts
import { createThirdwebClient } from "thirdweb";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

if (!clientId) {
  // Don't crash build, but make it obvious during dev.
  // (You can remove this if you prefer.)
  console.warn("Missing NEXT_PUBLIC_THIRDWEB_CLIENT_ID");
}

export const client = createThirdwebClient({
  clientId: clientId ?? "",
});
