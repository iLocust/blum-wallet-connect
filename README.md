# Blum Wallet Manager

This project is an open-source, command-line interface (CLI) tool for managing Blum wallets. It allows users to connect, disconnect, and display information about wallets associated with Telegram Mini App users. With no encryption and full transparency, this tool prioritizes user control and security.

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Bun runtime (strongly recommended)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/blum-wallet-manager.git
   cd blum-wallet-manager
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Install Bun (if not already installed):
   
   We strongly recommend using Bun to run this project for optimal performance. Follow the installation instructions at [bun.sh](https://bun.sh).

## Configuration

Before running the application, make sure you have a `data.txt` file in the root directory. This file should contain the query IDs for the Telegram Mini App users, one per line.

## Usage

To run the application, we recommend using Bun:

```
bun run index.ts
```

If you prefer to use Node.js instead, you can run:

```
node index.js
```

However, please note that Bun is optimized for this project and may offer better performance.

The main menu will present you with the following options:

1. Connect wallets
2. Disconnect wallets
3. Display all wallets

### Connecting Wallets

Choose option 1 to connect wallets. The application will attempt to connect a wallet for each query ID in `data.txt`. Connected wallet information will be saved in `connected_accounts_wallets.json`.

### Disconnecting Wallets

Choose option 2 to disconnect wallets. The application will attempt to disconnect wallets that were previously connected.

### Displaying All Wallets

Choose option 3 to view information about all wallets, including their connection status.

## Hard Disconnect

In addition to the main script, this project includes a separate file `dc.ts` for performing a "hard disconnect" of wallets. This file is designed to be used when the main script is unable to disconnect wallets successfully. It provides a more forceful approach to ensure all wallets are properly disconnected.

To use the hard disconnect feature:

```
bun run dc.ts
```

This will attempt to disconnect all wallets associated with the query IDs in `data.txt`, regardless of their current connection status.

## Files Description

- `index.ts`: Main application file containing the CLI logic.
- `blum.ts`: Contains the `BlumService` class for interacting with the Blum API.
- `wallet.ts`: Provides functions for generating wallet information and TON proofs.
- `data.txt`: Contains query IDs for Telegram Mini App users.
- `connected_accounts_wallets.json`: Stores information about connected wallets.
- `dc.ts`: Performs a "hard disconnect" of all wallets when other methods fail.

## Security and Transparency

As an open-source project with no encryption, Blum Wallet Manager offers full transparency and puts you in control of your wallet management process. You can review the code, make modifications, and ensure that your wallet operations are performed exactly as you intend.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)
