import { afterEach, describe, expect, it } from "vitest";
import { copy, setCopyLocale } from "./copy";

const SUPPORTED_LOCALES = ["en", "zh-CN", "zh-TW", "ja", "ko", "de"];

describe("registered product name", () => {
  afterEach(() => setCopyLocale("en"));

  it.each(SUPPORTED_LOCALES)("uses TokenOrbit in %s product copy", (locale) => {
    setCopyLocale(locale);

    expect(copy("shared.app_name")).toBe("TokenOrbit");
    expect(copy("landing.meta.og_site_name")).toBe("TokenOrbit");
    expect(copy("share.meta.og_site_name")).toBe("TokenOrbit");
    expect(copy("landing.meta.title")).toContain("TokenOrbit");
    expect(copy("share.meta.title")).toContain("TokenOrbit");
    expect(copy("dashboard.widgets.hint")).toContain("TokenOrbit Widgets");
  });
});
