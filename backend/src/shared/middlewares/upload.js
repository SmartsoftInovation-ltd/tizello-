/**
 * Multipart handling for file uploads, configured once.
 *
 * Three decisions here are security, not preference:
 *
 * 1. **The stored filename is generated, never the client's.** A browser can
 *    send `../../etc/passwd` or `report.pdf.exe` as a filename, and `path.join`
 *    resolves the first one straight out of the upload directory. The original
 *    name is kept as METADATA for display and download; what touches the
 *    filesystem is `<cuid>.<ext>`, where the extension comes from an allowlist
 *    rather than from the name.
 * 2. **The size cap is enforced by multer, before the write.** A cap checked
 *    after the fact means the disk has already taken the hit.
 * 3. **The MIME type is allowlisted, not denylisted.** A denylist is a
 *    guarantee that the next format nobody thought of gets through.
 *
 * `diskStorage` rather than `memoryStorage`: a 10 MB file per concurrent
 * upload held in the heap is how an upload endpoint becomes a memory limit.
 *
 * See docs/api/upload.md
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';

import config from '../../config/env.js';
import AppError from '../utils/AppError.js';
import httpStatus from '../constants/httpStatus.js';
import { AUTH_CODES } from '../constants/authCodes.js';

/**
 * MIME type → the extension we will give the stored file.
 *
 * The extension is taken from THIS table rather than from the uploaded name,
 * so `invoice.pdf.exe` announcing itself as a PDF is stored as `<id>.pdf` and
 * there is no path in which the `.exe` survives.
 *
 * No SVG: it is an XML document that can carry script, and serving one from
 * the app's own origin is a stored-XSS primitive. PNG, JPEG and WebP cover the
 * images anybody attaches to a project.
 *
 * MP4 AND WEBM were added for chat, where "+" shares a photo or a clip. Only
 * those two: they are what every browser plays without a codec conversation,
 * and `config.upload.maxBytes` (10 MB) is the real limit on what a video can
 * be here — a few seconds of phone footage. Anything longer belongs behind a
 * proper media pipeline, which this is not. QuickTime (`video/quicktime`) is
 * deliberately absent: Safari records it, most browsers will not play it back,
 * and storing something nobody can open is worse than refusing it.
 */
const ALLOWED_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};

const storage = multer.diskStorage({
  destination: (req, file, done) => done(null, config.upload.dir),
  // `randomUUID` rather than the original name — see header §1.
  filename: (req, file, done) =>
    done(null, `${randomUUID()}.${ALLOWED_TYPES[file.mimetype]}`),
});

const uploadOne = multer({
  storage,
  limits: { fileSize: config.upload.maxBytes, files: 1 },
  fileFilter: (req, file, done) => {
    if (ALLOWED_TYPES[file.mimetype]) return done(null, true);

    done(
      new AppError(
        httpStatus.UNSUPPORTED_MEDIA_TYPE,
        'That file type is not allowed',
        AUTH_CODES.VALIDATION_ERROR
      )
    );
  },
}).single('file');

/**
 * Wraps multer so its own errors become `AppError`s.
 *
 * Multer rejects with a `MulterError`, which the global handler would treat as
 * an unknown error and answer `500` — right for a bug, wrong for "that file is
 * too big", which is a thing the user can act on.
 */
const singleFile = (req, res, next) =>
  uploadOne(req, res, (error) => {
    if (!error) return next();

    if (error.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round(config.upload.maxBytes / (1024 * 1024));
      return next(
        new AppError(
          httpStatus.PAYLOAD_TOO_LARGE,
          `Files must be ${mb} MB or smaller`,
          AUTH_CODES.VALIDATION_ERROR
        )
      );
    }

    next(error);
  });

/** The extension a stored file was given, for the download handler's `Content-Type`. */
const extensionFor = (mime) => ALLOWED_TYPES[mime];

export { singleFile, ALLOWED_TYPES, extensionFor };
export default singleFile;
