import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoursesRoute from "../courses";

const mockNavigate = vi.fn();

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("CoursesRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("shows the available courses and coming-soon options", () => {
    render(<CoursesRoute />);

    expect(
      screen.getByRole("heading", { name: "Courses" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Story Reading")).toBeInTheDocument();
    expect(screen.getByText("Writing Practice")).toBeInTheDocument();
    expect(screen.getByText("Speaking Lab")).toBeInTheDocument();
    expect(screen.getByText("Word Builder")).toBeInTheDocument();
    expect(screen.getByText("Story Maker")).toBeInTheDocument();
    expect(screen.getAllByText("Coming soon")).toHaveLength(3);
  });

  it("routes each course card to its detail page", () => {
    render(<CoursesRoute />);

    const readingCard = screen.getByRole("button", { name: /story reading/i });
    const writingCard = screen.getByRole("button", { name: /writing practice/i });

    fireEvent.click(readingCard);
    expect(mockNavigate).toHaveBeenCalledWith("/courses/reading");

    fireEvent.click(writingCard);
    expect(mockNavigate).toHaveBeenCalledWith("/courses/writing");
  });
});
