import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

const CHAOS_FILE = path.join(process.cwd(), 'debug-payloads', 'chaos-data-samples.json');
const FAILED_DIR = path.join(process.cwd(), 'failed-records');

const chaosRecordSchema = z.object({
    id: z.string().min(1),
    age: z.number().int().nonnegative(),
    gender: z.string().min(1),
    country: z.string().min(1),
    city: z.string().min(1),
    tags: z.array(z.string()),
    engagementScore: z.number().min(0).max(1),
    email: z.string().email(),
});

type ChaosRecord = z.infer<typeof chaosRecordSchema>;

function logStructured(payload: Record<string, unknown>): void {
    process.stdout.write(JSON.stringify({ timestamp: new Date().toISOString(), ...payload }) + '\n');
}

function readChaosData(): unknown[] {
    const content = fs.readFileSync(CHAOS_FILE, 'utf-8');
    return JSON.parse(content) as unknown[];
}

function processRecord(_record: ChaosRecord): void {
    // Placeholder for real processing logic
}

async function main(): Promise<void> {
    const rawRecords = readChaosData();
    const failed: Array<{ record: unknown; issues: z.ZodIssue[] }> = [];
    let processed = 0;

    for (const record of rawRecords) {
        const parsed = chaosRecordSchema.safeParse(record);
        if (!parsed.success) {
            failed.push({ record, issues: parsed.error.issues });
            for (const issue of parsed.error.issues) {
                const field = issue.path.join('.') || 'record';
                logStructured({
                    event: 'ValidationFailed',
                    recordId: (record as { id?: string }).id,
                    field,
                    rawValue: (record as Record<string, unknown>)[issue.path[0] as string],
                    reason: issue.message,
                });
            }
            continue;
        }

        processRecord(parsed.data);
        processed += 1;
    }

    if (!fs.existsSync(FAILED_DIR)) {
        fs.mkdirSync(FAILED_DIR, { recursive: true });
    }

    const failedFile = path.join(FAILED_DIR, `batch-${Date.now()}.json`);
    fs.writeFileSync(
        failedFile,
        JSON.stringify(
            {
                failedAt: new Date().toISOString(),
                failedCount: failed.length,
                records: failed,
            },
            null,
            2,
        ),
    );

    process.stdout.write(`✅ Processed: ${processed} records\n`);
    process.stdout.write(`⚠️ Skipped (validation failed): ${failed.length} records\n`);
    process.stdout.write(`📁 Failed records saved to: ${failedFile}\n`);
}

main().catch((error) => {
    process.stderr.write(`❌ Failed to process chaos data: ${String(error)}\n`);
    process.exit(1);
});
