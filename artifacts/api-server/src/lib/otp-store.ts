interface OtpEntry {
  otp: string;
  expiry: number;
}

const store = new Map<string, OtpEntry>();

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function setOtp(key: string, otp: string, ttlMs = 10 * 60 * 1000): void {
  store.set(key, { otp, expiry: Date.now() + ttlMs });
}

export function verifyOtp(key: string, otp: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiry) {
    store.delete(key);
    return false;
  }
  if (entry.otp !== otp) return false;
  store.delete(key);
  return true;
}
