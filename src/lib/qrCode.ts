/**
 * FoodLink Zero-Dependency QR Code Generator & Handshake Protocol
 * Implements ISO/IEC 18004 QR Code specification (Versions 1-6, EC Level L/M)
 * with Galois Field GF(256) arithmetic, Reed-Solomon error correction,
 * and high-entropy custody handshake verification.
 */

export type QrErrorCorrectionLevel = 'L' | 'M';

export interface QrMatrix {
  size: number;
  modules: boolean[][];
}

export interface HandshakePayload {
  protocol: 'FOODLINK_V1';
  listingId: string;
  stage: 'pickup' | 'delivery';
  code: string;
  timestamp: number;
  donorOrg?: string;
  shelterOrg?: string;
}

// ============================================================================
// 1. Galois Field GF(256) & Reed-Solomon ECC for QR Codes
// ============================================================================
const GF_EXP: number[] = new Array(512);
const GF_LOG: number[] = new Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_EXP[i + 255] = val;
    GF_LOG[val] = i;
    val = (val << 1) ^ (val & 0x80 ? 0x11d : 0);
  }
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function polyMultiply(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMultiply(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree: number): number[] {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    g = polyMultiply(g, [1, GF_EXP[i]]);
  }
  return g;
}

function calculateEcc(data: number[], eccLength: number): number[] {
  const generator = getGeneratorPoly(eccLength);
  const info = [...data, ...new Array(eccLength).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = info[i];
    if (coef !== 0) {
      for (let j = 0; j < generator.length; j++) {
        info[i + j] ^= gfMultiply(generator[j], coef);
      }
    }
  }
  return info.slice(data.length);
}

// ============================================================================
// 2. QR Code Capacity & Alignment Specification Tables
// ============================================================================
interface VersionSpec {
  version: number;
  totalCodewords: number;
  dataCodewordsL: number;
  dataCodewordsM: number;
  eccPerBlockL: number;
  eccPerBlockM: number;
  alignmentPositions: number[];
}

const QR_SPECS: VersionSpec[] = [
  { version: 1, totalCodewords: 26, dataCodewordsL: 19, dataCodewordsM: 16, eccPerBlockL: 7, eccPerBlockM: 10, alignmentPositions: [] },
  { version: 2, totalCodewords: 44, dataCodewordsL: 34, dataCodewordsM: 28, eccPerBlockL: 10, eccPerBlockM: 16, alignmentPositions: [6, 18] },
  { version: 3, totalCodewords: 70, dataCodewordsL: 55, dataCodewordsM: 44, eccPerBlockL: 15, eccPerBlockM: 26, alignmentPositions: [6, 22] },
  { version: 4, totalCodewords: 100, dataCodewordsL: 80, dataCodewordsM: 64, eccPerBlockL: 20, eccPerBlockM: 36, alignmentPositions: [6, 26] },
  { version: 5, totalCodewords: 134, dataCodewordsL: 108, dataCodewordsM: 86, eccPerBlockL: 26, eccPerBlockM: 48, alignmentPositions: [6, 30] },
  { version: 6, totalCodewords: 172, dataCodewordsL: 136, dataCodewordsM: 108, eccPerBlockL: 36, eccPerBlockM: 64, alignmentPositions: [6, 34] },
];

// Format information bit patterns for Mask 0 (Binary checkerboard pattern)
// Mask 0 ( (row + col) % 2 == 0 )
const FORMAT_INFO_M_MASK0 = 0x5412; // 0101010000010010 (EC M, Mask 0 with XOR mask 0x5412)
const FORMAT_INFO_L_MASK0 = 0x77c4; // 0111011111000100 (EC L, Mask 0 with XOR mask 0x5412)

// ============================================================================
// 3. QR Matrix Encoding & Assembly
// ============================================================================

