import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { env } from "~/lib/env.server";

const execFileAsync = promisify(execFile);

const GHOSTSCRIPT_TIMEOUT_MS = 30_000;

// Mono (1-bit) scans already use CCITT/JBIG2 encoding, which is extremely
// compact — downsampling them below 300dpi hurts legibility for no real gain.
const MONO_IMAGE_RESOLUTION = 300;

const RESOLUTION_BY_PROFILE: Record<"150dpi" | "200dpi", number> = {
  "150dpi": 150,
  "200dpi": 200,
};

let ghostscriptMissingWarned = false;

export type PdfCompressionResult = {
  buffer: Buffer;
  compressed: boolean;
  originalByteSize: number;
};

// Rewriting a digitally signed PDF (e.g. ICP-Brasil lab reports) would strip
// the signature, so those files must be stored byte-for-byte as uploaded.
function hasDigitalSignature(buffer: Buffer) {
  return buffer.includes("/ByteRange");
}

function buildGhostscriptArgs(resolution: number, inputPath: string, outputPath: string) {
  return [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.5",
    "-dNOPAUSE",
    "-dBATCH",
    "-dQUIET",
    "-dSAFER",
    "-dAutoRotatePages=/None",
    "-dDownsampleColorImages=true",
    `-dColorImageResolution=${resolution}`,
    "-dColorImageDownsampleType=/Bicubic",
    // Default threshold (1.5) would skip 300dpi scans when targeting 200dpi
    // (300/200 = 1.5 is not above it), so downsample at any ratio > 1.
    "-dColorImageDownsampleThreshold=1.0",
    "-dDownsampleGrayImages=true",
    `-dGrayImageResolution=${resolution}`,
    "-dGrayImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleThreshold=1.0",
    "-dDownsampleMonoImages=false",
    `-dMonoImageResolution=${MONO_IMAGE_RESOLUTION}`,
    "-o",
    outputPath,
    inputPath,
  ];
}

/**
 * Recompresses a PDF with Ghostscript, downsampling scanned images to the
 * configured resolution. Always safe to call: on any failure (Ghostscript
 * absent, timeout, corrupt PDF) or when the result is not smaller, the
 * original buffer is returned untouched so the upload never breaks.
 */
export async function compressPdfBuffer(
  buffer: Buffer,
): Promise<PdfCompressionResult> {
  const original: PdfCompressionResult = {
    buffer,
    compressed: false,
    originalByteSize: buffer.length,
  };

  if (env.ATTACHMENT_PDF_COMPRESSION === "off") {
    return original;
  }

  if (hasDigitalSignature(buffer)) {
    return original;
  }

  const resolution = RESOLUTION_BY_PROFILE[env.ATTACHMENT_PDF_COMPRESSION];
  let workDir: string | null = null;

  try {
    workDir = await mkdtemp(join(tmpdir(), "pdf-compress-"));
    const inputPath = join(workDir, `${randomUUID()}-in.pdf`);
    const outputPath = join(workDir, `${randomUUID()}-out.pdf`);
    await writeFile(inputPath, buffer);

    await execFileAsync(
      "gs",
      buildGhostscriptArgs(resolution, inputPath, outputPath),
      { timeout: GHOSTSCRIPT_TIMEOUT_MS },
    );

    const compressedBuffer = await readFile(outputPath);
    if (compressedBuffer.length === 0 || compressedBuffer.length >= buffer.length) {
      return original;
    }

    return {
      buffer: compressedBuffer,
      compressed: true,
      originalByteSize: buffer.length,
    };
  } catch (error) {
    const isMissingBinary =
      error instanceof Error && "code" in error && error.code === "ENOENT";
    if (isMissingBinary) {
      if (!ghostscriptMissingWarned) {
        ghostscriptMissingWarned = true;
        console.warn(
          "[attachments] Ghostscript (gs) not found; PDF attachments will be stored without compression.",
        );
      }
    } else {
      console.warn("[attachments] PDF compression failed; storing original file.", error);
    }
    return original;
  } finally {
    if (workDir) {
      await rm(workDir, { force: true, recursive: true }).catch(() => {});
    }
  }
}
