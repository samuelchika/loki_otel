"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/*app.ts*/
const express_1 = __importDefault(require("express"));
const api_1 = require("@opentelemetry/api");
const dice_1 = require("./dice");
const winston_1 = __importStar(require("winston"));
// import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
const winston_loki_1 = __importDefault(require("winston-loki"));
const prom_client_1 = __importDefault(require("prom-client"));
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info', // Set your desired log level
    format: winston_1.format.combine(winston_1.format.timestamp(), // Adds a timestamp field
    winston_1.format.json() // Ensures output is JSON
    ),
    transports: [
        new winston_1.default.transports.Console(),
        // new OpenTelemetryTransportV3(), //this is removed because the auto-instrumentations already include it.
        new winston_1.default.transports.File({ filename: 'somefile.log' }),
        new winston_loki_1.default({
            host: 'http://127.0.0.1:3100',
            labels: { app: 'my-app' },
            json: true,
            format: winston_1.default.format.json(),
            replaceTimestamp: true,
            onConnectionError: (err) => console.error(err),
        }),
    ],
});
const PORT = parseInt(process.env.PORT || '8080');
const app = (0, express_1.default)();
prom_client_1.default.collectDefaultMetrics();
const tracer = api_1.trace.getTracer('dice-software-server', '1.0');
const tracer_dice = api_1.trace.getTracer('dice-lib');
const meter = api_1.metrics.getMeter('dice-software-server', '1.0');
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
const httpRequestCounter = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
});
// Create a custom gauge
const activeUsersGauge = new prom_client_1.default.Gauge({
    name: 'active_users',
    help: 'Number of currently active users',
});
// Create a custom histogram for request duration
const httpRequestDurationSeconds = new prom_client_1.default.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10], // Buckets for the histogram
});
app.use((req, res, next) => {
    const startTime = new Date().getTime();
    const end = httpRequestDurationSeconds.startTimer(); // Start timer for duration metric
    res.on('finish', () => {
        httpRequestCounter.inc({
            method: req.method,
            route: req.route ? req.route.path : req.path,
            status: res.statusCode,
        });
        // Observe the request duration
        end({
            method: req.method,
            route: req.route ? req.route.path : req.path,
            status: res.statusCode,
        });
        const metadata = {
            url: req.url,
            method: req.method,
            ip: req.ip,
            timestamp: startTime,
            userAgent: req.headers['user-agent'],
            path: req.path,
        };
        const endTime = new Date().getTime();
        const executionTime = endTime - startTime;
        exports.logger.info('finished', { ...metadata, duration: executionTime });
    });
    next();
});
// Expose metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', prom_client_1.default.register.contentType); // Set correct content type
    res.end(await prom_client_1.default.register.metrics()); // Serve all registered metrics
});
app.get('/rolldice', (req, res) => {
    return tracer_dice.startActiveSpan('rolldice_endpoint', (span) => {
        const histogram = meter.createHistogram('task.duration');
        const startTime = new Date().getTime();
        try {
            const rolls = req.query.rolls
                ? parseInt(req.query.rolls.toString())
                : NaN;
            if (isNaN(rolls)) {
                throw new Error("Request parameter 'rolls' is missing or not a number.");
            }
            span.setAttribute('rolldice', 'entrypoint_get_request');
            span.end();
            res.send(JSON.stringify((0, dice_1.rollTheDice)(rolls, 1, 6)));
            res.end();
            const endTime = new Date().getTime();
            const executionTime = endTime - startTime;
            // Record the duration of the task operation
            histogram.record(executionTime);
            return;
        }
        catch (e) {
            const result = e.message;
            res.status(400).send(result);
            const endTime = new Date().getTime();
            const executionTime = endTime - startTime;
            // Record the duration of the task operation
            histogram.record(executionTime);
            return;
        }
    });
});
app.listen(PORT, () => {
    exports.logger.info(`Listening for requests on http://localhost:${PORT}`, {
        update: 'Server is running without error',
    });
});
