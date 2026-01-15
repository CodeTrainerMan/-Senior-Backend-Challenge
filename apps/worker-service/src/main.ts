import { QueuePoller } from './queue-poller';
import { AnalysisProcessor } from './processors/analysis.processor';

/**
 * Worker Service entry point.
 * Polls for messages and processes them.
 */
async function main(): Promise<void> {
    console.log('🚀 Starting Worker Service...');

    const processor = new AnalysisProcessor();
    const poller = new QueuePoller(processor);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        poller.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Shutting down...');
        poller.stop();
        process.exit(0);
    });

    await poller.start();
}

main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
