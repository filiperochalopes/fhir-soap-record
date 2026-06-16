export function decodePluginSecretEncryptionKey(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const base64Key = Buffer.from(normalized, "base64");
  if (base64Key.length === 32) {
    return base64Key;
  }

  if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
    const hexKey = Buffer.from(normalized, "hex");
    if (hexKey.length === 32) {
      return hexKey;
    }
  }

  return null;
}
