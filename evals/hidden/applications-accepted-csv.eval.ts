// Hidden check: copied to eval-hidden/<task>.test.ts after the agent finishes.
import { describe, expect, it } from "vitest";
import { acceptedApplicantsCsv } from "../modules/applications/src/index";

const app = {
  id: "0b6f2b5e-3a3c-4d8e-9f0a-1c2d3e4f5a6b",
  submittedAt: "2026-10-01T12:00:00Z",
  fullName: "Sam Rivera",
  email: "sam@example.com",
  graduationYear: 2028,
  program: "Computing",
  position: "Developer",
  answers: { why: "SECRET-ANSWER", identity: "SECRET-DEMOGRAPHIC" },
  consent: true as const,
  status: "accepted" as const,
};

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF rows. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(field), (field = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field !== "" || row.length > 0) row.push(field), rows.push(row);
  return rows;
}

describe("hidden: accepted applicants CSV", () => {
  const apps = [
    app,
    { ...app, fullName: "Ana Lopez", email: "ana@example.com", status: "rejected" as const },
    { ...app, fullName: "Bo Chen", email: "bo@example.com", status: "interview" as const },
    { ...app, fullName: "Rivera, Jr.", email: "jr@example.com", position: "Designer" },
    { ...app, fullName: 'Kai "KJ" Jones', email: "kj@example.com" },
  ];

  it("has a name,email,position header and one row per accepted applicant", () => {
    const rows = parseCsv(acceptedApplicantsCsv(apps));
    expect(rows[0]).toEqual(["name", "email", "position"]);
    expect(rows.slice(1)).toEqual([
      ["Sam Rivera", "sam@example.com", "Developer"],
      ["Rivera, Jr.", "jr@example.com", "Designer"],
      ['Kai "KJ" Jones', "kj@example.com", "Developer"],
    ]);
  });

  it("filters by position when asked", () => {
    expect(parseCsv(acceptedApplicantsCsv(apps, "Designer")).slice(1)).toEqual([["Rivera, Jr.", "jr@example.com", "Designer"]]);
  });

  it("returns just the header when nobody is accepted", () => {
    expect(parseCsv(acceptedApplicantsCsv([{ ...app, status: "rejected" }]))).toEqual([["name", "email", "position"]]);
  });

  it("leaves out answers, program, graduation year, and anything else personal", () => {
    const csv = acceptedApplicantsCsv(apps);
    for (const leaked of ["SECRET-ANSWER", "SECRET-DEMOGRAPHIC", "Computing", "2028", app.id]) expect(csv).not.toContain(leaked);
  });
});
