import type { Awaitable, TagHandler } from "../../types.js";
import {
    defineStructuralTag,
    type StructuralTagHandler,
} from "../compiler/Render.js";

/**
 * Truthiness rules for tag arguments.
 * Empty string, "0", "false", "null", "undefined", "no" are falsy. Anything else is truthy.
 */
export function isTruthy(value: string): boolean {
    if (value.length === 0) return false;
    const lower = value.trim().toLowerCase();
    return (
        lower !== "0" &&
        lower !== "false" &&
        lower !== "null" &&
        lower !== "undefined" &&
        lower !== "no"
    );
}

/**
 * Helper for built-in tags that need to handle both sync and async render
 * callbacks. The structural API technically returns string, but in the async
 * renderer the callback returns Promise<string>. We detect a thenable at runtime.
 */
function maybeAwait<T>(
    v: Awaitable<T>,
    then: (resolved: T) => Awaitable<string>,
): Awaitable<string> {
    if (v && typeof (v as Promise<T>).then === "function") {
        return (v as Promise<T>).then(then);
    }
    return then(v as T);
}

/**
 * {if:cond|then|else}
 *   - 2 args: if cond truthy, render then. Else "".
 *   - 3 args: if cond truthy, render then. Else render else.
 */
export const ifTag: StructuralTagHandler = defineStructuralTag(
    (args, _ctx, render) => {
        if (args.length < 2 || args.length > 3) return "";
        const condExpr = args[0];
        const thenExpr = args[1];
        if (!condExpr || !thenExpr) return "";
        const cond = render(condExpr) as Awaitable<string>;
        return maybeAwait(cond, (resolved) => {
            if (isTruthy(resolved))
                return render(thenExpr) as Awaitable<string>;
            return args[2] ? (render(args[2]) as Awaitable<string>) : "";
        }) as string;
    },
);

/**
 * {unless:cond|then|else} — inverse of if.
 */
export const unlessTag: StructuralTagHandler = defineStructuralTag(
    (args, _ctx, render) => {
        if (args.length < 2 || args.length > 3) return "";
        const condExpr = args[0];
        const thenExpr = args[1];
        if (!condExpr || !thenExpr) return "";
        const cond = render(condExpr) as Awaitable<string>;
        return maybeAwait(cond, (resolved) => {
            if (!isTruthy(resolved))
                return render(thenExpr) as Awaitable<string>;
            return args[2] ? (render(args[2]) as Awaitable<string>) : "";
        }) as string;
    },
);

/**
 * {each:list|template|separator?}
 *
 * list: comma-separated string — items cannot contain commas (no escape mechanism).
 * The template re-renders for each item with locals:
 *   {it} = item, {idx} = 0-based index, {idx1} = 1-based, {first}, {last}.
 */
export const eachTag: StructuralTagHandler = defineStructuralTag(
    (args, _ctx, render) => {
        if (args.length < 2 || args.length > 3) return "";
        const listExpr = args[0];
        const itemExpr = args[1];
        if (!listExpr || !itemExpr) return "";

        const renderList = render(listExpr) as Awaitable<string>;

        return maybeAwait(renderList, (list) => {
            const items =
                list.length === 0 ? [] : list.split(",").map((s) => s.trim());
            if (items.length === 0) return "";

            const renderSep = args[2]
                ? (render(args[2]) as Awaitable<string>)
                : "";

            return maybeAwait(renderSep, (sep) => {
                const out: Awaitable<string>[] = [];
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item === undefined) continue;
                    out.push(
                        render(itemExpr, {
                            it: item,
                            idx: i,
                            idx1: i + 1,
                            first: i === 0,
                            last: i === items.length - 1,
                        }) as Awaitable<string>,
                    );
                }
                // If any pieces are promises, await all.
                if (
                    out.some(
                        (p) =>
                            p &&
                            typeof (p as Promise<string>).then === "function",
                    )
                ) {
                    return Promise.all(out).then((parts) => parts.join(sep));
                }
                return (out as string[]).join(sep);
            });
        }) as string;
    },
);

/**
 * {eq:a|b} — "true" if equal, "" otherwise (so it composes with {if}).
 */
export const eqTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    return args[0] === args[1] ? "true" : "";
};

/**
 * {ne:a|b} — inverse of eq.
 */
export const neTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    return args[0] !== args[1] ? "true" : "";
};

/**
 * {gt:a|b} — numeric comparison. "" if either non-numeric.
 */
export const gtTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    const a = Number(args[0]);
    const b = Number(args[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
    return a > b ? "true" : "";
};

export const ltTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    const a = Number(args[0]);
    const b = Number(args[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
    return a < b ? "true" : "";
};

export const gteTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    const a = Number(args[0]);
    const b = Number(args[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
    return a >= b ? "true" : "";
};

export const lteTag: TagHandler = (args) => {
    if (args.length !== 2) return "";
    const a = Number(args[0]);
    const b = Number(args[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
    return a <= b ? "true" : "";
};

/**
 * {not:value} — flip truthiness; "true" if falsy, "" otherwise.
 */
export const notTag: TagHandler = (args) =>
    args.length === 1 && !isTruthy(args[0] ?? "") ? "true" : "";

/**
 * String tags.
 */
export const upperTag: TagHandler = (args) => (args[0] ?? "").toUpperCase();
export const lowerTag: TagHandler = (args) => (args[0] ?? "").toLowerCase();
export const trimTag: TagHandler = (args) => (args[0] ?? "").trim();
export const lengthTag: TagHandler = (args) => String((args[0] ?? "").length);
export const replaceTag: TagHandler = (args) => {
    if (args.length !== 3) return args[0] ?? "";
    return (args[0] ?? "").split(args[1] ?? "").join(args[2] ?? "");
};

/**
 * {default:value|fallback} — return value if truthy, else fallback.
 */
export const defaultTag: TagHandler = (args) => {
    if (args.length !== 2) return args[0] ?? "";
    const value = args[0] ?? "";
    const fallback = args[1] ?? "";
    return isTruthy(value) ? value : fallback;
};

export const builtinTags = {
    if: ifTag,
    unless: unlessTag,
    each: eachTag,
    eq: eqTag,
    ne: neTag,
    gt: gtTag,
    lt: ltTag,
    gte: gteTag,
    lte: lteTag,
    not: notTag,
    upper: upperTag,
    lower: lowerTag,
    trim: trimTag,
    length: lengthTag,
    replace: replaceTag,
    default: defaultTag,
} as const;
