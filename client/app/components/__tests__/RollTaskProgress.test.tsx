import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RollTaskProgress } from "../RollTaskProgress";

describe("RollTaskProgress", () => {
  it("announces reading task generation", () => {
    render(<RollTaskProgress courseId="reading" />);

    expect(
      screen.getByRole("status", { name: /generating your reading task/i })
    ).toHaveTextContent("Building a fresh passage and questions");
    expect(
      screen.getByRole("progressbar", { name: /task generation in progress/i })
    ).toBeInTheDocument();
  });

  it("announces writing task generation", () => {
    render(<RollTaskProgress courseId="writing" />);

    expect(
      screen.getByRole("status", { name: /generating your writing task/i })
    ).toHaveTextContent("Choosing a fresh prompt");
  });
});
