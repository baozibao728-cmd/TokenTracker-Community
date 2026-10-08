import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { copy, setCopyLocale } from "../../lib/copy";
import { Shell } from "./Shell.jsx";

describe("Shell brand", () => {
  beforeEach(() => setCopyLocale("en"));

  it("renders the registered product name in the header", () => {
    render(
      <MemoryRouter>
        <Shell><div /></Shell>
      </MemoryRouter>,
    );

    const appName = copy("shared.app_name");
    expect(appName).toBe("TokenOrbit");
    expect(screen.getByRole("img", { name: appName })).toBeInTheDocument();
    expect(screen.getByText(appName)).toBeInTheDocument();
  });
});
