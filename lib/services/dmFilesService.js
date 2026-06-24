/**
 * @fileoverview Datei-Upload-Service für Direktnachrichten (multer storage-Konfiguration).
 * @module lib/services/dmFilesService
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const keyManager = require('../keyManager');
const crypto = require('crypto');

// Verschlüsselungs-Helfer
const ALGO_CHAT = 'aes-256-gcm';

/**
 * Holt den Master-Key vom Key-Manager.
 * @returns {Buffer|null}
 */
function deriveKeyForChat() {
    try {
        return keyManager.getMasterKey();
    } catch (e) {
        return null;
    }
}

/**
 * Verschlüsselt eine Datei (Stream) und schreibt Metadaten (.meta).
 * @param {string} inPath - Pfad zur Quelldatei.
 * @param {string} outPath - Pfad zur verschlüsselten Zieldatei.
 * @param {Buffer} key - Verschlüsselungsschlüssel.
 * @param {string} origName - Originaler Dateiname.
 * @returns {Promise<void>}
 */
function encryptFileStream(inPath, outPath, key, origName) {
    return new Promise((resolve, reject) => {
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGO_CHAT, key, iv, { authTagLength: 16 });
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
 * Entschlüsselt eine verschlüsselte Chat-Datei und streamt sie an die Response.
 * @param {string} encPath - Pfad zur verschlüsselten Datei.
 * @param {Object} res - Express response.
 * @param {Buffer} key - Entschlüsselungsschlüssel.
 * @param {string} filename - Fallback-Dateiname.
 * @returns {boolean|null} true wenn gestartet, null wenn Metadatei fehlt.
 */
function streamDecryptChatToResponse(encPath, res, key, filename) {
    const metaPath = encPath + '.meta';
    if (!fs.existsSync(metaPath)) return null;
    
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const iv = Buffer.from(meta.iv, 'base64');
    const auth = Buffer.from(meta.auth, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGO_CHAT, key, iv, { authTagLength: 16 });
    decipher.setAuthTag(auth);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${meta.orig || filename}"`);
    
    fs.createReadStream(encPath).pipe(decipher).pipe(res);
    return true;
}

const dmFilesStorage = multer.diskStorage({
    /**
     * Bestimmt das Upload-Verzeichnis für Chat-Dateien und erstellt es falls nötig.
    * @param {Object} req
     * @param {Object} file
     * @param {function(Error|null,string)} cb
     */
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads', 'chat');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    /**
     * Generiert einen eindeutigen Dateinamen für das Upload.
    * @param {Object} req
     * @param {Object} file
     * @param {function(Error|null,string)} cb
     */
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

/** @constant {Object} */
const dmUpload = multer({ 
    storage: dmFilesStorage,
    limits: { fileSize: 10 * 1024 * 1024 }
});

module.exports = {
    dmUpload,
    deriveKeyForChat,
    encryptFileStream,
    streamDecryptChatToResponse
};

