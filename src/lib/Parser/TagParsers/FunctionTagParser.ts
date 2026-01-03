import { type Node, NodeType, type ArgumentNode } from "../../../types.js";
import { TagParser } from "./TagParser.js";

export class FunctionTagParser extends TagParser {
    private readonly parserFn: (
        funcName: string,
        args: ArgumentNode[],
    ) => unknown;

    public constructor(
        parserFn: (funcName: string, args: ArgumentNode[]) => unknown,
    ) {
        super();
        this.parserFn = parserFn;
    }

    public parse(name: string, args: ArgumentNode[]): Node {
        return {
            type: NodeType.Function,
            name,
            args,
            value: this.parserFn(name, args),
        };
    }
}
