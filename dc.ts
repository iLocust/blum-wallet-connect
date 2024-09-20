import { fetch } from "bun";
import { readFileSync } from "fs";

class BlumService {
  private baseHeaders = {
    accept: "application/json, text/plain, */*",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
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

  constructor(private token?: string) {}

  private getAuthHeaders() {
    return this.token
      ? { ...this.baseHeaders, Authorization: `Bearer ${this.token}` }
      : this.baseHeaders;
  }

  async getNewToken(queryId: string): Promise<string | null> {
    const url = "https://user-domain.blum.codes/api/v1/auth/provider/PROVIDER_TELEGRAM_MINI_APP";
    const data = JSON.stringify({ query: queryId });

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.baseHeaders,
        body: data,
      });
      console.debug(`Token request response: ${response.status}`);

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

  async disconnectWallet(): Promise<boolean> {
    if (!this.token) {
      console.error("Token not provided.");
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
}

async function main() {
  try {
    const queryIds = readFileSync("data.txt", "utf-8").split("\r\n");

    console.info("Starting wallet disconnection process...");

    for (const [index, queryId] of queryIds.entries()) {
      console.info(`Processing account ${index + 1}`);

      const blumService = new BlumService();
      const token = await blumService.getNewToken(queryId);

      if (token) {
        const authenticatedService = new BlumService(token);
        const disconnectResponse = await authenticatedService.disconnectWallet();

        if (disconnectResponse) {
          console.info(`Account ${index + 1} - Wallet disconnected successfully.`);
        } else {
          console.error(`Account ${index + 1} - Failed to disconnect wallet.`);
        }
      } else {
        console.error(`Account ${index + 1} - Failed to get token.`);
      }
    }

    console.info("Wallet disconnection process completed.");
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
  }
}

main();