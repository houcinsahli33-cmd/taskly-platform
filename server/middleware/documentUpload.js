
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dossier = path.join(__dirname, '../private_uploads');

const stockage = multer.diskStorage({
  destination(req, file, cb) {
    // Sur Vercel, ne pas utiliser le disque local.
    if (process.env.VERCEL) {
      return cb(new Error(
        'Envoi de documents temporairement indisponible.'
      ));
    }

    // En local, creer le dossier uniquement lors d'un upload.
    fs.mkdir(dossier, { recursive: true }, (err) => {
      if (err) return cb(err);
      cb(null, dossier);
    });
  },

  filename(req, file, cb) {
    cb(null, crypto.randomBytes(32).toString('hex'));
  }
});

const upload = multer({
  storage: stockage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter(req, file, cb) {
    if (![
      'application/pdf',
      'image/jpeg',
      'image/png'
    ].includes(file.mimetype)) {
      return cb(new Error('Format non autorise : PDF, JPG ou PNG uniquement.'));
    }

    cb(null, true);
  }
});

function formatValide(buffer, mime) {
  if (mime === 'application/pdf')
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';

  if (mime === 'image/jpeg')
    return buffer[0] === 0xff &&
           buffer[1] === 0xd8 &&
           buffer[2] === 0xff;

  if (mime === 'image/png')
    return buffer.subarray(0, 8)
      .equals(Buffer.from('89504e470d0a1a0a', 'hex'));

  return false;
}

module.exports = { upload, dossier, formatValide };
