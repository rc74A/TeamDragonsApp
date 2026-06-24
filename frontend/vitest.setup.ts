// Registers jest-dom matchers (e.g. toBeInTheDocument) for Vitest.
// Also sets up the mock clerk authentication for testing on all pages
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import React from "react";

vi.mock("@clerk/react-router", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SignOutButton: ({ children }: { children: React.ReactNode }) =>
    React.createElement("button", { type: "button" }, children || "Sign Out"),
  useUser: () => ({
    isSignedIn: true,
    user: {
      id: "user_123",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
  }),
  useAuth: () => ({
    userId: "user_123",
    getToken: async () => "mock-token",
  }),
}));
