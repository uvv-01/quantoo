import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LearnPage from "@/app/learn/page";
import ProjectsPage from "@/app/projects/page";
import ProfilePage from "@/app/profile/page";
import SettingsPage from "@/app/settings/page";


describe("Learn Page", () => {
  it("renders the learn heading", () => {
    render(<LearnPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Learn");
  });

  it("renders learning topics", () => {
    render(<LearnPage />);
    expect(screen.getByText("Quantum Fundamentals")).toBeInTheDocument();
    expect(screen.getByText("Circuit Design")).toBeInTheDocument();
    expect(screen.getByText("Algorithms")).toBeInTheDocument();
  });
});

describe("Projects Page", () => {
  it("renders the projects heading", () => {
    render(<ProjectsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Projects");
  });

  it("shows coming soon state", () => {
    render(<ProjectsPage />);
    expect(screen.getByText(/Projects coming in Phase 8/)).toBeInTheDocument();
  });
});

describe("Profile Page", () => {
  it("renders the profile heading", () => {
    render(<ProfilePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Profile");
  });

  it("shows auth required state", () => {
    render(<ProfilePage />);
    expect(screen.getByText(/Authentication required/)).toBeInTheDocument();
  });
});

describe("Settings Page", () => {
  it("renders the settings heading", () => {
    render(<SettingsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Settings");
  });

  it("shows auth required state", () => {
    render(<SettingsPage />);
    expect(screen.getAllByText(/Authentication required/).length).toBeGreaterThan(0);
  });
});


