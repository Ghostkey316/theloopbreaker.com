import type { AppProps } from "next/app";
import "../styles/globals.css";

function VaultfireArcadeApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default VaultfireArcadeApp;
