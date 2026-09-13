/**
 * sessionQueue serializes operations within a single session.
 * Limitation: this server uses a single StdioServerTransport — no concurrent connections.
 * If multiple connections ever arise, a per-connection queue would be required.
 */

let sessionQueue: Promise<void> = Promise.resolve();

/**
 * Reset the shared operation queue state.
 * @returns {void}
 */
export function resetOperationQueue(): void {
    sessionQueue = Promise.resolve();
}

/**
 * Serialize a board operation through the shared session queue.
 * @template T The operation result type
 * @param {() => Promise<T>} op Async operation to run
 * @returns {Promise<T>} A promise resolving to the operation result
 */
export function enqueueKanbnOperation<T>(op: () => Promise<T>): Promise<T> {
    const result = sessionQueue.then(op);
    // Tail must swallow the rejection: if it were `result` itself, a failure
    // would poison every later op with a stale error. Caller still gets the
    // rejection via `result`, so the queue resets to a known-good state.
    sessionQueue = result.then(
        () => { },
        (error: unknown) => {
            console.error("[kanbn-mcp] queued operation failed; queue resumed:", error);
        }
    );
    return result;
}