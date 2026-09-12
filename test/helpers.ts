/** Runs `fn` and returns whatever it threw, or `undefined` if it did not throw. */
export function thrown(fn: () => void): unknown {
    try {
        fn();
    } catch (err) {
        return err;
    }
    return undefined;
}
