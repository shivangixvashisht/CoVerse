import type { useWallet } from "../hooks/useWallet";
import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";

export function Header({ wallet }: { wallet: ReturnType<typeof useWallet> }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <Logo />
        <nav className="nav" aria-label="Primary">
          <a href="#overview" aria-current="page">
            Dashboard
          </a>
          <a href="#projects">Projects</a>
          <a href="#splits">Splits</a>
          <a href="#roadmap">Roadmap</a>
        </nav>
        <WalletButton {...wallet} />
      </div>
    </header>
  );
}
