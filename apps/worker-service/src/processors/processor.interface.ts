import type { AnalysisRequestedEvent } from '@senior-challenge/shared-types';

/**
 * Interface for message processors.
 */
export interface MessageProcessor {
    process(event: AnalysisRequestedEvent): Promise<void>;
}
