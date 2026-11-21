async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

export async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    return await pipe(bytes, new CompressionStream('deflate-raw'))
  } catch {
    return null
  }
}

export function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  return pipe(bytes, new DecompressionStream('deflate-raw'))
}
