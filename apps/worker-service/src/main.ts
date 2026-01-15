import { QueuePoller } from './queue-poller';
import { AnalysisProcessor } from './processors/analysis.processor';
import { logger } from './utils/logger';

/**
 * Worker Service entry point.
 * Polls for messages and processes them.
 */
async function main(): Promise<void> {
    logger.info({ event: 'WorkerStarted', message: '🚀 Starting Worker Service...' });

    const processor = new AnalysisProcessor();
    const poller = new QueuePoller(processor);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        logger.info({ event: 'WorkerShutdown', message: '🛑 Shutting down...' });
        poller.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        logger.info({ event: 'WorkerShutdown', message: '🛑 Shutting down...' });
        poller.stop();
        process.exit(0);
    });

    await poller.start();
}

main().catch((error) => {
    logger.error({ event: 'WorkerFatalError', error });
    process.exit(1);
});
