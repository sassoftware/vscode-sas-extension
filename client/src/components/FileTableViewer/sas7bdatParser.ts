// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// First-party, self-contained SAS7BDAT (.sas7bdat) reader. It parses the
// SAS-9 binary format with no SAS server, no external dependencies and no
// native modules, so it bundles to both the node and the web build targets.
//
// One access mode: the page-level API reads only the column metadata up
// front, then decodes each page on demand so browsing tables of tens of
// millions of rows stays memory-bounded and instant. It goes through a
// ``PageSource`` that turns a page index into a Buffer, so the page-walk code
// never assumes the whole file is resident.
//
// File layout (the same layout the canonical BSD-licensed ReadStat library
// documents and reads):
//   1. A fixed header block (32-bit or 64-bit pointer file). It carries the
//      page size, page count, endianness and optional compression marker.
//   2. Pages of ``page_size`` bytes, addressed as ``header_size + i*page_size``.
//      Each page starts with a fixed page header (24 bytes for 32-bit, 40 for
//      64-bit) holding the page type, row count and subheader count.
//   3. A subheader-pointer table right after the page header. Each pointer is
//      {offset u32/u64, len, compression, is_compressed_data}; offsets are
//      relative to the page start. Column metadata lives in typed subheaders
//      (COLUMN_SIZE / COLUMN_NAME / COLUMN_ATTRS / COLUMN_FORMAT /
//      COLUMN_TEXT); rows live in DATA subheaders or in a raw row block.
//
// Column text (names, labels, formats) sits in COLUMN_TEXT blobs that must be
// collected before the per-column subheaders reference them, so we walk each
// page twice like the reference reader (pass 1 collects text, pass 2 decodes
// metadata and rows). Uncompressed and RLE-compressed rows are fully
// supported; RDC (binary) compression is detected and raises a dedicated
// error rather than mis-decoding. This file imports nothing from vscode —
// it is a pure (node && web) Buffer reader.

/** A column as decoded from the file. */
export interface SasColumn {
  name: string;
  label: string;
  /** "num" (IEEE double) or "char". */
  type: "num" | "char";
  /** On-disk byte width. */
  length: number;
  format: string;
}

/** On-disk byte geometry of a single column (needed to decode a row without
 *  re-resolving column text). */
export interface ColLayout {
  offset: number;
  width: number;
  type: "num" | "char";
}

/** Raised for sas7bdat features we don't support yet (RDC compression, or
 *  unrecognised layouts). Distinct from a plain malformed-file error so the
 *  caller can tell "not supported" from "corrupt". */
export class Sas7bdatUnsupportedError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "Sas7bdatUnsupportedError";
  }
}

/** Geometry + column metadata resolved from a file without materialising any
 *  row data. Decoding pages later needs only this. */
export interface SasMetadata {
  littleEndian: boolean;
  u64: boolean;
  headerSize: number;
  pageSize: number;
  pageCount: number;
  pageHeaderSize: number;
  shpSize: number;
  sigSize: number;
  totalRowCount: number;
  rowLength: number;
  /** Rows-per-page hint parsed from ROW_SIZE (matches the reference reader). */
  pageRowCount: number;
  rdcCompression: boolean;
  columns: SasColumn[];
  layouts: ColLayout[];
}

/** Turns a page index into a Buffer of `length` bytes (a prefix of that page;
 *  pass `length = pageSize` for the whole page). Implementations may read from
 *  memory (whole-file) or from an fd on demand (lazy). */
export interface PageSource {
  readonly fileSize: number;
  read(pageIndex: number, length: number): Buffer;
}

// ---------------------------------------------------------------------------
// Format constants
// ---------------------------------------------------------------------------

const SAS7BDAT_MAGIC: number[] = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc2,
  0xea, 0x81, 0x60, 0xb3, 0x14, 0x11, 0xcf, 0xbd, 0x92, 0x08, 0x00, 0x09, 0xc7,
  0x31, 0x8c, 0x18, 0x1f, 0x10, 0x11,
];
const SAS7BCAT_MAGIC: number[] = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc2,
  0xea, 0x81, 0x63, 0xb3, 0x14, 0x11, 0xcf, 0xbd, 0x92, 0x08, 0x00, 0x09, 0xc7,
  0x31, 0x8c, 0x18, 0x1f, 0x10, 0x11,
];

// Header alignment markers: a2 tells us 32-bit vs 64-bit, a1 whether 4 pad
// bytes follow the header struct.
const ALIGNMENT_OFFSET_4 = 0x33; // 64-bit / pad1 = 4
const ENDIAN_LITTLE = 0x01;

// Subheader signatures (32-bit values).
const SIG_ROW_SIZE = 0xf7f7f7f7;
const SIG_COLUMN_SIZE = 0xf6f6f6f6;
const SIG_COLUMN_ATTRS = 0xfffffffc;
const SIG_COLUMN_TEXT = 0xfffffffd;
const SIG_COLUMN_LIST = 0xfffffffe;
const SIG_COLUMN_NAME = 0xffffffff;
const COLUMN_SIG_MASK = 0xfffffff8;

// Page types (page_type & PAGE_TYPE_MASK).
const PAGE_DATA = 0x0100;
const PAGE_MIX = 0x0200;
const PAGE_TYPE_MASK = 0x0f00;
const PAGE_DELETED_ROWS = 0x0080;
const PAGE_COMP = 0x9000;

// Subheader compression codes.
const COMP_NONE = 0x00;
const COMP_TRUNC = 0x01;
const COMP_NONE_MOVED = 0x02;
const COMP_REFERENCE = 0x03;
const COMP_ROW = 0x04;
const COMP_DELETED_ROW = 0x05;
const COMP_ROW_MOVED = 0x06;
const COMP_NONE_UNREFERENCED = 0x09;
const COMP_ROW_UNREFERENCED = 0x0d;

const COLUMN_TYPE_NUM = 0x01;
const COLUMN_TYPE_CHR = 0x02;

const COMPRESSION_SIGNATURE_RDC = "SASYZCR2";

const PAGE_HEADER_SIZE_32BIT = 24;
const SUBHEADER_POINTER_SIZE_32BIT = 12;

