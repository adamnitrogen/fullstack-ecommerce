const { AsyncLocalStorage } = require('async_hooks');

// Create a singleton instance of AsyncLocalStorage
const context = new AsyncLocalStorage();

/**
 * Get the current request context (if any)
 */
function getContext() {
    return context.getStore();
}

/**
 * Run a function within a new context
 */
function runWithContext(data, callback) {
    return context.run(data, callback);
}

module.exports = {
    context,
    getContext,
    runWithContext
};
