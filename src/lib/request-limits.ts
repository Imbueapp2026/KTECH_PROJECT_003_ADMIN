/**
 * Request size limit utilities
 * Validates request body size and file upload sizes
 */

const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10 MB for general requests
const MAX_FILE_UPLOAD_SIZE = 5 * 1024 * 1024; // 5 MB per file (matches upload endpoint)

export class RequestSizeError extends Error {
  constructor(message: string, public maxSize: number) {
    super(message);
    this.name = 'RequestSizeError';
  }
}

/**
 * Validate request body size
 * Throws RequestSizeError if size exceeds limit
 */
export function validateRequestSize(contentLength: string | null, maxSize: number = MAX_REQUEST_SIZE): void {
  if (!contentLength) return;
  
  const size = parseInt(contentLength, 10);
  if (isNaN(size)) return;
  
  if (size > maxSize) {
    throw new RequestSizeError(
      `Request body size (${(size / 1024 / 1024).toFixed(2)} MB) exceeds limit (${(maxSize / 1024 / 1024).toFixed(2)} MB)`,
      maxSize
    );
  }
}

/**
 * Validate file size
 * Throws RequestSizeError if size exceeds limit
 */
export function validateFileSize(fileSize: number, maxSize: number = MAX_FILE_UPLOAD_SIZE): void {
  if (fileSize > maxSize) {
    throw new RequestSizeError(
      `File size (${(fileSize / 1024 / 1024).toFixed(2)} MB) exceeds limit (${(maxSize / 1024 / 1024).toFixed(2)} MB)`,
      maxSize
    );
  }
}

/**
 * Middleware to check request size before processing
 */
export async function checkRequestSize(req: Request, maxSize: number = MAX_REQUEST_SIZE): Promise<void> {
  const contentLength = req.headers.get('content-length');
  validateRequestSize(contentLength, maxSize);
}

/**
 * Get human-readable size string
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
