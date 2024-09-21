import nacl from 'tweetnacl';
import * as naclUtils from 'tweetnacl-util';
import { Int64LE } from 'int64-buffer';
import { mnemonicToWalletKey, newSecureWords, sha256_sync, type KeyPair } from '@ton/crypto';
import { WalletContractV4, type Cell } from '@ton/ton';

interface Wallet {
  mnemonics: string;
  address: string;
  address_bounceable_url_safe: string;
  public_key: string;
  private_key: string;
  base64_boc: string;
  creation_date: string;
}

interface TonProofItemReply {
  name: string;
  proof?: {
    timestamp: number;
    domain: {
      lengthBytes: number;
      value: string;
    };
    signature: string;
    payload: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

function getTimeSec(): number {
  return Math.floor(Date.now() / 1000);
}

function getDomainFromURL(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
  } catch (e) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

async function generateWalletInfo() : Promise<Wallet> {
  const walletMnemonics = await newSecureWords(24);
  const keyPair: KeyPair = await mnemonicToWalletKey(walletMnemonics);
  const { publicKey, secretKey } = keyPair;

  const wallet = WalletContractV4.create({workchain: 0, publicKey: publicKey });
  const base64Boc = wallet.init.data.toBoc().toString('base64');
  const creationDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const walletInfo = {
      mnemonics: walletMnemonics.join(' '),
      address: wallet.address.toRawString(),
      address_bounceable_url_safe: wallet.address.toString({urlSafe: true, bounceable: true, testOnly: false}),
      public_key: Buffer.from(publicKey).toString('hex'),
      private_key: Buffer.from(secretKey).toString('hex'),
      base64_boc: base64Boc,
      creation_date: creationDate
  };

  return walletInfo;
}


function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const byteArray = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    byteArray[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return byteArray;
}

function createTonProofItem(
  manifest: string,
  address: string,
  secretKey: Uint8Array,
  payload: string,
): TonProofItemReply | null {
  try {
    const timestamp = getTimeSec();
    const timestampBuffer = new Int64LE(timestamp).toBuffer();

    const domain = getDomainFromURL(manifest);
    const domainBuffer = Buffer.from(domain);
    const domainLengthBuffer = Buffer.allocUnsafe(4);
    domainLengthBuffer.writeInt32LE(domainBuffer.byteLength);

    const [workchain, addrHash] = address.split(':');

    const addressWorkchainBuffer = Buffer.allocUnsafe(4);
    addressWorkchainBuffer.writeInt32BE(Number(workchain));

    const addressBuffer = Buffer.concat([
      addressWorkchainBuffer,
      Buffer.from(addrHash, 'hex'),
    ]);

    const messageBuffer = Buffer.concat([
      Buffer.from('ton-proof-item-v2/'),
      addressBuffer,
      domainLengthBuffer,
      domainBuffer,
      timestampBuffer,
      Buffer.from(payload),
    ]);

    const message = sha256_sync(messageBuffer);
    const bufferToSign = Buffer.concat([
      Buffer.from('ffff', 'hex'),
      Buffer.from('ton-connect'),
      message,
    ]);

    const signed = nacl.sign.detached(
      sha256_sync(bufferToSign),
      secretKey,
    );

    const signature = naclUtils.encodeBase64(signed);

    return {
      name: 'ton_proof',
      proof: {
        timestamp,
        domain: {
          lengthBytes: domainBuffer.byteLength,
          value: domain,
        },
        signature,
        payload,
      },
    };
  } catch (e: any) {
    console.error(`CreateToonProof: ${e.message} | ${e.stack}`)
    return null;
  }
}

function generateTonProof(
  manifest: string,
  wallet: Wallet
) : TonProofItemReply | null {
  let payload:string = new Date().getTime().toString();
  let privateKey:Uint8Array = hexToUint8Array(wallet.private_key)

  return createTonProofItem(
    manifest,
    wallet.address,
    privateKey,
    payload
  )
}

export {
  generateWalletInfo, generateTonProof, getTimeSec,
  createTonProofItem, hexToUint8Array
};  export type { Wallet, };

