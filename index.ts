import { readFileSync, writeFileSync, existsSync } from "fs";
import * as readline from "readline";
import * as wlt from "./wallet";
import BlumService from "./blum";
import { exec } from "child_process";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

interface ConnectedAccount extends wlt.Wallet {
  queryId: string;
}

interface WalletStatus {
  queryId: string;
  lineNumber: number;
  isConnected: boolean;
}

function generateWallet(): Promise<wlt.Wallet> {
  return new Promise((resolve, reject) => {
    exec('python3 ton_gen.py single', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running ton_gen.py: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`ton_gen.py stderr: ${stderr}`);
      }
      try {
        const wallet: wlt.Wallet = JSON.parse(stdout);
        resolve(wallet);
      } catch (e) {
        reject(new Error("Failed to parse wallet data"));
      }
    });
  });
}

function checkWalletStatus(queryIds: string[], connectedAccounts: ConnectedAccount[]): WalletStatus[] {
  return queryIds.map((queryId, index) => ({
    queryId,
    lineNumber: index + 1,
    isConnected: connectedAccounts.some(account => account.queryId === queryId)
  }));
}

function extractUserId(queryId: string): string {
  const match = queryId.match(/user=%7B%22id%22%3A(\d+)/);
  return match ? match[1] : 'Unknown';
}

function formatQueryId(queryId: string): string {
  const userId = extractUserId(queryId);
  return `User ID: ${userId.padEnd(20)}`;
}

// Main program
(async () => {
  try {
    const dataFilePath = "data.txt";
    const connectedAccountsFilePath = "connected_accounts_wallets.json";
    
    if (!existsSync(dataFilePath)) {
      throw new Error("data.txt not found. Please ensure it exists.");
    }

    const queryIds = readFileSync(dataFilePath, "utf-8").split("\r\n");

    let connectedAccounts: ConnectedAccount[] = [];
    if (existsSync(connectedAccountsFilePath)) {
      connectedAccounts = JSON.parse(readFileSync(connectedAccountsFilePath, "utf-8"));
    }

    const action = await askQuestion("Choose an action:\n1. Connect wallets\n2. Disconnect wallets\n3. Display all wallets\nEnter 1, 2, or 3: ");

    console.log("\n" + "=".repeat(90));
    console.log(`${action === "1" ? "Connecting" : action === "2" ? "Disconnecting" : "Displaying All"} Wallets`.padStart(55));
    console.log("=".repeat(90) + "\n");

    let totalBalanceAllAccounts = 0;

    if (action === "3") {
      const allWallets = checkWalletStatus(queryIds, connectedAccounts);
      console.log("Line | Status | User Information".padEnd(60) + "| data.txt Content");
      console.log("-".repeat(90));
      allWallets.forEach(({ queryId, lineNumber, isConnected }) => {
        const formattedQueryId = formatQueryId(queryId);
        const status = isConnected ? "🟢" : "🔴";
        console.log(`${lineNumber.toString().padStart(4)} | ${status}     | ${formattedQueryId} | ${queryId.slice(0, 30)}...`);
      });
      console.log("\n" + "-".repeat(90));
      const connectedCount = allWallets.filter(w => w.isConnected).length;
      const unconnectedCount = allWallets.length - connectedCount;
      console.log(`Total wallets: ${allWallets.length} (🟢 Connected: ${connectedCount}, 🔴 Unconnected: ${unconnectedCount})`);
    } else {
      for (const [index, queryId] of queryIds.entries()) {
        console.log(`QueryID : ${index + 1}`);
        console.log("-".repeat(30));

        const token = await new BlumService().getNewToken(queryId);

        if (token) {
          const blum = new BlumService(token);

          if (action === "1") {
            // Generate a new wallet on-the-fly for connecting
            const wallet = await generateWallet();
            blum.setWallet(wallet);

            // Connect wallet
            const connectResponse = await blum.connectWallet();

            if (connectResponse) {
              console.log(`✅ Account ${index + 1} - Wallet connected successfully`);
              console.log(`   Address: ${wallet.address_bounceable_url_safe}`);

              const balanceInfo = await blum.getBalance();

              if (balanceInfo) {
                const availableBalance = balanceInfo.availableBalance;
                totalBalanceAllAccounts += parseFloat(availableBalance);
                console.log(`   Balance: ${availableBalance}`);
              } else {
                console.log(`❌ Account ${index + 1} - Failed to get balance`);
              }

              // Create a new ConnectedAccount object with all required information
              const newConnectedAccount: ConnectedAccount = {
                queryId: queryId,
                mnemonics: wallet.mnemonics,
                address: wallet.address,
                address_bounceable_url_safe: wallet.address_bounceable_url_safe,
                public_key: wallet.public_key,
                private_key: wallet.private_key,
                base64_boc: wallet.base64_boc,
                creation_date: wallet.creation_date
              };
              connectedAccounts.push(newConnectedAccount);
            } else {
              console.log(`❌ Account ${index + 1} - Failed to connect wallet`);
            }
          } else if (action === "2") {
            // Disconnect wallet
            const disconnectResponse = await blum.disconnectWallet();

            if (disconnectResponse) {
              console.log(`✅ Account ${index + 1} - Wallet disconnected successfully`);
              
              // Remove the disconnected account from connectedAccounts array
              connectedAccounts = connectedAccounts.filter(account => account.queryId !== queryId);
              console.log(`   Removed from connected accounts`);
            } else {
              console.log(`❌ Account ${index + 1} - Failed to disconnect wallet`);
            }
          }
        } else {
          console.log(`❌ Account ${index + 1} - Failed to get token`);
        }

        console.log(); // Add a blank line between accounts
      }
    }

    // Save updated connected accounts to JSON file
    writeFileSync(connectedAccountsFilePath, JSON.stringify(connectedAccounts, null, 2));

    if (action === "1") {
      console.log("\n" + "=".repeat(50));
      console.log(`Total Balance: ${totalBalanceAllAccounts.toFixed(2)}`.padStart(35));
      console.log("=".repeat(50));
    }

    console.log("=".repeat(90));
    rl.close();
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    rl.close();
  }
})();