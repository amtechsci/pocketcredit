# S3 File Upload Helper - Usage Guide

## Overview
Generic S3 file upload service for handling all file uploads in the Pocket Credit application.

## Configuration (.env)
```env
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
AWS_REGION=ap-south-1
AWS_S3_BUCKET=your-bucket-name
S3_PREFIX=pocket
```

**⚠️ IMPORTANT: Never commit actual AWS credentials to Git! Always use environment variables.**

## S3 Folder Structure
```
creditlab.in/
└── pocket/                          (S3_PREFIX)
    ├── student-documents/
    │   └── {userId}/
    │       ├── college_id_front/
    │       ├── college_id_back/
    │       └── marks_memo/
    ├── kyc-documents/
    │   └── {userId}/
    │       ├── pan_card/
    │       ├── aadhar_front/
    │       └── aadhar_back/
    ├── profile-pictures/
    │   └── {userId}/
    │       └── avatar/
    ├── loan-documents/
    │   └── {userId}/
    │       └── loan-{loanId}/
    └── generated-documents/
        └── {userId}/
            ├── kfs/
            └── loan-agreement/
```

## Usage Examples

### 1. Student Documents (College ID, Marks Memo)
```javascript
const { uploadStudentDocument } = require('../services/s3Service');

// In your route handler
const uploadResult = await uploadStudentDocument(
  fileBuffer,        // Buffer from multer: req.file.buffer
  fileName,          // Original filename: req.file.originalname
  mimeType,          // MIME type: req.file.mimetype
  userId,            // User ID: req.userId
  documentType       // 'college_id_front', 'college_id_back', 'marks_memo'
);

// Result:
// {
//   success: true,
//   key: 'pocket/student-documents/123/college_id_front/1234567890-college_id.jpg',
//   url: null,  // Private file, use presigned URL
//   bucket: 'creditlab.in',
//   size: 245678,
//   mimeType: 'image/jpeg'
// }
```

### 2. KYC Documents (PAN, Aadhar)
```javascript
const { uploadKYCDocument } = require('../services/s3Service');

const uploadResult = await uploadKYCDocument(
  req.file.buffer,
  req.file.originalname,
  req.file.mimetype,
  userId,
  'pan_card'  // or 'aadhar_front', 'aadhar_back'
);
```

### 3. Profile Pictures
```javascript
const { uploadProfilePicture } = require('../services/s3Service');

const uploadResult = await uploadProfilePicture(
  req.file.buffer,
  req.file.originalname,
  req.file.mimetype,
  userId
);
```

### 4. Loan Documents
```javascript
const { uploadLoanDocument } = require('../services/s3Service');

const uploadResult = await uploadLoanDocument(
  req.file.buffer,
  req.file.originalname,
  req.file.mimetype,
  userId,
  loanApplicationId
);
```

### 5. Generated PDFs (KFS, Loan Agreements)
```javascript
const { uploadGeneratedPDF } = require('../services/s3Service');

// For KFS document
const uploadResult = await uploadGeneratedPDF(
  pdfBuffer,
  'KFS_LA12345.pdf',
  userId,
  'kfs'
);

// For Loan Agreement
const uploadResult = await uploadGeneratedPDF(
  pdfBuffer,
  'LoanAgreement_LA12345.pdf',
  userId,
  'loan-agreement'
);
```

### 6. Custom/Generic Upload
```javascript
const { uploadToS3 } = require('../services/s3Service');

const uploadResult = await uploadToS3(
  fileBuffer,
  fileName,
  mimeType,
  {
    folder: 'custom-folder',    // Required
    userId: 123,                 // Optional but recommended
    documentType: 'custom-doc',  // Optional
    isPublic: false              // Default: false (private)
  }
);
```

## Delete Files
```javascript
const { deleteFromS3 } = require('../services/s3Service');

// Delete using S3 key
await deleteFromS3('pocket/student-documents/123/college_id_front/1234567890-college_id.jpg');

// Result:
// {
//   success: true,
//   message: 'File deleted successfully'
// }
```

## Generate Presigned URLs (for private files)
```javascript
const { getPresignedUrl } = require('../services/s3Service');

// Generate URL valid for 1 hour (default)
const url = await getPresignedUrl(s3Key);

// Custom expiration (e.g., 5 minutes)
const url = await getPresignedUrl(s3Key, 300);

// Use this URL in your response to allow user to download/view the file
res.json({
  status: 'success',
  data: {
    document_url: url,
    expires_in: 3600
  }
});
```

## Complete Example: Student Document Upload Route
```javascript
const express = require('express');
const multer = require('multer');
const { uploadStudentDocument, getPresignedUrl } = require('../services/s3Service');
const { requireAuth } = require('../middleware/jwtAuth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', requireAuth, upload.single('document'), async (req, res) => {
  try {
    const userId = req.userId;
    const { document_type } = req.body;

    // Upload to S3
    const uploadResult = await uploadStudentDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId,
      document_type
    );

    // Save to database
    await executeQuery(
      `INSERT INTO student_documents 
       (user_id, document_type, file_name, s3_key, s3_bucket, file_size, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, document_type, req.file.originalname, uploadResult.key, 
       uploadResult.bucket, uploadResult.size, uploadResult.mimeType]
    );

    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: {
        document_id: result.insertId,
        s3_key: uploadResult.key
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get document with presigned URL
router.get('/:documentId/url', requireAuth, async (req, res) => {
  try {
    const document = await executeQuery(
      'SELECT s3_key FROM student_documents WHERE id = ? AND user_id = ?',
      [req.params.documentId, req.userId]
    );

    if (!document || document.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    const url = await getPresignedUrl(document[0].s3_key, 3600);

    res.json({
      status: 'success',
      data: {
        url: url,
        expires_in: 3600
      }
    });
  } catch (error) {
    console.error('Get URL error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
```

## Error Handling
```javascript
try {
  const uploadResult = await uploadStudentDocument(
    fileBuffer, fileName, mimeType, userId, documentType
  );
  
  console.log('✅ Upload successful:', uploadResult.key);
  
} catch (error) {
  console.error('❌ Upload failed:', error.message);
  
  // Common errors:
  // - Missing AWS credentials
  // - Invalid bucket name
  // - Network issues
  // - Insufficient permissions
  
  res.status(500).json({
    status: 'error',
    message: 'Failed to upload file'
  });
}
```

## Validate S3 Configuration
```javascript
const { validateS3Config } = require('../services/s3Service');

// Check if S3 is properly configured
if (validateS3Config()) {
  console.log('✅ S3 is ready');
} else {
  console.warn('⚠️  S3 configuration is incomplete');
}
```

## Best Practices

1. **Always use convenience wrappers** when available instead of the generic `uploadToS3`
2. **Store S3 keys in database** for later retrieval and deletion
3. **Use presigned URLs** for private files instead of making them public
4. **Set appropriate expiration times** for presigned URLs (shorter for sensitive documents)
5. **Delete old files** when replacing documents to avoid storage costs
6. **Validate file types** before uploading using multer fileFilter
7. **Limit file sizes** using multer limits configuration
8. **Handle errors gracefully** and provide user-friendly messages
9. **Log upload activities** for auditing and debugging
10. **Clean up database records** when deleting S3 files

## Security Notes

- All files are **private by default** (require presigned URLs)
- Use `isPublic: true` only for truly public assets (logos, etc.)
- Presigned URLs expire automatically
- S3 keys contain user IDs for access control
- Always verify user ownership before providing presigned URLs

