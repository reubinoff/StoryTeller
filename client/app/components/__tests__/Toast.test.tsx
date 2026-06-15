import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "../Toast";

describe("ToastProvider", () => {
  it("renders toast actions as keyboard-activatable buttons", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    const Harness = () => {
      const { push } = useToast();
      return (
        <button
          type="button"
          onClick={() =>
            push({
              title: "Your writing task is ready!",
              action: "View result",
              onAction,
            })
          }
        >
          Push toast
        </button>
      );
    };

    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    );

    await user.click(screen.getByRole("button", { name: /push toast/i }));
    const cta = screen.getByRole("button", { name: /view result/i });
    cta.focus();
    await user.keyboard("{Enter}");

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
