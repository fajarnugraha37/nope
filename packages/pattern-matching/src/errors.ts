import { HttpError } from "@fajarnugraha37/error";

export class NonExhaustiveError extends HttpError {
  constructor(input: unknown) {
    let displayedValue;
    try {
      displayedValue = JSON.stringify(input);
    } catch (e) {
      displayedValue = input;
    }
    super(`Pattern matching error: no pattern matches value ${displayedValue}`, 400, { input });
  }
}
