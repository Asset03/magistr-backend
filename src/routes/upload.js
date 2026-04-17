const express = require('express');
const router = express.Router();
const path = require('path');

const { protect } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, getFileInfo, getFileUrl } = require('../middleware/upload');

// Upload profile image
router.post('/profile-image', protect, uploadSingle('profileImage'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const fileInfo = getFileInfo(req.file);
    const fileUrl = getFileUrl(req.file.filename);

    // Update user's profile image in database
    const User = require('../models/User');
    await User.findByIdAndUpdate(
      req.user.id,
      { profileImage: fileUrl },
      { new: true }
    );

    res.json({
      success: true,
      data: {
        fileInfo,
        fileUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

// Upload publication PDF
router.post('/publication-pdf', protect, uploadSingle('pdf'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const fileInfo = getFileInfo(req.file);
    const fileUrl = getFileUrl(req.file.filename);

    res.json({
      success: true,
      data: {
        fileInfo,
        fileUrl
      }
    });
  } catch (error) {
    next(error);
  }
});

// Upload multiple files (documents, images, etc.)
router.post('/documents', protect, uploadMultiple('documents', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const filesInfo = req.files.map(file => ({
      ...getFileInfo(file),
      fileUrl: getFileUrl(file.filename)
    }));

    res.json({
      success: true,
      data: {
        files: filesInfo,
        count: filesInfo.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Serve uploaded files (static)
router.get('/:filename', (req, res, next) => {
  const filename = req.params.filename;
  const uploadDir = process.env.UPLOAD_PATH || 'uploads';
  const filePath = path.join(uploadDir, filename);

  res.sendFile(filePath, (err) => {
    if (err) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
  });
});

module.exports = router;
