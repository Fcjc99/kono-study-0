/** GET → the public key devices use to turn on lock-screen reminders, or null when they're not set up. */
type Response = { status(code: number): Response; setHeader(name: string, value: string): void; json(body: unknown): void }
export default function handler(_req: unknown, res: Response) {
  res.setHeader('cache-control', 'no-store')
  res.status(200).json({ publicKey: process.env.VAPID_PUBLIC_KEY?.trim() || null })
}
