export function bufferToString(buff: ArrayBuffer): string {
  return [].reduce.call(new Uint8Array(buff), (p: string, c: number) => p + String.fromCharCode(c), '');
}

export function stringToBuffer(str: string): ArrayBuffer {
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes.buffer;
}
