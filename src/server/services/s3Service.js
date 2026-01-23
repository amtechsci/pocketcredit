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
        // We don't break immediately because we might want to overlay, 
        // but typically one is enough. Let's keep going to ensure we get *some* variables if split.
        // However, usually first match is preferred or we want specific override.
        // For now, let's assume if we find one valid one, we break? 
        // Or keep loading to ensure all vars are present?
        // Let's break on first successful load to avoid confusion, 
        // assuming priority is top-down.
        break;
      }
    }
  }

  // Fallback to default load which uses cwd
  if (!loaded) {
    console.log('Trying default dotenv load...');
    require('dotenv').config();
  }
};

loadEnv();

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET;
const S3_PREFIX = process.env.S3_PREFIX || 'pocket'; // Base folder prefix

if (!BUCKET_NAME) {
  console.error('❌ ERROR: AWS_S3_BUCKET environment variable is not set!');
  console.error('   Please add AWS_S3_BUCKET to your .env file');
}

/**
 * Generic file upload to S3 - Can be used for all file types
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - MIME type (e.g., 'image/jpeg', 'application/pdf')
 * @param {Object} options - Upload options
 * @param {string} options.folder - Specific folder (e.g., 'student-documents', 'kyc', 'profile-pics')
 * @param {number} options.userId - User ID (for organizing by user)
 * @param {string} options.documentType - Document type (e.g., 'college_id_front', 'pan_card')
 * @param {boolean} options.isPublic - Whether file should be publicly accessible (default: false)
 * @returns {Promise<{success: boolean, key: string, url: string, size: number}>}
 */
async function uploadToS3(fileBuffer, fileName, mimeType, options = {}) {
  try {
    const {
      folder = 'documents',
      userId = null,
      documentType = null,
      isPublic = false
    } = options;

    // Build S3 path: prefix/folder/userId/documentType/timestamp-filename
    let s3Path = S3_PREFIX;

    if (folder) s3Path += `/${folder}`;
    if (userId) s3Path += `/${userId}`;
    if (documentType) s3Path += `/${documentType}`;

    const timestamp = Date.now();
    
    // Enhanced filename sanitization to handle all edge cases
    // 1. Remove any path separators to prevent directory traversal
    let sanitizedFileName = fileName.replace(/[\/\\]/g, '_');
    
    // 2. Convert to ASCII-compatible format (remove Unicode, emoji, etc.)
    sanitizedFileName = sanitizedFileName
      .normalize('NFD') // Normalize Unicode characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .replace(/\s+/g, '_') // Replace whitespace with underscores
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Keep only alphanumeric, dots, hyphens, underscores
      .replace(/_+/g, '_') // Replace multiple underscores with single
      .replace(/^[._-]+|[._-]+$/g, '') // Remove leading/trailing special chars
      .trim();
    
    // 3. Ensure filename is not empty after sanitization
    if (!sanitizedFileName || sanitizedFileName.length === 0) {
      sanitizedFileName = 'document';
    }
    
    // 4. Handle file extension
    const lastDotIndex = sanitizedFileName.lastIndexOf('.');
    if (lastDotIndex > 0 && lastDotIndex < sanitizedFileName.length - 1) {
      const name = sanitizedFileName.substring(0, lastDotIndex);
      const ext = sanitizedFileName.substring(lastDotIndex + 1).toLowerCase();
      sanitizedFileName = `${name}.${ext}`;
    }
    
    // 5. Truncate if filename is too long (S3 key limit is 1024 chars, but keep it reasonable)
    const maxFileNameLength = 200;
    if (sanitizedFileName.length > maxFileNameLength) {
      const ext = sanitizedFileName.substring(sanitizedFileName.lastIndexOf('.'));
      const nameWithoutExt = sanitizedFileName.substring(0, sanitizedFileName.lastIndexOf('.'));
      sanitizedFileName = nameWithoutExt.substring(0, maxFileNameLength - ext.length) + ext;
    }
    
    const uniqueFileName = `${s3Path}/${timestamp}-${sanitizedFileName}`;

    const BUCKET_NAME = process.env.AWS_S3_BUCKET;
    if (!BUCKET_NAME) throw new Error('AWS_S3_BUCKET is not set');

    const uploadParams = {
      Bucket: BUCKET_NAME,
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

    // Add ACL only if public
    if (isPublic) {
      uploadParams.ACL = 'public-read';
    }

    // Use Upload for better handling of large files
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
      ? `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`
      : null; // For private files, use presigned URLs

    console.log(`✅ File uploaded to S3: ${uniqueFileName}`);

    return {
      success: true,
      key: uniqueFileName,
      url: fileUrl,
      bucket: BUCKET_NAME,
      location: result.Location,
      size: fileBuffer.length,
      mimeType: mimeType,
    };
  } catch (error) {
    console.error('❌ S3 Upload Error:', {
      error: error.message,
      code: error.code,
      fileName: fileName,
      sanitizedFileName: sanitizedFileName,
      uniqueFileName: uniqueFileName,
      bucket: BUCKET_NAME,
      mimeType: mimeType,
      fileSize: fileBuffer?.length
    });
    
    // Provide more specific error messages
    let errorMessage = 'Failed to upload file to S3';
    if (error.message.includes('pattern')) {
      errorMessage += ': Invalid filename format. Please try renaming your file to use only letters, numbers, and basic punctuation.';
    } else if (error.code === 'AccessDenied') {
      errorMessage += ': Access denied. Please check S3 bucket permissions.';
    } else if (error.code === 'NoSuchBucket') {
      errorMessage += ': S3 bucket not found. Please check configuration.';
    } else {
      errorMessage += `: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Delete file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<{success: boolean}>}
 */
async function deleteFromS3(key) {
  try {
    const BUCKET_NAME = process.env.AWS_S3_BUCKET;
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    await s3Client.send(new DeleteObjectCommand(deleteParams));

    return {
      success: true,
      message: 'File deleted successfully',
    };
  } catch (error) {
    console.error('S3 Delete Error:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
}

/**
 * Generate presigned URL for secure file access
 * @param {string} key - S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key, expiresIn = 3600) {
  try {
    const BUCKET_NAME = process.env.AWS_S3_BUCKET;
    if (!BUCKET_NAME) throw new Error('AWS_S3_BUCKET is not set');

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Generate Presigned URL Error:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

/**
 * Download file from S3
 * @param {string} key - S3 object key
 * @returns {Promise<Buffer>}
 */
async function downloadFromS3(key) {
  try {
    const BUCKET_NAME = process.env.AWS_S3_BUCKET;
    if (!BUCKET_NAME) throw new Error('AWS_S3_BUCKET is not set');

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    return buffer;
  } catch (error) {
    console.error('Download from S3 Error:', error);
    throw new Error(`Failed to download file from S3: ${error.message}`);
  }
}

/**
 * Validate S3 configuration
 * @returns {boolean}
 */
function validateS3Config() {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'AWS_S3_BUCKET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing S3 configuration: ${missing.join(', ')}`);
    return false;
  }

  console.log('✅ S3 configuration is valid');
  return true;
}

// ============================================
// CONVENIENCE WRAPPER FUNCTIONS
// ============================================

/**
 * Upload student document
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} mimeType - MIME type
 * @param {number} userId - User ID
 * @param {string} documentType - Document type (e.g., 'college_id_front', 'marks_memo')
 */
async function uploadStudentDocument(fileBuffer, fileName, mimeType, userId, documentType) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'student-documents',
    userId,
    documentType,
    isPublic: false,
  });
}

