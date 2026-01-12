const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, 'migration-photos-setup.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Photos Migration SQL:');
        console.log('---------------------------------------------------');
        console.log(sql);
        console.log('---------------------------------------------------');
        console.log('Please execute this SQL in your Supabase SQL Editor to fix the photos table schema.');

    } catch (error) {
        console.error('Error reading migration file:', error);
    }
}

runMigration();
