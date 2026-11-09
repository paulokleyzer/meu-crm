// Browser-only WhatsApp ZIP/TXT reader. Media files are never opened or uploaded.
const MAX_ARCHIVE = 20 * 1024 * 1024;
const MAX_CHAT = 5 * 1024 * 1024;
const decoder = new TextDecoder("utf-8", { fatal: false });

function limit(value: number, max: number) {
  if (value > max) throw new Error("Arquivo acima do limite permitido.");
}
async function unzipChat(data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  // Locate end-of-central-directory; ZIP comments can be up to 65535 bytes.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("ZIP inválido ou não suportado.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count > 1500) throw new Error("ZIP possui entradas demais.");
  for (let entry = 0; entry < count; entry++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error("Índice do ZIP inválido.");
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const expanded = view.getUint32(offset + 24, true);
    const nameSize = view.getUint16(offset + 28, true);
    const extraSize = view.getUint16(offset + 30, true);
    const commentSize = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (offset + 46 + nameSize + extraSize + commentSize > bytes.length)
      throw new Error("Entrada do ZIP inválida.");
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameSize));
    offset += 46 + nameSize + extraSize + commentSize;
    if (!/\.txt$/i.test(name) || name.startsWith("__MACOSX/")) continue;
    limit(expanded, MAX_CHAT);
    if (size > 0 && expanded / size > 200) throw new Error("ZIP compactado de forma suspeita.");
    if (flags & 1) throw new Error("ZIP criptografado não é suportado.");
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50)
      throw new Error("Cabeçalho ZIP inválido.");
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + size > bytes.length) throw new Error("Arquivo ZIP incompleto.");
    const compressed = bytes.slice(start, start + size);
    if (method === 0) return decoder.decode(compressed);
    if (method !== 8) throw new Error("Compressão ZIP não suportada.");
    if (!("DecompressionStream" in globalThis))
      throw new Error("Seu navegador não suporta ZIP. Exporte e importe o TXT.");
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        total += result.value.byteLength;
        if (total > MAX_CHAT) throw new Error("Conversa maior que 5 MB.");
        chunks.push(result.value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const merged = new Uint8Array(total);
    let index = 0;
    for (const chunk of chunks) { merged.set(chunk, index); index += chunk.length; }
    return decoder.decode(merged);
  }
  throw new Error("O ZIP não contém um arquivo de conversa TXT.");
}

export async function readWhatsAppExport(file: File) {
  limit(file.size, MAX_ARCHIVE);
  if (/\.txt$/i.test(file.name)) return { fileName: file.name, text: await file.text() };
  if (/\.zip$/i.test(file.name))
    return { fileName: file.name, text: await unzipChat(await file.arrayBuffer()) };
  throw new Error("Envie apenas exportações .txt ou .zip do WhatsApp.");
}
