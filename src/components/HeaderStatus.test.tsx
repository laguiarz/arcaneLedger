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
import { useLibrary } from "@/store/library";
import { useSwUpdate } from "@/lib/swUpdate";

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

/**
 * The second staleness axis: the library holds the PUBLISHED sheet, and until
 * this existed a republished character never reached a device that had already
 * loaded it.
 */
describe("HeaderStatus offers to reload from the library", () => {
  const FICHA = /recargar/i;

  beforeEach(() => {
    window.localStorage.clear();
    useCharacter.getState().loadCharacter(
      { ...useCharacter.getState().character },
      { sourceId: "brunella", revision: "old" },
    );
    useLibrary.setState({
      availableRevision: null,
      checking: false,
      reloading: false,
      lastError: null,
    });
    useSwUpdate.setState({ needRefresh: false });
  });

  afterEach(cleanup);

  it("shows the button when the library advertises a different revision", () => {
    useLibrary.setState({ availableRevision: "new" });
    render(<HeaderStatus />);
    expect(screen.getByLabelText(FICHA)).toBeTruthy();
  });

  it("stays quiet when the revisions match", () => {
    useLibrary.setState({ availableRevision: "old" });
    render(<HeaderStatus />);
    expect(screen.queryByLabelText(FICHA)).toBeNull();
  });

  it("stays quiet while an app update is waiting", () => {
    // Reloading the sheet under the old bundle is what makes the reload look
    // broken, so the app update has to be installed first.
    useLibrary.setState({ availableRevision: "new" });
    useSwUpdate.setState({ needRefresh: true });
    render(<HeaderStatus />);
    expect(screen.queryByLabelText(FICHA)).toBeNull();
  });

  it("stays quiet for an imported character", () => {
    useCharacter.getState().loadCharacter({ ...useCharacter.getState().character });
    useLibrary.setState({ availableRevision: "new" });
    render(<HeaderStatus />);
    expect(screen.queryByLabelText(FICHA)).toBeNull();
  });

  it("calls the reload when tapped", async () => {
    const user = userEvent.setup();
    const reload = vi.fn(async () => {});
    useLibrary.setState({ availableRevision: "new", reload });
    render(<HeaderStatus />);
    await user.click(screen.getByLabelText(FICHA));
    expect(reload).toHaveBeenCalled();
  });
});
