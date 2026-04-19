const mongoose = require('mongoose');
const Product = require('../models/productModel');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const updateImages = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb+srv://chiragvgohil05_db_user:c6L6SblndPNz3nWx@cluster0.yn8oj8d.mongodb.net/snowera?appName=Cluster0';
        
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const newImageUrl = 'https://res.cloudinary.com/dypbwrvma/image/upload/v1775839242/menuItems/ha9jt3lpznqt2gfeg19y.jpg';

        const result = await Product.updateMany(
            {}, 
            { $set: { images: [newImageUrl] } }
        );

        console.log(`Successfully updated ${result.modifiedCount} products with the new image URL.`);
        
        process.exit();
    } catch (err) {
        console.error('Error updating product images:', err);
        process.exit(1);
    }
};

updateImages();
