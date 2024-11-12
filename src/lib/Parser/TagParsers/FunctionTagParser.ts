import { type Node, NodeType, type ArgumentNode } from "../../../types.js";
import { TagParser } from "./TagParser.js";

export class FunctionTagParser extends TagParser {
    private readonly parserFn: (
        funcName: string,
        args: ArgumentNode[],
    ) => Promise<string>;

    public constructor(
        parserFn: (funcName: string, args: ArgumentNode[]) => Promise<string>,
    ) {
        super();
        this.parserFn = parserFn;
    }

    public async parse(name: string, args: ArgumentNode[]): Promise<Node> {
        return {
            type: NodeType.Function,
            name,
            args,
            value: await this.parserFn(name, args),
        };
    }
}
