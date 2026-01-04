import type { TVariableParserFn, VariableNode } from "../../../types.js";
import { NodeType } from "../../../types.js";
import { TagParser } from "./TagParser.js";

export class VariableTagParser extends TagParser {
    private readonly parserFn: TVariableParserFn;

    public constructor(parserFn: TVariableParserFn) {
        super();
        this.parserFn = parserFn;
    }

    public parse(raw: string): VariableNode {
        return {
            type: NodeType.Variable,
            raw,
            value: this.parserFn(raw),
        };
    }
}