/**
 * Upload KYC document
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} mimeType - MIME type
 * @param {number} userId - User ID
 * @param {string} documentType - Document type (e.g., 'pan_card', 'aadhar_front')
 */
async function uploadKYCDocument(fileBuffer, fileName, mimeType, userId, documentType) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'kyc-documents',
    userId,
    documentType,
    isPublic: false,
  });
}

/**
 * Upload profile picture
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} mimeType - MIME type
 * @param {number} userId - User ID
 */
async function uploadProfilePicture(fileBuffer, fileName, mimeType, userId) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'profile-pictures',
    userId,
    documentType: 'avatar',
    isPublic: false,
  });
}

/**
 * Upload loan agreement document
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {string} mimeType - MIME type
 * @param {number} userId - User ID
 * @param {string} loanId - Loan application ID
 */
async function uploadLoanDocument(fileBuffer, fileName, mimeType, userId, loanId) {
  return uploadToS3(fileBuffer, fileName, mimeType, {
    folder: 'loan-documents',
    userId,
    documentType: `loan-${loanId}`,
    isPublic: false,
  });
}

/**
 * Upload generated PDF (KFS, Loan Agreement, etc.)
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - File name
 * @param {number} userId - User ID
 * @param {string} documentType - Document type (e.g., 'kfs', 'loan-agreement')
 */
async function uploadGeneratedPDF(fileBuffer, fileName, userId, documentType) {
  return uploadToS3(fileBuffer, fileName, 'application/pdf', {
    folder: 'generated-documents',
    userId,
    documentType,
    isPublic: false,
  });
}

module.exports = {
  // Core functions
  uploadToS3,
  deleteFromS3,
  getPresignedUrl,
  downloadFromS3,
  validateS3Config,
  s3Client,

  // Convenience wrappers for specific use cases
  uploadStudentDocument,
  uploadKYCDocument,
  uploadProfilePicture,
  uploadLoanDocument,
  uploadGeneratedPDF,
};

