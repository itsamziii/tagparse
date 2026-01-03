/**
 * Position information for error reporting
 */
export type Position = {
    /**
     * Column number (1-based)
     */
    column: number;
    /**
     * Line number (1-based)
     */
    line: number;
    /**
     * Character offset from start (0-based)
     */
    offset: number;
}

/**
 * Base error class for all tagparse errors
 */
export class TagParseError extends Error {
    public readonly position?: Position;

    public constructor(message: string, position?: Position) {
        const fullMessage = position
            ? `${message} at line ${position.line}, column ${position.column}`
            : message;
        super(fullMessage);
        this.name = "TagParseError";
        this.position = position;

        // Maintains proper stack trace for where error was thrown (V8 engines)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Error thrown when strict mode validation fails
 */
export class StrictModeError extends TagParseError {
    public constructor(message: string, position?: Position) {
        super(message, position);
        this.name = "StrictModeError";
    }
}

/**
 * @deprecated Use TagParseError instead
 */
export const ParserError = TagParseError;
