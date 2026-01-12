const QRCode = require('qrcode');

/**
 * Generate UPI QR Code for Indian payment systems
 * Compatible with Google Pay, PhonePe, Paytm, BHIM, etc.
 * 
 * @param {string} upiId - UPI ID (e.g., "username@bankname")
 * @param {string} accountName - Payee name
 * @param {number|null} amount - Optional fixed amount
 * @returns {Promise<string>} Base64 encoded PNG image data URL
 */
async function generateUPIQR(upiId, accountName, amount = null) {
    // UPI payment string as per NPCI specification
    let upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(accountName)}&cu=INR`;

    if (amount && amount > 0) {
        upiString += `&am=${amount}`;
    }

    try {
        // Generate QR code as Data URL (base64 PNG)
        const qrDataURL = await QRCode.toDataURL(upiString, {
            errorCorrectionLevel: 'H', // High error correction
            type: 'image/png',
            quality: 0.95,
            margin: 2,
            width: 512,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        return qrDataURL;
    } catch (error) {
        console.error('[QR Generator] Error generating UPI QR:', error);
        throw new Error('Failed to generate UPI QR code');
    }
}

/**
 * Generate Bank Account QR Code
 * Note: This creates a QR with bank details as text.
 * For true BHIM/UPI bank account QR, bank-specific API integration is needed.
 * 
 * @param {Object} bankDetails - Bank account details
 * @returns {Promise<string>} Base64 encoded PNG image data URL
 */
async function generateBankAccountQR(bankDetails) {
    const { accountNumber, ifscCode, bankName, accountName, branchName } = bankDetails;

    // Create formatted bank info text
    const bankInfo = `Bank Account Details
Name: ${accountName}
Bank: ${bankName}${branchName ? `\nBranch: ${branchName}` : ''}
Account: ${accountNumber}
IFSC: ${ifscCode}`;

    try {
        const qrDataURL = await QRCode.toDataURL(bankInfo, {
            errorCorrectionLevel: 'M',
            type: 'image/png',
            quality: 0.95,
            margin: 2,
            width: 512,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        return qrDataURL;
    } catch (error) {
        console.error('[QR Generator] Error generating bank account QR:', error);
        throw new Error('Failed to generate bank account QR code');
    }
}

/**
 * Generate QR code from any text/URL
 * 
 * @param {string} data - Data to encode in QR
 * @param {Object} options - QR generation options
 * @returns {Promise<string>} Base64 encoded PNG image data URL
 */
async function generateQRCode(data, options = {}) {
    const defaultOptions = {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.95,
        margin: 2,
        width: 512
    };

    try {
        const qrDataURL = await QRCode.toDataURL(data, {
            ...defaultOptions,
            ...options
        });

        return qrDataURL;
    } catch (error) {
        console.error('[QR Generator] Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
}

module.exports = {
    generateUPIQR,
    generateBankAccountQR,
    generateQRCode
};
