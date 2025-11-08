import { HttpError } from "@fajarnugraha37/common";

export class NonExhaustiveError extends HttpError {
  constructor(public input: unknown) {
    let displayedValue;
    try {
      displayedValue = JSON.stringify(input);
    } catch (e) {
      displayedValue = input;
    }
    super(`Pattern matching error: no pattern matches value ${displayedValue}`);
    this.name = "NonExhaustiveError";
  }
}
