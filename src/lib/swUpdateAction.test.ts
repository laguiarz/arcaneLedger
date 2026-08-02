import { describe, it, expect } from "vitest";
import { updateAction } from "./swUpdateAction";

describe("updateAction", () => {
  it("hands over to the waiting worker when there is one", () => {
    expect(updateAction({ hasWaiting: true, canSkipWaiting: true })).toBe(
      "skip-waiting",
    );
  });

  it("reloads when the prompt is showing but nothing is waiting", () => {
    // The state that made the button do nothing: needRefresh true,
    // registration.waiting null, so SKIP_WAITING went to nobody.
    expect(updateAction({ hasWaiting: false, canSkipWaiting: true })).toBe(
      "reload-now",
    );
  });

  it("reloads when the register call never produced an updater", () => {
    expect(updateAction({ hasWaiting: true, canSkipWaiting: false })).toBe(
      "reload-now",
    );
  });

  it("never returns skip-waiting when both are missing", () => {
    expect(updateAction({ hasWaiting: false, canSkipWaiting: false })).toBe(
      "reload-now",
    );
  });
});
