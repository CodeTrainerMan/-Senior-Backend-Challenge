declare module 'fs' {
    const fs: {
        existsSync(path: string): boolean;
        readFileSync(path: string, encoding: string): string;
        writeFileSync(path: string, data: string): void;
        mkdirSync(path: string, options?: { recursive?: boolean }): void;
    };
    export = fs;
}

declare module 'path' {
    const path: {
        isAbsolute(path: string): boolean;
        join(...paths: string[]): string;
    };
    export = path;
}

declare const process: {
    argv: string[];
    env: Record<string, string | undefined>;
    exit(code?: number): void;
    cwd(): string;
};

declare const console: {
    log(...args: unknown[]): void;
    error(...args: unknown[]): void;
};
