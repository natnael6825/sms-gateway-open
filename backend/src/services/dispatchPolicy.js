'use strict';

// A claimed job has one minute to reach a terminal state.
const DISPATCH_TIMEOUT_MS = 60_000;

// The native sender polls every five seconds. Three missed polls remove it from
// assignment until it asks for work again, even if a UI heartbeat is present.
const DISPATCH_READY_WINDOW_MS = 15_000;

module.exports = { DISPATCH_TIMEOUT_MS, DISPATCH_READY_WINDOW_MS };
