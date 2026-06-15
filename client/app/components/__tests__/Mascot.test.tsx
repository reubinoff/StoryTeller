import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Mascot } from "../Mascot";

describe("Mascot", () => {
  it("exposes pose and mood classes for reactive guide states", () => {
    const { container } = render(
      <Mascot pose="thinking" mood="thinking" kind="ferret" size={96} />
    );

    const mascot = container.querySelector("[data-pose='thinking']");
    expect(mascot).not.toBeNull();
    expect(mascot).toHaveAttribute("data-mood", "thinking");
    expect(mascot).toHaveClass("mascot-pose-thinking");
    expect(mascot).toHaveClass("mascot-mood-thinking");
  });
});
