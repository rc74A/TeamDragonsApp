import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import Profile from "./profile";

type ProfileResponse = {
  owner_id: number;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  updated_at: string;
};

const EMPTY: ProfileResponse = {
  owner_id: 1,
  full_name: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
  updated_at: "2026-01-01T00:00:00Z",
};

function mockFetch(getBody: ProfileResponse = EMPTY) {
  return vi.fn(
    async (url: string, _options?: RequestInit): Promise<Response> => {
      if (url.includes("/auth/me")) {
        return {
          ok: true,
          json: async () => ({ id: 1 }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => getBody,
      } as unknown as Response;
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Profile page", () => {
  it("renders the profile form inside the app shell", async () => {
    vi.stubGlobal("fetch", mockFetch());

    await act(async () => {
      render(
        <MemoryRouter>
          <Profile />
        </MemoryRouter>,
      );
    });

    expect(
      screen.getByRole("heading", { name: "Dragon Application", level: 1 }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Profile", level: 2 }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Location")).toBeInTheDocument();
    expect(screen.getByLabelText("Summary")).toBeInTheDocument();
  });

  it("loads the existing profile from the API", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ...EMPTY,
        full_name: "Joel Walker",
        email: "joel@example.com",
      }),
    );

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue("Joel Walker")).toBeInTheDocument();
    expect(screen.getByDisplayValue("joel@example.com")).toBeInTheDocument();
  });

  it("saves the profile via a PUT request", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await user.type(screen.getByLabelText("Full name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
    const putCall = fetchMock.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    const body = JSON.parse((putCall?.[1]?.body as string) ?? "{}");
    expect(body.full_name).toBe("Ada Lovelace");
    expect(body.email).toBe("ada@example.com");
  });

  it("blocks save on an invalid email and does not call PUT", async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockClear();

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();
    const putCalls = fetchMock.mock.calls.filter(
      ([, options]) => options?.method === "PUT",
    );
    expect(putCalls).toHaveLength(0);
  });
});
