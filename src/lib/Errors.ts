export class ParserError extends Error {
    public constructor(message: string) {
        super();
        this.message = message;
    }
}
export class StrictModeError extends Error {
    public constructor(message: string) {
        super();
        this.message = message;
    }
}
