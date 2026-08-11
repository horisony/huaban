const USB_FILTERS = [{ usbVendorId: 0x303a, usbProductId: 0x1001 }];
const FRAME_WIDTH = 400;
const FRAME_HEIGHT = 300;
const FRAME_ROW_BYTES = Math.ceil(FRAME_WIDTH / 8);
const FRAME_BYTES = FRAME_ROW_BYTES * FRAME_HEIGHT;
const USB_CHUNK_BYTES = 256;
const SERIAL_RESPONSE_TIMEOUT = 15000;

function waitForImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function imageToU8g2Frame(dataUrl) {
  const image = await waitForImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
  const scale = Math.min(FRAME_WIDTH / image.width, FRAME_HEIGHT / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (FRAME_WIDTH - width) / 2, (FRAME_HEIGHT - height) / 2, width, height);

  const rgba = ctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;
  const gray = new Float32Array(FRAME_WIDTH * FRAME_HEIGHT);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = rgba[p] * 0.299 + rgba[p + 1] * 0.587 + rgba[p + 2] * 0.114;
  }

  // Floyd–Steinberg dithering keeps useful detail on a true 1-bit panel.
  const out = new Uint8Array(FRAME_BYTES);
  for (let y = 0; y < FRAME_HEIGHT; y++) {
    for (let x = 0; x < FRAME_WIDTH; x++) {
      const i = y * FRAME_WIDTH + x;
      const oldValue = gray[i];
      const white = oldValue >= 160;
      const newValue = white ? 255 : 0;
      if (!white) out[y * FRAME_ROW_BYTES + Math.floor(x / 8)] |= 1 << (x & 7);
      const error = oldValue - newValue;
      if (x + 1 < FRAME_WIDTH) gray[i + 1] += error * 7 / 16;
      if (y + 1 < FRAME_HEIGHT) {
        if (x > 0) gray[i + FRAME_WIDTH - 1] += error * 3 / 16;
        gray[i + FRAME_WIDTH] += error * 5 / 16;
        if (x + 1 < FRAME_WIDTH) gray[i + FRAME_WIDTH + 1] += error / 16;
      }
    }
  }
  return out;
}

export class Esp32Bridge {
  constructor() {
    this.port = null;
    this.readText = '';
    this.sendQueue = Promise.resolve();
  }

  get supported() {
    return !!navigator.serial;
  }

  get connected() {
    return !!this.port?.writable;
  }

  async connect() {
    if (!this.supported) throw new Error('web_serial_unsupported');
    this.port = await navigator.serial.requestPort({ filters: USB_FILTERS });
    await this.port.open({ baudRate: 921600, bufferSize: 32768 });
  }

  async disconnect() {
    if (!this.port) return;
    await this.port.close();
    this.port = null;
  }

  async readLine(reader) {
    const decoder = new TextDecoder();
    const deadline = Date.now() + SERIAL_RESPONSE_TIMEOUT;
    while (Date.now() < deadline) {
      const newline = this.readText.indexOf('\n');
      if (newline >= 0) {
        const line = this.readText.slice(0, newline).trim();
        this.readText = this.readText.slice(newline + 1);
        if (line) return line;
        continue;
      }
      const remaining = deadline - Date.now();
      const result = await Promise.race([
        reader.read(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('serial_response_timeout')), remaining)),
      ]);
      if (result.done) throw new Error('serial_disconnected');
      this.readText += decoder.decode(result.value, { stream: true });
    }
    throw new Error('serial_response_timeout');
  }

  async waitFor(reader, expected) {
    while (true) {
      const line = await this.readLine(reader);
      if (line === expected) return;
      if (line === 'HUABAN_TIMEOUT') throw new Error('device_receive_timeout');
    }
  }

  async sendImageNow(dataUrl) {
    if (!this.connected) throw new Error('device_not_connected');
    const frame = await imageToU8g2Frame(dataUrl);
    const header = new Uint8Array(12);
    header.set(new TextEncoder().encode('HUABAN1\n'), 0);
    new DataView(header.buffer).setUint32(8, frame.length, true);

    const writer = this.port.writable.getWriter();
    const reader = this.port.readable.getReader();
    try {
      await writer.write(header);
      await this.waitFor(reader, 'HUABAN_GO');
      for (let offset = 0; offset < frame.length; offset += USB_CHUNK_BYTES) {
        await writer.write(frame.subarray(offset, offset + USB_CHUNK_BYTES));
        await this.waitFor(reader, 'HUABAN_NEXT');
      }
      await this.waitFor(reader, 'HUABAN_OK');
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
      writer.releaseLock();
    }
  }

  sendImage(dataUrl) {
    const transfer = this.sendQueue.then(() => this.sendImageNow(dataUrl));
    this.sendQueue = transfer.catch(() => {});
    return transfer;
  }
}
