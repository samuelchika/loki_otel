"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rollTheDice = rollTheDice;
/*dice.ts*/
const api_1 = require("@opentelemetry/api");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const tracer = api_1.trace.getTracer('dice-lib');
const meter = api_1.metrics.getMeter('dice-lib');
const app_1 = require("./app");
function rollOnce(i, min, max) {
    return tracer.startActiveSpan(`rollOnce:${i}`, (span) => {
        const result = Math.floor(Math.random() * (max - min + 1) + min);
        span.setAttribute('rolldice', 'db_request');
        span.setAttribute(semantic_conventions_1.SEMATTRS_CODE_FUNCTION, 'doWork');
        span.setAttribute(semantic_conventions_1.SEMATTRS_CODE_FILEPATH, __filename);
        span.end();
        return result;
    });
}
function rollTheDice(rolls, min, max) {
    return tracer.startActiveSpan('rollTheDice', (parentSpan) => {
        const result = [];
        for (let i = 0; i < rolls; i++) {
            result.push(rollOnce(i, min, max));
        }
        parentSpan.setAttribute('rolldice', 'controller');
        parentSpan.end();
        app_1.logger.info(`Rolled ${rolls} dice: ${result.join(', ')}`, {
            min: min,
            max: max,
        });
        return result;
    });
}
