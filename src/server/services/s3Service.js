const path = require('path');
const fs = require('fs');

// function to load env from multiple possible paths
const loadEnv = () => {
  const possiblePaths = [
    path.join(__dirname, '../.env'), // src/server/.env
    path.join(__dirname, '../../server/.env'), // Alternative structure
    path.join(__dirname, '../../.env'), // src/.env
    path.join(__dirname, '../../../.env'), // project root
    path.join(process.cwd(), '.env') // current working directory
  ];

  let loaded = false;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      const result = require('dotenv').config({ path: p });
      if (!result.error) {
        loaded = true;
        break;
      }
    }
  }

  if (!loaded) {
    console.log('Trying default dotenv load...');
    require('dotenv').config();
  }
};

loadEnv();

const creditLabStorage = require('./creditLabPocketStorageService');

const useCreditLabStorage = creditLabStorage.isCreditLabStorageEnabled();

let s3Client;
let Upload;
let PutObjectCommand;
let DeleteObjectCommand;
let GetObjectCommand;
let getSignedUrl;

if (!useCreditLabStorage) {
  ({ S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3'));
  ({ Upload } = require('@aws-sdk/lib-storage'));
  ({ getSignedUrl } = require('@aws-sdk/s3-request-presigner'));

  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET;
const S3_PREFIX = process.env.S3_PREFIX || 'pocket';

if (!useCreditLabStorage && !BUCKET_NAME) {
  console.error('❌ ERROR: AWS_S3_BUCKET environment variable is not set!');
  console.error('   Set CREDITLAB_POCKET_API_TOKEN or AWS_S3_BUCKET in your .env file');
}

if (useCreditLabStorage) {
  console.log('📦 File storage: CreditLab Pocket API (no direct S3 credentials required)');
}

function sanitizeFileName(fileName) {
  let sanitizedFileName = fileName.replace(/[\/\\]/g, '_');

  sanitizedFileName = sanitizedFileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .trim();

  if (!sanitizedFileName || sanitizedFileName.length === 0) {
    sanitizedFileName = 'document';
  }

  const lastDotIndex = sanitizedFileName.lastIndexOf('.');
  if (lastDotIndex > 0 && lastDotIndex < sanitizedFileName.length - 1) {
    const name = sanitizedFileName.substring(0, lastDotIndex);
    const ext = sanitizedFileName.substring(lastDotIndex + 1).toLowerCase();
    sanitizedFileName = `${name}.${ext}`;
  }

  const maxFileNameLength = 200;
  if (sanitizedFileName.length > maxFileNameLength) {
    const ext = sanitizedFileName.substring(sanitizedFileName.lastIndexOf('.'));
    const nameWithoutExt = sanitizedFileName.substring(0, sanitizedFileName.lastIndexOf('.'));
    sanitizedFileName = nameWithoutExt.substring(0, maxFileNameLength - ext.length) + ext;
  }

  return sanitizedFileName;
}

function buildRelativeStoragePath(options = {}) {
  const {
    folder = 'documents',
    userId = null,
    documentType = null,
  } = options;

  let storagePath = folder || 'documents';
  if (userId) storagePath += `/${userId}`;
  if (documentType) storagePath += `/${documentType}`;

  return storagePath;
}

function toDirectS3Key(relativeKey) {
  const normalized = creditLabStorage.normalizeStorageKey(relativeKey);
  return `${S3_PREFIX}/${normalized}`;
}

/**
 * Generic file upload - CreditLab API or direct S3 fallback.
 * Returns a key relative to pocket/ when using CreditLab; legacy full S3 key otherwise.
 */
async function uploadToS3(fileBuffer, fileName, mimeType, options = {}) {
  let sanitizedFileName;
  let relativeKey;

  try {
    const {
      folder = 'documents',
      userId = null,
      documentType = null,
      isPublic = false,
    } = options;

    if (isPublic && useCreditLabStorage) {
      console.warn('⚠️  Public ACL is not supported via CreditLab storage; file will remain private');
    }

    const storagePath = buildRelativeStoragePath({ folder, userId, documentType });
    const timestamp = Date.now();
    sanitizedFileName = sanitizeFileName(fileName);
    relativeKey = `${storagePath}/${timestamp}-${sanitizedFileName}`;

    if (useCreditLabStorage) {
      const result = await creditLabStorage.upload(
        fileBuffer,
        relativeKey,
        mimeType,
        fileName
      );

      console.log(`✅ File uploaded via CreditLab API: ${result.key}`);

      return {
        success: true,
        key: result.key,
        url: null,
        bucket: 'creditlab.in',
        location: result.s3_key,
        size: fileBuffer.length,
        mimeType,
      };
    }

    const uniqueFileName = toDirectS3Key(relativeKey);
    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) throw new Error('AWS_S3_BUCKET is not set');

    const uploadParams = {
      Bucket: bucketName,
      Key: uniqueFileName,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: {
        'original-name': fileName,
        'upload-timestamp': timestamp.toString(),
        ...(userId && { 'user-id': userId.toString() }),
        ...(documentType && { 'document-type': documentType }),
      },
    };

    if (isPublic) {
      uploadParams.ACL = 'public-read';
    }

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    upload.on('httpUploadProgress', (progress) => {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      console.log(`📤 S3 Upload: ${percentage}% (${progress.loaded}/${progress.total} bytes)`);
    });

    const result = await upload.done();

    const fileUrl = isPublic
      ? `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`
      : null;

    console.log(`✅ File uploaded to S3: ${uniqueFileName}`);

    return {
      success: true,
      key: uniqueFileName,
      url: fileUrl,
      bucket: bucketName,
      location: result.Location,
      size: fileBuffer.length,
      mimeType,
    };
  } catch (error) {
    console.error('❌ Storage Upload Error:', {
      error: error.message,
      code: error.code,
      fileName,
      sanitizedFileName,
      relativeKey,
      bucket: BUCKET_NAME,
      mimeType,
      fileSize: fileBuffer?.length,
    });

    let errorMessage = useCreditLabStorage
      ? 'Failed to upload file via CreditLab storage API'
      : 'Failed to upload file to S3';

    if (error.message.includes('pattern')) {
      errorMessage += ': Invalid filename format. Please try renaming your file to use only letters, numbers, and basic punctuation.';
    } else if (error.code === 'AccessDenied') {
      errorMessage += ': Access denied. Please check storage permissions.';
    } else if (error.code === 'NoSuchBucket') {
      errorMessage += ': Storage bucket not found. Please check configuration.';
    } else {
      errorMessage += `: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}

async function deleteFromS3(key) {
  try {
    if (useCreditLabStorage) {
      return creditLabStorage.deleteFile(key);
    }

    const bucketName = process.env.AWS_S3_BUCKET;
    const deleteParams = {
      Bucket: bucketName,
      Key: toDirectS3Key(key),
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));

    return {
      success: true,
      message: 'File deleted successfully',
    };
  } catch (error) {
    console.error('Storage Delete Error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

async function getPresignedUrl(key, expiresIn = 3600) {
  try {
    if (useCreditLabStorage) {
      return creditLabStorage.presign(key, expiresIn);
    }

    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) throw new Error('AWS_S3_BUCKET is not set');

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: toDirectS3Key(key),
    });

    return getSignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('Generate Presigned URL Error:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

async function downloadFromS3(key) {
  try {
    if (useCreditLabStorage) {
      return creditLabStorage.download(key);
    }

    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) throw new Error('AWS_S3_BUCKET is not set');

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: toDirectS3Key(key),
    });

    const response = await s3Client.send(command);

    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Download from storage Error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

function validateS3Config() {
  if (useCreditLabStorage) {
    return creditLabStorage.validateCreditLabStorageConfig();
  }

  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
  const missing = required.filter((envKey) => !process.env[envKey]);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing S3 configuration: ${missing.join(', ')}`);
    console.warn('   Set CREDITLAB_POCKET_API_TOKEN to use CreditLab storage instead of direct S3');
    return false;
  }

  console.log('✅ S3 configuration is valid');
  return true;
}

async function uploadStudentDocument(fileBuffer, fileName, mimeType, userId, documentType) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'student-documents',
    userId,
    documentType,
    isPublic: false,
  });
}

