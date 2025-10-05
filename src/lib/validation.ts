/**
 * Centralized input validation for API routes
 * Prevents crashes, injection attacks, and DoS
 */

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate folder path
 */
export function validateFolderPath(folderPath: unknown): string {
  if (typeof folderPath !== 'string') {
    throw new ValidationError('Folder path must be a string', 'folderPath');
  }

  if (folderPath.trim().length === 0) {
    throw new ValidationError('Folder path cannot be empty', 'folderPath');
  }

  if (folderPath.length > 1000) {
    throw new ValidationError('Folder path is too long (max 1000 characters)', 'folderPath');
  }

  // Check for null bytes (security)
  if (folderPath.includes('\0')) {
    throw new ValidationError('Folder path contains invalid characters', 'folderPath');
  }

  return folderPath.trim();
}

/**
 * Validate photo paths array
 */
export function validatePhotoPaths(photoPaths: unknown, options?: {
  maxCount?: number;
  maxLength?: number;
}): string[] {
  const { maxCount = 1000, maxLength = 1000 } = options || {};

  if (!Array.isArray(photoPaths)) {
    throw new ValidationError('Photo paths must be an array', 'photoPaths');
  }

  if (photoPaths.length === 0) {
    throw new ValidationError('Photo paths array cannot be empty', 'photoPaths');
  }

  if (photoPaths.length > maxCount) {
    throw new ValidationError(`Too many photos (max ${maxCount})`, 'photoPaths');
  }

  const validPaths: string[] = [];

  for (let i = 0; i < photoPaths.length; i++) {
    const photoPath = photoPaths[i];

    if (typeof photoPath !== 'string') {
      throw new ValidationError(`Photo path at index ${i} must be a string`, 'photoPaths');
    }

    if (photoPath.trim().length === 0) {
      throw new ValidationError(`Photo path at index ${i} cannot be empty`, 'photoPaths');
    }

    if (photoPath.length > maxLength) {
      throw new ValidationError(`Photo path at index ${i} is too long (max ${maxLength} characters)`, 'photoPaths');
    }

    // Check for null bytes
    if (photoPath.includes('\0')) {
      throw new ValidationError(`Photo path at index ${i} contains invalid characters`, 'photoPaths');
    }

    validPaths.push(photoPath.trim());
  }

  return validPaths;
}

/**
 * Validate photos array (with path property)
 */
export function validatePhotosArray(photos: unknown, options?: {
  maxCount?: number;
}): Array<{ path: string; [key: string]: any }> {
  const { maxCount = 1000 } = options || {};

  if (!Array.isArray(photos)) {
    throw new ValidationError('Photos must be an array', 'photos');
  }

  if (photos.length === 0) {
    throw new ValidationError('Photos array cannot be empty', 'photos');
  }

  if (photos.length > maxCount) {
    throw new ValidationError(`Too many photos (max ${maxCount})`, 'photos');
  }

  const validPhotos: Array<{ path: string; [key: string]: any }> = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];

    if (typeof photo !== 'object' || photo === null) {
      throw new ValidationError(`Photo at index ${i} must be an object`, 'photos');
    }

    if (typeof photo.path !== 'string') {
      throw new ValidationError(`Photo at index ${i} must have a string 'path' property`, 'photos');
    }

    if (photo.path.trim().length === 0) {
      throw new ValidationError(`Photo at index ${i} has empty path`, 'photos');
    }

    if (photo.path.includes('\0')) {
      throw new ValidationError(`Photo at index ${i} has invalid path`, 'photos');
    }

    validPhotos.push(photo);
  }

  return validPhotos;
}

/**
 * Validate DBSCAN epsilon parameter
 */
export function validateEps(eps: unknown): number {
  if (typeof eps !== 'number') {
    throw new ValidationError('eps must be a number', 'eps');
  }

  if (!Number.isFinite(eps)) {
    throw new ValidationError('eps must be a finite number', 'eps');
  }

  if (eps < 0 || eps > 1) {
    throw new ValidationError('eps must be between 0 and 1', 'eps');
  }

  return eps;
}

/**
 * Validate DBSCAN minPts parameter
 */
export function validateMinPts(minPts: unknown): number {
  if (typeof minPts !== 'number') {
    throw new ValidationError('minPts must be a number', 'minPts');
  }

  if (!Number.isInteger(minPts)) {
    throw new ValidationError('minPts must be an integer', 'minPts');
  }

  if (minPts < 1 || minPts > 100) {
    throw new ValidationError('minPts must be between 1 and 100', 'minPts');
  }

  return minPts;
}

/**
 * Validate boolean flag
 */
export function validateBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === undefined || value === null) {
    return defaultValue;
  }

  // Accept string representations
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
  }

  return defaultValue;
}

/**
 * Validate image path from query parameter
 */
export function validateImagePath(imagePath: unknown): string {
  if (typeof imagePath !== 'string') {
    throw new ValidationError('Image path must be a string', 'path');
  }

  if (imagePath.trim().length === 0) {
    throw new ValidationError('Image path cannot be empty', 'path');
  }

  if (imagePath.length > 1000) {
    throw new ValidationError('Image path is too long (max 1000 characters)', 'path');
  }

  // Check for null bytes
  if (imagePath.includes('\0')) {
    throw new ValidationError('Image path contains invalid characters', 'path');
  }

  // Basic path traversal check (more comprehensive check in file system layer)
  const normalized = imagePath.toLowerCase();
  if (normalized.includes('..') && (normalized.includes('../') || normalized.includes('..\\'))) {
    throw new ValidationError('Image path contains invalid sequences', 'path');
  }

  return imagePath.trim();
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof ValidationError) {
    return error.message; // Our errors are safe to expose
  }

  if (error instanceof Error) {
    // Log full error internally
    console.error('Internal error:', error);
    
    // Return sanitized message
    if (error.message.includes('ENOENT')) {
      return 'File or directory not found';
    }
    if (error.message.includes('EACCES')) {
      return 'Permission denied';
    }
    if (error.message.includes('EISDIR')) {
      return 'Path is a directory, not a file';
    }
    
    // Generic error for unknown cases
    return 'An internal error occurred';
  }

  return 'An unknown error occurred';
}

/**
 * Create standardized error response
 */
export function createErrorResponse(error: unknown, status: number = 500) {
  const message = sanitizeErrorMessage(error);
  const field = error instanceof ValidationError ? error.field : undefined;

  return {
    error: message,
    ...(field && { field }),
    status,
  };
}



