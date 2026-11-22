/**
 * File storage for lesson audio, portfolio uploads and (later) videos.
 * Production: Google Cloud Storage bucket named in STORAGE_BUCKET.
 * Development (no STORAGE_BUCKET): files go to public/uploads/ and are served by Next.js.
 * Shared contract for every feature: saveFile(key, data, contentType) -> public URL.
 */
import { promises as fs } from 'fs'
import path from 'path'

export const storageConfigured = () => Boolean(process.env.STORAGE_BUCKET)

const safeKey = (key: string) => {
  const k = key.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!k || k.split('/').some((p) => p === '..' || p === '')) throw new Error('Bad storage key')
  return k
}

export async function saveFile(key: string, data: Buffer, contentType: string): Promise<string> {
  const k = safeKey(key)
  const bucketName = process.env.STORAGE_BUCKET
  if (bucketName) {
    const { Storage } = await import('@google-cloud/storage')
    const file = new Storage().bucket(bucketName).file(k)
    await file.save(data, { contentType, resumable: false, metadata: { cacheControl: 'public, max-age=31536000' } })
    return `https://storage.googleapis.com/${bucketName}/${k}`
  }
  const out = path.join(process.cwd(), 'public', 'uploads', ...k.split('/'))
  await fs.mkdir(path.dirname(out), { recursive: true })
  await fs.writeFile(out, data)
  return `/uploads/${k}`
}

export async function deleteFile(key: string): Promise<void> {
  const k = safeKey(key)
  const bucketName = process.env.STORAGE_BUCKET
  if (bucketName) {
    const { Storage } = await import('@google-cloud/storage')
    await new Storage().bucket(bucketName).file(k).delete({ ignoreNotFound: true })
    return
  }
  await fs.rm(path.join(process.cwd(), 'public', 'uploads', ...k.split('/')), { force: true })
}
