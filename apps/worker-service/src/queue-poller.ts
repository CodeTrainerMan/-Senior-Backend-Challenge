import * as fs from 'fs';
import * as path from 'path';
import type { AnalysisRequestedEvent } from '@senior-challenge/shared-types';
import type { MessageProcessor } from './processors/processor.interface';
import { capturePayload } from './middleware/capture.middleware';
import { logger } from './utils/logger';

const QUEUE_DIR = path.resolve(process.cwd(), '..', '..', 'local-queue');
const POLL_INTERVAL_MS = 1000;

/**
 * Queue Poller - simulates SQS polling for local development.
 * In production, this would use AWS SQS SDK.
 */
export class QueuePoller {
    private isRunning = false;

    constructor(private readonly processor: MessageProcessor) { }

    /**
     * Starts the polling loop.
     */
    async start(): Promise<void> {
        logger.info({ event: 'QueuePollerStarted', message: '📡 Queue poller started', queueDir: QUEUE_DIR });
        logger.info({ event: 'QueueDir', message: '🩺 Queue dir (consumer)', queueDir: QUEUE_DIR });

        // Ensure queue directory exists
        if (!fs.existsSync(QUEUE_DIR)) {
            fs.mkdirSync(QUEUE_DIR, { recursive: true });
        }

        this.isRunning = true;
        await this.pollLoop();
    }

    /**
     * Stops the polling loop.
     */
    stop(): void {
        this.isRunning = false;
    }

    /**
     * Main polling loop.
     */
    private async pollLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                const files = fs.readdirSync(QUEUE_DIR).filter((f) => f.endsWith('.json'));

                for (const file of files) {
                    const filepath = path.join(QUEUE_DIR, file);

                    try {
                        const content = fs.readFileSync(filepath, 'utf-8');
                        const event: AnalysisRequestedEvent = JSON.parse(content);

                        logger.info({ event: 'MessageReceived', jobId: event.jobId, traceId: event.traceId });

                        capturePayload(event);
                        await this.processor.process(event);

                        // Delete file after successful processing
                        fs.unlinkSync(filepath);
                        logger.info({ event: 'MessageProcessed', jobId: event.jobId, filename: file });
                    } catch (error) {
                        logger.error({ event: 'MessageProcessingFailed', error });
                        // Move to failed? For now, just skip
                    }
                }
            } catch (error) {
                logger.error({ event: 'PollLoopError', error });
            }

            await this.sleep(POLL_INTERVAL_MS);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