async function uploadKYCDocument(fileBuffer, fileName, mimeType, userId, documentType) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'kyc-documents',
    userId,
    documentType,
    isPublic: false,
  });
}

async function uploadProfilePicture(fileBuffer, fileName, mimeType, userId) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'profile-pictures',
    userId,
    documentType: 'avatar',
    isPublic: false,
  });
}

async function uploadLoanDocument(fileBuffer, fileName, mimeType, userId, loanId) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'loan-documents',
    userId,
    documentType: `loan-${loanId}`,
    isPublic: false,
  });
}

async function uploadGeneratedPDF(fileBuffer, fileName, userId, documentType) {
  return uploadToS3(fileBuffer, fileName, 'application/pdf', {
    folder: 'generated-documents',
    userId,
    documentType,
    isPublic: false,
  });
}

module.exports = {
  uploadToS3,
  deleteFromS3,
  getPresignedUrl,
  downloadFromS3,
  validateS3Config,
  s3Client,
  uploadStudentDocument,
  uploadKYCDocument,
  uploadProfilePicture,
  uploadLoanDocument,
  uploadGeneratedPDF,
  isCreditLabStorageEnabled: creditLabStorage.isCreditLabStorageEnabled,
  normalizeStorageKey: creditLabStorage.normalizeStorageKey,
};
