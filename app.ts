import { Timestamp } from './node_modules/@grpc/grpc-js/build/src/generated/google/protobuf/Timestamp.d';
/*app.ts*/
import express, { Express } from 'express';
import { trace, Span, metrics } from '@opentelemetry/api';
import { rollTheDice } from './dice';
import winston from 'winston';

export const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'somefile.log' }),
    ],
});
const PORT: number = parseInt(process.env.PORT || '8080');
const app: Express = express();

const tracer = trace.getTracer('dice-software-server', '1.0');
const tracer_dice = trace.getTracer('dice-lib');
const meter = metrics.getMeter('dice-software-server', '1.0');

function getRandomNumber(min: number, max: number) {
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
        logger.info('finished', { ...metadata, duration: executionTime });
    });

    next();
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
