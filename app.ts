/*app.ts*/
import express, { Express } from 'express';
import { trace, Span, metrics } from '@opentelemetry/api';
import { rollTheDice } from './dice';
import winston, { format} from 'winston';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
// import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import LokiTransport from 'winston-loki';
import client from 'prom-client';



export const logger = winston.createLogger({
     level: process.env.LOG_LEVEL || 'info', // Set your desired log level
  format: format.combine(
    format.timestamp(), // Adds a timestamp field
    format.json()       // Ensures output is JSON
  ),
    transports: [
        new winston.transports.Console(),
        // new OpenTelemetryTransportV3(), //this is removed because the auto-instrumentations already include it.
        new winston.transports.File({ filename: 'somefile.log' }),
        new LokiTransport({
            host: 'http://127.0.0.1:3100',
            labels: { app: 'my-app' },
        json: true,
        format: winston.format.json(),
        replaceTimestamp: true,
            onConnectionError: (err) => console.error(err),
        
         }),

    ],
});
const PORT: number = parseInt(process.env.PORT || '8080');
const app: Express = express();

client.collectDefaultMetrics();
const tracer = trace.getTracer('dice-software-server', '1.0');
const tracer_dice = trace.getTracer('dice-lib');
const meter = metrics.getMeter('dice-software-server', '1.0');

function getRandomNumber(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

// Create a custom gauge
const activeUsersGauge = new client.Gauge({
  name: 'active_users',
  help: 'Number of currently active users',
});

// Create a custom histogram for request duration
const httpRequestDurationSeconds = new client.Histogram({
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
        logger.info('finished', { ...metadata, duration: executionTime });
    });

    next();
});


// Expose metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType); // Set correct content type
  res.end(await client.register.metrics()); // Serve all registered metrics
});

app.get('/rolldice', (req, res) => {
    return tracer_dice.startActiveSpan('rolldice_endpoint', (span: Span) => {
        const histogram = meter.createHistogram('task.duration');
        const startTime = new Date().getTime();
        try {
            const rolls = req.query.rolls
                ? parseInt(req.query.rolls.toString())
                : NaN;
            if (isNaN(rolls)) {
                throw new Error(
                    "Request parameter 'rolls' is missing or not a number."
                );
            }
            span.setAttribute('rolldice', 'entrypoint_get_request');
            span.end();
            res.send(JSON.stringify(rollTheDice(rolls, 1, 6)));
            res.end();
            const endTime = new Date().getTime();
            const executionTime = endTime - startTime;

            // Record the duration of the task operation
            histogram.record(executionTime);
            return;
        } catch (e) {
            const result = (e as Error).message;
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
    logger.info(`Listening for requests on http://localhost:${PORT}`, {
        update: 'Server is running without error',
    });
});
