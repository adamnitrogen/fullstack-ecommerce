
require('dotenv').config();
const { bootstrapAdmin } = require('./lib/bootstrap');

async function runTest() {
    console.log("--- TEST STRAP ---");
    await bootstrapAdmin();
    console.log("--- END TEST ---");
}

runTest();
