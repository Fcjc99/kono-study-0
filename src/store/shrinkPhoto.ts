import type { PhotoInput } from './aiProvider'

/** Photos sent to KONO's built-in AI are shrunk first (longest side 1600 px, JPEG), which keeps them
 * under the server's size limit and makes them faster to send; handwriting stays readable at that size. */
export async function shrinkPhoto(photo: PhotoInput, maxSide = 1600): Promise<PhotoInput> {
  if (photo.base64.length < 1_200_000 && photo.mimeType !== 'image/heic') return photo
  const bytes = Uint8Array.from(atob(photo.base64), c => c.charCodeAt(0))
  const bitmap = await createImageBitmap(new Blob([bytes], { type: photo.mimeType }))
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const data = canvas.toDataURL('image/jpeg', 0.82)
    canvas.width = 0; canvas.height = 0
    return { base64: data.split(',')[1] ?? '', mimeType: 'image/jpeg' }
  } finally { bitmap.close() }
}
