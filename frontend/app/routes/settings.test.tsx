import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Settings from "./settings";

const STORAGE_KEY = "tdAccountSettings";

describe("Settings page", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the account section and coming-soon sections", () => {
    render(<Settings />);

    expect(
      screen.getByRole("heading", { name: "Settings", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Notifications" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Appearance" }),
    ).toBeInTheDocument();
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
