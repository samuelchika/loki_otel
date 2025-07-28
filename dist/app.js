"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/*app.ts*/
const express_1 = __importDefault(require("express"));
const api_1 = require("@opentelemetry/api");
const dice_1 = require("./dice");
const winston_1 = __importDefault(require("winston"));
// import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
exports.logger = winston_1.default.createLogger({
    transports: [
        new winston_1.default.transports.Console(),
        // new OpenTelemetryTransportV3(), this is removed because the auto-instrumentations already include it.
        new winston_1.default.transports.File({ filename: 'somefile.log' }),
    ],
});
const PORT = parseInt(process.env.PORT || '8080');
const app = (0, express_1.default)();
const tracer = api_1.trace.getTracer('dice-software-server', '1.0');
const tracer_dice = api_1.trace.getTracer('dice-lib');
const meter = api_1.metrics.getMeter('dice-software-server', '1.0');
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}
app.use((req, res, next) => {
    const startTime = new Date().getTime();
    res.on('finish', () => {
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
