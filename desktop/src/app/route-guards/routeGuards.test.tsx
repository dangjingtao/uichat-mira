// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatchAllRedirect } from "./CatchAllRedirect";
import { GuestOnly } from "./GuestOnly";
import { RequireAuth } from "./RequireAuth";

const authState = vi.hoisted(() => ({
  isCheckingSession: false,
  session: null as null | { token: string },
}));

vi.mock("../providers/AuthProvider", () => ({
  useAuth: () => authState,
}));

vi.mock("../../shared/ui/FullPageStatus", () => ({
  FullPageStatus: ({ message }: { message: string }) => (
    <div data-testid="session-check">{message}</div>
  ),
}));

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>;
}

describe("route guards", () => {
  beforeEach(() => {
    authState.isCheckingSession = false;
    authState.session = null;
  });

  it("shows session validation before either auth guard decides", () => {
    authState.isCheckingSession = true;
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [{ path: "/private", element: <div>private</div> }],
        },
      ],
      { initialEntries: ["/private"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId("session-check")).toBeInTheDocument();
    expect(screen.queryByText("private")).not.toBeInTheDocument();
  });

  it("redirects anonymous users to login", async () => {
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [{ path: "/private", element: <div>private</div> }],
        },
        { path: "/login", element: <LocationProbe /> },
      ],
      { initialEntries: ["/private"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("renders private routes for authenticated users", () => {
    authState.session = { token: "token" };
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [{ path: "/private", element: <div>private</div> }],
        },
      ],
      { initialEntries: ["/private"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("private")).toBeInTheDocument();
  });

  it("redirects authenticated users away from guest-only routes", async () => {
    authState.session = { token: "token" };
    const router = createMemoryRouter(
      [
        {
          element: <GuestOnly />,
          children: [{ path: "/login", element: <div>login</div> }],
        },
        { path: "/chat", element: <LocationProbe /> },
      ],
      { initialEntries: ["/login"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe("/chat"));
    expect(screen.getByTestId("location")).toHaveTextContent("/chat");
  });

  it("renders guest routes without a session", () => {
    const router = createMemoryRouter(
      [
        {
          element: <GuestOnly />,
          children: [{ path: "/login", element: <div>login</div> }],
        },
      ],
      { initialEntries: ["/login"] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText("login")).toBeInTheDocument();
  });

  it("redirects catch-all routes to the configured destination", async () => {
    const router = createMemoryRouter(
      [
        { path: "/missing", element: <CatchAllRedirect to="/chat" /> },
        { path: "/chat", element: <LocationProbe /> },
      ],
      { initialEntries: ["/missing"] },
    );

    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe("/chat"));
    expect(screen.getByTestId("location")).toHaveTextContent("/chat");
  });
});
