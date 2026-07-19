import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, encodeUTF8, decodeUTF8 } from 'tweetnacl-util';

const PRIVATE_KEY_STORAGE = 'zapply_private_key';

// ---- Generate new E2E keypair ----
export const generateKeyPair = (): { publicKey: string; privateKey: string } => {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    privateKey: encodeBase64(keyPair.secretKey),
  };
};

// ---- Store private key securely in localStorage ----
export const setPrivateKey = (privateKeyBase64: string): void => {
  localStorage.setItem(PRIVATE_KEY_STORAGE, privateKeyBase64);
};

// ---- Retrieve stored private key ----
export const getPrivateKey = (): string | null => {
  return localStorage.getItem(PRIVATE_KEY_STORAGE);
};

// ---- Clear private key (on logout) ----
export const clearPrivateKey = (): void => {
  localStorage.removeItem(PRIVATE_KEY_STORAGE);
};

// ---- Encrypt a message for a recipient ----
export const encryptMessage = (
  message: string,
  recipientPublicKeyBase64: string,
  senderPrivateKeyBase64: string
): string | null => {
  try {
    const recipientPublicKey = decodeBase64(recipientPublicKeyBase64);
    const senderPrivateKey = decodeBase64(senderPrivateKeyBase64);
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = decodeUTF8(message);
    const encrypted = nacl.box(messageUint8, nonce, recipientPublicKey, senderPrivateKey);

    // Pack: nonce (24 bytes) + encrypted
    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);

    return encodeBase64(fullMessage);
  } catch (err) {
    console.error('Encryption failed:', err);
    return null;
  }
};

// ---- Decrypt a message ----
export const decryptMessage = (
  encryptedBase64: string,
  senderPublicKeyBase64: string,
  recipientPrivateKeyBase64: string
): string | null => {
  try {
    const senderPublicKey = decodeBase64(senderPublicKeyBase64);
    const recipientPrivateKey = decodeBase64(recipientPrivateKeyBase64);
    const messageWithNonce = decodeBase64(encryptedBase64);

    const nonce = messageWithNonce.slice(0, nacl.box.nonceLength);
    const message = messageWithNonce.slice(nacl.box.nonceLength);

    const decrypted = nacl.box.open(message, nonce, senderPublicKey, recipientPrivateKey);
    if (!decrypted) return null;

    return encodeUTF8(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
};

// ---- Encrypt for self (for local storage backup) ----
export const encryptForSelf = (message: string, publicKeyBase64: string, privateKeyBase64: string): string | null => {
  return encryptMessage(message, publicKeyBase64, privateKeyBase64);
};
