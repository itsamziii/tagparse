import type { ParseDiagnostic, Position, Span } from "../../types.js";

function formatPosition(p: Position): string {
    return `line ${p.line}, column ${p.column}`;
}

export class TagParseError extends Error {
    public readonly position?: Position;
    public readonly span?: Span;
    public readonly hint?: string;

    public constructor(
        message: string,
        options?: {
            position?: Position;
            span?: Span;
            hint?: string;
            cause?: unknown;
        },
    ) {
        const where = options?.span?.start ?? options?.position;
        const full = where
            ? `${message} (at ${formatPosition(where)})`
            : message;
        super(full, options?.cause ? { cause: options.cause } : undefined);
        this.name = "TagParseError";
        if (options?.position) this.position = options.position;
        if (options?.span) this.span = options.span;
        if (options?.hint) this.hint = options.hint;

        if (
            "captureStackTrace" in Error &&
            typeof Error.captureStackTrace === "function"
        ) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export class StrictModeError extends TagParseError {
    public constructor(
        message: string,
        options?: ConstructorParameters<typeof TagParseError>[1],
    ) {
        super(message, options);
        this.name = "StrictModeError";
    }
}

export class RenderError extends TagParseError {
    public readonly tagName?: string;

    public constructor(
        message: string,
        options?: ConstructorParameters<typeof TagParseError>[1] & {
            tagName?: string;
        },
    ) {
        super(message, options);
        this.name = "RenderError";
        if (options?.tagName) this.tagName = options.tagName;
    }
}

export class MaxDepthError extends TagParseError {
    public constructor(depth: number, span?: Span) {
        super(
            `Maximum nesting depth (${depth}) exceeded`,
            span ? { span } : undefined,
        );
        this.name = "MaxDepthError";
    }
}

/**
 * Aggregate error thrown by parse() in strict mode when diagnostics exist.
 */
export class AggregateParseError extends TagParseError {
    public readonly diagnostics: readonly ParseDiagnostic[];

    public constructor(diagnostics: readonly ParseDiagnostic[]) {
        const first = diagnostics[0];
        const opts: { span?: Span; hint?: string } | undefined = first
            ? {
                  span: first.span,
                  ...(first.hint !== undefined ? { hint: first.hint } : {}),
              }
            : undefined;
        super(first ? first.message : "Parse failed", opts);
        this.name = "AggregateParseError";
        this.diagnostics = diagnostics;
    }
}
