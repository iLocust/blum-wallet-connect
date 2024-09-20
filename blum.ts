import { fetch } from "bun";
import { generateTonProof, type Wallet } from "./wallet";

class BlumService {
  private baseHeaders = {
    accept: "application/json, text/plain, */*",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    "content-type": "application/json",
    origin: "https://telegram.blum.codes",
    "x-requested-with": "org.telegram.messenger",
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
    referer: "https://telegram.blum.codes/",
    "accept-encoding": "gzip, deflate",
    "accept-language": "en,en-US;q=0.9",
  };

  constructor(private token?: string, private wallet?: Wallet) {}

  private getAuthHeaders() {
    return this.token
      ? { ...this.baseHeaders, Authorization: `Bearer ${this.token}` }
      : this.baseHeaders;
  }

  async getNewToken(queryId: string): Promise<string | null> {
    const url =
      "https://user-domain.blum.codes/api/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP";
    const data = JSON.stringify({ query: queryId });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.baseHeaders,
        body: data,
      });
      // console.debug(`Token request response: ${response.status}`);

      if (response.ok) {
        const responseJson = await response.json();
        return responseJson.token.refresh;
      } else {
        console.error(`Failed to get token: ${response.status}`);
        return null;
      }
    } catch (e: any) {
      console.error(`Error getting token: ${e.message}`);
      return null;
    }
  }

  async connectWallet(): Promise<boolean> {
    if (!this.wallet || !this.token) {
      console.error("Wallet or token not provided.");
      return false;
    }

    const url = "https://wallet-domain.blum.codes/api/v1/wallet/connect";
    const data = JSON.stringify({
      account: {
        address: this.wallet.address,
        chain: "-239",
        publicKey: this.wallet.public_key,
      },
      tonProof: generateTonProof(
        "https://telegram.blum.codes/tonconnect-manifest.json",
        this.wallet
      ),
    });

    // console.debug(`Connecting wallet with address: ${this.wallet.address}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: data,
      });
      console.debug(`Wallet Connect: ${await response.text()}`);

      return response.ok;
    } catch (e: any) {
      console.error(`Error connecting wallet: ${e.message}`);
      return false;
    }
  }

  async disconnectWallet(): Promise<boolean> {
    if (!this.wallet || !this.token) {
      console.error("Wallet or token not provided.");
      return false;
    }

    const url = "https://wallet-domain.blum.codes/api/v1/wallet/disconnect";
    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
      console.debug(`Wallet Disconnect: ${response.status}`);

      return response.ok;
    } catch (e: any) {
      console.error(`Error disconnecting wallet: ${e.message}`);
      return false;
    }
  }

  async getBalance(): Promise<any | null> {
    if (!this.token) {
      console.error("Token not provided.");
      return null;
    }

    const url = "https://game-domain.blum.codes/api/v1/user/balance";
    try {
      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error(`Failed to get balance: ${response.status}`);
        return null;
      }
    } catch (e: any) {
      console.error(`Error getting balance: ${e.message}`);
      return null;
    }
  }
}

export default BlumService;