// RLE command nibbles.
const RLE_INSERT_BYTE18 = 4;
const RLE_INSERT_AT17 = 5;
const RLE_INSERT_BLANK17 = 6;
const RLE_INSERT_ZERO17 = 7;
const RLE_COPY1 = 8;
const RLE_COPY17 = 9;
const RLE_COPY33 = 10;
const RLE_COPY49 = 11;
const RLE_INSERT_BYTE3 = 12;
const RLE_INSERT_AT2 = 13;
const RLE_INSERT_BLANK2 = 14;
const RLE_INSERT_ZERO2 = 15;

// Bytes that follow a command nibble (the two-byte insert/copy variants).
const RLE_CMD_LEN: readonly number[] = (() => {
  const t = new Array<number>(16).fill(0);
  t[0] = 1; // COPY64
  t[1] = 1; // COPY64 + 4096
  t[RLE_INSERT_BYTE18] = 2;
  t[RLE_INSERT_AT17] = 1;
  t[RLE_INSERT_BLANK17] = 1;
  t[RLE_INSERT_ZERO17] = 1;
  t[RLE_INSERT_BYTE3] = 1;
  return t;
})();

type SubheaderKind =
  | "row-size"
  | "column-size"
  | "counts"
  | "column-format"
  | "column-attrs"
  | "column-text"
  | "column-list"
  | "column-name"
  | "unknown"
  | "data";

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface TextRef {
  index: number;
  offset: number;
  length: number;
}

interface ColInfo {
  nameRef: TextRef;
  formatRef: TextRef;
  informatRef: TextRef;
  labelRef: TextRef;
  offset: number;
  width: number;
  type: "num" | "char";
  formatWidth: number;
  formatDigits: number;
}

interface SubheaderPointer {
  offset: number;
  len: number;
  compression: number;
  isCompressedData: boolean;
}

/** Parse context: geometry + the column metadata collected from the leading
 *  meta pages. `rows`/`columns` are the (reused) working buffers for a single
 *  page decode. */
interface Parse {
  source: PageSource;
  meta: SasMetadata;
  textBlobs: Buffer[];
  textBlobLengths: number[];
  colInfos: ColInfo[];
  colNamesCount: number;
  colAttrsCount: number;
  colFormatsCount: number;
  columns: SasColumn[];
  rows: (string | null)[][];
}

// ---------------------------------------------------------------------------
// Reader helpers
// ---------------------------------------------------------------------------

function u16(buf: Buffer, off: number, le: boolean): number {
  return le ? buf.readUInt16LE(off) : buf.readUInt16BE(off);
}
function u32(buf: Buffer, off: number, le: boolean): number {
  return le ? buf.readUInt32LE(off) : buf.readUInt32BE(off);
}
function u64(buf: Buffer, off: number, le: boolean): number {
  const v = le ? buf.readBigUInt64LE(off) : buf.readBigUInt64BE(off);
  return Number(v); // values we read (offsets, counts) fit in 2^53
}
function readTextRef(buf: Buffer, off: number, le: boolean): TextRef {
  return {
    index: u16(buf, off, le),
    offset: u16(buf, off + 2, le),
    length: u16(buf, off + 4, le),
  };
}

/** Decode a byte span to a JS string. SAS char data is single-byte (the
 *  file's encoding); we map bytes 1:1 (latin-1), which round-trips ASCII and
 *  keeps every byte value. Multi-byte encodings are not decoded. */
