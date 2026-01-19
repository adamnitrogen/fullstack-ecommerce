require('dotenv').config();
const returnService = require('../services/return.service');
const { logStatusHistory } = require('../services/order.service');

// Mock dependencies
const mockGetReturnableItems = async (orderId, userId) => {
    return [
        {
            id: 'item-1',
            title: 'Test Product',
            remaining_quantity: 1,
            quantity: 1,
            returned_quantity: 0
        }
    ];
};

// Overwrite for testing
returnService.getReturnableItems = mockGetReturnableItems;

async function testValidation() {
    console.log('Testing Return Service Validation...');

    // Case 1: Missing Reason
    try {
        await returnService.createReturnRequest('user-1', 'order-1', [{
            orderItemId: 'item-1',
            quantity: 1,
            images: ['http://example.com/img.jpg']
        }], null);
        console.error('FAIL: Missing reason should throw error');
    } catch (e) {
        if (e.message.includes('Return reason is required')) console.log('PASS: Missing reason caught');
        else console.error('FAIL: Unexpected error for missing reason:', e.message);
    }

    // Case 2: Missing Images
    try {
        await returnService.createReturnRequest('user-1', 'order-1', [{
            orderItemId: 'item-1',
            quantity: 1,
            reason: 'Defective'
        }], null);
        console.error('FAIL: Missing images should throw error');
    } catch (e) {
        if (e.message.includes('At least 1 image is required')) console.log('PASS: Missing images caught');
        else console.error('FAIL: Unexpected error for missing images:', e.message);
    }

    // Case 3: Too Many Images
    try {
        await returnService.createReturnRequest('user-1', 'order-1', [{
            orderItemId: 'item-1',
            quantity: 1,
            reason: 'Defective',
            images: ['1', '2', '3', '4']
        }], null);
        console.error('FAIL: Too many images should throw error');
    } catch (e) {
        if (e.message.includes('Maximum 3 images allowed')) console.log('PASS: Max images caught');
        else console.error('FAIL: Unexpected error for max images:', e.message);
    }
}

testValidation();
