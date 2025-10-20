/**
 * Student Documents Routes
 * Handles student document uploads to S3
 */

const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/jwtAuth');
const { checkHoldStatus } = require('../middleware/checkHoldStatus');
const { executeQuery, initializeDatabase } = require('../config/database');
const { uploadStudentDocument, deleteFromS3, getPresignedUrl } = require('../services/s3Service');
const router = express.Router();

// Configure multer for memory storage (files will be uploaded to S3)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF files are allowed.'));
    }
  },
});

// POST /api/student-documents/upload - Upload student document
router.post('/upload', requireAuth, checkHoldStatus, upload.single('document'), async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { document_type } = req.body;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    // Validate document_type
    const validTypes = ['college_id_front', 'college_id_back', 'marks_memo', 'educational_certificate'];
    if (!document_type || !validTypes.includes(document_type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid document type'
      });
    }

    // Check if user is a student
    const users = await executeQuery(
      'SELECT employment_type FROM users WHERE id = ?',
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (users[0].employment_type !== 'student') {
      return res.status(400).json({
        status: 'error',
        message: 'Document upload is only available for students'
      });
    }

    console.log(`📤 Uploading ${document_type} for user ${userId}`);

    // Upload to S3 using convenience wrapper
    const uploadResult = await uploadStudentDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId,
      document_type
    );

    // For private files, construct the S3 URL (even though direct access requires presigned URL)
    const fileUrl = uploadResult.url || `https://${uploadResult.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadResult.key}`;

    console.log('✅ Upload Result:', {
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      size: uploadResult.size
    });

    // Check if document already exists for this type
    const existing = await executeQuery(
      'SELECT id, s3_key FROM student_documents WHERE user_id = ? AND document_type = ?',
      [userId, document_type]
    );

    if (existing && existing.length > 0) {
      // Delete old file from S3
      try {
        await deleteFromS3(existing[0].s3_key);
        console.log('🗑️  Deleted old document from S3');
      } catch (deleteError) {
        console.error('Error deleting old document:', deleteError);
        // Continue anyway
      }

      // Update existing record
      await executeQuery(
        `UPDATE student_documents 
         SET file_name = ?, file_path = ?, s3_key = ?, s3_bucket = ?, 
             file_size = ?, mime_type = ?, upload_status = 'uploaded', 
             uploaded_at = NOW()
         WHERE id = ?`,
        [
          req.file.originalname,
          fileUrl,
          uploadResult.key,
          uploadResult.bucket,
          req.file.size,
          req.file.mimetype,
          existing[0].id
        ]
      );

      console.log('✅ Document updated successfully');
    } else {
      // Insert new record
      await executeQuery(
        `INSERT INTO student_documents 
         (user_id, document_type, file_name, file_path, s3_key, s3_bucket, 
          file_size, mime_type, upload_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NOW())`,
        [
          userId,
          document_type,
          req.file.originalname,
          fileUrl,
          uploadResult.key,
          uploadResult.bucket,
          req.file.size,
          req.file.mimetype
        ]
      );

      console.log('✅ Document uploaded successfully');
    }

    // Get the document ID
    const documentId = existing && existing.length > 0 ? existing[0].id : null;
    
    // If new insert, get the last inserted ID
    let finalDocumentId = documentId;
    if (!documentId) {
      const result = await executeQuery(
        'SELECT id FROM student_documents WHERE user_id = ? AND document_type = ? ORDER BY uploaded_at DESC LIMIT 1',
        [userId, document_type]
      );
      finalDocumentId = result[0]?.id;
    }

    res.json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: {
        document: {
          id: finalDocumentId,
          document_type,
          s3_key: uploadResult.key,
          file_name: req.file.originalname,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
          status: 'uploaded'
        }
      }
    });

  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to upload document'
    });
  }
});

// GET /api/student-documents - Get all documents for current user
router.get('/', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const documents = await executeQuery(
      `SELECT id, document_type, file_name, file_size, mime_type, 
              upload_status, verification_notes, uploaded_at, verified_at
       FROM student_documents 
       WHERE user_id = ?
       ORDER BY uploaded_at DESC`,
      [userId]
    );

    res.json({
      status: 'success',
      data: {
        documents: documents || [],
        count: documents ? documents.length : 0
      }
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch documents'
    });
  }
});

// GET /api/student-documents/:id/url - Get presigned URL for document
router.get('/:id/url', requireAuth, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const documentId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Get document
    const documents = await executeQuery(
      'SELECT s3_key FROM student_documents WHERE id = ? AND user_id = ?',
      [documentId, userId]
    );

    if (!documents || documents.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    // Generate presigned URL (valid for 1 hour)
    const url = await getPresignedUrl(documents[0].s3_key, 3600);

    res.json({
      status: 'success',
      data: {
        url,
        expires_in: 3600
      }
    });

  } catch (error) {
    console.error('Get document URL error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to generate document URL'
    });
  }
});

// DELETE /api/student-documents/:id - Delete document
router.delete('/:id', requireAuth, checkHoldStatus, async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const documentId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Get document
    const documents = await executeQuery(
      'SELECT s3_key FROM student_documents WHERE id = ? AND user_id = ?',
      [documentId, userId]
    );

    if (!documents || documents.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    // Delete from S3
    await deleteFromS3(documents[0].s3_key);

    // Delete from database
    await executeQuery(
      'DELETE FROM student_documents WHERE id = ? AND user_id = ?',
      [documentId, userId]
    );

    console.log('✅ Document deleted successfully');

    res.json({
      status: 'success',
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete document'
    });
  }
});

module.exports = router;

