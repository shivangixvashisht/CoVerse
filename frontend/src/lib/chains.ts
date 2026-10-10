const KNOWN_CHAINS: Record<string, string> = {
  "1": "Ethereum Mainnet",
  "10": "OP Mainnet",
  "137": "Polygon",
  "8453": "Base",
  "42161": "Arbitrum One",
  "11155111": "Sepolia",
  "84532": "Base Sepolia",
  "31337": "Hardhat Local",
};

export function chainName(chainId: bigint | number | string | null | undefined): string {
  if (chainId === null || chainId === undefined) return "Unknown network";
  return KNOWN_CHAINS[String(chainId)] ?? `Chain ${String(chainId)}`;
}

/** Chains a user can safely experiment on (no real funds). */
export function isTestChain(chainId: bigint | number | string | null | undefined): boolean {
  return ["31337", "11155111", "84532"].includes(String(chainId));
}
