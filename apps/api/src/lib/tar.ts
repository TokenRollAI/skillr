/**
 * Minimal tar.gz creation for CF Workers.
 * Creates a single-file tar archive compressed with gzip.
 * Uses Web Streams CompressionStream (available in Workers runtime).
 */

export async function createTarGz(filename: string, content: Uint8Array): Promise<Uint8Array> {
  const tar = createTar(filename, content);
  return gzip(tar);
}

function createTar(filename: string, content: Uint8Array): Uint8Array {
  const header = new Uint8Array(512);
  const encoder = new TextEncoder();

  // File name (0-99, max 100 bytes)
  const nameBytes = encoder.encode(filename);
  header.set(nameBytes.subarray(0, 100), 0);

  // File mode (100-107): 0644
  writeOctal(header, 100, 8, 0o644);
  // UID (108-115): 0
  writeOctal(header, 108, 8, 0);
  // GID (116-123): 0
  writeOctal(header, 116, 8, 0);
  // File size (124-135): octal
  writeOctal(header, 124, 12, content.byteLength);
  // Modification time (136-147): current time
  writeOctal(header, 136, 12, Math.floor(Date.now() / 1000));
  // Type flag (156): '0' = regular file
  header[156] = 0x30; // '0'
  // Magic (257-262): 'ustar\0'
  header.set(encoder.encode('ustar\0'), 257);
  // Version (263-264): '00'
  header.set(encoder.encode('00'), 263);

  // Compute checksum (148-155)
  // First fill checksum field with spaces
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += header[i];
  writeOctal(header, 148, 7, checksum);
  header[155] = 0x20; // trailing space

  // Pad content to 512-byte boundary
  const paddedSize = Math.ceil(content.byteLength / 512) * 512;
  const dataBlock = new Uint8Array(paddedSize);
  dataBlock.set(content);

  // End-of-archive: two 512-byte zero blocks
  const endBlock = new Uint8Array(1024);

  // Combine: header + data + end
  const total = new Uint8Array(512 + paddedSize + 1024);
  total.set(header, 0);
  total.set(dataBlock, 512);
  total.set(endBlock, 512 + paddedSize);

  return total;
}

function writeOctal(buf: Uint8Array, offset: number, length: number, value: number) {
  const str = value.toString(8).padStart(length - 1, '0');
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  buf.set(bytes.subarray(0, length - 1), offset);
  buf[offset + length - 1] = 0; // null terminator
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(data) as unknown as BufferSource);
  writer.close();

  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.byteLength;
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