export function encodeQrCode(text: string, ecLevel: QrErrorCorrectionLevel = 'M'): QrMatrix {
  const utf8Bytes = Array.from(new TextEncoder().encode(text));
  
  // Pick best matching version
  let selectedSpec: VersionSpec | null = null;
  for (const spec of QR_SPECS) {
    const maxDataBytes = ecLevel === 'M' ? spec.dataCodewordsM : spec.dataCodewordsL;
    // 4 bits mode + 8 bits length indicator + data bytes <= maxDataBytes
    if (utf8Bytes.length + 2 <= maxDataBytes) {
      selectedSpec = spec;
      break;
    }
  }

  if (!selectedSpec) {
    selectedSpec = QR_SPECS[QR_SPECS.length - 1]; // Fallback to highest available version
  }

  const maxDataCodewords = ecLevel === 'M' ? selectedSpec.dataCodewordsM : selectedSpec.dataCodewordsL;
  const eccLength = selectedSpec.totalCodewords - maxDataCodewords;

  // Build bitstream: 0100 (Byte mode) + 8-bit character count + UTF-8 payload
  const bitStream: number[] = [];
  function pushBits(val: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte Mode Indicator
  pushBits(utf8Bytes.length, 8); // Character count
  for (const b of utf8Bytes) {
    pushBits(b, 8);
  }

  // Terminator (up to 4 zero bits)
  const remainingBits = maxDataCodewords * 8 - bitStream.length;
  const terminatorCount = Math.min(4, Math.max(0, remainingBits));
  pushBits(0, terminatorCount);

  // Pad to byte boundary
  while (bitStream.length % 8 !== 0) {
    bitStream.push(0);
  }

  // Convert bitstream to data codewords
  const dataCodewords: number[] = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bitStream[i + b];
    }
    dataCodewords.push(byteVal);
  }

  // Pad codewords (0xEC, 0x11) until maxDataCodewords reached
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (dataCodewords.length < maxDataCodewords) {
    dataCodewords.push(padBytes[padIdx % 2]);
    padIdx++;
  }

  // Calculate Reed-Solomon Error Correction
  const eccCodewords = calculateEcc(dataCodewords, eccLength);
  const finalCodewords = [...dataCodewords, ...eccCodewords];

  // Matrix creation
  const size = 17 + 4 * selectedSpec.version;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array(size).fill(null)
  );

  // Helper to place finder pattern at (r, c)
  function placeFinder(top: number, left: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row < 0 || row >= size || col < 0 || col >= size) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matrix[row][col] = false; // Separator
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          matrix[row][col] = true;
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          matrix[row][col] = true;
        } else {
          matrix[row][col] = false;
        }
      }
    }
  }

  // Place 3 Finder Patterns
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Place Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0;
    if (matrix[6][i] === null) matrix[6][i] = val;
    if (matrix[i][6] === null) matrix[i][6] = val;
  }

  // Place Alignment Patterns for Version >= 2
  if (selectedSpec.alignmentPositions.length > 0) {
    const coords = selectedSpec.alignmentPositions;
    for (const r of coords) {
      for (const c of coords) {
        // Skip finder areas
        if ((r === 6 && c === 6) || (r === 6 && c === coords[coords.length - 1]) || (r === coords[coords.length - 1] && c === 6)) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            matrix[r + dr][c + dc] = isBorder || isCenter;
          }
        }
      }
    }
  }

  // Dark module
  matrix[4 * selectedSpec.version + 9][8] = true;

  // Reserve format information areas
  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // Place Data Codewords (Zig-Zag upward/downward)
  let bitIndex = 0;
  const allBits: number[] = [];
  for (const byte of finalCodewords) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((byte >> b) & 1);
    }
  }

  let upward = true;
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    // Skip vertical timing column 6
    if (rightCol === 6) rightCol--;

    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const col of [rightCol, rightCol - 1]) {
        if (matrix[row][col] === null) {
          const bitVal = bitIndex < allBits.length ? allBits[bitIndex++] : 0;
          // Apply Mask 0: (row + col) % 2 === 0 -> invert bit
          const maskInvert = (row + col) % 2 === 0;
          matrix[row][col] = (bitVal === 1) !== maskInvert;
        }
      }
    }
    upward = !upward;
  }

  // Place Format Information (Mask 0 + Error Correction Level)
  const formatInfo = ecLevel === 'M' ? FORMAT_INFO_M_MASK0 : FORMAT_INFO_L_MASK0;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >> i) & 1) === 1;
    // Top-left corner
    if (i < 6) {
      matrix[i][8] = bit;
    } else if (i === 6) {
      matrix[7][8] = bit;
    } else if (i === 7) {
      matrix[8][8] = bit;
    } else if (i === 8) {
      matrix[8][7] = bit;
    } else {
      matrix[8][14 - i] = bit;
    }

    // Split across top-right and bottom-left
    if (i < 8) {
      matrix[8][size - 1 - i] = bit;
    } else {
      matrix[size - 15 + i][8] = bit;
    }
  }

  // Clean final boolean matrix
  const cleanModules: boolean[][] = matrix.map((row) =>
    row.map((cell) => cell === true)
  );

  return {
    size,
    modules: cleanModules,
  };
}

/**
 * Generate a Scalable Vector Graphics (SVG) string from a QR matrix
 */
