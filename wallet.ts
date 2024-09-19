import nacl from 'tweetnacl';
import * as naclUtils from 'tweetnacl-util';
import { Int64LE } from 'int64-buffer';
import { createHash } from 'bun:crypto';

const CONNECT_ITEM_ERROR_CODES = {
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

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
  return Math.floor(Date.now() / 1000); // Convert milliseconds to seconds
}

function getDomainFromURL(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname; // Extracts just the domain name (hostname)
  } catch (e) {
    throw new Error(`Invalid URL: ${url}`);
  }
}

// Convert hex string to Uint8Array
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

    const message = createHash('sha256').update(messageBuffer).digest();

    const bufferToSign = Buffer.concat([
      Buffer.from('ffff', 'hex'),
      Buffer.from('ton-connect'),
      message,
    ]);

    const signed = nacl.sign.detached(
      createHash('sha256').update(bufferToSign).digest(),
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
    console.error(`CreateToonProof: ${e.message}`)
    return null;
  }
}

function generateTonProof(
  manifest: string,
  wallet: Wallet
) : TonProofItemReply | null {
  let payload:string = new Date().getTime().toString();

  return createTonProofItem(
    manifest,
    wallet.address,
    hexToUint8Array(wallet.private_key),
    payload
  )
}

export {
  generateTonProof,getTimeSec,
  createTonProofItem, hexToUint8Array
};  export type { Wallet, };

