const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Document, User, Loan } = require('../utils/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/documents');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: userId_timestamp_originalname
    const userId = req.user?.id || 'anonymous';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${userId}_${timestamp}_${sanitizedBaseName}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, PDF, DOC, and DOCX files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Get user's documents
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { loanId, type, status } = req.query;
    
    let filter = { userId: req.user.id };
    if (loanId) filter.loanId = loanId;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const documents = Document.findAll(filter);

    // Sort by created date (newest first)
    documents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      status: 'success',
      data: documents
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch documents'
    });
  }
});

// Upload document
router.post('/upload', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    const { name, type, loanId, description } = req.body;

    if (!name || !type) {
      // Clean up uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        status: 'error',
        message: 'Document name and type are required'
      });
    }

    // Check if loan exists (if loanId provided)
    if (loanId) {
      const loan = Loan.findOne({ loanId, userId: req.user.id });
      if (!loan) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          status: 'error',
          message: 'Loan not found'
        });
      }
    }

    // Calculate file size in a readable format
    const fileSize = req.file.size;
    const fileSizeFormatted = fileSize < 1024 * 1024 
      ? `${Math.round(fileSize / 1024)} KB`
      : `${Math.round(fileSize / (1024 * 1024) * 10) / 10} MB`;

    // Create document record
    const document = Document.create({
      userId: req.user.id,
      loanId: loanId || null,
      name,
      type,
      description: description || '',
      fileName: req.file.filename,
      originalFileName: req.file.originalname,
      fileSize: fileSizeFormatted,
      fileSizeBytes: fileSize,
      mimeType: req.file.mimetype,
      uploadPath: `/uploads/documents/${req.file.filename}`,
      status: 'pending'
    });

    res.status(201).json({
      status: 'success',
      message: 'Document uploaded successfully',
      data: document
    });

  } catch (error) {
    // Clean up uploaded file in case of error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Upload document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to upload document'
    });
  }
});

// Get document by ID
router.get('/:documentId', authenticateToken, async (req, res) => {
  try {
    const document = Document.findById(req.params.documentId);
    
    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    res.json({
      status: 'success',
      data: document
    });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch document'
    });
  }
});

// Download document
router.get('/:documentId/download', authenticateToken, async (req, res) => {
  try {
    const document = Document.findById(req.params.documentId);
    
    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    const filePath = path.join(__dirname, '../uploads/documents', document.fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'File not found on server'
      });
    }

    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFileName}"`);
    res.setHeader('Content-Type', document.mimeType);
    
    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to download document'
    });
  }
});

// View document (for images and PDFs)
router.get('/:documentId/view', authenticateToken, async (req, res) => {
  try {
    const document = Document.findById(req.params.documentId);
    
    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    const filePath = path.join(__dirname, '../uploads/documents', document.fileName);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: 'error',
        message: 'File not found on server'
      });
    }

    // Set appropriate headers for viewing
    res.setHeader('Content-Type', document.mimeType);
    
    // For images, set cache headers
    if (document.mimeType.startsWith('image/')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }

    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('View document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to view document'
    });
  }
});

// Update document details
router.put('/:documentId', authenticateToken, async (req, res) => {
  try {
    const { name, type, description } = req.body;

    const document = Document.findById(req.params.documentId);
    
    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    // Only allow updates if document is not verified
    if (document.status === 'verified') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot update verified document'
      });
    }

    const updatedDocument = Document.update(req.params.documentId, {
      name: name || document.name,
      type: type || document.type,
      description: description || document.description,
      status: 'pending' // Reset status to pending if updated
    });

    res.json({
      status: 'success',
      message: 'Document updated successfully',
      data: updatedDocument
    });

  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update document'
    });
  }
});

