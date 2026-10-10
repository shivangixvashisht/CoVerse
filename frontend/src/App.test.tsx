import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Eip1193Provider } from "./hooks/useWallet";

const ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

function mockProvider(overrides: Partial<Record<string, () => unknown>> = {}): Eip1193Provider {
  const handlers: Record<string, () => unknown> = {
    eth_accounts: () => [],
    eth_requestAccounts: () => [ADDRESS],
    eth_chainId: () => "0x7a69", // 31337
    net_version: () => "31337",
    ...overrides,
  };
  return {
    isMetaMask: true,
    request: vi.fn(async ({ method }: { method: string }) => {
      const handler = handlers[method];
      if (!handler) throw new Error(`Unexpected RPC method ${method}`);
      return handler();
    }),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

describe("App", () => {
  it("clearly labels sample content as demo data", () => {
    render(<App />);
    expect(screen.getByRole("note")).toHaveTextContent(/demo preview/i);
    expect(screen.getAllByText(/demo data/i).length).toBeGreaterThan(0);
  });

  it("does not offer actions that are not implemented yet", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /start a collaboration/i })).toBeDisabled();
  });

  it("filters projects by content type", async () => {
    render(<App />);
    const projects = screen.getByRole("region", { name: /your collaborations/i });
    await userEvent.click(within(projects).getByRole("button", { name: "Podcast" }));
    expect(within(projects).getAllByRole("article")).toHaveLength(1);
    expect(within(projects).getByText("Second Shift")).toBeInTheDocument();
  });

  it("shows the selected project's split", async () => {
    render(<App />);
    const projects = screen.getByRole("region", { name: /your collaborations/i });
    const card = within(projects).getByText("Second Shift").closest("article")!;
    await userEvent.click(within(card).getByRole("button", { name: /view split/i }));
    const split = screen.getByRole("region", { name: /revenue split/i });
    expect(within(split).getByText("Dani Cole")).toBeInTheDocument();
    expect(within(split).getByText(/shares total 100%/i)).toBeInTheDocument();
  });
});

describe("wallet connection", () => {
  it("offers to install MetaMask when no provider is injected", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /install metamask/i })).toHaveAttribute("href", "https://metamask.io/download/");
  });

  it("connects and shows the shortened address and network", async () => {
    window.ethereum = mockProvider();
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    const walletButton = await screen.findByRole("button", { name: /0x1234…5678/ });
    await userEvent.click(walletButton);
    expect(screen.getByText("Hardhat Local")).toBeInTheDocument();
    // Read-only: only account and network queries, never signing or sending.
    const methods = vi.mocked(window.ethereum!.request).mock.calls.map(([a]) => a.method);
    expect(methods.every((m) => ["eth_accounts", "eth_requestAccounts", "eth_chainId", "net_version"].includes(m))).toBe(true);
  });

  it("shows a friendly message when the user rejects the request", async () => {
    window.ethereum = mockProvider({
      eth_requestAccounts: () => {
        throw Object.assign(new Error("User rejected the request."), { code: 4001 });
      },
    });
    render(<App />);
    await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/rejected/i));
  });
});
