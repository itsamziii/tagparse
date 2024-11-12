import type { Node, TVariableParserFn } from "../../../types.js";
import { NodeType } from "../../../types.js";
import { TagParser } from "./TagParser.js";

export class VariableTagParser extends TagParser {
    private readonly parserFn: TVariableParserFn;

    public constructor(parserFn: TVariableParserFn) {
        super();
        this.parserFn = parserFn;
    }

    public async parse(raw: string): Promise<Node> {
        return {
            type: NodeType.Variable,
            raw,
            value: await this.parserFn(raw),
        };
    }
}
