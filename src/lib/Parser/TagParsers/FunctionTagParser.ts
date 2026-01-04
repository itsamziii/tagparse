import {
    type FunctionNode,
    NodeType,
    type ArgumentNode,
    type TFunctionParserFn,
} from "../../../types.js";
import { TagParser } from "./TagParser.js";

export class FunctionTagParser extends TagParser {
    private readonly parserFn: TFunctionParserFn;

    public constructor(parserFn: TFunctionParserFn) {
        super();
        this.parserFn = parserFn;
    }

    public parse(name: string, args: ArgumentNode[]): FunctionNode {
        return {
            type: NodeType.Function,
            name,
            args,
            value: this.parserFn(name, args),
        };
    }
}
