/**
 * Common i18n strings for Email Templates
 */
const { APP_NAME } = require('./base.template');

const commonStrings = {
    en: {
        dear: 'Dear',
        valuedDonor: 'Valued Donor',
        generousDonor: 'Generous Donor',
        withGratitude: 'With gratitude',
        withRegards: 'With regards',
        team: `The ${APP_NAME} Team`,
        taxInfo: 'Tax Information',
        securityNote: 'Security Note',
        allRightsReserved: 'All rights reserved.'
    },
    hi: {
        dear: 'प्रिय',
        valuedDonor: 'बहुमूल्य दाता',
        generousDonor: 'उदार दाता',
        withGratitude: 'आभार सहित',
        team: `${APP_NAME} टीम`,
        taxInfo: 'कर संबंधी जानकारी',
        securityNote: 'सुरक्षा नोट',
        allRightsReserved: 'सर्वाधिकार सुरक्षित।'
    }
};

/**
 * Get common strings for a specific language
 * @param {string} lang 
 * @returns {Object}
 */
function getCommonStrings(lang = 'en') {
    return commonStrings[lang] || commonStrings.en;
}

module.exports = {
    getCommonStrings
};
