import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router";
import HelpRoute from "../help";

function renderHelp() {
  return render(
    <MemoryRouter initialEntries={["/help"]}>
      <HelpRoute />
    </MemoryRouter>
  );
}

describe("HelpRoute", () => {
  it("renders the public FAQ content", () => {
    renderHelp();

    expect(screen.getByRole("heading", { name: /help & faq/i })).toBeInTheDocument();
    expect(screen.getByText("How does the difficulty work?")).toBeInTheDocument();
    expect(screen.getByText('What is a "task"?')).toBeInTheDocument();
    expect(screen.getByText("How long does writing feedback take?")).toBeInTheDocument();
    expect(screen.getByText("Can I change my interests later?")).toBeInTheDocument();
  });

  it("links the brand mark back to the public landing page", () => {
    renderHelp();

    expect(screen.getByRole("link")).toHaveAttribute("href", "/");
  });
});
