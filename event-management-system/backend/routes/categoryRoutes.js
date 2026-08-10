const express = require('express');
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// @route  GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json({ categories });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Server error fetching categories.' });
  }
});

// @route  POST /api/categories
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required.' });
    }
    const exists = await Category.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });
    if (exists) {
      return res.status(409).json({ message: 'Category already exists.' });
    }
    const category = await Category.create({ name: name.trim() });
    res.status(201).json({ message: 'Category created.', category });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Server error creating category.' });
  }
});

// @route  PUT /api/categories/:id
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required.' });
    }
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });

    category.name = name.trim();
    await category.save();
    res.json({ message: 'Category updated.', category });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Server error updating category.' });
  }
});

// @route  DELETE /api/categories/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found.' });
    await category.deleteOne();
    res.json({ message: 'Category deleted.' });
  } catch (err) {
    console.error(req.method, req.originalUrl, err);
    res.status(500).json({ message: 'Server error deleting category.' });
  }
});

module.exports = router;
