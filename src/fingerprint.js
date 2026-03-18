/**
 * Módulo para lectores de huella R307/R503 vía Web Serial API
 * Protocolo ZFM (compatible con R307, R503, ZFM-20, etc.)
 * Requiere: Chrome, HTTPS o localhost, lector conectado por USB
 */

const FINGERPRINT_HEADER = 0xEF01;
const FINGERPRINT_ADDRESS = 0xFFFFFFFF;
const DEFAULT_BAUD = 57600;

// Comandos del protocolo ZFM
const CMD_GEN_IMG = 0x01;
const CMD_IMG2TZ = 0x02;
const CMD_REG_MODEL = 0x05;
const CMD_STORE = 0x06;
const CMD_SEARCH = 0x04;
const CMD_EMPTY = 0x0D;

let serialPort = null;
let reader = null;
let readBuffer = [];

function buildPacket(instruction, data = []) {
  const length = 1 + data.length;
  const packet = [
    0xEF, 0x01,
    (FINGERPRINT_ADDRESS >> 24) & 0xFF,
    (FINGERPRINT_ADDRESS >> 16) & 0xFF,
    (FINGERPRINT_ADDRESS >> 8) & 0xFF,
    FINGERPRINT_ADDRESS & 0xFF,
    0x01, // Package identifier (command)
    (length >> 8) & 0xFF,
    length & 0xFF,
    instruction,
    ...data
  ];
  let sum = (length >> 8) + (length & 0xFF) + instruction;
  data.forEach(b => sum += b);
  packet.push((sum >> 8) & 0xFF, sum & 0xFF);
  return new Uint8Array(packet);
}

async function readResponse(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (readBuffer.length >= 12) {
      const header = (readBuffer[0] << 8) | readBuffer[1];
      if (header !== 0xEF01) {
        readBuffer.shift();
        continue;
      }
      const len = (readBuffer[7] << 8) | readBuffer[8];
      const totalLen = 9 + len + 2;
      if (readBuffer.length >= totalLen) {
        const response = readBuffer.splice(0, totalLen);
        const confirmCode = response[9];
        const data = response.slice(10, 10 + len - 1);
        return { confirmCode, data };
      }
    }
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('Timeout esperando respuesta del lector');
}

async function readLoop() {
  const reader = serialPort.readable.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      for (let i = 0; i < value.length; i++) {
        readBuffer.push(value[i] & 0xFF);
      }
      if (readBuffer.length > 512) readBuffer = readBuffer.slice(-256);
    }
  } catch (e) {
    console.warn('Fingerprint read loop:', e);
  } finally {
    reader.releaseLock();
  }
}

export function isSerialSupported() {
  return 'serial' in navigator;
}

export async function connect() {
  if (!isSerialSupported()) {
    throw new Error('Web Serial no disponible. Usá Chrome con HTTPS o localhost.');
  }
  if (serialPort) {
    await disconnect();
  }
  serialPort = await navigator.serial.requestPort();
  await serialPort.open({ baudRate: DEFAULT_BAUD });
  readBuffer = [];
  readLoop();
  return true;
}

export async function disconnect() {
  if (serialPort) {
    try {
      await serialPort.close();
    } catch (e) {}
    serialPort = null;
  }
}

async function writeToPort(data) {
  if (!serialPort) throw new Error('Lector no conectado');
  const writer = serialPort.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}

export async function getImage() {
  if (!serialPort) throw new Error('Lector no conectado');
  await writeToPort(buildPacket(CMD_GEN_IMG, []));
  const res = await readResponse(5000);
  return res.confirmCode === 0;
}

export async function imageToTemplate(bufferSlot) {
  if (!serialPort) throw new Error('Lector no conectado');
  await writeToPort(buildPacket(CMD_IMG2TZ, [bufferSlot]));
  const res = await readResponse(3000);
  return res.confirmCode === 0;
}

export async function createModel() {
  if (!serialPort) throw new Error('Lector no conectado');
  await writeToPort(buildPacket(CMD_REG_MODEL, []));
  const res = await readResponse(3000);
  return res.confirmCode === 0;
}

export async function storeTemplate(pageNumber) {
  if (!serialPort) throw new Error('Lector no conectado');
  await writeToPort(buildPacket(CMD_STORE, [(pageNumber >> 8) & 0xFF, pageNumber & 0xFF]));
  const res = await readResponse(3000);
  return res.confirmCode === 0;
}

export async function searchTemplate() {
  if (!serialPort) throw new Error('Lector no conectado');
  await writeToPort(buildPacket(CMD_SEARCH, [0x01, 0x00, 0x00, 0x03, 0xE8])); // Buffer 1, start 0, count 1000
  const res = await readResponse(3000);
  if (res.confirmCode !== 0) return null;
  if (res.data.length >= 4) {
    const pageId = (res.data[0] << 8) | res.data[1];
    const matchScore = (res.data[2] << 8) | res.data[3];
    return pageId < 1000 ? { pageId, matchScore } : null;
  }
  return null;
}

export async function emptyDatabase() {
  if (!serialPort) throw new Error('Lector no conectado');
  await writeToPort(buildPacket(CMD_EMPTY, []));
  const res = await readResponse(5000);
  return res.confirmCode === 0;
}

/**
 * Registro: captura 2 veces, valida que coincidan, guarda en el lector
 * Retorna el pageId asignado (0-999) o null si falla
 */
export async function enroll(pageId) {
  // 1ra captura
  let ok = await getImage();
  if (!ok) return { error: 'Apoyá el dedo en el lector (1ra vez)' };
  ok = await imageToTemplate(1);
  if (!ok) return { error: 'Huella no clara. Intentá de nuevo (1ra vez)' };

  // 2da captura
  ok = await getImage();
  if (!ok) return { error: 'Apoyá el dedo de nuevo (2da vez)' };
  ok = await imageToTemplate(2);
  if (!ok) return { error: 'Huella no clara. Intentá de nuevo (2da vez)' };

  // Verificar que coincidan
  ok = await createModel();
  if (!ok) return { error: 'Las dos huellas no coinciden. Registrá de nuevo.' };

  // Guardar en el lector
  ok = await storeTemplate(pageId);
  if (!ok) return { error: 'Error al guardar en el lector' };

  return { pageId };
}

/**
 * Verificación: captura y busca en el lector
 * Retorna { pageId, matchScore } o null
 */
export async function verify() {
  const ok = await getImage();
  if (!ok) return null;
  const ok2 = await imageToTemplate(1);
  if (!ok2) return null;
  return await searchTemplate();
}
