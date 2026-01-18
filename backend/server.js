if (process.env.NEW_RELIC_ENABLED !== 'false') {
    require('newrelic');
}
const express = require('express');
// Trigger restart for bootstrap verification
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const logger = require('./utils/logger');
const pinoHttp = require('pino-http');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5001;

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5174',
            'http://127.0.0.1:3000',
            'http://localhost:4173'
            // NOTE: Add ngrok/tunnel URLs via FRONTEND_URL env var
        ];

        if (process.env.FRONTEND_URL) {
            allowedOrigins.push(...process.env.FRONTEND_URL.split(',').map(url => url.trim()));
        }

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.some(o => origin.startsWith(o))) {
            callback(null, true);
        } else {
            console.log('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-guest-id', 'X-Correlation-ID', 'X-Idempotency-Key', 'x-rtb-fingerprint-id'],
    exposedHeaders: ['x-rtb-fingerprint-id']
}));
app.use(cookieParser()); // Parse cookies
// Increase payload size limit to handle images (base64 encoded)
// Request Logging & Correlation ID
app.use(pinoHttp({
    logger,

    // Constraint: Correlation ID
    // Automatically capture from headers or generate if missing.
    // This ID attaches to every log in the request scope.
    genReqId: function (req) {
        return req.headers['x-correlation-id'] || req.headers['x-request-id'] || require('crypto').randomUUID();
    },

    // Constraint: Conciseness
    // Only log essential metadata. No full headers. No full body.
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            url: req.url,
            // query: req.query, // Optional: exclude if sensitive
            // params: req.params,
            ip: req.remoteAddress,
            userAgent: req.headers['user-agent'], // Only specific header allowed
            userId: req.user?.id || req.headers['x-user-id'], // Capture User ID if available
            idempotencyKey: req.headers['x-idempotency-key'] // Capture Idempotency Key if present
        }),
        res: (res) => ({
            statusCode: res.statusCode
            // Duration is added automatically by pino-http
        }),
        err: require('pino').stdSerializers.err // Standard error serializer
    },

    // Quiet down health checks and static assets if needed
    autoLogging: {
        ignore: (req) => req.url === '/api/health'
    },

    customSuccessMessage: function (req, res) {
        if (res.statusCode === 404) return `${req.method} ${req.url} - Resource not found`;
        return `${req.method} ${req.url} completed with status ${res.statusCode}`;
    },

    // Use 'info' in production to capture standard request logs
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

    // Inject standard fields for the unified log structure
    customProps: function (req, res) {
        return {
            module: 'API',
            operation: 'HTTP_REQUEST'
        };
    }
}));

// Context Middleware: Propagate Trace Context to deep services
const { tracingMiddleware } = require('./middleware/tracing.middleware');
const newrelic = require('newrelic');

// Apply tracing middleware - generates/extracts traceId, spanId, correlationId
app.use(tracingMiddleware);

