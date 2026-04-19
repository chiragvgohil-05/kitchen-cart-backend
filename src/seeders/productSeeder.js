const mongoose = require('mongoose');
const Product = require('../models/productModel');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const products = [
  {
    "name": "Peri Peri Fries",
    "description": "Crispy fries tossed in peri peri seasoning.",
    "mrp": 150,
    "sellingPrice": 130,
    "category": "69c29aad6382e1cc061265a0",
    "stock": 40,
    "images": ["/public/uploads/products/peri-peri-fries.png"],
    "keyFeatures": ["Spicy", "Crispy"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Tandoori Paneer Pizza",
    "description": "Pizza topped with spicy tandoori paneer.",
    "mrp": 320,
    "sellingPrice": 280,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 20,
    "images": ["/public/uploads/products/paneer-pizza.png"],
    "keyFeatures": ["Paneer", "Cheesy"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Margherita Pizza",
    "description": "Classic pizza with tomato and cheese.",
    "mrp": 300,
    "sellingPrice": 260,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 25,
    "images": ["/public/uploads/products/margherita-pizza.png"],
    "keyFeatures": ["Classic", "Cheesy"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Veg Pasta",
    "description": "Creamy white sauce vegetable pasta.",
    "mrp": 240,
    "sellingPrice": 210,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 30,
    "images": ["/public/uploads/products/veg-pasta.png"],
    "keyFeatures": ["Creamy", "Italian"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Pink Sauce Pasta",
    "description": "Pasta cooked in delicious pink sauce.",
    "mrp": 250,
    "sellingPrice": 220,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 30,
    "images": ["/public/uploads/products/pink-pasta.png"],
    "keyFeatures": ["Creamy", "Tangy"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Classic Lemon Soda",
    "description": "Sparkling soda with lemon flavor.",
    "mrp": 120,
    "sellingPrice": 100,
    "category": "69c29aad6382e1cc0612659c",
    "stock": 50,
    "images": ["/public/uploads/products/lemon-soda.png"],
    "keyFeatures": ["Refreshing"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "Watermelon Juice",
    "description": "Fresh watermelon juice.",
    "mrp": 140,
    "sellingPrice": 120,
    "category": "69c29aad6382e1cc0612659c",
    "stock": 40,
    "images": ["/public/uploads/products/watermelon-juice.png"],
    "keyFeatures": ["Fresh", "Hydrating"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "Butterscotch Milkshake",
    "description": "Creamy butterscotch flavored milkshake.",
    "mrp": 260,
    "sellingPrice": 230,
    "category": "69c29aad6382e1cc0612659d",
    "stock": 25,
    "images": ["/public/uploads/products/butterscotch-shake.png"],
    "keyFeatures": ["Sweet", "Creamy"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "KitKat Milkshake",
    "description": "Chocolate milkshake blended with KitKat.",
    "mrp": 270,
    "sellingPrice": 240,
    "category": "69c29aad6382e1cc0612659d",
    "stock": 25,
    "images": ["/public/uploads/products/kitkat-shake.png"],
    "keyFeatures": ["Chocolate", "Crunchy"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "Classic Veg Salad",
    "description": "Healthy salad with fresh vegetables.",
    "mrp": 180,
    "sellingPrice": 150,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 20,
    "images": ["/public/uploads/products/veg-salad.png"],
    "keyFeatures": ["Healthy", "Fresh"],
    "technicalSpecs": { "Type": "Veg" }
  }
];

const seedProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for products seeding');

    // Deleting old products
    // await Product.deleteMany();
    // console.log('Old products removed');

    await Product.insertMany(products);
    console.log('Products seeded successfully');

    process.exit();
  } catch (err) {
    console.error('Error seeding products:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedProducts();
}

module.exports = seedProducts;
