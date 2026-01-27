const policyService = require('../services/policy.service');
const logger = require('../utils/logger');

const MESSAGES = require('../config/messages');

exports.uploadPolicy = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: MESSAGES.ERRORS.NO_FILE_UPLOADED });
        }
        const { policyType, title } = req.body;

        // Basic validation
        if (!['privacy', 'terms', 'shipping-refund'].includes(policyType)) {
            return res.status(400).json({ error: MESSAGES.ERRORS.INVALID_POLICY_TYPE });
        }

        let policyTitle = title;
        if (!policyTitle) {
            if (policyType === 'shipping-refund') {
                policyTitle = 'Shipping & Refund Policy';
            } else if (policyType === 'privacy') {
                policyTitle = 'Privacy Policy';
            } else if (policyType === 'terms') {
                policyTitle = 'Terms & Conditions';
            } else {
                policyTitle = policyType.charAt(0).toUpperCase() + policyType.slice(1).replace('-', ' ') + ' Policy';
            }
        }

        const policy = await policyService.uploadPolicy(
            req.file,
            policyType,
            policyTitle,
            req.user.id
        );

        res.status(201).json({
            message: MESSAGES.SUCCESS.POLICY_UPLOADED,
            policy: {
                policyType: policy.policy_type,
                version: policy.version,
                contentHtml: policy.content_html,
                title: policy.title,
                updatedAt: policy.updated_at
            }
        });
    } catch (error) {
        logger.error({ err: error }, 'Upload policy controller error');
        next(error);
    }
};

exports.getPublicPolicy = async (req, res, next) => {
    try {
        const { policyType } = req.params;

        if (!['privacy', 'terms', 'shipping-refund'].includes(policyType)) {
            return res.status(400).json({ error: MESSAGES.ERRORS.INVALID_POLICY_TYPE });
        }

        const policy = await policyService.getActivePolicy(policyType);

        if (!policy) {
            return res.status(404).json({ error: MESSAGES.ERRORS.POLICY_NOT_FOUND });
        }

        res.json({
            policyType: policy.policy_type,
            version: policy.version,
            contentHtml: policy.content_html,
            title: policy.title,
            updatedAt: policy.updated_at
        });
    } catch (error) {
        logger.error({ err: error }, 'Get public policy controller error');
        next(error);
    }
};

exports.getPolicyVersion = async (req, res, next) => {
    try {
        const { policyType } = req.params;

        if (!['privacy', 'terms', 'shipping-refund'].includes(policyType)) {
            return res.status(400).json({ error: MESSAGES.ERRORS.INVALID_POLICY_TYPE });
        }

        const policy = await policyService.getActivePolicy(policyType);

        if (!policy) {
            return res.status(404).json({ error: MESSAGES.ERRORS.POLICY_NOT_FOUND });
        }

        res.json({ version: policy.version });
    } catch (error) {
        logger.error({ err: error }, 'Get policy version controller error');
        next(error);
    }
};
