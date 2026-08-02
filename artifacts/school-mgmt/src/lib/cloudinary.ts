/**
 * uploadToCloudinary – uploads to Cloudinary if credentials are configured in
 * Settings → Cloudinary Integration, otherwise falls back to a base64 data URL.
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported");
  }

  try {
    const configRes = await fetch("/api/settings/cloudinary");
    if (configRes.ok) {
      const { cloudName, uploadPreset, configured } = await configRes.json();
      if (configured && cloudName && uploadPreset) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", uploadPreset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: fd,
        });
        if (res.ok) {
          const data = await res.json();
          return (data as any).secure_url as string;
        }
      }
    }
  } catch {
    // fall through to base64
  }

  // Fallback: convert to base64 data URL (no external service needed)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * uploadDocumentToCloudinary – uploads any file type (PDF, DOC, XLS, etc.)
 * to Cloudinary using the "raw" resource type, which preserves the original
 * file for download. Requires Cloudinary to be configured in Settings.
 */
export async function uploadDocumentToCloudinary(file: File): Promise<string> {
  const configRes = await fetch("/api/settings/cloudinary");
  if (!configRes.ok) throw new Error("Could not reach settings");

  const { cloudName, uploadPreset, configured } = await configRes.json();
  if (!configured || !cloudName || !uploadPreset) {
    throw new Error("Cloudinary is not configured. Please set it up in Settings → Cloudinary Integration.");
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", uploadPreset);

  // Use "auto" so Cloudinary handles both images and raw files correctly
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error?.message || "Cloudinary upload failed");
  }

  const data = await res.json();
  return (data as any).secure_url as string;
}
