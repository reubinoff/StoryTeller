import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HydrateFallback } from "../root";

describe("HydrateFallback", () => {
  it("renders a branded loading screen for initial hydration", () => {
    const { container } = render(<HydrateFallback />);

    expect(
      screen.getByRole("main", { name: /loading storyteller/i })
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("img", { name: "Storyteller" })).toHaveAttribute(
      "src",
      "/brand/logo.svg"
    );
    expect(screen.getByText("Loading Storyteller...")).toBeInTheDocument();
    expect(container.querySelector(".spinner")).toBeInTheDocument();
    expect(container.querySelector(".sr")).toHaveTextContent("The app is loading.");
    expect(container.querySelectorAll(".skeleton")).toHaveLength(3);
  });
});
