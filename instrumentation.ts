// /*instrumentation.ts*/
// import { NodeSDK } from '@opentelemetry/sdk-node';
// import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
// import {
//     PeriodicExportingMetricReader,
//     ConsoleMetricExporter,
// } from '@opentelemetry/sdk-metrics';

// const sdk = new NodeSDK({
//     traceExporter: new ConsoleSpanExporter(),
//     metricReader: new PeriodicExportingMetricReader({
//         exporter: new ConsoleMetricExporter(),
//     }),
//     instrumentations: [getNodeAutoInstrumentations()],
// });

// sdk.start();
/*instrumentation.ts*/
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter} from '@opentelemetry/sdk-trace-node';
import {
    PeriodicExportingMetricReader,
    ConsoleMetricExporter,
    
} from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import {
    BatchLogRecordProcessor,
    ConsoleLogRecordExporter,
    SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';

const otlpLogExporter = new OTLPLogExporter({
    url: 'http://localhost:4317/v1/logs',
});

// const

const sdk = new NodeSDK({
    resource: new Resource({
        [ATTR_SERVICE_NAME]: 'dice-software-node',
        [ATTR_SERVICE_VERSION]: '1.0',
    }),
    traceExporter: new ConsoleSpanExporter(),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new ConsoleMetricExporter(),
    }),
    logRecordProcessors: [
        new BatchLogRecordProcessor(new ConsoleLogRecordExporter()),
        new BatchLogRecordProcessor(otlpLogExporter),
    ],
    instrumentations: [getNodeAutoInstrumentations()], // This will automatically instrument various Node.js libraries including the WINSTON transport.
    // Because of this, you don't need to add the OpenTelemetryTransportV3 to your WINSTON transports.
    // The OpenTelemetryTransportV3 is already included in the auto-instrumentations.
});

//   traceExporter: new OTLPTraceExporter({
//     // optional - default url is http://localhost:4318/v1/traces
//     url: '<your-otlp-endpoint>/v1/traces',
//     // optional - collection of custom headers to be sent with each request, empty by default
//     headers: {},
//   }),

sdk.start();
