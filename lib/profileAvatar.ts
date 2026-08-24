import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';

export const PROFILE_AVATAR_MAX_BYTES = 4 * 1024 * 1024;
export const PROFILE_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type ProfileAvatarMimeType = (typeof PROFILE_AVATAR_MIME_TYPES)[number];

const AVATAR_PATH_PATTERN = /^([a-z0-9-]{1,128})\.([a-f0-9]{64})\.(jpg|png|webp|heic|heif)$/u;

function imageExtensionForMimeType(mimeType: ProfileAvatarMimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
}

export function decodeBase64Avatar(base64: string) {
  const normalized = base64.replace(/\s/g, '');
  if (!normalized || !/^[a-z0-9+/]+={0,2}$/iu.test(normalized)) {
    throw new Error('Avatar image payload is invalid.');
  }

  const bytes = Buffer.from(normalized, 'base64');
  if (bytes.length === 0) throw new Error('Avatar image payload is invalid.');
  if (bytes.length > PROFILE_AVATAR_MAX_BYTES) {
    throw new Error('Avatar image is too large. Max size is 4 MB.');
  }
  return bytes;
}

export function detectAvatarMimeType(bytes: Buffer): ProfileAvatarMimeType {
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const isWebp = bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  const isoBrand = bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp'
    ? bytes.subarray(8, 12).toString('ascii').toLowerCase()
    : '';
  if (isJpeg) return 'image/jpeg';
  if (isPng) return 'image/png';
  if (isWebp) return 'image/webp';
  if (['heic', 'heix', 'hevc', 'hevx'].includes(isoBrand)) return 'image/heic';
  if (['mif1', 'msf1'].includes(isoBrand)) return 'image/heif';
  throw new Error('Avatar image content is not a supported image type.');
}

export async function normalizeAvatarImage(bytes: Buffer) {
  try {
    const result = await sharp(bytes, {
      failOn: 'error',
      limitInputPixels: 24_000_000,
      animated: false,
    })
      .rotate()
      .resize(1024, 1024, { fit: 'cover', position: 'centre' })
      .webp({ quality: 86, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    return {
      bytes: result.data,
      mimeType: 'image/webp' as const,
      width: result.info.width,
      height: result.info.height,
    };
  } catch {
    throw new Error('Avatar image could not be processed.');
  }
}

function avatarOwnerSignature(objectId: string, userId: string, ownerSecret: string) {
  return createHmac('sha256', ownerSecret).update(`${objectId}:${userId}`).digest('hex');
}

export function buildAvatarStoragePath(
  mimeType: ProfileAvatarMimeType,
  userId: string,
  ownerSecret: string,
  createId: () => string = randomUUID,
) {
  const objectId = createId();
  const ownerSignature = avatarOwnerSignature(objectId, userId, ownerSecret);
  return `${objectId}.${ownerSignature}.${imageExtensionForMimeType(mimeType)}`;
}

export function avatarStoragePathBelongsToUser(
  storagePath: string,
  userId: string,
  ownerSecret: string,
) {
  const match = storagePath.match(AVATAR_PATH_PATTERN);
  if (!match) return false;
  const expected = Buffer.from(avatarOwnerSignature(match[1], userId, ownerSecret), 'hex');
  const actual = Buffer.from(match[2], 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function avatarStoragePathFromPublicUrl(
  avatarUrl: string | null | undefined,
  supabaseUrl: string,
  bucket: string,
) {
  if (!avatarUrl) return null;

  try {
    const parsed = new URL(avatarUrl);
    const expectedOrigin = new URL(supabaseUrl).origin;
    if (parsed.origin !== expectedOrigin) return null;

    const prefix = `/storage/v1/object/public/${encodeURIComponent(bucket)}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;

    const encodedPath = parsed.pathname.slice(prefix.length);
    const storagePath = decodeURIComponent(encodedPath);
    if (!storagePath || storagePath.startsWith('/') || storagePath.includes('../')) return null;
    return storagePath;
  } catch {
    return null;
  }
}
