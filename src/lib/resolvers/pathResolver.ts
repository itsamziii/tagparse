import type { RenderContext, VariableResolver } from "../../types.js";

/**
 * Names that are forbidden as path segments. Walking through these would
 * expose the prototype chain or constructor and let user templates read
 * arbitrary methods from `Object.prototype`.
 */
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Build a {@link VariableResolver} that walks dotted paths into a data object.
 *
 * ```ts
 * tpl.render({
 *   variables: pathResolver({ member: { proper: "Alice#1234" } }),
 * });
 * // {member.proper} → "Alice#1234"
 * ```
 *
 * Behaviour:
 *   - Splits the variable name on `.` and walks the data object segment by segment.
 *   - Array indexing works: `{items.0.name}` walks `data.items[0].name`.
 *   - Returns `undefined` (not `""`) when any segment is missing, so
 *     `onMissingVariable` can still observe the miss.
 *   - Calls zero-arg functions encountered along the path (including at the leaf),
 *     so `{ user: () => fetchUser().name }` works. Functions that take arguments
 *     are returned as-is (which then stringifies to `""` — the renderer drops
 *     non-primitive callables to avoid surprising side-effects).
 *   - Refuses to traverse `__proto__`, `prototype`, or `constructor` keys to
 *     prevent prototype-pollution-via-template attacks.
 *   - The path string is matched literally — leading/trailing whitespace counts
 *     as part of the segment name, mirroring the rest of the library.
 */
export function pathResolver<Ctx = unknown>(
    data: Record<string, unknown>,
): VariableResolver<Ctx> {
    return (name: string, _ctx: RenderContext<Ctx>) => {
        return walkPath(data, name);
    };
}

function walkPath(
    root: unknown,
    path: string,
): string | number | boolean | null | undefined {
    if (path.length === 0) return undefined;

    const segments = path.split(".");
    let current: unknown = root;

    for (const segment of segments) {
        if (FORBIDDEN_KEYS.has(segment)) return undefined;

        // Unwrap zero-arg functions encountered mid-path.
        if (
            typeof current === "function" &&
            (current as (...a: unknown[]) => unknown).length === 0
        ) {
            try {
                current = (current as () => unknown)();
            } catch {
                return undefined;
            }
        }

        if (current === null || current === undefined) return undefined;

        if (Array.isArray(current)) {
            // Array index access. Reject anything non-numeric.
            const idx = Number(segment);
            if (!Number.isInteger(idx) || idx < 0 || idx >= current.length)
                return undefined;
            current = current[idx];
            continue;
        }

        if (typeof current !== "object") {
            // We still have segments to walk but the current value is a primitive.
            return undefined;
        }

        // Use Object.hasOwn to avoid inherited keys (toString, hasOwnProperty, etc.).
        if (!Object.hasOwn(current as object, segment)) return undefined;
        current = (current as Record<string, unknown>)[segment];
    }

    // Unwrap a zero-arg function at the leaf, too.
    if (
        typeof current === "function" &&
        (current as (...a: unknown[]) => unknown).length === 0
    ) {
        try {
            current = (current as () => unknown)();
        } catch {
            return undefined;
        }
    }

    if (current === null || current === undefined) return undefined;

    const t = typeof current;
    if (t === "string" || t === "number" || t === "boolean") {
        return current as string | number | boolean;
    }
    if (t === "bigint") return (current as bigint).toString();

    // Defer object stringification to the renderer's stringify().
    return current as never;
}
