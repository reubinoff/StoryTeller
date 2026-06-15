import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("renders through a body portal instead of inside the route container", () => {
    render(
      <div data-testid="route-container" className="page-fadein">
        <Modal open onClose={() => undefined} ariaLabel="Leave task">
          <h3>Leave this task?</h3>
        </Modal>
      </div>
    );

    const dialog = screen.getByRole("dialog", { name: /leave task/i });
    const routeContainer = screen.getByTestId("route-container");

    expect(dialog).toHaveTextContent("Leave this task?");
    expect(routeContainer).not.toContainElement(dialog);
    expect(document.body).toContainElement(dialog);
  });

  it("locks page scrolling and closes on Escape", () => {
    const onClose = vi.fn();
    document.body.style.overflow = "auto";

    const { unmount } = render(
      <Modal open onClose={onClose} ariaLabel="Confirm submit">
        <button type="button">Keep editing</button>
      </Modal>
    );

    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });

  it("focuses the dialog while open and restores focus when dismissed", async () => {
    const Harness = () => {
      const [open, setOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open modal
          </button>
          <Modal open={open} onClose={() => setOpen(false)} ariaLabel="Leave task">
            <button type="button" onClick={() => setOpen(false)}>
              Stay
            </button>
          </Modal>
        </>
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole("button", { name: /open modal/i });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: /leave task/i })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: /stay/i }));

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("traps tab focus inside the dialog", () => {
    render(
      <div>
        <button type="button">Outside</button>
        <Modal open onClose={() => undefined} ariaLabel="Confirm submit">
          <button type="button">Keep editing</button>
          <button type="button">Submit answer</button>
        </Modal>
      </div>
    );

    const dialog = screen.getByRole("dialog", { name: /confirm submit/i });
    const first = screen.getByRole("button", { name: /keep editing/i });
    const last = screen.getByRole("button", { name: /submit answer/i });

    expect(dialog).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(first).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(first).toHaveFocus();
  });

  it("marks background content inert while open and restores it afterward", () => {
    const { unmount } = render(
      <main data-testid="page-content">
        <button type="button">Open modal</button>
        <Modal open onClose={() => undefined} ariaLabel="Leave task">
          <button type="button">Stay</button>
        </Modal>
      </main>
    );

    const routeContainer = screen.getByTestId("page-content").parentElement as HTMLElement;

    expect(routeContainer).toHaveAttribute("aria-hidden", "true");
    expect(routeContainer).toHaveProperty("inert", true);

    unmount();

    expect(routeContainer).not.toHaveAttribute("aria-hidden");
    expect(routeContainer.inert).not.toBe(true);
  });
});
