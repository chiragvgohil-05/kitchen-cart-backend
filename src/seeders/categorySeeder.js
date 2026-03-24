const mongoose = require('mongoose');
const Category = require('../models/categoryModel');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const categories = [
  {
    "_id": "69c29aad6382e1cc0612659a",
    "name": "Coffee",
    "description": "Hot and cold coffee beverages including espresso, cappuccino, latte, and mocha."
  },
  {
    "_id": "69c29aad6382e1cc0612659b",
    "name": "Tea",
    "description": "Variety of teas including masala tea, green tea, black tea, and herbal infusions."
  },
  {
    "_id": "69c29aad6382e1cc0612659c",
    "name": "Cold Beverages",
    "description": "Refreshing chilled drinks like iced tea, cold coffee, and mocktails."
  },
  {
    "_id": "69c29aad6382e1cc0612659d",
    "name": "Milkshakes & Smoothies",
    "description": "Thick milkshakes and fruit smoothies made with fresh ingredients."
  },
  {
    "_id": "69c29aad6382e1cc0612659e",
    "name": "Bakery Items",
    "description": "Freshly baked items like croissants, muffins, and breads."
  },
  {
    "_id": "69c29aad6382e1cc0612659f",
    "name": "Desserts",
    "description": "Sweet treats including cakes, brownies, and cheesecakes."
  },
  {
    "_id": "69c29aad6382e1cc061265a0",
    "name": "Fast Food / Snacks",
    "description": "Quick bites like burgers, fries, and garlic bread."
  },
  {
    "_id": "69c29aad6382e1cc061265a1",
    "name": "Sandwiches & Burgers",
    "description": "Grilled sandwiches and burgers with veg and paneer fillings."
  }
];

const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for categories seeding');

    await Category.deleteMany();
    console.log('Old categories removed');

    await Category.insertMany(categories);
    console.log('Categories seeded successfully');

    process.exit();
  } catch (err) {
    console.error('Error seeding categories:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedCategories();
}

module.exports = seedCategories;