// Delete document
router.delete('/:documentId', authenticateToken, async (req, res) => {
  try {
    const document = Document.findById(req.params.documentId);
    
    if (!document || document.userId !== req.user.id) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found'
      });
    }

    // Only allow deletion if document is not verified
    if (document.status === 'verified') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot delete verified document'
      });
    }

    // Delete physical file
    const filePath = path.join(__dirname, '../uploads/documents', document.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete document record
    Document.delete(req.params.documentId);

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

// Get document requirements for loan type
router.get('/requirements/:loanType', async (req, res) => {
  try {
    const { loanType } = req.params;
    const { employmentType = 'salaried' } = req.query;

    // Define document requirements based on loan type and employment
    const requirements = {
      personal: {
        salaried: [
          {
            name: 'PAN Card',
            type: 'identity',
            required: true,
            description: 'Permanent Account Number card for identity verification'
          },
          {
            name: 'Aadhaar Card',
            type: 'identity',
            required: true,
            description: 'Aadhaar card for address and identity verification'
          },
          {
            name: 'Salary Slips',
            type: 'income',
            required: true,
            description: 'Latest 3 months salary slips'
          },
          {
            name: 'Bank Statements',
            type: 'financial',
            required: true,
            description: '6 months bank statements'
          },
          {
            name: 'Form 16',
            type: 'income',
            required: false,
            description: 'Annual income tax certificate (optional but preferred)'
          },
          {
            name: 'Employment Letter',
            type: 'employment',
            required: false,
            description: 'Employment verification letter'
          }
        ],
        'self-employed': [
          {
            name: 'PAN Card',
            type: 'identity',
            required: true,
            description: 'Permanent Account Number card'
          },
          {
            name: 'Aadhaar Card',
            type: 'identity',
            required: true,
            description: 'Aadhaar card for verification'
          },
          {
            name: 'ITR Documents',
            type: 'income',
            required: true,
            description: 'Income Tax Returns for last 2-3 years'
          },
          {
            name: 'Bank Statements',
            type: 'financial',
            required: true,
            description: '12 months bank statements'
          },
          {
            name: 'Business Proof',
            type: 'business',
            required: true,
            description: 'Business registration/license documents'
          },
          {
            name: 'Financial Statements',
            type: 'financial',
            required: false,
            description: 'Profit & Loss, Balance Sheet (if available)'
          }
        ]
      },
      business: {
        salaried: [], // Business loans typically not for salaried
        'self-employed': [
          {
            name: 'PAN Card',
            type: 'identity',
            required: true,
            description: 'Personal PAN card'
          },
          {
            name: 'Business PAN',
            type: 'business',
            required: true,
            description: 'Business PAN card'
          },
          {
            name: 'Aadhaar Card',
            type: 'identity',
            required: true,
            description: 'Aadhaar card'
          },
          {
            name: 'Business Registration',
            type: 'business',
            required: true,
            description: 'Certificate of incorporation/registration'
          },
          {
            name: 'ITR Documents',
            type: 'income',
            required: true,
            description: 'Personal and business ITR for 3 years'
          },
          {
            name: 'Bank Statements',
            type: 'financial',
            required: true,
            description: 'Personal and business bank statements (12 months)'
          },
          {
            name: 'Financial Statements',
            type: 'financial',
            required: true,
            description: 'Audited P&L and Balance Sheet'
          },
          {
            name: 'GST Returns',
            type: 'business',
            required: true,
            description: 'GST returns for 12 months'
          },
          {
            name: 'Current Ratio',
            type: 'financial',
            required: false,
            description: 'Current assets to current liabilities ratio'
          }
        ]
      }
    };

    const loanRequirements = requirements[loanType]?.[employmentType] || [];

    res.json({
      status: 'success',
      data: {
        loanType,
        employmentType,
        requirements: loanRequirements,
        totalRequired: loanRequirements.filter(req => req.required).length,
        totalOptional: loanRequirements.filter(req => !req.required).length
      }
    });

  } catch (error) {
    console.error('Get requirements error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch document requirements'
    });
  }
});

// Check document completeness for user
router.get('/check-completeness/:loanId?', authenticateToken, async (req, res) => {
  try {
    const { loanId } = req.params;
    
    // Get user details
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get loan details if loanId provided
    let loan = null;
    if (loanId) {
      loan = Loan.findOne({ loanId, userId: req.user.id });
      if (!loan) {
        return res.status(404).json({
          status: 'error',
          message: 'Loan not found'
        });
      }
    }

    // Determine employment type and loan type
    const employmentType = user.personalInfo?.employmentType || 'salaried';
    const loanType = loan?.type || 'personal';

    // Get requirements
    const requirementsResponse = await fetch(`${req.protocol}://${req.get('host')}/api/documents/requirements/${loanType}?employmentType=${employmentType}`);
    const requirementsData = await requirementsResponse.json();
    const requirements = requirementsData.data?.requirements || [];

    // Get user's documents
    const userDocs = Document.findAll({ 
      userId: req.user.id,
      ...(loanId && { loanId })
    });

    // Check completeness
    const completenessCheck = requirements.map(req => {
      const userDoc = userDocs.find(doc => 
        doc.name.toLowerCase().includes(req.name.toLowerCase().split(' ')[0]) ||
        doc.type === req.type
      );

      return {
        ...req,
        uploaded: !!userDoc,
        status: userDoc?.status || 'not_uploaded',
        documentId: userDoc?.id || null,
        uploadDate: userDoc?.createdAt || null
      };
    });

    const requiredDocs = completenessCheck.filter(doc => doc.required);
    const uploadedRequired = requiredDocs.filter(doc => doc.uploaded);
    const verifiedRequired = requiredDocs.filter(doc => doc.status === 'verified');

    const completionPercentage = requiredDocs.length > 0 
      ? Math.round((uploadedRequired.length / requiredDocs.length) * 100)
      : 100;

    const verificationPercentage = requiredDocs.length > 0
      ? Math.round((verifiedRequired.length / requiredDocs.length) * 100)
      : 100;

    res.json({
      status: 'success',
      data: {
        loanId,
        loanType,
        employmentType,
        completenessCheck,
        summary: {
          totalRequired: requiredDocs.length,
          uploadedRequired: uploadedRequired.length,
          verifiedRequired: verifiedRequired.length,
          completionPercentage,
          verificationPercentage,
          isComplete: uploadedRequired.length === requiredDocs.length,
          isFullyVerified: verifiedRequired.length === requiredDocs.length
        },
        nextSteps: requiredDocs
          .filter(doc => !doc.uploaded)
          .map(doc => `Upload ${doc.name}`)
          .slice(0, 3) // Show only next 3 steps
      }
    });

  } catch (error) {
    console.error('Check completeness error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check document completeness'
    });
  }
});

module.exports = router;