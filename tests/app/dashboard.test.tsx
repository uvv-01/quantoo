import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/page";

describe("Dashboard Page", () => {
  it("renders the dashboard heading", () => {
    render(<DashboardPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
  });

  it("renders dashboard cards", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Today's Challenge")).toBeInTheDocument();
    expect(screen.getByText("Continue Learning")).toBeInTheDocument();
    expect(screen.getByText("Skill Progress")).toBeInTheDocument();
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });

  it("renders empty states", () => {
    render(<DashboardPage />);
    expect(screen.getByText("No challenge yet")).toBeInTheDocument();
    expect(screen.getByText("No progress yet")).toBeInTheDocument();
    expect(screen.getByText("No skill data")).toBeInTheDocument();
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("renders projects section", () => {
    render(<DashboardPage />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("does not show fake data", () => {
    const { container } = render(<DashboardPage />);
    // Ensure no fake statistics or data
    expect(container.textContent).not.toMatch(/\d+\s+(problems|users|runs)/i);
  });
});
