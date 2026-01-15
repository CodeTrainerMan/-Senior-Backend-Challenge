type LogLevel = 'info' | 'warn' | 'error';

export interface LogPayload {
    event: string;
    message?: string;
    traceId?: string;
    jobId?: string;
    recordId?: string;
    field?: string;
    rawValue?: unknown;
    error?: unknown;
    [key: string]: unknown;
}

function log(level: LogLevel, payload: LogPayload): void {
    const entry = {
        level,
        timestamp: new Date().toISOString(),
        ...payload,
    };

    const line = JSON.stringify(entry);
    if (level === 'error') {
        process.stderr.write(line + '\n');
    } else {
        process.stdout.write(line + '\n');
    }
}

export const logger = {
    info: (payload: LogPayload) => log('info', payload),
    warn: (payload: LogPayload) => log('warn', payload),
    error: (payload: LogPayload) => log('error', payload),
};
