require('dotenv').config({ path: 'backend/.env' });
try {
    console.log('Loading order.service...');
    require('./services/order.service');
    console.log('Loading checkout.service...');
    require('./services/checkout.service');
    console.log('Loading history.service...');
    require('./services/history.service');
    console.log('Success!');
} catch (e) {
    console.error('Crash detected:', e);
}
