const mongoose = require('mongoose');
const Table = require('../models/tableModel');
const dotenv = require('dotenv');
const path = require('path');

// Load env from one level up (backend root)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const tables = [
  {
    "tableNumber": "T1",
    "capacity": 2,
    "status": "Available",
    "location": "Indoor"
  },
  {
    "tableNumber": "T2",
    "capacity": 4,
    "status": "Available",
    "location": "Indoor"
  },
  {
    "tableNumber": "T3",
    "capacity": 2,
    "status": "Reserved",
    "location": "Indoor"
  },
  {
    "tableNumber": "T4",
    "capacity": 6,
    "status": "Available",
    "location": "Outdoor"
  },
  {
    "tableNumber": "T5",
    "capacity": 4,
    "status": "Occupied",
    "location": "Indoor"
  },
  {
    "tableNumber": "T6",
    "capacity": 2,
    "status": "Available",
    "location": "Outdoor"
  },
  {
    "tableNumber": "T7",
    "capacity": 8,
    "status": "Maintenance",
    "location": "Indoor"
  },
  {
    "tableNumber": "T8",
    "capacity": 4,
    "status": "Available",
    "location": "Indoor"
  },
  {
    "tableNumber": "T9",
    "capacity": 2,
    "status": "Reserved",
    "location": "Outdoor"
  },
  {
    "tableNumber": "T10",
    "capacity": 6,
    "status": "Available",
    "location": "Indoor"
  }
];

const seedTables = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for tables seeding');

    await Table.deleteMany();
    console.log('Old tables removed');

    await Table.insertMany(tables);
    console.log('Tables seeded successfully');

    process.exit();
  } catch (err) {
    console.error('Error seeding tables:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedTables();
}

module.exports = seedTables;
