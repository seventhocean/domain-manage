import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
const keys = new Set(["cf_api_token", "komari_api_key"]);
function master() {
  const value = process.env.CREDENTIAL_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw Object.assign(
      new Error(
        "保存密钥需要配置 64 位十六进制 CREDENTIAL_KEY；也可直接使用连接器环境变量",
      ),
      { status: 409 },
    );
  return Buffer.from(value, "hex");
}
export function encodeSetting(key: string, value: unknown): string {
  if (!keys.has(key) || !value) return JSON.stringify(value);
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", master(), nonce);
  const body = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    encrypted: 1,
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    body: body.toString("base64"),
  });
}
export function decodeSetting(value: string): unknown {
  const parsed = JSON.parse(value);
  if (!parsed || parsed.encrypted !== 1) return parsed;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    master(),
    Buffer.from(parsed.nonce, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parsed.body, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
