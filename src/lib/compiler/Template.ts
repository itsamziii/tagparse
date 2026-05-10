import type {
    CompiledTemplate,
    ParseDiagnostic,
    ParserOptions,
    TemplateNode,
} from "../../types.js";
import { parse } from "../parser/Parser.js";
import { collectTagNames, collectVariableNames } from "../visitor/Visitor.js";
import { type RenderOptions, render } from "./Render.js";
import { type RenderAsyncOptions, renderAsync } from "./RenderAsync.js";

/**
 * The friendly facade most users will reach for.
 *
 *   const tpl = Template.compile("Hello {user}!");
 *   tpl.render({ data: { user: "Alice" } });
 *
 * Compile once, render many times. Each render() call is independent and
 * thread-safe (instance has no per-render mutable state).
 */
export class Template {
    public readonly compiled: CompiledTemplate;
    public readonly diagnostics: readonly ParseDiagnostic[];

    private constructor(
        compiled: CompiledTemplate,
        diagnostics: readonly ParseDiagnostic[],
    ) {
        this.compiled = compiled;
        this.diagnostics = diagnostics;
    }

    public static compile(source: string, options?: ParserOptions): Template {
        const result = parse(source, options);
        return new Template(result.template, result.diagnostics);
    }

    public render<Ctx = unknown>(options?: RenderOptions<Ctx>): string {
        return render(this.compiled, options);
    }

    public async renderAsync<Ctx = unknown>(
        options?: RenderAsyncOptions<Ctx>,
    ): Promise<string> {
        return renderAsync(this.compiled, options);
    }

    /** Set of variable names referenced anywhere in the template. */
    public get variableNames(): Set<string> {
        return collectVariableNames(this.compiled.nodes);
    }

    /** Set of tag names used in the template. */
    public get tagNames(): Set<string> {
        return collectTagNames(this.compiled.nodes);
    }

    public get nodes(): readonly TemplateNode[] {
        return this.compiled.nodes;
    }

    public get source(): string {
        return this.compiled.source;
    }

    public get hasErrors(): boolean {
        return this.diagnostics.some((d) => d.severity === "error");
    }

    public get hasWarnings(): boolean {
        return this.diagnostics.some((d) => d.severity === "warning");
    }
}
