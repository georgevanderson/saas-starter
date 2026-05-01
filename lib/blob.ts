import 'server-only';

type BlobPutResult = { url: string };

export async function putBlob(
  key: string,
  body: Buffer,
  contentType: string
): Promise<BlobPutResult> {
  const provider = process.env.BLOB_PROVIDER || 'vercel';

  if (provider === 'vercel') {
    const { put } = await import('@vercel/blob');
    const { url } = await put(key, body, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url };
  }

  throw new Error(`unknown BLOB_PROVIDER: ${provider}`);
}
