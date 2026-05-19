const multer = require('multer');
const path = require('path');
const fs = require('fs');

const proofOfAddressDir = path.join(process.cwd(), 'src/uploads/proof-of-address');
const kycDocumentsDir = path.join(process.cwd(), 'src/uploads/kyc-documents');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(proofOfAddressDir);
ensureDir(kycDocumentsDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'proofOfAddressFile') {
      cb(null, proofOfAddressDir);
      return;
    }

    if (file.fieldname === 'documentFile') {
      cb(null, kycDocumentsDir);
      return;
    }

    cb(null, kycDocumentsDir);
  },

  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/\s+/g, '_');
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginalName}`;
    cb(null, uniqueName);
  }
});

function fileFilter(req, file, cb) {
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed.'));
    return;
  }

  cb(null, true);
}

const uploadKycFiles = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
}).fields([
  { name: 'proofOfAddressFile', maxCount: 1 },
  { name: 'documentFile', maxCount: 1 }
]);

module.exports = {
  uploadKycFiles
};
