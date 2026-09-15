import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProblemsPage from "@/app/problems/page";

describe("Problems Page", () => {
  it("renders the problems heading", () => {
    render(<ProblemsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Problems",
    );
  });

  it("renders the description", () => {
    render(<ProblemsPage />);
    expect(
      screen.getByText(/quantum computing challenges/i),
    ).toBeInTheDocument();
  });

  it("renders a search input", () => {
    render(<ProblemsPage />);
    expect(
      screen.getByRole("searchbox", { name: /search problems/i }),
    ).toBeInTheDocument();
  });

  it("renders difficulty filter buttons", () => {
    render(<ProblemsPage />);
    expect(screen.getByRole("button", { name: /beginner/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /easy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /hard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expert/i })).toBeInTheDocument();
  });
});
