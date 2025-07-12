require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');

console.log('MONGO_URI =', process.env.MONGO_URI);

const clearDatabase = async () => {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    const collections = await mongoose.connection.db.collections();

    for (const collection of collections) {
      await collection.drop();
      console.log(`Collection ${collection.collectionName} dropped successfully`);
    }

    console.log('All collections have been dropped. Database is now empty.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
};

clearDatabase();
