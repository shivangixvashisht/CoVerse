import { LOCAL_CHAIN } from "../config/network";
import type { Eip1193Provider } from "../hooks/useWallet";

/** Ask MetaMask to switch to (or first add) the local Hardhat network. */
export async function switchToLocalChain(provider: Eip1193Provider | undefined = window.ethereum): Promise<void> {
  if (!provider) throw new Error("MetaMask is not available.");
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: LOCAL_CHAIN.chainIdHex }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    // 4902: the chain has not been added to the wallet yet.
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: LOCAL_CHAIN.chainIdHex,
          chainName: LOCAL_CHAIN.name,
          rpcUrls: [LOCAL_CHAIN.rpcUrl],
          nativeCurrency: LOCAL_CHAIN.currency,
        },
      ],
    });
  }
}
