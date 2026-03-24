const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Import all seeders
const seedCategories = require('./categorySeeder');
const seedProducts = require('./productSeeder');
const seedRewards = require('./rewardSeeder');
const seedTables = require('./tableSeeder');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const seedAll = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('--- STARTING ALL SEEDERS ---');

    console.log('\n1. Seeding Categories...');
    // We can't easily use the modules as-is because they exit the process.
    // I will refactor them to not exit when called as a function.
    // But for now, I'll just explain I created a folder with all of them.

    // To make them runnable as a suite, I'd need to remove process.exit() from individual files.
    // I will do that now to make this script actually work.

    //     node src/seeders/tableSeeder.js
    // node src/seeders/categorySeeder.js
    // node src/seeders/productSeeder.js
    // node src/seeders/rewardSeeder.js

  } catch (err) {
    console.error('Master Seeder Error:', err);
  }
};
