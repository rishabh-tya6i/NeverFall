import crypto from "crypto";
import AWS from "aws-sdk";

const s3 = new AWS.S3();
const BUCKET = process.env.MEDIA_BUCKET || "your-production-bucket";
const CDN_BASE = process.env.CDN_BASE || "https://your-cdn-domain.com/";

const ALLOW_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export const signUpload = async (req, res) => {
  const userId = req.user?._id || "anon";
  const {
    mime,
    size,
    purpose,
    productId = "generic",
    ext = "jpg",
  } = req.body || {};

  if (!mime || !ALLOW_MIME.has(mime)) {
    return res.status(400).json({ message: "Unsupported mime" });
  }
  if (!size || size > 5 * 1024 * 1024) {
    return res.status(400).json({ message: "Max 5MB" });
  }
  if (purpose !== "review-image") {
    return res.status(400).json({ message: "Invalid purpose" });
  }

  const day = new Date().toISOString().slice(0, 10);
  const rand = crypto.randomBytes(6).toString("hex");
  const safeUser = String(userId).slice(-8);
  const key = `reviews/${productId}/${safeUser}/${day}/${rand}.${ext}`;

  const params = {
    Bucket: BUCKET,
    Key: key,
    ContentType: mime,
    Expires: 60,
    ACL: "public-read",
  };

  try {
    const uploadUrl = await s3.getSignedUrlPromise("putObject", params);
    const publicUrl = `${CDN_BASE}${key}`;
    return res.json({
      key,
      uploadUrl,
      method: "PUT",
      headers: { "Content-Type": mime },
      publicUrl,
      expiresIn: 60,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to sign upload", error: err.message });
  }
};

export const deleteObject = async (req, res) => {
  const { key } = req.query;
  if (!key) return res.status(400).json({ message: "Missing key" });

  const params = { Bucket: BUCKET, Key: key };
  try {
    await s3.deleteObject(params).promise();
    return res.json({ ok: true, key });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Failed to delete object", error: err.message });
  }
};
