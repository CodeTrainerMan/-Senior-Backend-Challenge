import * as fs from 'fs';
import * as path from 'path';
import type { AnalysisRequestedEvent } from '@senior-challenge/shared-types';
import { logger } from '../utils/logger';

const DEBUG_PAYLOADS_DIR = path.join(process.cwd(), 'debug-payloads');

/**
 * Capture incoming payloads when CAPTURE_MODE=true.
 */
export function capturePayload(event: AnalysisRequestedEvent): void {
    if (process.env.CAPTURE_MODE !== 'true') {
        return;
    }

    try {
        if (!fs.existsSync(DEBUG_PAYLOADS_DIR)) {
            fs.mkdirSync(DEBUG_PAYLOADS_DIR, { recursive: true });
        }

        const filename = `${event.jobId}-${Date.now()}.json`;
        const filepath = path.join(DEBUG_PAYLOADS_DIR, filename);

        fs.writeFileSync(filepath, JSON.stringify(event, null, 2));
        logger.info({ event: 'PayloadCaptured', message: '🧲 Captured payload', filename, traceId: event.traceId });
    } catch (error) {
        logger.error({ event: 'PayloadCaptureFailed', error, traceId: event.traceId });
    }
}
