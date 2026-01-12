const { requestLock } = require('../middleware/requestLock.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const logger = require('../utils/logger');

// Mock Logger to cleaner output
logger.debug = () => { };
logger.info = console.log;
logger.warn = console.log;
logger.error = console.error;

async function run() {
    console.log('--- Testing Request Lock (Async Store) ---');
    const lockMw = requestLock('test-op');

    // Mock Req 1
    const req1 = {
        headers: { 'x-correlation-id': 'req-1' },
        user: { id: 'user-1' },
        _finish: []
    };
    const res1 = {
        on: (evt, cb) => { if (evt === 'finish') req1._finish.push(cb); },
        status: () => ({ json: () => { } }),
        statusCode: 200
    };

    // Run Req 1
    let executed1 = false;
    await lockMw(req1, res1, () => { executed1 = true; console.log('Req 1: Executed (Lock Acquired)'); });

    // Mock Req 2 (Same User)
    const req2 = {
        headers: { 'x-correlation-id': 'req-2' },
        user: { id: 'user-1' }
    };
    const res2 = {
        status: (code) => {
            console.log(`Req 2: Status ${code} (Expected 409)`);
            return { json: (d) => console.log('Req 2: Blocked Message:', d.code) };
        }
    };

    // Run Req 2 (Expect Block)
    await lockMw(req2, res2, () => { console.log('ERROR: Req 2 executed!'); });

    // Release Req 1
    console.log('Releasing Lock 1...');
    for (const cb of req1._finish) await cb();

    // Run Req 2 Again (Expect Success)
    const res3 = {
        on: () => { },
        status: () => ({ json: () => { } })
    };
    await lockMw(req2, res3, () => { console.log('Req 2 (Retry): Executed (Lock Acquired)'); });


    console.log('\n--- Testing Idempotency (Async Store) ---');
    const idemMw = idempotency();

    const reqIdem = {
        headers: { 'x-idempotency-key': 'key-1' },
        user: { id: 'user-1' }
    };
    const resIdem = {
        statusCode: 200,
        json: (data) => console.log('Original Response:', data),
        on: () => { }
    };

    // 1. First Pass
    console.log('Idempotency: Pass 1');
    await idemMw(reqIdem, resIdem, () => {
        // Simulate sending response
        resIdem.json({ success: true, count: 1 });
    });

    // 2. Second Pass (Retry)
    console.log('Idempotency: Pass 2 (Retry)');
    const resIdem2 = {
        status: (code) => ({
            json: (data) => console.log(`Cached Response: Status ${code}`, data)
        })
    };
    await idemMw(reqIdem, resIdem2, () => console.log('ERROR: Should use cache!'));
}

run();
