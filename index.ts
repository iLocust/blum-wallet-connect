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
  username: string;
}

interface WalletStatus {
  queryId: string;
  lineNumber: number;
  isConnected: boolean;
}

function checkWalletStatus(queryIds: string[], connectedAccounts: ConnectedAccount[]): WalletStatus[] {
  return queryIds.map((queryId, index) => ({
    queryId,
    lineNumber: index + 1,
    isConnected: connectedAccounts.some(account => account.queryId === queryId)
  }));
}

function extractUsername(queryId: string): string {
  const match = queryId.match(/%22username%22%3A%22(.*?)%22/);
  return match ? match[1] : 'Unknown';
}

function formatQueryId(queryId: string): string {
  const id = queryId.match(/%22id%22%3A(\d+)/)?.[1] || 'Unknown';
  const username = extractUsername(queryId);
  return `ID: ${id.padEnd(11)} | Username: ${username.padEnd(20)}`;
}

async function mainMenu(): Promise<string> {
  console.log("\n" + "=".repeat(50));
  console.log("Main Menu".padStart(30));
  console.log("=".repeat(50));
  return askQuestion("Choose an action:\n1. Connect wallets\n2. Disconnect wallets\n3. Display all wallets\n9. Exit\nEnter 1, 2, 3, or 9: ");
}

async function processWallets(action: string, queryIds: string[], connectedAccounts: ConnectedAccount[]): Promise<ConnectedAccount[]> {
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
      let wallet: wlt.Wallet;

      if (action === "1") {
        wallet = await wlt.generateWalletInfo();
      } else {
        const existingAccount = connectedAccounts.find(account => account.queryId === queryId);
        if (existingAccount) {
          wallet = existingAccount;
        } else {
          console.log(`❌ Account ${index + 1} - No connected wallet found for disconnection`);
          continue;
        }
      }

      console.log(`QueryID : ${index + 1}`);
      console.log("-".repeat(30));

      const blumService = new BlumService();
      const token = await blumService.getNewToken(queryId);

      if (token) {
        const blum = blumService.init(token, wallet);

        if (action === "1") {
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

            const userDataMatch = queryId.match(/user=%7B%22id%22%3A(\d+).*?%22username%22%3A%22(.*?)%22/);
            if (userDataMatch) {
              const newConnectedAccount: ConnectedAccount = {
                queryId: queryId,
                username: userDataMatch[2],
                ...wallet
              };
              connectedAccounts.push(newConnectedAccount);
            }
          } else {
            console.log(`❌ Account ${index + 1} - Failed to connect wallet`);
          }
        } else if (action === "2") {
          const disconnectResponse = await blum.disconnectWallet();

          if (disconnectResponse) {
            console.log(`✅ Account ${index + 1} - Wallet disconnected successfully`);
            connectedAccounts = connectedAccounts.filter(account => account.queryId !== queryId);
            console.log(`   Removed from connected accounts`);
          } else {
            console.log(`❌ Account ${index + 1} - Failed to disconnect wallet`);
          }
        }
      } else {
        console.log(`❌ Account ${index + 1} - Failed to get token`);
      }

      console.log();
    }
  }

  if (action === "1") {
    console.log("\n" + "=".repeat(50));
    console.log(`Total Balance: ${totalBalanceAllAccounts.toFixed(2)}`.padStart(35));
    console.log("=".repeat(50));
  }

  return connectedAccounts;
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

    while (true) {
      const action = await mainMenu();

      if (action === "9") {
        console.log("Exiting the program. Goodbye!");
        break;
      }

      if (["1", "2", "3"].includes(action)) {
        connectedAccounts = await processWallets(action, queryIds, connectedAccounts);
        
        // Save updated connected accounts to JSON file
        writeFileSync(connectedAccountsFilePath, JSON.stringify(connectedAccounts, null, 2));

        const postAction = await askQuestion("\nChoose an action:\n1. Back to main menu\n2. Exit\nEnter 1 or 2: ");
        if (postAction === "2") {
          console.log("Exiting the program. Goodbye!");
          break;
        }
      } else {
        console.log("Invalid option. Please try again.");
      }
    }

    rl.close();
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    rl.close();
  }
})();