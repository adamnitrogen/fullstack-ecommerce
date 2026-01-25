const Razorpay = require('razorpay');
require('dotenv').config();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function testInvoice() {
    try {
        console.log('Creating invoice...');
        const invoice = await razorpay.invoices.create({
            type: 'invoice',
            description: 'Test Invoice',
            customer: {
                name: 'Test User',
                email: 'test@example.com',
                contact: '9999999999'
            },
            line_items: [{
                name: 'Test Item',
                amount: 10000,
                currency: 'INR',
                quantity: 1
            }],
            currency: 'INR'
        });

        console.log('Invoice created:', JSON.stringify(invoice, null, 2));

        if (invoice.status === 'draft') {
            console.log('Issuing invoice...');
            const finalInvoice = await razorpay.invoices.issue(invoice.id);
            console.log('Final invoice:', JSON.stringify(finalInvoice, null, 2));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testInvoice();
