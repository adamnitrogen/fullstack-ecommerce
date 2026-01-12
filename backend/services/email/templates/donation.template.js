/**
 * Donation Email Templates
 */
const { wrapInTemplate, APP_NAME } = require('./base.template');

/**
 * Donation receipt/thank you email (One-Time)
 */
function getDonationReceiptEmail({ donation, donorName, isAnonymous = false }) {
    const displayName = isAnonymous ? 'Generous Donor' : (donorName || 'Valued Donor');
    const firstName = displayName.split(' ')[0];

    const content = `
        <h2>Thank You for Your Donation! 🙏</h2>
        <p>Dear ${firstName},</p>
        <p>We are deeply grateful for your generous contribution to our cause. Your support makes a real difference.</p>
        
        <div class="success-box">
            <strong>Donation Details</strong><br>
            💰 Amount: ₹${(donation.amount || 0).toFixed(2)}<br>
            📅 Date: ${new Date(donation.createdAt || Date.now()).toLocaleDateString()}<br>
            🧾 Receipt ID: ${donation.id}
            ${donation.campaign ? `<br>🎯 Campaign: ${donation.campaign}` : ''}
        </div>
        
        <p>Your contribution helps us continue our mission and create positive impact in our community.</p>
        
        <div class="info-box">
            <strong>Tax Information:</strong><br>
            This receipt can be used for tax purposes. Please retain it for your records.
        </div>
        
        <p>Thank you for being part of our mission!</p>
        <p class="text-muted">With gratitude,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Thank You for Your Donation - Receipt #${donation.id}`,
        html: wrapInTemplate(content, { title: 'Donation Receipt' })
    };
}

/**
 * Subscription confirmation email (Monthly/Recurring Donations)
 */
function getSubscriptionConfirmationEmail({ subscription, donorName, isAnonymous = false }) {
    const displayName = isAnonymous ? 'Generous Donor' : (donorName || 'Valued Donor');
    const firstName = displayName.split(' ')[0];
    const amount = subscription.amount || 0;

    // Calculate next billing date (approximately 1 month from now)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    const content = `
        <h2>Welcome to Our Monthly Giving Family! 🐄💚</h2>
        <p>Dear ${firstName},</p>
        <p>Thank you for joining our community of monthly supporters! Your recurring contribution creates a lasting impact for the cows in our care.</p>
        
        <div class="success-box" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-left: 4px solid #22c55e;">
            <strong style="font-size: 18px;">🎉 Monthly Donation Activated</strong><br><br>
            💰 <strong>Monthly Amount:</strong> ₹${amount.toFixed(2)}<br>
            📅 <strong>Started:</strong> ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}<br>
            🔄 <strong>Next Contribution:</strong> ${nextBillingDate.toLocaleDateString('en-IN', { dateStyle: 'long' })}<br>
            ${subscription.donationRef ? `🧾 <strong>Reference:</strong> ${subscription.donationRef}` : ''}
        </div>
        
        <h3 style="color: #16a34a;">What Your Monthly Donation Provides:</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
                <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0;">🌾 <strong>Nutritious Fodder</strong></td>
                <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">🏥 <strong>Regular Veterinary Care</strong></td>
            </tr>
            <tr>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 0 8px;">🏠 <strong>Clean Shelter</strong></td>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 8px 0;">💚 <strong>Daily Love & Care</strong></td>
            </tr>
        </table>
        
        <div class="info-box" style="background: #fef3c7; border-left: 4px solid #f59e0b;">
            <strong>📋 Managing Your Subscription</strong><br>
            You can view, pause, or cancel your monthly donation anytime from your profile dashboard. 
            All tax receipts will be sent automatically after each monthly payment.
        </div>
        
        <p style="text-align: center; margin-top: 24px;">
            <strong style="font-size: 16px; color: #16a34a;">Together, we're making a difference every single month! 🌟</strong>
        </p>
        
        <p class="text-muted">With heartfelt gratitude,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `🐄 Welcome to Monthly Giving - Thank You, ${firstName}!`,
        html: wrapInTemplate(content, { title: 'Monthly Donation Started' })
    };
}

/**
 * Subscription cancellation email (Recurring Donation Stopped)
 */
function getSubscriptionCancellationEmail({ subscription, donorName }) {
    const firstName = donorName ? donorName.split(' ')[0] : 'Valued Donor';
    const amount = subscription.amount || 0;

    const content = `
        <h2>Monthly Giving Update</h2>
        <p>Dear ${firstName},</p>
        <p>As per your request, we have cancelled your recurring monthly donation for <strong>${APP_NAME}</strong>.</p>
        
        <div class="warning-box" style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-left: 4px solid #64748b; padding: 20px;">
            <strong style="font-size: 18px;">🛑 Recurring Donation Auto-Pay Cancelled</strong><br><br>
            💰 <strong>Monthly Amount:</strong> ₹${amount.toFixed(2)}<br>
            📅 <strong>Cancellation Date:</strong> ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}<br>
            ${subscription.donationRef ? `🧾 <strong>Reference:</strong> ${subscription.donationRef}` : ''}
        </div>
        
        <p>Your auto-pay has been stopped, and no further contributions will be processed automatically. We are deeply grateful for the support you have provided to our cows.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
                <td style="padding: 12px; background: #f9fafb; border-radius: 8px 0 0 0;">🌾 <strong>Impact Made</strong></td>
                <td style="padding: 12px; background: #f9fafb; border-radius: 0 8px 0 0;">🏥 <strong>Care Provided</strong></td>
            </tr>
            <tr>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 0 8px;">🏠 <strong>Shelter Supported</strong></td>
                <td style="padding: 12px; background: #f3f4f6; border-radius: 0 0 8px 0;">💚 <strong>Lives Touched</strong></td>
            </tr>
        </table>

        <div class="info-box" style="background: #f0f9ff; border-left: 4px solid #0ea5e9;">
            <strong>💖 Every Bit Counts</strong><br>
            While your monthly commitment has ended, you can still support us through one-time donations whenever you wish. Your kindness remains the foundation of our sanctuary.
        </div>
        
        <p style="text-align: center; margin-top: 24px;">
            <a href="${process.env.FRONTEND_URL || 'https://merigaumata.com'}/donations" class="button" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">Continue Your Support</a>
        </p>
        
        <p>If you have any questions or would like to reactivate your recurring support in the future, we are always here for you.</p>
        
        <p class="text-muted">With heartfelt gratitude,<br>The ${APP_NAME} Team</p>
    `;

    return {
        subject: `Confirmation: Your recurring donation auto-pay has been cancelled`,
        html: wrapInTemplate(content, { title: 'Recurring Donation Cancelled' })
    };
}

module.exports = {
    getDonationReceiptEmail,
    getSubscriptionConfirmationEmail,
    getSubscriptionCancellationEmail
};

