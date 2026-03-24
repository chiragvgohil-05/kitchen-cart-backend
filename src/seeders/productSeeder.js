const mongoose = require('mongoose');
const Product = require('../models/productModel');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const products = [
  {
    "name": "Espresso",
    "description": "Strong and rich single shot coffee.",
    "mrp": 120,
    "sellingPrice": 100,
    "category": "69c29aad6382e1cc0612659a",
    "stock": 50,
    "images": ["/public/uploads/products/espresso.png"],
    "keyFeatures": ["Strong taste", "Quick energy"],
    "technicalSpecs": { "Size": "Small", "Serve": "Hot" }
  },
  {
    "name": "Cappuccino",
    "description": "Creamy coffee with milk foam.",
    "mrp": 180,
    "sellingPrice": 150,
    "category": "69c29aad6382e1cc0612659a",
    "stock": 40,
    "images": ["/public/uploads/products/cappuccino.png"],
    "keyFeatures": ["Foamy texture", "Rich taste"],
    "technicalSpecs": { "Size": "Medium", "Serve": "Hot" }
  },
  {
    "name": "Latte",
    "description": "Smooth coffee with milk.",
    "mrp": 200,
    "sellingPrice": 170,
    "category": "69c29aad6382e1cc0612659a",
    "stock": 40,
    "images": ["/public/uploads/products/latte.png"],
    "keyFeatures": ["Mild taste", "Creamy"],
    "technicalSpecs": { "Size": "Large", "Serve": "Hot" }
  },
  {
    "name": "Masala Tea",
    "description": "Indian spiced tea.",
    "mrp": 80,
    "sellingPrice": 60,
    "category": "69c29aad6382e1cc0612659b",
    "stock": 60,
    "images": ["/public/uploads/products/masala-tea.png"],
    "keyFeatures": ["Spicy", "Refreshing"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Green Tea",
    "description": "Healthy antioxidant tea.",
    "mrp": 100,
    "sellingPrice": 80,
    "category": "69c29aad6382e1cc0612659b",
    "stock": 50,
    "images": ["/public/uploads/products/green-tea.png"],
    "keyFeatures": ["Healthy", "Light"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Cold Coffee",
    "description": "Chilled coffee with ice cream.",
    "mrp": 220,
    "sellingPrice": 190,
    "category": "69c29aad6382e1cc0612659c",
    "stock": 30,
    "images": ["/public/uploads/products/cold-coffee.png"],
    "keyFeatures": ["Chilled", "Sweet"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "Iced Tea",
    "description": "Refreshing chilled tea.",
    "mrp": 150,
    "sellingPrice": 120,
    "category": "69c29aad6382e1cc0612659c",
    "stock": 35,
    "images": ["/public/uploads/products/iced-tea.png"],
    "keyFeatures": ["Refreshing", "Cool"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "Chocolate Milkshake",
    "description": "Thick chocolate shake.",
    "mrp": 250,
    "sellingPrice": 220,
    "category": "69c29aad6382e1cc0612659d",
    "stock": 25,
    "images": ["/public/uploads/products/choco-shake.png"],
    "keyFeatures": ["Sweet", "Creamy"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "Strawberry Smoothie",
    "description": "Fresh strawberry smoothie.",
    "mrp": 240,
    "sellingPrice": 210,
    "category": "69c29aad6382e1cc0612659d",
    "stock": 25,
    "images": ["/public/uploads/products/strawberry-smoothie.png"],
    "keyFeatures": ["Fruity", "Healthy"],
    "technicalSpecs": { "Serve": "Cold" }
  },
  {
    "name": "Croissant",
    "description": "Buttery flaky pastry.",
    "mrp": 120,
    "sellingPrice": 100,
    "category": "69c29aad6382e1cc0612659e",
    "stock": 20,
    "images": ["/public/uploads/products/croissant.png"],
    "keyFeatures": ["Fresh baked"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Blueberry Muffin",
    "description": "Soft muffin with blueberries.",
    "mrp": 150,
    "sellingPrice": 130,
    "category": "69c29aad6382e1cc0612659e",
    "stock": 20,
    "images": ["/public/uploads/products/muffin.png"],
    "keyFeatures": ["Soft", "Sweet"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Chocolate Brownie",
    "description": "Rich chocolate brownie.",
    "mrp": 180,
    "sellingPrice": 150,
    "category": "69c29aad6382e1cc0612659f",
    "stock": 30,
    "images": ["/public/uploads/products/brownie.png"],
    "keyFeatures": ["Chocolate", "Soft"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Cheesecake",
    "description": "Creamy cheesecake dessert.",
    "mrp": 300,
    "sellingPrice": 260,
    "category": "69c29aad6382e1cc0612659f",
    "stock": 15,
    "images": ["/public/uploads/products/cheesecake.png"],
    "keyFeatures": ["Creamy", "Premium"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "French Fries",
    "description": "Crispy salted fries.",
    "mrp": 120,
    "sellingPrice": 100,
    "category": "69c29aad6382e1cc061265a0",
    "stock": 50,
    "images": ["/public/uploads/products/fries.png"],
    "keyFeatures": ["Crispy"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Garlic Bread",
    "description": "Toasted garlic bread.",
    "mrp": 140,
    "sellingPrice": 120,
    "category": "69c29aad6382e1cc061265a0",
    "stock": 40,
    "images": ["/public/uploads/products/garlic-bread.png"],
    "keyFeatures": ["Buttery"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Veg Burger",
    "description": "Delicious veg burger.",
    "mrp": 180,
    "sellingPrice": 150,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 35,
    "images": ["/public/uploads/products/veg-burger.png"],
    "keyFeatures": ["Fresh", "Filling"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Paneer Burger",
    "description": "Burger with paneer patty.",
    "mrp": 220,
    "sellingPrice": 190,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 30,
    "images": ["/public/uploads/products/paneer-burger.png"],
    "keyFeatures": ["Paneer", "Protein"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Grilled Sandwich",
    "description": "Grilled veg sandwich.",
    "mrp": 160,
    "sellingPrice": 140,
    "category": "69c29aad6382e1cc061265a1",
    "stock": 30,
    "images": ["/public/uploads/products/sandwich.png"],
    "keyFeatures": ["Grilled"],
    "technicalSpecs": { "Type": "Veg" }
  },
  {
    "name": "Mocha Coffee",
    "description": "Coffee with chocolate flavor.",
    "mrp": 210,
    "sellingPrice": 180,
    "category": "69c29aad6382e1cc0612659a",
    "stock": 30,
    "images": ["/public/uploads/products/mocha.png"],
    "keyFeatures": ["Chocolate coffee"],
    "technicalSpecs": { "Serve": "Hot" }
  },
  {
    "name": "Black Coffee",
    "description": "Pure black coffee.",
    "mrp": 100,
    "sellingPrice": 80,
    "category": "69c29aad6382e1cc0612659a",
    "stock": 50,
    "images": ["/public/uploads/products/black-coffee.png"],
    "keyFeatures": ["Strong"],
    "technicalSpecs": { "Serve": "Hot" }
  }


];

const seedProducts = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB for products seeding');

        // Deleting old products
        await Product.deleteMany();
        console.log('Old products removed');

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
