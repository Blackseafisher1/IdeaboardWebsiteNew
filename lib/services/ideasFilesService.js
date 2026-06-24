/**
 * @fileoverview Datei-Upload und Verschlüsselungs-Helpers für Ideen.
 * Verwaltet Speicherung, Verschlüsselung, Löschung und Bereitstellung von Idea-Dateien.
 * @module lib/services/ideasFilesService
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const keyManager = require('../keyManager');
const db = require('../../config/db.js');
const { executeWithRetry } = require('../dbHelpers');
const { isAdmin: hasAdminRole } = require('../roleHelpers');

// Use a separate, non-public folder for idea uploads so we can encrypt
// them at rest and avoid exposing raw files via `public` static middleware.
const ideasStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads', 'ideas');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const ideasUpload = multer({
    storage: ideasStorage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

// Encryption helpers for idea uploads
const ALGO_IDEA = 'aes-256-gcm';

/**
 * Holt den Schlüssel zur Dateiverschlüsselung aus dem KeyManager.
 * @returns {Buffer|null}
 */
function deriveKeyForIdeas() {
    try {
        return keyManager.getMasterKey();
    } catch (e) {
        return null;
    }
}

/**
 * Verschlüsselt eine Datei (Stream) und schreibt Metadaten (.meta).
 * @private
 * @param {string} inPath - Pfad zur Quelldatei.
 * @param {string} outPath - Pfad zur verschlüsselten Zieldatei.
 * @param {Buffer} key - Verschlüsselungsschlüssel.
 * @param {string} origName - Originaler Dateiname.
 * @returns {Promise<void>}
 */
function encryptFileStream(inPath, outPath, key, origName) {
    // Verschlüsselt die Quelldatei asynchron und schreibt Meta-Informationen (.meta).
    // Liefert ein Promise, das bei erfolgreichem Abschluss aufgelöst wird.
    return new Promise((resolve, reject) => {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGO_IDEA, key, iv, { authTagLength: 16 });
        const inp = fs.createReadStream(inPath);
        const out = fs.createWriteStream(outPath);
        inp.pipe(cipher).pipe(out);
        out.on('finish', () => {
            const auth = cipher.getAuthTag();
            fs.writeFileSync(outPath + '.meta', JSON.stringify({
                iv: iv.toString('base64'),
                auth: auth.toString('base64'),
                orig: origName
            }), { mode: 0o600 });
            resolve();
        });
        out.on('error', reject);
        inp.on('error', reject);
    });
}

/**
 * Decrypts an encrypted idea file and pipes it to the response stream.
 * @param {string} encPath - Pfad zur verschlüsselten Datei.
 * @param {Object} res - Express response (vereinfachter Typ für JSDoc).
 * @param {Buffer} key - Entschlüsselungsschlüssel.
 * @param {string} filename - Fallback-Dateiname.
 * @param {string} [mime] - Optionaler MIME-Type.
 * @returns {boolean|null} true wenn gestartet, null wenn Metadatei fehlt.
 */
