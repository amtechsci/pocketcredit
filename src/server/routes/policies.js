const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { initializeDatabase, executeQuery } = require('../config/database');
const { authenticateAdmin } = require('../middleware/auth');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/policies');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'policy-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept PDFs only
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// GET /api/policies - Get all policies (public endpoint)
router.get('/', async (req, res) => {
  try {
    await initializeDatabase();
    
    const policies = await executeQuery(
      'SELECT id, policy_name, policy_slug, pdf_url, is_active, display_order, is_system_policy FROM policies WHERE is_active = 1 ORDER BY display_order ASC'
    );

    res.json({
      status: 'success',
      data: policies
    });
  } catch (error) {
    console.error('Error fetching policies:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch policies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/policies/slug/:slug - Get policy by slug (public endpoint)
router.get('/slug/:slug', async (req, res) => {
  try {
    await initializeDatabase();
    const { slug } = req.params;
    
    const policies = await executeQuery(
      'SELECT id, policy_name, policy_slug, pdf_url, pdf_filename, is_active, display_order FROM policies WHERE policy_slug = ? AND is_active = 1',
      [slug]
    );

    if (policies.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    res.json({
      status: 'success',
      data: policies[0]
    });
  } catch (error) {
    console.error('Error fetching policy by slug:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/policies/:id - Get single policy
router.get('/:id', async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    
    // Check if id is a number (ID) or string (slug) - handle slug case
    if (isNaN(parseInt(id))) {
      const policies = await executeQuery(
        'SELECT id, policy_name, policy_slug, pdf_url, pdf_filename, is_active, display_order FROM policies WHERE policy_slug = ? AND is_active = 1',
        [id]
      );

      if (policies.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Policy not found'
        });
      }

      return res.json({
        status: 'success',
        data: policies[0]
      });
    }
    
    const policies = await executeQuery(
      'SELECT * FROM policies WHERE id = ?',
      [id]
    );

    if (policies.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    res.json({
      status: 'success',
      data: policies[0]
    });
  } catch (error) {
    console.error('Error fetching policy:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/policies - Create new policy (admin only)
router.post('/', authenticateAdmin, upload.single('pdf'), async (req, res) => {
  try {
    await initializeDatabase();
    const { policy_name, policy_slug, display_order, is_active } = req.body;
    const adminId = req.adminId;

    if (!policy_name || !policy_slug) {
      return res.status(400).json({
        status: 'error',
        message: 'Policy name and slug are required'
      });
    }

    // Check if slug already exists
    const existing = await executeQuery(
      'SELECT id FROM policies WHERE policy_slug = ?',
      [policy_slug]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: 'A policy with this slug already exists'
      });
    }

    let pdf_url = null;
    let pdf_filename = null;

    if (req.file) {
      pdf_filename = req.file.filename;
      pdf_url = `/uploads/policies/${pdf_filename}`;
    }

    const result = await executeQuery(
      `INSERT INTO policies (policy_name, policy_slug, pdf_url, pdf_filename, display_order, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        policy_name,
        policy_slug,
        pdf_url,
        pdf_filename,
        display_order || 0,
        is_active !== undefined ? is_active : 1,
        adminId
      ]
    );

    const newPolicy = await executeQuery(
      'SELECT * FROM policies WHERE id = ?',
      [result.insertId]
    );

    res.json({
      status: 'success',
      message: 'Policy created successfully',
      data: newPolicy[0]
    });
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/policies/:id - Update policy (admin only)
router.put('/:id', authenticateAdmin, upload.single('pdf'), async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;
    const { policy_name, policy_slug, display_order, is_active } = req.body;

    // Check if policy exists
    const existing = await executeQuery(
      'SELECT * FROM policies WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    const currentPolicy = existing[0];
    let pdf_url = currentPolicy.pdf_url;
    let pdf_filename = currentPolicy.pdf_filename;

    // Handle new PDF upload
    if (req.file) {
      // Delete old PDF file if exists
      if (currentPolicy.pdf_filename) {
        const oldFilePath = path.join(__dirname, '../uploads/policies', currentPolicy.pdf_filename);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }

      pdf_filename = req.file.filename;
      pdf_url = `/uploads/policies/${pdf_filename}`;
    }

    await executeQuery(
      `UPDATE policies 
       SET policy_name = ?, policy_slug = ?, pdf_url = ?, pdf_filename = ?, display_order = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        policy_name || currentPolicy.policy_name,
        policy_slug || currentPolicy.policy_slug,
        pdf_url,
        pdf_filename,
        display_order !== undefined ? display_order : currentPolicy.display_order,
        is_active !== undefined ? is_active : currentPolicy.is_active,
        id
      ]
    );

    const updatedPolicy = await executeQuery(
      'SELECT * FROM policies WHERE id = ?',
      [id]
    );

    res.json({
      status: 'success',
      message: 'Policy updated successfully',
      data: updatedPolicy[0]
    });
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/policies/:id - Delete policy (admin only)
// HARD GUARD: System policies cannot be deleted
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await initializeDatabase();
    const { id } = req.params;

    // Check if policy exists
    const existing = await executeQuery(
      'SELECT * FROM policies WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Policy not found'
      });
    }

    const policy = existing[0];

    // HARD GUARD: Block deletion of system policies
    if (policy.is_system_policy === 1 || policy.is_system_policy === true) {
      return res.status(403).json({
        status: 'error',
        message: 'System policies cannot be deleted. You can only update the PDF file or toggle active status.',
        code: 'SYSTEM_POLICY_PROTECTED'
      });
    }

    // Delete PDF file if exists
    if (policy.pdf_filename) {
      const filePath = path.join(__dirname, '../uploads/policies', policy.pdf_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete from database
    await executeQuery('DELETE FROM policies WHERE id = ?', [id]);

    res.json({
      status: 'success',
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting policy:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete policy',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;

