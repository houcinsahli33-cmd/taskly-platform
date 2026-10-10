
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dossier = path.join(__dirname, "../private_uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024,
    files: 1, fields: 25, fieldSize: 16384, parts: 26
  },
  fileFilter(req, file, cb) {
    if (![
      "application/pdf",
      "image/jpeg",
      "image/png"
    ].includes(file.mimetype)) {
      return cb(new Error("Format non autorise."));
    }
    cb(null, true);
  }
});

function formatValide(buffer, mime) {
  if (mime === "application/pdf")
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";

  if (mime === "image/jpeg")
    return buffer[0] === 0xff &&
           buffer[1] === 0xd8 &&
           buffer[2] === 0xff;

  if (mime === "image/png")
    return buffer.subarray(0, 8)
      .equals(Buffer.from("89504e470d0a1a0a", "hex"));

  return false;
}

module.exports = { upload, dossier, formatValide };
