const logger = require('../utils/logger');
const { context } = require('../utils/async-context');

function deepServiceMethod() {
    // This logs using the global logger, but should have correlationId from context
    logger.info('Log from deep service');
}

function runTest() {
    const correlationId = 'als-test-id-' + Date.now();

    console.log('Starting ALS Test with ID:', correlationId);

    // Simulate Request Middleware
    const store = { correlationId };

    context.run(store, () => {
        // Inside the request (e.g. controller -> service -> db)
        logger.info('Log from middleware/controller');

        setTimeout(() => {
            // Even in async callback
            deepServiceMethod();
            console.log('✅ Test finished (check logs for correlationId)');
        }, 100);
    });
}

runTest();
