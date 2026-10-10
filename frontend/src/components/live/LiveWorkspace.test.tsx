import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { useWallet } from "../../hooks/useWallet";
import LiveWorkspace from "./LiveWorkspace";

const ACCOUNT = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const CONTRACT = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

type Wallet = ReturnType<typeof useWallet>;
const wallet = (overrides: Partial<Wallet>): Wallet => ({
  status: "connected",
  account: ACCOUNT,
  chainId: 31337n,
  error: null,
  connect: vi.fn(),
  disconnect: vi.fn(),
  ...overrides,
});

/** TEST-ONLY stand-in for MetaMask's EIP-1193 provider. */
function installProvider(handlers: Record<string, (params?: unknown[]) => unknown>) {
  const request = vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
    const h = handlers[method];
    if (!h) throw new Error(`unexpected ${method}`);
    return h(params);
  });
  window.ethereum = { request, on: vi.fn(), removeListener: vi.fn() };
  return request;
}

function stubDeploymentFile(body: unknown | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      body === null ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => body },
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("live workspace gating", () => {
  it("asks for MetaMask when no wallet is installed", () => {
    render(<LiveWorkspace wallet={wallet({ status: "unavailable", account: null, chainId: null })} />);
    expect(screen.getByText("MetaMask is required")).toBeInTheDocument();
  });

  it("asks the user to connect", async () => {
    const w = wallet({ status: "disconnected", account: null, chainId: null });
    render(<LiveWorkspace wallet={w} />);
    await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(w.connect).toHaveBeenCalled();
  });

  it("blocks the wrong network and offers to switch to Hardhat Local", async () => {
    const request = installProvider({ wallet_switchEthereumChain: () => null });
    render(<LiveWorkspace wallet={wallet({ chainId: 1n })} />);
    expect(screen.getByText("Wrong network")).toBeInTheDocument();
    expect(screen.getByText("Ethereum Mainnet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /switch to hardhat local/i }));
    expect(request).toHaveBeenCalledWith({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a69" }] });
  });

  it("adds the local network to MetaMask when it is not known yet", async () => {
    const request = installProvider({
      wallet_switchEthereumChain: () => {
        throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
      },
      wallet_addEthereumChain: () => null,
    });
    render(<LiveWorkspace wallet={wallet({ chainId: 11155111n })} />);
    await userEvent.click(screen.getByRole("button", { name: /switch to hardhat local/i }));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "wallet_addEthereumChain",
        params: [expect.objectContaining({ chainId: "0x7a69", rpcUrls: ["http://127.0.0.1:8545"] })],
      }),
    );
  });

  it("shows a clear message when the user declines the network switch", async () => {
    installProvider({
      wallet_switchEthereumChain: () => {
        throw Object.assign(new Error("User rejected"), { code: 4001 });
      },
    });
    render(<LiveWorkspace wallet={wallet({ chainId: 1n })} />);
    await userEvent.click(screen.getByRole("button", { name: /switch to hardhat local/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/rejected the request/);
  });

  it("explains how to deploy when no deployment is configured", async () => {
    installProvider({ eth_chainId: () => "0x7a69" });
    stubDeploymentFile(null);
    render(<LiveWorkspace wallet={wallet({})} />);
    expect(await screen.findByText("Contract not configured")).toBeInTheDocument();
    expect(screen.getByText(/npm run contracts:deploy/)).toBeInTheDocument();
  });

  it("detects a stale address after the local node was restarted", async () => {
    installProvider({ eth_chainId: () => "0x7a69", eth_getCode: () => "0x" });
    stubDeploymentFile({ contract: "CollaborationRegistry", chainId: 31337, address: CONTRACT });
    render(<LiveWorkspace wallet={wallet({})} />);
    expect(await screen.findByText("Contract not found on this chain")).toBeInTheDocument();
    expect(screen.getByText(/run `npm run contracts:deploy` again/)).toBeInTheDocument();
  });
});