// New Relic custom attributes for searchability
app.use((req, res, next) => {
    newrelic.addCustomAttribute('traceId', req.traceId);
    newrelic.addCustomAttribute('spanId', req.spanId);
    newrelic.addCustomAttribute('correlationId', req.correlationId);

    // Add User ID from header if present
    const userIdHeader = req.headers['x-user-id'];
    if (userIdHeader) {
        newrelic.addCustomAttribute('userId', userIdHeader);
    }

    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const categoryRoutes = require('./routes/category.routes');
const uploadRoutes = require('./routes/upload.routes');
const eventRoutes = require('./routes/event.routes');
const blogRoutes = require('./routes/blog.routes');
const testimonialRoutes = require('./routes/testimonial.routes');
const galleryFolderRoutes = require('./routes/gallery-folder.routes');
const galleryRoutes = require('./routes/gallery-item.routes'); // Renamed from galleryItemRoutes
const galleryVideoRoutes = require('./routes/gallery-video.routes');
const carouselRoutes = require('./routes/carousel.routes'); // Added
const faqRoutes = require('./routes/faq.routes');
const socialMediaRoutes = require('./routes/social-media.routes');
const contactInfoRoutes = require('./routes/contact-info.routes');
const bankDetailsRoutes = require('./routes/bank-details.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const managerRoutes = require('./routes/manager.routes');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/gallery-items', galleryRoutes); // Updated path and variable name
app.use('/api/gallery-folders', galleryFolderRoutes); // Updated path
app.use('/api/gallery-videos', galleryVideoRoutes); // Updated path
app.use('/api/carousel-slides', carouselRoutes); // Added
app.use('/api/faqs', faqRoutes);
app.use('/api/social-media', socialMediaRoutes);
app.use('/api/contact-info', contactInfoRoutes);
app.use('/api/bank-details', bankDetailsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/contact', require('./routes/contact.routes'));
app.use('/api/admin/events', require('./routes/admin-event.routes'));
app.use('/api/admin/alerts', require('./routes/admin-alert.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/comments', require('./routes/comments.routes'));
app.use('/api/blog-comments', require('./routes/blog-comment.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/profile', require('./routes/profile.routes'));
app.use('/api/addresses', require('./routes/address.routes'));
app.use('/api/about', require('./routes/about.routes'));
app.use('/api/coupons', require('./routes/coupon.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/checkout', require('./routes/checkout.routes'));
app.use('/api/admin/notifications', require('./routes/admin-notification.routes'));
app.use('/api/geo', require('./routes/geo.routes'));  // Proxy for geographical APIs
app.use('/api/razorpay', require('./routes/razorpay.routes'));
app.use('/api/event-registrations', require('./routes/event-registration.routes'));
app.use('/api/donations', require('./routes/donation.routes')); // Added Donation Routes
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/returns', require('./routes/return.routes'));
app.use('/api/email', require('./routes/email.routes'));
app.use('/api/settings', require('./routes/settings.routes'));
app.use('/api/policies', require('./routes/policy.routes'));
app.use('/api/account/delete', require('./routes/account-deletion.routes'));
app.use('/api/admin/jobs', require('./routes/jobs.routes'));
app.use('/api', require('./routes/product-variant.routes')); // Product variants (admin + public)
app.use('/api/webhooks', require('./routes/webhook.routes')); // Payment webhooks
app.use('/api/invoices', require('./routes/invoice.routes')); // Invoice management
app.use('/api/cron', require('./routes/cron.routes')); // Background job triggers
app.use('/api/admin/delivery-configs', require('./routes/delivery-configs.routes')); // Delivery config management
app.use('/api/custom-invoices', require('./routes/custom-invoice.routes')); // Manual invoice generation

// Global Error Handler (Must be last)
app.use(require('./middleware/error.middleware'));

const { bootstrapAdmin } = require('./lib/bootstrap');
const { SupabaseLogger } = require('./services/supabase-logger');
const { initScheduler, stopScheduler } = require('./lib/scheduler');

let server;

function startServer(port, attempt = 0) {
    const maxAttempts = 10;
    const numericPort = Number(port);
    server = app.listen(numericPort, () => {
        logger.info({ module: 'Server', operation: 'START' }, `Server running on port ${numericPort}`);
    });
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (attempt >= maxAttempts) {
                logger.error('Maximum port retry attempts reached.');
                process.exit(1);
            }
            const fallbackPort = numericPort + 1;
            logger.warn(`Port ${numericPort} in use, trying port ${fallbackPort}...`);
            startServer(fallbackPort, attempt + 1);
        } else {
            logger.error({ err }, 'Server error');
        }
    });
    return server;
}

async function initializeAndStart() {
    try {
        logger.info({ module: 'Server', operation: 'INIT' }, 'Verifying database connection...');
        await SupabaseLogger.checkConnection();
        logger.info({ module: 'Server', operation: 'INIT' }, 'Database connection verified');

        await bootstrapAdmin();

        // Initialize background job scheduler
        initScheduler();

        startServer(PORT);

        // Graceful Shutdown Logic
        const shutdown = (signal) => {
            logger.info({ module: 'Server', operation: 'SHUTDOWN', context: { signal } }, `Received ${signal}. Shutting down gracefully...`);

            if (server) {
                // Stop scheduled jobs first
                stopScheduler();

                server.close(() => {
                    logger.info({ module: 'Server', operation: 'SHUTDOWN' }, 'HTTP server closed.');
                    // Close other resources if any (e.g. database pools, redis) here
                    process.exit(0);
                });

                // Force exit if closing takes too long
                setTimeout(() => {
                    logger.error({ module: 'Server', operation: 'SHUTDOWN' }, 'Could not close connections in time, forcefully shutting down');
                    process.exit(1);
                }, 10000);
            } else {
                process.exit(0);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

    } catch (error) {
        console.error('Failed to initialize server:', error);
        logger.fatal({ err: error }, 'Failed to initialize server');
        process.exit(1);
    }
}

initializeAndStart();
