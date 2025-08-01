"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const sdk_node_1 = require("@opentelemetry/sdk-node");
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const sdk_metrics_1 = require("@opentelemetry/sdk-metrics");
const exporter_metrics_otlp_http_1 = require("@opentelemetry/exporter-metrics-otlp-http");
const resources_1 = require("@opentelemetry/resources");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const sdk_logs_1 = require("@opentelemetry/sdk-logs");
const exporter_logs_otlp_grpc_1 = require("@opentelemetry/exporter-logs-otlp-grpc");
// using this was not beneficial because there was a json parse error.
const otlpLogExporter = new exporter_logs_otlp_grpc_1.OTLPLogExporter({
    url: 'http://localhost:4317/v1/logs',
});
// const
// Define your OTLP endpoint.
const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics';
// Configure the OTLP Metric Exporter
const metricExporter = new exporter_metrics_otlp_http_1.OTLPMetricExporter({
    url: OTLP_ENDPOINT,
    headers: {},
});
const sdk = new sdk_node_1.NodeSDK({
    resource: new resources_1.Resource({
        [semantic_conventions_1.ATTR_SERVICE_NAME]: 'dice-software-node',
        [semantic_conventions_1.ATTR_SERVICE_VERSION]: '1.0',
    }),
    traceExporter: new sdk_trace_node_1.ConsoleSpanExporter(),
    metricReader: new sdk_metrics_1.PeriodicExportingMetricReader({
        exporter: new sdk_metrics_1.ConsoleMetricExporter(),
    }),
    logRecordProcessors: [
        new sdk_logs_1.BatchLogRecordProcessor(new sdk_logs_1.ConsoleLogRecordExporter()),
        new sdk_logs_1.BatchLogRecordProcessor(otlpLogExporter),
    ],
    instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()], // This will automatically instrument various Node.js libraries including the WINSTON transport.
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
