import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ProblemsPage from "@/app/problems/page";

describe("Problems Page", () => {
  it("renders the problems heading", () => {
    render(<ProblemsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Problems");
  });

  it("renders problem catalog section", () => {
    render(<ProblemsPage />);
    expect(screen.getByText("Problem Catalog")).toBeInTheDocument();
  });

  it("shows coming soon state", () => {
    render(<ProblemsPage />);
    expect(screen.getByText(/No problems available yet/)).toBeInTheDocument();
  });

  it("mentions Phase 3 for problems", () => {
    render(<ProblemsPage />);
    expect(screen.getAllByText(/Phase 3/).length).toBeGreaterThan(0);
  });

  it("has filter placeholder", () => {
    render(<ProblemsPage />);
    expect(screen.getByText(/Filtering will be available/)).toBeInTheDocument();
  });
});
