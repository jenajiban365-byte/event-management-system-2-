const express = require('express');
const Category = require('../models/Category');
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { asyncRoute } = require('../utils/routeHelpers');

const router = express.Router();

// @route  GET /api/categories
router.get('/', asyncRoute(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ categories });
}, 'Server error fetching categories.'));

// @route  POST /api/categories
router.post('/', protect, adminOnly, asyncRoute(async (req, res) => {
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
}, 'Server error creating category.'));

// @route  PUT /api/categories/:id
router.put('/:id', protect, adminOnly, asyncRoute(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required.' });
  }
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found.' });

  category.name = name.trim();
  await category.save();
  res.json({ message: 'Category updated.', category });
}, 'Server error updating category.'));

// @route  DELETE /api/categories/:id
router.delete('/:id', protect, adminOnly, asyncRoute(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) return res.status(404).json({ message: 'Category not found.' });
  await category.deleteOne();
  res.json({ message: 'Category deleted.' });
}, 'Server error deleting category.'));

module.exports = router;