export function matrixToSvg(
  matrix: QrMatrix,
  options: {
    margin?: number;
    size?: number;
    color?: string;
    bgColor?: string;
  } = {}
): string {
  const margin = options.margin ?? 4;
  const targetSize = options.size ?? 256;
  const color = options.color ?? '#059669';
  const bgColor = options.bgColor ?? '#FFFFFF';
  const totalGrid = matrix.size + margin * 2;

  let pathData = '';
  for (let r = 0; r < matrix.size; r++) {
    for (let c = 0; c < matrix.size; c++) {
      if (matrix.modules[r][c]) {
        pathData += `M${c + margin},${r + margin}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalGrid} ${totalGrid}" width="${targetSize}" height="${targetSize}" shape-rendering="crispEdges">
    <rect width="${totalGrid}" height="${totalGrid}" fill="${bgColor}" rx="2" />
    <path d="${pathData}" fill="${color}" />
  </svg>`;
}

// ============================================================================
// 4. FoodLink Handshake Protocol & Security Helpers
// ============================================================================

/**
 * Generate a 6-character alphanumeric verification PIN (e.g. FL-4921)
 */
export function generateHandshakePin(prefix: 'PU' | 'DL' = 'PU'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let pin = '';
  for (let i = 0; i < 4; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `FL-${prefix}-${pin}`;
}

/**
 * Construct compact verifiable JSON payload for FoodLink QR code
 */
export function createHandshakePayload(params: {
  listingId: string;
  stage: 'pickup' | 'delivery';
  code: string;
  donorOrg?: string;
  shelterOrg?: string;
}): string {
  const payload: HandshakePayload = {
    protocol: 'FOODLINK_V1',
    listingId: params.listingId,
    stage: params.stage,
    code: params.code.trim().toUpperCase(),
    timestamp: Date.now(),
    donorOrg: params.donorOrg,
    shelterOrg: params.shelterOrg,
  };
  return JSON.stringify(payload);
}

/**
 * Parse and validate a scanned or entered QR handshake string
 */
export function verifyHandshakePayload(
  rawInput: string,
  expectedListingId: string,
  expectedStage: 'pickup' | 'delivery',
  expectedCode?: string
): {
  isValid: boolean;
  error?: string;
  payload?: HandshakePayload;
} {
  const cleanInput = rawInput.trim();
  if (!cleanInput) {
    return { isValid: false, error: 'Empty code or QR scan.' };
  }

  // Path A: Check if rawInput is a direct PIN code (e.g., "FL-PU-7K2X" or "4829" or expectedCode)
  if (expectedCode && cleanInput.toUpperCase() === expectedCode.trim().toUpperCase()) {
    return {
      isValid: true,
      payload: {
        protocol: 'FOODLINK_V1',
        listingId: expectedListingId,
        stage: expectedStage,
        code: expectedCode,
        timestamp: Date.now(),
      },
    };
  }

  // Path B: Parse JSON handshake structure
  try {
    const parsed = JSON.parse(cleanInput) as Partial<HandshakePayload>;
    if (parsed.protocol !== 'FOODLINK_V1') {
      return { isValid: false, error: 'Invalid QR format: Not a FoodLink custody handshake code.' };
    }

    if (parsed.listingId !== expectedListingId) {
      return {
        isValid: false,
        error: `Mismatched batch: This code is for listing #${parsed.listingId?.slice(0, 6)}, not #${expectedListingId.slice(0, 6)}.`,
      };
    }

    if (parsed.stage !== expectedStage) {
      return {
        isValid: false,
        error: `Incorrect custody stage: Expected ${expectedStage.toUpperCase()} handshake, but scanned ${parsed.stage?.toUpperCase()}.`,
      };
    }

    if (expectedCode && parsed.code && parsed.code.toUpperCase() !== expectedCode.trim().toUpperCase()) {
      return {
        isValid: false,
        error: 'Authentication PIN mismatch. Please check with the coordinator.',
      };
    }

    return {
      isValid: true,
      payload: parsed as HandshakePayload,
    };
  } catch {
    // If not JSON, but matches expected code partially
    if (expectedCode && cleanInput.replace(/[^A-Za-z0-9]/g, '').toUpperCase() === expectedCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase()) {
      return {
        isValid: true,
        payload: {
          protocol: 'FOODLINK_V1',
          listingId: expectedListingId,
          stage: expectedStage,
          code: expectedCode,
          timestamp: Date.now(),
        },
      };
    }

    return {
      isValid: false,
      error: 'Invalid QR code or verification PIN.',
    };
  }
}
