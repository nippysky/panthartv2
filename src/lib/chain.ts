// src/lib/chain.ts
import { defineChain } from "thirdweb";

export const electroneumChain = defineChain({
  id: 52014,
  rpc: "https://rpc.ankr.com/electroneum",
  nativeCurrency: { name: "Electroneum", symbol: "ETN", decimals: 18 },
  blockExplorers: [
    { name: "Electroneum Block Explorer", url: "https://blockexplorer.electroneum.com" },
  ],
  icon: {
    url: "https://s2.coinmarketcap.com/static/img/coins/200x200/2137.png",
    width: 200,
    height: 200,
    format: "png",
  },
});
