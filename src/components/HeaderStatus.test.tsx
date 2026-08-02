// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The header pulls in the service-worker store, which registers a real SW.
// Only the registration is stubbed; the rest of the store is the real thing.
vi.mock("virtual:pwa-register", () => ({
  registerSW: () => async () => {},
}));

import HeaderStatus from "./HeaderStatus";
import CloudSyncSettings from "./settings/CloudSyncSettings";
import { useCharacter } from "@/store/character";
import { useSync } from "@/store/sync";

/**
 * Turning sync on in Settings has to be visible in the header immediately.
 * The two live in different parts of the tree and talk only through
 * localStorage plus the sync store, which is exactly where "I ticked the box
 * and nothing happened" comes from.
 */
describe("HeaderStatus reacts to enabling sync in Settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // The header hides itself entirely with no active character.
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

  const OFF = "Sincronización desactivada";
  const SAVE = "Subir los cambios locales a la nube";

  it("shows sync as active after typing the secret and ticking the box", async () => {
    const user = userEvent.setup();
    render(
      <>
        <HeaderStatus />
        <CloudSyncSettings />
      </>,
    );

    expect(screen.getByLabelText(OFF)).toBeTruthy();

    await user.type(screen.getByPlaceholderText(/mismo secreto/i), "s3cret");
    await user.click(screen.getByLabelText("Activar sincronización"));

    expect(screen.queryByLabelText(OFF)).toBeNull();
    // A device that has never confirmed a sync is dirty by design, so the
    // active header offers the upload.
    expect(screen.getByLabelText(SAVE)).toBeTruthy();
  });

  it("shows sync as active when the box is ticked before the secret is typed", async () => {
    const user = userEvent.setup();
    render(
      <>
        <HeaderStatus />
        <CloudSyncSettings />
      </>,
    );

    await user.click(screen.getByLabelText("Activar sincronización"));
    await user.type(screen.getByPlaceholderText(/mismo secreto/i), "s3cret");

    expect(screen.queryByLabelText(OFF)).toBeNull();
    expect(screen.getByLabelText(SAVE)).toBeTruthy();
  });
});