function decodeText(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

/** Resolve a text ref against the collected COLUMN_TEXT blobs. */
function copyTextRef(
  ref: TextRef,
  textBlobs: Buffer[],
  textBlobLengths: number[],
): string {
  if (ref.index >= textBlobs.length) {
    throw new Error(
      "sas7bdat: text reference points past collected text blobs",
    );
  }
  if (ref.length === 0) {
    return "";
  }
  if (ref.offset + ref.length > textBlobLengths[ref.index]) {
    throw new Error("sas7bdat: text reference out of range");
  }
  return decodeText(
    textBlobs[ref.index].subarray(ref.offset, ref.offset + ref.length),
  );
}

function subheaderRemainder(len: number, sigSize: number): number {
  return len - (4 + 2 * sigSize);
}

function classifySignature32(sig: number): SubheaderKind {
  switch (sig) {
    case SIG_ROW_SIZE:
      return "row-size";
    case SIG_COLUMN_SIZE:
      return "column-size";
    case SIG_COLUMN_ATTRS:
      return "column-attrs";
    case SIG_COLUMN_TEXT:
      return "column-text";
    case SIG_COLUMN_LIST:
      return "column-list";
    case SIG_COLUMN_NAME:
      return "column-name";
    default:
      if ((sig & COLUMN_SIG_MASK) === COLUMN_SIG_MASK) {
        return "unknown";
      }
      return "data";
  }
}

/** Classify the subheader whose signature is at page-local `off`. */
function classifySubheader(
  page: Buffer,
  off: number,
  meta: SasMetadata,
): SubheaderKind {
  if (!meta.u64) {
    return classifySignature32(u32(page, off, meta.littleEndian));
  }
  // 64-bit files use an 8-byte signature. Reading it as two u32 halves keeps
  // us on the ES2019 target (no BigInt literals). Under LE the low word is at
  // `off`, the high word at `off + 4`. The repeating F7/F6 words are ROW_SIZE
  // and COLUMN_SIZE; the column-* signatures share an all-0xFF high word.
  const hi = u32(page, off + 4, meta.littleEndian);
  const lo = u32(page, off, meta.littleEndian);
  if (hi === 0xf7f7f7f7 && lo === 0xf7f7f7f7) {
    return "row-size";
  }
  if (hi === 0xf6f6f6f6 && lo === 0xf6f6f6f6) {
    return "column-size";
  }
  if (hi !== 0xffffffff) {
    return "data";
  }
  return classifySignature32(lo);
}

// ---------------------------------------------------------------------------
// Subheader parsers
// ---------------------------------------------------------------------------

function parseColumnText(p: Parse, sub: Buffer, len: number): void {
  const remainder = u16(sub, p.meta.sigSize, p.meta.littleEndian);
  if (remainder !== subheaderRemainder(len, p.meta.sigSize)) {
    throw new Error("sas7bdat: malformed COLUMN_TEXT subheader");
  }
  const blob = sub.subarray(p.meta.sigSize, len);
  p.textBlobs.push(blob);
  p.textBlobLengths.push(len - p.meta.sigSize);
}

function parseColumnSize(_p: Parse, sub: Buffer, len: number): void {
  if (len < (_p.meta.u64 ? 16 : 8)) {
    throw new Error("sas7bdat: short COLUMN_SIZE subheader");
  }
  // The declared count only reserves capacity in the reference reader; the
  // real columns are filled in by COLUMN_NAME / COLUMN_ATTRS.
  void sub;
  void len;
}

function parseRowSize(p: Parse, sub: Buffer, len: number): void {
  if (len < (p.meta.u64 ? 250 : 190)) {
    throw new Error("sas7bdat: short ROW_SIZE subheader");
  }
  if (p.meta.u64) {
    p.meta.rowLength = u64(sub, 40, p.meta.littleEndian);
    p.meta.totalRowCount = u64(sub, 48, p.meta.littleEndian);
    p.meta.pageRowCount = u64(sub, 120, p.meta.littleEndian);
  } else {
    p.meta.rowLength = u32(sub, 20, p.meta.littleEndian);
    p.meta.totalRowCount = u32(sub, 24, p.meta.littleEndian);
    p.meta.pageRowCount = u32(sub, 60, p.meta.littleEndian);
  }

  // Compression indication lives in the ROW_SIZE text references.
  const compressionRef = readTextRef(sub, len - 118, p.meta.littleEndian);
  if (compressionRef.length) {
    const c = copyTextRef(compressionRef, p.textBlobs, p.textBlobLengths);
    p.meta.rdcCompression = c.startsWith(COMPRESSION_SIGNATURE_RDC);
  }
}

function ensureColInfos(p: Parse, count: number): void {
  while (p.colInfos.length < count) {
    p.colInfos.push({
      nameRef: { index: 0, offset: 0, length: 0 },
      formatRef: { index: 0, offset: 0, length: 0 },
      informatRef: { index: 0, offset: 0, length: 0 },
      labelRef: { index: 0, offset: 0, length: 0 },
      offset: 0,
      width: 0,
      type: "char",
      formatWidth: 0,
      formatDigits: 0,
    });
  }
}

function parseColumnName(p: Parse, sub: Buffer, len: number): void {
  const cmax = p.meta.u64
    ? Math.floor((len - 28) / 8)
    : Math.floor((len - 20) / 8);
  const remainder = u16(sub, p.meta.sigSize, p.meta.littleEndian);
  if (remainder !== subheaderRemainder(len, p.meta.sigSize)) {
    throw new Error("sas7bdat: malformed COLUMN_NAME subheader");
  }
  const cnp = p.meta.sigSize + 8;
  ensureColInfos(p, p.colInfos.length + cmax);
  for (let i = 0; i < cmax; i++) {
    p.colInfos[p.colNamesCount + i].nameRef = readTextRef(
      sub,
      cnp + i * 8,
      p.meta.littleEndian,
    );
  }
  p.colNamesCount += cmax;
}

function parseColumnAttrs(p: Parse, sub: Buffer, len: number): void {
  const cmax = p.meta.u64
    ? Math.floor((len - 28) / 16)
    : Math.floor((len - 20) / 12);
  const remainder = u16(sub, p.meta.sigSize, p.meta.littleEndian);
  if (remainder !== subheaderRemainder(len, p.meta.sigSize)) {
    throw new Error("sas7bdat: malformed COLUMN_ATTRS subheader");
  }
  const cap = p.meta.sigSize + 8;
  const off = p.meta.u64 ? 8 : 4;
  const stride = p.meta.u64 ? 16 : 12;
  ensureColInfos(p, p.colInfos.length + cmax);
  for (let i = 0; i < cmax; i++) {
    const pos = cap + i * stride;
    const info = p.colInfos[p.colAttrsCount + i];
    info.offset = p.meta.u64
      ? u64(sub, pos, p.meta.littleEndian)
      : u32(sub, pos, p.meta.littleEndian);
    info.width = u32(sub, pos + off, p.meta.littleEndian);
    const typeByte = sub[pos + off + 6];
    if (typeByte === COLUMN_TYPE_NUM) {
      info.type = "num";
    } else if (typeByte === COLUMN_TYPE_CHR) {
      info.type = "char";
    } else {
      throw new Error(
        `sas7bdat: unknown column type byte 0x${typeByte.toString(16)}`,
      );
    }
  }
  p.colAttrsCount += cmax;
}

function parseColumnFormat(p: Parse, sub: Buffer, len: number): void {
  if (len < (p.meta.u64 ? 58 : 46)) {
    throw new Error("sas7bdat: short COLUMN_FORMAT subheader");
  }
  ensureColInfos(p, p.colInfos.length + 1);
  const info = p.colInfos[p.colFormatsCount];
  if (p.meta.u64) {
    info.formatWidth = u16(sub, 24, p.meta.littleEndian);
    info.formatDigits = u16(sub, 26, p.meta.littleEndian);
    info.informatRef = readTextRef(sub, 40, p.meta.littleEndian);
    info.formatRef = readTextRef(sub, 46, p.meta.littleEndian);
    info.labelRef = readTextRef(sub, 52, p.meta.littleEndian);
  } else {
    info.formatWidth = u16(sub, 12, p.meta.littleEndian);
    info.formatDigits = u16(sub, 14, p.meta.littleEndian);
    info.informatRef = readTextRef(sub, 28, p.meta.littleEndian);
    info.formatRef = readTextRef(sub, 34, p.meta.littleEndian);
    info.labelRef = readTextRef(sub, 40, p.meta.littleEndian);
  }
  p.colFormatsCount++;
}

function dispatchSubheader(
  p: Parse,
  kind: SubheaderKind,
  sub: Buffer,
  len: number,
): void {
  switch (kind) {
    case "row-size":
      parseRowSize(p, sub, len);
      break;
    case "column-size":
      parseColumnSize(p, sub, len);
      break;
    case "column-text":
      parseColumnText(p, sub, len);
      break;
    case "column-name":
      parseColumnName(p, sub, len);
      break;
    case "column-attrs":
      parseColumnAttrs(p, sub, len);
      break;
    case "column-format":
      parseColumnFormat(p, sub, len);
      break;
    case "counts":
    case "column-list":
    case "unknown":
    case "data":
      break;
  }
}

// ---------------------------------------------------------------------------
// Page / subheader-pointer iteration (page-local offsets)
// ---------------------------------------------------------------------------

function pageType(page: Buffer, meta: SasMetadata): number {
  return u16(page, meta.pageHeaderSize - 8, meta.littleEndian);
}
function subheaderCount(page: Buffer, meta: SasMetadata): number {
  return u16(page, meta.pageHeaderSize - 4, meta.littleEndian);
}

function parseSubheaderPointer(
  page: Buffer,
  shpOffset: number,
  meta: SasMetadata,
): SubheaderPointer {
  if (meta.u64) {
    return {
      offset: u64(page, shpOffset, meta.littleEndian),
      len: u64(page, shpOffset + 8, meta.littleEndian),
      compression: page[shpOffset + 16],
      isCompressedData: page[shpOffset + 17] !== 0,
    };
  }
  return {
    offset: u32(page, shpOffset, meta.littleEndian),
    len: u32(page, shpOffset + 4, meta.littleEndian),
    compression: page[shpOffset + 8],
    isCompressedData: page[shpOffset + 9] !== 0,
  };
}

function isMovedRow(compression: number): boolean {
  return (
    compression === COMP_ROW_MOVED ||
    compression === COMP_NONE_MOVED ||
    compression === COMP_ROW_UNREFERENCED ||
    compression === COMP_NONE_UNREFERENCED
  );
}

function validateSubheaderPointer(
  page: Buffer,
  ptr: SubheaderPointer,
  subheaderCount: number,
  meta: SasMetadata,
): void {
  const pageSize = meta.pageSize;
  if (
    ptr.offset > pageSize ||
    ptr.len > pageSize ||
    ptr.offset + ptr.len > pageSize
  ) {
    throw new Error("sas7bdat: subheader pointer out of page bounds");
  }
  if (ptr.offset < meta.pageHeaderSize + subheaderCount * meta.shpSize) {
    throw new Error("sas7bdat: subheader overlaps pointer table");
  }
  if (
    (ptr.compression === COMP_NONE || ptr.compression === COMP_NONE_MOVED) &&
    ptr.len < meta.sigSize
  ) {
    throw new Error("sas7bdat: short subheader payload");
  }
}

/** True if the page is a metadata page (has a subheader table, not a raw data
 *  block), i.e. not DATA and not COMP. */
function isMetaPage(page: Buffer, meta: SasMetadata): boolean {
  const t = pageType(page, meta);
  return (t & PAGE_TYPE_MASK) !== PAGE_DATA && !(t & PAGE_COMP);
}

// --- Pass 1: collect COLUMN_TEXT blobs (must precede name/label refs) ---

function parsePagePass1(p: Parse, page: Buffer): void {
  const count = subheaderCount(page, p.meta);
  if (p.meta.pageHeaderSize + count * p.meta.shpSize > p.meta.pageSize) {
    throw new Error("sas7bdat: subheader table overflows page");
  }
  for (let i = 0; i < count; i++) {
    const ptr = parseSubheaderPointer(
      page,
      p.meta.pageHeaderSize + i * p.meta.shpSize,
      p.meta,
    );
    if (
      ptr.len > 0 &&
      ptr.compression !== COMP_TRUNC &&
      ptr.compression !== COMP_REFERENCE
    ) {
      validateSubheaderPointer(page, ptr, count, p.meta);
      if (ptr.compression === COMP_NONE) {
        const kind = classifySubheader(page, ptr.offset, p.meta);
        if (kind === "column-text") {
          const sub = page.subarray(ptr.offset, ptr.offset + ptr.len);
          dispatchSubheader(p, kind, sub, ptr.len);
        }
      }
    }
  }
}

// --- Pass 2: decode column metadata and rows ---

function parsePagePass2(p: Parse, page: Buffer, pageIndex: number): void {
  const t = pageType(page, p.meta);
  let data = -1;

  if ((t & PAGE_TYPE_MASK) === PAGE_DATA) {
    p.meta.pageRowCount = u16(
      page,
      p.meta.pageHeaderSize - 6,
      p.meta.littleEndian,
    );
    data = p.meta.pageHeaderSize;
  } else if (!(t & PAGE_COMP)) {
    const count = subheaderCount(page, p.meta);
    if (p.meta.pageHeaderSize + count * p.meta.shpSize > p.meta.pageSize) {
      throw new Error("sas7bdat: subheader table overflows page");
    }
    for (let i = 0; i < count; i++) {
      const ptr = parseSubheaderPointer(
        page,
        p.meta.pageHeaderSize + i * p.meta.shpSize,
        p.meta,
      );
      if (ptr.len > 0 && ptr.compression === COMP_REFERENCE) {
        const targetPage = ptr.offset - 1;
        const subheaderIndex = ptr.len - 1;
        parseMovedRow(p, targetPage, subheaderIndex);
      } else if (ptr.len > 0 && ptr.compression !== COMP_TRUNC) {
        validateSubheaderPointer(page, ptr, count, p.meta);
        if (ptr.compression === COMP_NONE) {
          const kind = classifySubheader(page, ptr.offset, p.meta);
          if (ptr.isCompressedData && kind === "data") {
            if (ptr.len !== p.meta.rowLength) {
              throw new Error(
                "sas7bdat: standalone data subheader width mismatch",
              );
            }
            submitColumns(p);
            parseSingleRow(p, page, ptr.offset);
          } else if (kind !== "column-text") {
            const sub = page.subarray(ptr.offset, ptr.offset + ptr.len);
            dispatchSubheader(p, kind, sub, ptr.len);
          }
        } else if (ptr.compression === COMP_ROW) {
          submitColumns(p);
          parseCompressedRow(p, page, ptr.offset, ptr.len);
        } else if (ptr.compression === COMP_DELETED_ROW) {
          // Dropped row — accounted for implicitly as a row slot.
        } else if (isMovedRow(ptr.compression)) {
          // Handled on its origin page.
        } else {
          throw new Sas7bdatUnsupportedError(
            `sas7bdat: unsupported subheader compression code ${ptr.compression}`,
          );
        }
      }
    }

    if ((t & PAGE_TYPE_MASK) === PAGE_MIX) {
      // Rows follow the subheader table, padded to an 8-byte boundary with
      // 4 zero/space bytes when the table ends mid-way (`tableEnd % 8 == 4`).
      const tableEnd = p.meta.pageHeaderSize + count * p.meta.shpSize;
      if (tableEnd % 8 === 4 && tableEnd + 4 <= p.meta.pageSize) {
        const pad = u32(page, tableEnd, p.meta.littleEndian);
        if (pad === 0x00000000 || pad === 0x20202020) {
          data = tableEnd + 4;
        } else {
          data = tableEnd;
        }
      } else {
        data = tableEnd;
      }
    }
    void pageIndex;
  }

  if (data >= 0) {
    submitColumns(p);
    const deletedBitmap =
      (t & PAGE_DELETED_ROWS) !== 0 ? deletedRowBitmap(p, page, data) : null;
    parseRows(p, page, data, deletedBitmap);
  }
}

/** Page-local offset of the row-data block on this page (a raw block start),
 *  or -1 for pages whose rows live entirely in subheaders. Mirrors the ``data``
 *  computation in parsePagePass2 so indexes stay consistent with decoding. */
function pageDataOffset(page: Buffer, meta: SasMetadata): number {
  const t = pageType(page, meta);
  if ((t & PAGE_TYPE_MASK) === PAGE_DATA) {
    return meta.pageHeaderSize;
  }
  if (t & PAGE_COMP) {
    return -1;
  }
  const count = subheaderCount(page, meta);
  const tableEnd = meta.pageHeaderSize + count * meta.shpSize;
  if ((t & PAGE_TYPE_MASK) === PAGE_MIX) {
    if (tableEnd % 8 === 4 && tableEnd + 4 <= meta.pageSize) {
      const pad = u32(page, tableEnd, meta.littleEndian);
      if (pad === 0x00000000 || pad === 0x20202020) {
        return tableEnd + 4;
      }
    }
    return tableEnd;
  }
  return -1;
}

function deletedRowBitmap(p: Parse, page: Buffer, data: number): Uint8Array {
  const puh = p.meta.pageHeaderSize;
  const pageUnusedBytes = p.meta.u64
    ? u64(page, 24, p.meta.littleEndian)
    : u32(page, 12, p.meta.littleEndian);
  const rowCount = Math.min(scopedPageRowCount(p, page), p.meta.totalRowCount);
  const offset = data + rowCount * p.meta.rowLength + pageUnusedBytes;
  const required = Math.ceil(rowCount / 8);
  if (offset + required > page.length) {
    throw new Error("sas7bdat: deleted-row bitmap out of page bounds");
  }
  return page.subarray(offset, offset + required);
  void puh;
}

function bitmapBit(bitmap: Uint8Array, index: number): boolean {
  const byte = bitmap[Math.floor(index / 8)];
  const mask = 1 << (7 - (index % 8));
  return (byte & mask) !== 0;
}

/** The rows-per-page value used for a page: the DATA-page u16 when applicable,
 *  else the global ROW_SIZE page row count (mirrors the reference reader). */
function scopedPageRowCount(p: Parse, page: Buffer): number {
  const t = pageType(page, p.meta);
  if ((t & PAGE_TYPE_MASK) === PAGE_DATA) {
    return u16(page, p.meta.pageHeaderSize - 6, p.meta.littleEndian);
  }
  return p.meta.pageRowCount;
}

/** Number of rows contributed by a page's subheader pointer table (data
 *  subheaders and moved-row references). Deleted rows count as a slot. */
function subheaderRowCount(p: Parse, page: Buffer): number {
  const t = pageType(page, p.meta);
  if ((t & PAGE_TYPE_MASK) === PAGE_DATA || t & PAGE_COMP) {
    return 0;
  }
  const count = subheaderCount(page, p.meta);
  let n = 0;
  for (let i = 0; i < count; i++) {
    const ptr = parseSubheaderPointer(
      page,
      p.meta.pageHeaderSize + i * p.meta.shpSize,
      p.meta,
    );
    if (ptr.len === 0 || ptr.compression === COMP_TRUNC) {
      continue;
    }
    if (ptr.compression === COMP_REFERENCE) {
      n++; // a moved-out row still occupies a slot here
      continue;
    }
    validateSubheaderPointer(page, ptr, count, p.meta);
    if (ptr.compression === COMP_NONE) {
      const kind = classifySubheader(page, ptr.offset, p.meta);
      if (ptr.isCompressedData && kind === "data") {
        n++;
      }
    } else if (
      ptr.compression === COMP_ROW ||
      ptr.compression === COMP_DELETED_ROW ||
      isMovedRow(ptr.compression)
    ) {
      n++;
    }
  }
  void t;
  return n;
}

/** Number of raw (contiguous) rows in a page's trailing block, mirroring
 *  parseRows: bounded by the page row count, the remaining rows and the bytes
 *  actually present. */
function contiguousRowCount(p: Parse, page: Buffer): number {
  const data = pageDataOffset(page, p.meta);
  if (data < 0) {
    return 0;
  }
  const rowLimit = Math.min(scopedPageRowCount(p, page), p.meta.totalRowCount);
  const fit = Math.floor((p.meta.pageSize - data) / p.meta.rowLength);
  const n = Math.min(rowLimit, fit);
  // parseRows breaks when a row would run past the page end and also stops at
  // totalRowCount; the min already captures that.
  void page;
  return n > 0 ? n : 0;
}

/** Total row slots a page contributes, in database order. Used both to build
 *  the row→page index and to size a windowed decode, so the two always agree.
 *  A page's rows are its trailer block (DATA / MIX) plus its row subheaders
 *  (MIX) — matching parsePagePass2's order: subheaders first, then the MIX
 *  trailer. COMP pages never contribute rows to our decoder, so they add 0. */
function countRowsInPage(p: Parse, pageIndex: number): number {
  const page = p.source.read(pageIndex, pagePrefixLen(p));
  const t = pageType(page, p.meta);
  if ((t & PAGE_TYPE_MASK) === PAGE_DATA) {
    return contiguousRowCount(p, page);
  }
  if (t & PAGE_COMP) {
    return 0; // our pass-2 walk emits no rows from COMP pages
  }
  // MIX / META: subheader rows, then the MIX trailer.
  return subheaderRowCount(p, page) + contiguousRowCount(p, page);
}

/** Bytes of a page we need to classify it and count its rows: the page header
 *  plus the whole subheader-pointer table. Cheap per page, enabling an
 *  O(pages) index build without reading row bytes. */
function pagePrefixLen(p: Parse): number {
  // Pointer table length is itself only known from the header; read header +
  // a generous pointer region. We read up to the subheader count once known in
  // countRowsInPage via this prefix. Use page-sized ceiling to stay simple and
  // bounded by the true page buffer we decode later.
  return p.meta.pageSize;
}

function parseRows(
  p: Parse,
  page: Buffer,
  data: number,
  deletedBitmap: Uint8Array | null,
): void {
  const rowLength = p.meta.rowLength;
  const rowLimit = Math.min(scopedPageRowCount(p, page), p.meta.totalRowCount);
  for (let i = 0; i < rowLimit; i++) {
    const rowStart = data + i * rowLength;
    if (rowStart + rowLength > p.meta.pageSize) {
      break;
    }
    if (deletedBitmap !== null && bitmapBit(deletedBitmap, i)) {
      p.rows.push([]); // deleted row slot => missing row
    } else {
      parseSingleRow(p, page, rowStart);
    }
  }
}

// --- Row decode ---

function submitColumns(p: Parse): void {
  if (p.columns.length > 0) {
    return;
  }
  const meta = p.meta;
  const out: SasColumn[] = [];
  for (let i = 0; i < p.colInfos.length; i++) {
    const info = p.colInfos[i];
    const name = copyTextRef(info.nameRef, p.textBlobs, p.textBlobLengths);
    if (name.length === 0 && i > 0) {
      break; // columns run out once a name comes back empty (after the first)
    }
    const label =
      copyTextRef(info.labelRef, p.textBlobs, p.textBlobLengths) || name;
    out.push({
      name,
      label,
      type: info.type,
      length: info.width,
      format: buildFormat(info, p),
    });
  }
  p.columns = out;
  meta.columns = out;
  meta.layouts = p.colInfos.slice(0, out.length).map((c) => ({
    offset: c.offset,
    width: c.width,
    type: c.type,
  }));
}

function buildFormat(info: ColInfo, p: Parse): string {
  let f = copyTextRef(info.formatRef, p.textBlobs, p.textBlobLengths);
  if (info.formatWidth) {
    f += String(info.formatWidth);
  }
  if (f.length && info.formatDigits) {
    f += "." + String(info.formatDigits);
  }
  return f;
}

function parseSingleRow(p: Parse, page: Buffer, rowStart: number): void {
  const cells: (string | null)[] = [];
  for (let j = 0; j < p.columns.length; j++) {
    const col = p.colInfos[j];
    if (col.offset + col.width > p.meta.rowLength) {
      throw new Error("sas7bdat: column overruns row record");
    }
    cells.push(parseCell(col, p.meta, page, rowStart + col.offset));
  }
  p.rows.push(cells);
}

/** Decode one cell from a Buffer page. */
function parseCell(
  col: ColInfo,
  meta: SasMetadata,
  page: Buffer,
  cellStart: number,
): string | null {
  if (col.type === "char") {
    const s = decodeText(page.subarray(cellStart, cellStart + col.width));
    return s.replace(/\0+$/, "").replace(/ +$/, "");
  }
  return decodeDouble(meta, col.width, (k) => page[cellStart + k]);
}

/** Decode one cell from a decompressed Uint8Array row. */
function parseCellBytes(
  col: ColInfo,
  meta: SasMetadata,
  rowBytes: Uint8Array,
  cellStart: number,
): string | null {
  if (col.type === "char") {
    const s = decodeText(rowBytes.subarray(cellStart, cellStart + col.width));
    return s.replace(/\0+$/, "").replace(/ +$/, "");
  }
  return decodeDouble(meta, col.width, (k) => rowBytes[cellStart + k]);
}

/** Build an 8-byte IEEE double from `width` (3-8) file bytes that hold the
 *  low-order bytes of a little-endian double (or the high bytes of a
 *  big-endian one), then stringify it. NaN means SAS "missing". */
function decodeDouble(
  meta: SasMetadata,
  width: number,
  at: (k: number) => number,
): string | null {
  if (width < 1 || width > 8) {
    throw new Error("sas7bdat: numeric column width out of range");
  }
  // SAS stores numerics MSB-first within their (3-8 byte) on-disk width,
  // with the low/high byte straddling the derived endianness. Reading the
  // `width` bytes in order and zero-extending into an 8-byte double matches
  // the canonical reader for both endiannesses.
  const tmp = new Uint8Array(8);
  for (let k = 0; k < width; k++) {
    tmp[k] = at(k);
  }
  const value = new DataView(tmp.buffer).getFloat64(0, meta.littleEndian);
  if (Number.isNaN(value)) {
    return null; // SAS missing value
  }
  return String(value);
}

function parseCompressedRow(
  p: Parse,
  page: Buffer,
  subStart: number,
  len: number,
): void {
  if (p.meta.rdcCompression) {
    throw new Sas7bdatUnsupportedError(
      "sas7bdat: RDC ('binary') compression is not supported by the local reader",
    );
  }
  const out = new Uint8Array(p.meta.rowLength);
  const written = rleDecompress(page.subarray(subStart, subStart + len), out);
  if (written !== p.meta.rowLength) {
    throw new Error(
      `sas7bdat: RLE row decompressed to ${written} bytes, expected ${p.meta.rowLength}`,
    );
  }
  submitColumns(p);
  const cells: (string | null)[] = [];
  for (let j = 0; j < p.columns.length; j++) {
    const col = p.colInfos[j];
    cells.push(parseCellBytes(col, p.meta, out, col.offset));
  }
  p.rows.push(cells);
}

/** Decode a row that a REFERENCE subheader redirected us to (page index,
 *  subheader index). Used when a row was relocated to another page by SAS. */
function parseMovedRow(
  p: Parse,
  pageIndex: number,
  subheaderIndex: number,
): void {
  if (pageIndex >= p.meta.pageCount) {
    throw new Error("sas7bdat: redirect points past the last page");
  }
  const page = p.source.read(pageIndex, p.meta.pageSize);
  const meta = p.meta;
  const t = pageType(page, meta);
  if ((t & PAGE_TYPE_MASK) === PAGE_DATA || t & PAGE_COMP) {
    throw new Error("sas7bdat: redirect points at a data/compressed page");
  }
  const count = subheaderCount(page, meta);
  if (subheaderIndex >= count) {
    throw new Error("sas7bdat: redirect subheader index out of range");
  }
  const ptr = parseSubheaderPointer(
    page,
    meta.pageHeaderSize + subheaderIndex * meta.shpSize,
    meta,
  );
  validateSubheaderPointer(page, ptr, count, meta);
  submitColumns(p);

  if (ptr.compression === COMP_NONE_MOVED) {
    const kind = classifySubheader(page, ptr.offset, meta);
    if (!ptr.isCompressedData || kind !== "data") {
      throw new Error("sas7bdat: malformed moved-row target");
    }
    if (ptr.len !== meta.rowLength) {
      throw new Error("sas7bdat: moved-row width mismatch");
    }
    parseSingleRow(p, page, ptr.offset);
  } else if (ptr.compression === COMP_ROW_MOVED) {
    parseCompressedRow(p, page, ptr.offset, ptr.len);
  } else {
    throw new Sas7bdatUnsupportedError(
      "sas7bdat: unsupported moved-row compression",
    );
  }
}

// ---------------------------------------------------------------------------
// RLE decompression (SASYZCRL)
// ---------------------------------------------------------------------------

/** Decompress an RLE-encoded row into `out`. Returns the number of bytes
 *  written, which must equal the row length. Throws on overflow/malformed
 *  input. */
export function rleDecompress(input: Uint8Array, out: Uint8Array): number {
  let ip = 0;
  let written = 0;
  while (ip < input.length) {
    const control = input[ip++];
    const command = (control & 0xf0) >> 4;
    const length = control & 0x0f;

    // Ensure whatever extra bytes this command consumes are present before we
    // touch them (mirrors the canonical reader's upfront bounds check).
    const need = RLE_CMD_LEN[command];
    if (ip + need > input.length) {
      throw new Error("sas7bdat: RLE input underrun");
    }
    if (command === 3) {
      // Command 0x3x is never emitted by SAS; guard against an infinite loop.
      throw new Error("sas7bdat: unrecognised RLE command");
    }

    let copyLen = 0;
    let insertLen = 0;
    let insertByte = 0;

    switch (command) {
      case 0: // COPY64
        copyLen = input[ip++] + 64 + length * 256;
        break;
      case 1: // COPY64 + 4096
        copyLen = input[ip++] + 64 + 4096 + length * 256;
        break;
      case 2: // COPY96
        copyLen = length + 96;
        break;
      case RLE_INSERT_BYTE18:
        insertLen = input[ip++] + 18 + length * 256;
        insertByte = input[ip++];
        break;
      case RLE_INSERT_AT17:
        insertLen = input[ip++] + 17 + length * 256;
        insertByte = 0x40;
        break;
      case RLE_INSERT_BLANK17:
        insertLen = input[ip++] + 17 + length * 256;
        insertByte = 0x20;
        break;
      case RLE_INSERT_ZERO17:
        insertLen = input[ip++] + 17 + length * 256;
        insertByte = 0;
        break;
      case RLE_COPY1:
        copyLen = length + 1;
        break;
      case RLE_COPY17:
        copyLen = length + 17;
        break;
      case RLE_COPY33:
        copyLen = length + 33;
        break;
      case RLE_COPY49:
        copyLen = length + 49;
        break;
      case RLE_INSERT_BYTE3:
        insertByte = input[ip++];
        insertLen = length + 3;
        break;
      case RLE_INSERT_AT2:
        insertByte = 0x40;
        insertLen = length + 2;
        break;
      case RLE_INSERT_BLANK2:
        insertByte = 0x20;
        insertLen = length + 2;
        break;
      case RLE_INSERT_ZERO2:
        insertByte = 0;
        insertLen = length + 2;
        break;
      default:
        throw new Error("sas7bdat: unrecognised RLE command");
    }

    // A COPY command is followed by `copyLen` literal bytes taken verbatim
    // from the compressed stream (not a back-reference), matching the
    // canonical reader.
    if (copyLen) {
      if (written + copyLen > out.length) {
        throw new Error("sas7bdat: RLE copy overflows row");
      }
      if (ip + copyLen > input.length) {
        throw new Error("sas7bdat: RLE copy underruns input");
      }
      out.set(input.subarray(ip, ip + copyLen), written);
      ip += copyLen;
      written += copyLen;
    }
    if (insertLen) {
      if (written + insertLen > out.length) {
        throw new Error("sas7bdat: RLE insert overflows row");
      }
      out.fill(insertByte, written, written + insertLen);
      written += insertLen;
    }
  }
  return written;
}

// ---------------------------------------------------------------------------
// Header + metadata resolution
// ---------------------------------------------------------------------------

/** Read + validate the file header from its first `head` bytes and return the
 *  fully-populated geometry. The header is not page-aligned, so callers read
 *  the raw file prefix (≥ 164 + 32 + 24 bytes). */
export function parseSasHeaderRegion(
  head: Buffer,
  fileSize: number,
): SasMetadata {
  const meta = freshMeta();
  if (head.length < 164 + 32) {
    throw new Error("sas7bdat: file too small to be a SAS table");
  }
  // Validate the 32-byte magic. The table and catalog digests share a suffix;
  // check the whole string against each to report catalogs accurately.
  let isTable = true;
  let isCatalog = true;
  for (let i = 0; i < 32; i++) {
    if (head[i] !== SAS7BDAT_MAGIC[i]) {
      isTable = false;
    }
    if (head[i] !== SAS7BCAT_MAGIC[i]) {
      isCatalog = false;
    }
  }
  if (isCatalog) {
    throw new Error("sas7bdat: file is a SAS catalog (.sas7bcat), not a table");
  }
  if (!isTable) {
    throw new Error("sas7bdat: not a SAS 7 data file (bad magic)");
  }

  const a2 = head[32];
  meta.u64 = a2 === ALIGNMENT_OFFSET_4;

  const a1 = head[35];
  const pad1 = a1 === ALIGNMENT_OFFSET_4 ? 4 : 0;

  const endian = head[37];
  if (endian === ENDIAN_LITTLE) {
    meta.littleEndian = true;
  } else if (endian === 0) {
    meta.littleEndian = false;
  } else {
    throw new Error(`sas7bdat: unknown endianness marker ${endian}`);
  }

  // Skip the 164-byte header struct, any pad, and the four time doubles.
  const pos = 164 + pad1 + 32;
  if (pos + (meta.u64 ? 24 : 12) > head.length) {
    throw new Error("sas7bdat: truncated header");
  }
  if (meta.u64) {
    meta.headerSize = u64(head, pos, meta.littleEndian);
    meta.pageSize = u64(head, pos + 8, meta.littleEndian);
    meta.pageCount = u64(head, pos + 16, meta.littleEndian);
  } else {
    meta.headerSize = u32(head, pos, meta.littleEndian);
    meta.pageSize = u32(head, pos + 4, meta.littleEndian);
    meta.pageCount = u32(head, pos + 8, meta.littleEndian);
  }

  meta.pageHeaderSize = meta.u64 ? 40 : PAGE_HEADER_SIZE_32BIT;
  meta.shpSize = meta.u64 ? 24 : SUBHEADER_POINTER_SIZE_32BIT;
  meta.sigSize = meta.u64 ? 8 : 4;

  if (
    meta.headerSize < meta.pageHeaderSize ||
    meta.pageSize === 0 ||
    meta.pageCount === 0
  ) {
    throw new Error("sas7bdat: implausible page geometry");
  }
  if (meta.headerSize + meta.pageCount * meta.pageSize > fileSize) {
    throw new Error("sas7bdat: pages extend past end of file");
  }
  return meta;
}

function freshMeta(): SasMetadata {
  return {
    littleEndian: true,
    u64: false,
    headerSize: 0,
    pageSize: 0,
    pageCount: 0,
    pageHeaderSize: PAGE_HEADER_SIZE_32BIT,
    shpSize: SUBHEADER_POINTER_SIZE_32BIT,
    sigSize: 4,
    totalRowCount: 0,
    rowLength: 0,
    pageRowCount: 0,
    rdcCompression: false,
    columns: [],
    layouts: [],
  };
}

/** A Parse context backed by `source` and a known geometry `meta`. `meta`'s
 *  geometry must already be set (via parseSasHeaderRegion) before use. */
function pOf(source: PageSource, meta: SasMetadata): Parse {
  return {
    source,
    meta,
    textBlobs: [],
    textBlobLengths: [],
    colInfos: [],
    colNamesCount: 0,
    colAttrsCount: 0,
    colFormatsCount: 0,
    columns: [],
    rows: [],
  };
}

/** Fill `p.meta.columns`/`p.meta.layouts` (and `p`'s column state) by walking
 *  the leading meta pages of `p.source` (plus AMD tail pages that carry
 *  column text). Reads only pages before the first data page, so opening a
 *  huge table touches only its metadata. */
function resolveColumnsOn(p: Parse): void {
  const meta = p.meta;

  // Pass 1: collect column text across leading meta pages (stop at the first
  // data page; data pages carry no COLUMN_TEXT subheaders).
  let lastMetaPage = 0;
  for (let i = 0; i < meta.pageCount; i++) {
    const page = p.source.read(i, meta.pageSize);
    if ((pageType(page, meta) & PAGE_TYPE_MASK) === PAGE_DATA) {
      lastMetaPage = i;
      break;
    }
    if (isMetaPage(page, meta)) {
      parsePagePass1(p, page);
    }
    lastMetaPage = i;
  }

  // Pass-1 AMD pages sit at the tail of the file.
  for (let i = meta.pageCount - 1; i > lastMetaPage; i--) {
    const page = p.source.read(i, meta.pageSize);
    if (isMetaPage(page, meta)) {
      parsePagePass1(p, page);
    }
  }

  // Pass 2 (metadata only): decode columns from the leading meta pages. No
  // rows exist before the first data page, and submitColumns fills `meta`.
  for (let i = 0; i <= lastMetaPage; i++) {
    const page = p.source.read(i, meta.pageSize);
    if (isMetaPage(page, meta)) {
      parsePagePass2(p, page, i);
    }
  }

  // Finalise `meta.columns`/`meta.layouts` now, so the columns are available
  // the moment a table opens — our previous code deferred this to the first
  // DATA page decode, which broke random-access sources that read pages lazily.
  submitColumns(p);
}

/** Decode the rows of a single page into `out.rows` (returned). The caller
 *  must provide a Parse whose column metadata is already resolved; `out.rows`
 *  is cleared first. A page decodes exactly the slot count reported by
 *  countRowsInPage. */
function decodePageParse(p: Parse, pageIndex: number): (string | null)[][] {
  const page = p.source.read(pageIndex, p.meta.pageSize);
  p.rows.length = 0;
  parsePagePass2(p, page, pageIndex);
  return p.rows;
}

/**
 * Random-access reader over a {@link PageSource}: resolves column metadata on
 * open (reading only the leading meta pages) and then decodes individual pages
 * on demand. Backed by a shared, reused row buffer, so decoding a window is
 * bounded by that window — this is what lets gigantic tables stay snappy.
 */
export class Sas7bdatPageReader {
  private readonly p: Parse;

  public constructor(source: PageSource, meta: SasMetadata) {
    this.p = pOf(source, meta);
    resolveColumnsOn(this.p);
  }

  public get meta(): SasMetadata {
    return this.p.meta;
  }

  /** Row slots this page contributes to the global row order. */
  public countRowsInPage(pageIndex: number): number {
    return countRowsInPage(this.p, pageIndex);
  }

  /** Decode every row of the page. The returned arrays are freshly allocated
   *  (the reader's internal buffer is reused across calls). */
  public decodeRowsInPage(pageIndex: number): (string | null)[][] {
    return decodePageParse(this.p, pageIndex);
  }
}
