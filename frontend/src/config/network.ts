/**
 * The only network the browser app will talk to in this milestone: a local Hardhat node.
 * Override the RPC URL with VITE_RPC_URL if your node listens elsewhere.
 */
export const LOCAL_CHAIN = {
  chainId: 31337,
  chainIdHex: "0x7a69",
  name: "Hardhat Local",
  rpcUrl: (import.meta.env.VITE_RPC_URL as string | undefined) || "http://127.0.0.1:8545",
  currency: { name: "Ether", symbol: "ETH", decimals: 18 },
} as const;

/** Chains where CoVerse may send transactions. Test networks only — never mainnet. */
export const SUPPORTED_CHAIN_IDS: readonly number[] = [LOCAL_CHAIN.chainId];

export function isSupportedChain(chainId: bigint | number | null | undefined): boolean {
  return chainId !== null && chainId !== undefined && SUPPORTED_CHAIN_IDS.includes(Number(chainId));
}
