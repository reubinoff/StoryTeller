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

    const readingCard = screen
      .getByText("Story Reading")
      .closest('[role="button"]');
    const writingCard = screen
      .getByText("Writing Practice")
      .closest('[role="button"]');

    expect(readingCard).not.toBeNull();
    expect(writingCard).not.toBeNull();

    fireEvent.click(readingCard as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith("/courses/reading");

    fireEvent.keyDown(writingCard as HTMLElement, { key: "Enter" });
    expect(mockNavigate).toHaveBeenCalledWith("/courses/writing");
  });
});
