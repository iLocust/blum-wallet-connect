import json
import os
import sys
from datetime import datetime
from tonsdk.contract.wallet import WalletVersionEnum, Wallets
from tonsdk.utils import bytes_to_b64str
from tonsdk.crypto import mnemonic_new

def generate_wallet_info(wallet_mnemonics, wallet_version, wallet_workchain):
    # Create wallet from mnemonics
    _mnemonics, _pub_k, _priv_k, wallet = Wallets.from_mnemonics(
        wallet_mnemonics, wallet_version, wallet_workchain)

    # Create external init message
    query = wallet.create_init_external_message()

    # Convert to base64 format
    base64_boc = bytes_to_b64str(query["message"].to_boc(False))

    # Get the current date and time
    creation_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Prepare wallet information dictionary with the creation date
    wallet_info = {
        "mnemonics": " ".join(wallet_mnemonics),
        "address": wallet.address.to_string(),
        "address_bounceable_url_safe": wallet.address.to_string(True, True, True),
        "public_key": _pub_k.hex(),
        "private_key": _priv_k.hex(),
        "base64_boc": base64_boc,
        "creation_date": creation_date
    }

    return wallet_info

def main():
    # Initialize wallet parameters
    wallet_workchain = 0
    wallet_version = WalletVersionEnum.v4r2

    if len(sys.argv) > 1 and sys.argv[1] == "single":
        # Generate a single wallet and print its JSON
        wallet_mnemonics = mnemonic_new()
        wallet_info = generate_wallet_info(wallet_mnemonics, wallet_version, wallet_workchain)
        print(json.dumps(wallet_info))
    else:
        # Original functionality: generate multiple wallets based on data.txt
        input_file = "data.txt"
        output_file = "ton_wallets.json"

        if not os.path.exists(input_file):
            print(f"Error: {input_file} not found.")
            return

        with open(input_file, 'r') as f:
            num_addresses = sum(1 for line in f)

        wallets = []
        for i in range(num_addresses):
            wallet_mnemonics = mnemonic_new()
            wallet_info = generate_wallet_info(wallet_mnemonics, wallet_version, wallet_workchain)
            wallets.append(wallet_info)
            print(f"Generated wallet {i + 1}.")

        with open(output_file, 'w') as f:
            json.dump(wallets, f, indent=4)

        print(f"{num_addresses} wallet(s) successfully generated and saved to '{output_file}'.")

if __name__ == "__main__":
    main()