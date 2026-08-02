// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("virtual:pwa-register", () => ({
  registerSW: () => async () => {},
}));

import CloudSyncSettings from "./CloudSyncSettings";
import { useCharacter } from "@/store/character";
import { useSync } from "@/store/sync";

/**
 * Enabling sync without a secret is a silent refusal: the server rejects every
 * request without one, so the tick does nothing. The box stayed checked anyway
 * and nothing said why, which reads as "I turned sync on and the header still
 * says it's off" — a bug from where the user sits, whatever the code thinks.
 */
describe("CloudSyncSettings — enabling without a secret", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCharacter.getState().resetToSample();
    useSync.setState({
      status: "idle",
      lastError: undefined,
      remoteUpdatedAt: null,
      dirty: false,
      remoteAhead: false,
      enabled: false,
    });
  });

  afterEach(cleanup);

  const MISSING = /falta el secreto compartido/i;

  it("says the secret is missing when the box is ticked with an empty field", async () => {
    const user = userEvent.setup();
    render(<CloudSyncSettings />);

    expect(screen.queryByText(MISSING)).toBeNull();

    await user.click(screen.getByLabelText("Activar sincronización"));

    // Checked, because that IS what the user asked for — but told plainly that
    // it hasn't taken effect.
    expect((screen.getByLabelText("Activar sincronización") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(MISSING);
  });

  it("drops the warning once the secret is typed", async () => {
    const user = userEvent.setup();
    render(<CloudSyncSettings />);

    await user.click(screen.getByLabelText("Activar sincronización"));
    await user.type(screen.getByPlaceholderText(/mismo secreto/i), "s3cret");

    expect(screen.queryByText(MISSING)).toBeNull();
    expect(useSync.getState().enabled).toBe(true);
  });

  it("stays quiet while the box is untouched", async () => {
    const user = userEvent.setup();
    render(<CloudSyncSettings />);

    // An empty secret is only a problem once you have asked for sync.
    await user.type(screen.getByPlaceholderText(/mismo secreto/i), "s3");
    await user.clear(screen.getByPlaceholderText(/mismo secreto/i));

    expect(screen.queryByText(MISSING)).toBeNull();
  });
});
