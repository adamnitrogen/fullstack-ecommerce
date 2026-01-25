const emailService = require('../services/email');
const logger = require('../utils/logger');

// Mock Data
const mockEvent = {
    id: 'evt_123',
    title: 'Test Event',
    startDate: new Date().toISOString(),
    location: 'Test Location'
};

const mockRegistration = {
    id: 'reg_123',
    registrationNumber: 'EVT-TEST-001',
    full_name: 'Test User',
    email: 'test@example.com'
};

const mockPaymentDetails = {
    amount: 1000,
    basePrice: 800,
    gstAmount: 200,
    gstRate: 18,
    transactionId: 'pay_test123',
    invoiceUrl: 'https://razorpay.com/invoice/test_link' // Explicitly providing this
};

async function testEmailTemplate() {
    try {
        console.log('Generating email template...');
        // We can't easily see the HTML output without modifying the service, 
        // but we can check if it throws or log the "Sending email" step which might contain metadata.
        // Actually, let's use the template function directly if exported, but it's not.
        // So we relies on the service to "send" (via console provider likely).

        await emailService.sendEventRegistrationEmail(
            'test@example.com',
            {
                event: mockEvent,
                registration: mockRegistration,
                attendeeName: 'Test User',
                isPaid: true,
                paymentDetails: mockPaymentDetails
            }
        );
        console.log('Email sent (check logs for ConsoleProvider output)');
    } catch (error) {
        console.error('Error:', error);
    }
}

testEmailTemplate();
