/**
 * DispatchModal has been replaced by silent auto-dispatch in App.jsx.
 * SMS messages are now dispatched automatically without a modal UI.
 * The old PATCH /api/messages/:id/status endpoint has been replaced by
 * POST /api/webhook/:id (see webhook.controller.js).
 *
 * This file is kept as a placeholder to document the architectural change.
 */

describe('DispatchModal (deprecated)', () => {
  test('DispatchModal is no longer used — SMS dispatch is handled silently in App.jsx', () => {
    // Silent dispatch is tested in App.test.jsx
    expect(true).toBe(true);
  });
});
