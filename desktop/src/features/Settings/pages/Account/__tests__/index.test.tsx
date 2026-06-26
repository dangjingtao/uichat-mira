// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AccountSettings from "../index";

describe("AccountSettings", () => {
  it("redirects to /settings/general", () => {
    render(
      <MemoryRouter initialEntries={["/settings/account"]}>
        <Routes>
          <Route path="/settings/account" element={<AccountSettings />} />
          <Route path="/settings/general" element={<div data-testid="general">General</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(document.querySelector('[data-testid="general"]')).toBeInTheDocument();
  });
});
