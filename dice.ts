/*dice.ts*/
import { trace, Span, metrics } from '@opentelemetry/api';
import {
    SEMATTRS_CODE_FUNCTION,
    SEMATTRS_CODE_FILEPATH,
} from '@opentelemetry/semantic-conventions';

const tracer = trace.getTracer('dice-lib');
const meter = metrics.getMeter('dice-lib');
import { logger } from './app';

function rollOnce(i: number, min: number, max: number): number {
    return tracer.startActiveSpan(`rollOnce:${i}`, (span: Span) => {
        const result = Math.floor(Math.random() * (max - min + 1) + min);
        span.setAttribute('rolldice', 'db_request');
        span.setAttribute(SEMATTRS_CODE_FUNCTION, 'doWork');
        span.setAttribute(SEMATTRS_CODE_FILEPATH, __filename);
        span.end();
        return result;
    });
}

export function rollTheDice(rolls: number, min: number, max: number) {
    return tracer.startActiveSpan('rollTheDice', (parentSpan: Span) => {
        const result: number[] = [];
        for (let i = 0; i < rolls; i++) {
            result.push(rollOnce(i, min, max));
        }
        parentSpan.setAttribute('rolldice', 'controller');
        parentSpan.end();
        logger.info(`Rolled ${rolls} dice: ${result.join(', ')}`, {
            min: min,
            max: max,
        });
        return result;
    });
}
