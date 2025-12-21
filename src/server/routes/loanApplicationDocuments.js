/**
 * Loan Application Documents Routes
 * Handles document uploads for loan applications (bank statements, salary slips, Aadhar, PAN, etc.)
 */

const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/jwtAuth');
const { authenticateAdmin } = require('../middleware/auth');
const { executeQuery, initializeDatabase } = require('../config/database');
const { uploadLoanDocument, deleteFromS3, getPresignedUrl } = require('../services/s3Service');
const router = express.Router();

// Configure multer for memory storage (files will be uploaded to S3)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024, // 50MB default (increased from 10MB)
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

// POST /api/loan-documents/upload - Upload loan application document
router.post('/upload', requireAuth, upload.single('document'), async (req, res) => {
  try {
    await initializeDatabase();
    const userId = req.userId;
    const { loan_application_id, document_name, document_type } = req.body;

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

    if (!loan_application_id || !document_name || !document_type) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: loan_application_id, document_name, document_type'
      });
    }

    // Verify that the loan application belongs to the user
    const applications = await executeQuery(
      'SELECT id, user_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [loan_application_id, userId]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Loan application not found or access denied'
      });
    }

    console.log(`📤 Uploading ${document_type} (${document_name}) for loan application ${loan_application_id}`);

    // Upload to S3
    const uploadResult = await uploadLoanDocument(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId,
      loan_application_id
    );

    // Construct the S3 URL
    const fileUrl = uploadResult.url || `https://${uploadResult.bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadResult.key}`;

    console.log('✅ Upload Result:', {
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      size: uploadResult.size
    });

    // Check if document already exists for this type and application
    const existing = await executeQuery(
      'SELECT id, s3_key FROM loan_application_documents WHERE loan_application_id = ? AND document_type = ?',
      [loan_application_id, document_type]
    );

    if (existing && existing.length > 0) {
      // Delete old file from S3
      try {
        if (existing[0].s3_key) {
          await deleteFromS3(existing[0].s3_key);
          console.log('🗑️  Deleted old document from S3');
        }
      } catch (deleteError) {
        console.error('Error deleting old document:', deleteError);
        // Continue anyway
      }

      // Update existing record
      await executeQuery(
        `UPDATE loan_application_documents 
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
        `INSERT INTO loan_application_documents 
         (loan_application_id, user_id, document_name, document_type, file_name, file_path, 
          s3_key, s3_bucket, file_size, mime_type, upload_status, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', NOW())`,
        [
          loan_application_id,
          userId,
          document_name,
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
        'SELECT id FROM loan_application_documents WHERE loan_application_id = ? AND document_type = ? ORDER BY uploaded_at DESC LIMIT 1',
        [loan_application_id, document_type]
      );
      finalDocumentId = result[0]?.id;
    }

    console.log(`✅ Document saved: ID=${finalDocumentId}, name=${document_name}, type=${document_type}, loan_app_id=${loan_application_id}`);

    res.json({
      status: 'success',
      success: true,
      message: 'Document uploaded successfully',
      data: {
        document: {
          id: finalDocumentId,
          document_name,
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

// Helper function to get documents
const getDocumentsForApplication = async (applicationId, isAdmin = false, userId = null) => {
  await initializeDatabase();
  
  if (!isAdmin && userId) {
    // Verify that the loan application belongs to the user
    const applications = await executeQuery(
      'SELECT id, user_id FROM loan_applications WHERE id = ? AND user_id = ?',
      [applicationId, userId]
    );

    if (!applications || applications.length === 0) {
      throw new Error('Loan application not found or access denied');
    }
  } else if (isAdmin) {
    // Admin can access any loan application - verify it exists
    const applications = await executeQuery(
      'SELECT id, user_id FROM loan_applications WHERE id = ?',
      [applicationId]
    );

    if (!applications || applications.length === 0) {
      throw new Error('Loan application not found');
    }
  }

  // Get all documents for this application
  const documents = await executeQuery(
    `SELECT id, document_name, document_type, file_name, file_size, mime_type, 
            upload_status, uploaded_at, verified_at, verification_notes
     FROM loan_application_documents 
     WHERE loan_application_id = ? 
     ORDER BY uploaded_at DESC`,
    [applicationId]
  );

  console.log(`📄 Found ${documents?.length || 0} documents for loan application ${applicationId}`);
  
  return documents || [];
};

// GET /api/loan-documents/:applicationId - Get all documents for a loan application (user)
router.get('/:applicationId', requireAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    const documents = await getDocumentsForApplication(applicationId, false, userId);

    res.json({
      status: 'success',
      success: true,
      data: {
        documents: documents
      }
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(404).json({
      status: 'error',
      message: error.message || 'Failed to fetch documents'
    });
  }
});

// GET /api/admin/loan-documents/:applicationId - Get all documents for a loan application (admin)
// This route will be mounted at /api/admin/loan-documents in server.js
router.get('/:applicationId', authenticateAdmin, async (req, res) => {
  try {
    const { applicationId } = req.params;

    const documents = await getDocumentsForApplication(applicationId, true);

    res.json({
      status: 'success',
      success: true,
      data: {
        documents: documents
      }
    });

  } catch (error) {
    console.error('Get documents error (admin):', error);
    res.status(404).json({
      status: 'error',
      message: error.message || 'Failed to fetch documents'
    });
  }
});

// GET /api/loan-documents/:id/url - Get presigned URL for document
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

    // Get document and verify ownership
    const documents = await executeQuery(
      'SELECT s3_key, user_id FROM loan_application_documents WHERE id = ? AND user_id = ?',
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

// DELETE /api/loan-documents/:id - Delete document
router.delete('/:id', requireAuth, async (req, res) => {
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

    // Get document and verify ownership
    const documents = await executeQuery(
      'SELECT s3_key, user_id FROM loan_application_documents WHERE id = ? AND user_id = ?',
      [documentId, userId]
    );

    if (!documents || documents.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    // Delete from S3
    try {
      if (documents[0].s3_key) {
        await deleteFromS3(documents[0].s3_key);
        console.log('🗑️  Deleted document from S3');
      }
    } catch (deleteError) {
      console.error('Error deleting document from S3:', deleteError);
      // Continue to delete from database anyway
    }

    // Delete from database
    await executeQuery(
      'DELETE FROM loan_application_documents WHERE id = ?',
      [documentId]
    );

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

