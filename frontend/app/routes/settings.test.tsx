import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "./settings";

const STORAGE_KEY = "tdAccountSettings";

describe("Settings page", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders inside the app shell with account and coming-soon sections", () => {
    render(<Settings />);

    // App-shell behavior is preserved (banner + sidebar nav).
    expect(
      screen.getByRole("heading", { name: "Dragon Application", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toBeInTheDocument();

    // Baseline account settings content.
    expect(
      screen.getByRole("heading", { name: "Settings", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getAllByText("Coming soon")).toHaveLength(3);
  });

  it("loads existing account settings from localStorage", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ displayName: "Joel Walker", email: "joel@example.com" }),
    );

    render(<Settings />);

    expect(await screen.findByDisplayValue("Joel Walker")).toBeInTheDocument();
    expect(screen.getByDisplayValue("joel@example.com")).toBeInTheDocument();
  });

  it("saves valid account details to localStorage", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.type(screen.getByLabelText("Display name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Saved.")).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(stored).toEqual({
      displayName: "Ada Lovelace",
      email: "ada@example.com",
    });
  });

  it("shows a validation error for an invalid email and does not save", async () => {
    const user = userEvent.setup();
    render(<Settings />);

    await user.type(screen.getByLabelText("Display name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
