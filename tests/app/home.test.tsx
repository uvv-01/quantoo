import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

// Mock next/font to avoid module resolution issues in tests
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans", className: "" }),
  Geist_Mono: () => ({ variable: "font-geist-mono", className: "" }),
}));

describe("Home Page", () => {
  it("renders the main heading", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Quantum Daily");
  });

  it("renders the tagline", () => {
    render(<HomePage />);
    expect(screen.getAllByText(/Practice quantum computing like an engineer/).length).toBeGreaterThan(0);
  });

  it("renders the workflow steps", () => {
    render(<HomePage />);
    expect(screen.getByText("Learn")).toBeInTheDocument();
    expect(screen.getByText("Challenge")).toBeInTheDocument();
    expect(screen.getByText("Write")).toBeInTheDocument();
    expect(screen.getByText("Execute")).toBeInTheDocument();
  });

  it("renders feature cards with planned badges", () => {
    render(<HomePage />);
    expect(screen.getByText("Quantum Judge")).toBeInTheDocument();
    expect(screen.getByText("Quantum Debugger")).toBeInTheDocument();
    expect(screen.getByText("Noise Simulation")).toBeInTheDocument();
    expect(screen.getAllByText("Real Hardware").length).toBeGreaterThan(0);
  });

  it("renders roadmap section", () => {
    render(<HomePage />);
    expect(screen.getByText("Development Roadmap")).toBeInTheDocument();
    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
  });

  it("renders CTA section", () => {
    render(<HomePage />);
    expect(screen.getByText(/Ready to Build Quantum Programs/)).toBeInTheDocument();
  });

  it("has navigation links", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: /Start Solving/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Learn Quantum Computing/i })).toBeInTheDocument();
  });
});