function streamDecryptIdeaToResponse(encPath, res, key, filename, mime) {
    const metaPath = encPath + '.meta';
    if (!fs.existsSync(metaPath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const iv = Buffer.from(meta.iv, 'base64');
    const auth = Buffer.from(meta.auth, 'base64');
    const decipher = crypto.createDecipheriv(ALGO_IDEA, key, iv, { authTagLength: 16 });
    decipher.setAuthTag(auth);
    if (mime) res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${meta.orig || filename}"`);
    fs.createReadStream(encPath).pipe(decipher).pipe(res);
    return true;
}

/**
 * Handles saving an uploaded file for an idea: encryption, DB insert, and counter update.
 * @async
 * @param {number|string} ideaId
 * @param {Object} file - The file object from multer (req.file)
 * @param {Object} [conn] - Optional DB connection
 * @returns {Promise<boolean>}
 */
async function saveIdeaFile(ideaId, file, conn = db) {
    if (!file) return false;

    const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads', 'ideas');
    const origPath = path.join(uploadDir, file.filename);
    const key = deriveKeyForIdeas();
    let storedFilename = file.filename;

    try {
        if (key) {
            const outPath = origPath + '.enc';
            await encryptFileStream(origPath, outPath, key, file.originalname || file.filename);
            try { fs.unlinkSync(origPath); } catch (e) {}
            storedFilename = file.filename + '.enc';
        }
    } catch (e) {
        console.error('Idea file encryption failed:', e);
    }

    const fileRes = await conn.query(
        'INSERT INTO idea_files (idea_id, file_path, original_name, uploaded_at) VALUES (?, ?, ?, NOW())',
        [ideaId, storedFilename, file.originalname]
    );

    if (fileRes && fileRes.affectedRows > 0) {
        await executeWithRetry(conn, 'UPDATE ideas SET file_count = file_count + 1, updated_at = NOW() WHERE idea_id = ?', [ideaId]);
        return true;
    }
    return false;
}

/**
 * Deletes an idea file: permission check, DB delete, disk unlink, and counter update.
 * @async
 * @param {number|string} fileId
 * @param {number|string} userId
 * @param {string} userRole
 * @returns {Promise.<Object>}
 */
async function deleteIdeaFile(fileId, userId, userRole) {
    const fileRows = await db.query('SELECT file_path, idea_id FROM idea_files WHERE file_id = ? LIMIT 1', [fileId]);
    const fileRow = fileRows[0];
    if (!fileRow) return { success: false, error: 'Datei nicht gefunden' };

    const ideaId = fileRow.idea_id;
    const ideaRows = await db.query('SELECT user_id FROM ideas WHERE idea_id = ? LIMIT 1', [ideaId]);
    const idea = ideaRows[0];
    if (!idea) return { success: false, error: 'Idee nicht gefunden' };

    const isOwner = String(idea.user_id) === String(userId);
    const isAdmin = hasAdminRole(userRole);
    if (!isOwner && !isAdmin) return { success: false, error: 'Nicht berechtigt' };

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const delRes = await conn.query('DELETE FROM idea_files WHERE file_id = ?', [fileId]);

        if (delRes && delRes.affectedRows > 0) {
            await executeWithRetry(conn, 'UPDATE ideas SET file_count = GREATEST(file_count - 1, 0), updated_at = NOW() WHERE idea_id = ?', [ideaId]);

            // Disk cleanup
            try {
                const safeName = path.basename(fileRow.file_path);
                const baseDir = path.join(__dirname, '..', '..', 'data', 'uploads', 'ideas');
                const absPath = path.join(baseDir, safeName);

                if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
                if (absPath.endsWith('.enc') && fs.existsSync(absPath + '.meta')) fs.unlinkSync(absPath + '.meta');

                if (safeName.endsWith('.enc')) {
                    const plain = path.join(baseDir, safeName.slice(0, -4));
                    if (fs.existsSync(plain)) fs.unlinkSync(plain);
                }
            } catch (e) {
                console.warn('Failed to unlink idea file (best-effort):', e);
            }

            await conn.commit();
            return { success: true, ideaId };
        }

        await conn.rollback();
        return { success: false, error: 'Löschen fehlgeschlagen' };
    } catch (err) {
        if (conn) await conn.rollback();
        throw err;
    } finally {
        if (conn) conn.release();
    }
}

/**
 * Get file info for download.
 * @async
 * @param {number|string} fileId
 * @returns {Promise<Object|undefined>} Objekt mit `file_path` und `original_name`.
 */
async function getIdeaFile(fileId) {
    const rows = await db.query(
        'SELECT file_path, original_name FROM idea_files WHERE file_id = ? LIMIT 1',
        [fileId]);
    return rows[0];
    return rows[0];
}

module.exports = {
    getIdeaFile,
    ideasUpload,
    deriveKeyForIdeas,
    encryptFileStream,
    streamDecryptIdeaToResponse,
    saveIdeaFile,
    deleteIdeaFile
};


