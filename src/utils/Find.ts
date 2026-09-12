/**
 * Returns the first element satisfying `predicate`.
 *
 * Callers look up entries they have themselves just created or derived, so a miss means an
 * inconsistent bracket or record: fail loudly instead of propagating `undefined`.
 */
export function mustFind<T>(items: T[], predicate: (item: T) => boolean, description: string) : T {
    const item = items.find(predicate);
    if (item === undefined) {
        throw new Error(`Could not find ${description}`);
    }
    return item;
}
