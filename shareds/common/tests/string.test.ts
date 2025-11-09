import { describe, expect, test } from "bun:test";

import {
  splitArnParts,
  getResourceSegments,
} from "../src/string/arn";
import {
  convertAssumedRoleArnToRoleArn,
  convertRoleArnToAssumedRoleArn,
  isAssumedRoleArn,
  isIamUserArn,
  isIamRoleArn,
  isFederatedUserArn,
  isArnPrincipal,
  isServicePrincipal,
} from "../src/string/principals";
import { createId } from "../src/id";

describe("AWS ARN helpers", () => {
  const roleArn = "arn:aws:iam::123456789012:role/Admin";
  const assumedArn =
    "arn:aws:sts::123456789012:assumed-role/Admin/cli-session";

  test("splitArnParts extracts segments", () => {
    const parts = splitArnParts(roleArn);
    expect(parts.service).toBe("iam");
    expect(parts.resourceType).toBe("role");
    expect(parts.resourcePath).toBe("Admin");
  });

  test("getResourceSegments handles delimiters", () => {
    expect(
      getResourceSegments("lambda", "123", "us-east-1", "function:MyFunc")
    ).toEqual(["function", "MyFunc"]);

    expect(
      getResourceSegments("s3", "", "", "bucket-name/object")
    ).toEqual(["", "bucket-name/object"]);
  });

  test("convertRoleArnToAssumedRoleArn builds session ARN", () => {
    const session = convertRoleArnToAssumedRoleArn(roleArn, "cli-session");
    expect(session).toBe(assumedArn);
  });

  test("convertAssumedRoleArnToRoleArn derives base ARN", () => {
    const role = convertAssumedRoleArnToRoleArn(assumedArn);
    expect(role).toBe(roleArn);
  });

  test("principal detectors recognise forms", () => {
    expect(isAssumedRoleArn(assumedArn)).toBe(true);
    expect(isIamRoleArn(roleArn)).toBe(true);
    expect(isIamUserArn("arn:aws:iam::123456789012:user/alice")).toBe(true);
    expect(
      isFederatedUserArn("arn:aws:sts::123456789012:federated-user/bob")
    ).toBe(true);
    expect(isArnPrincipal(roleArn)).toBe(true);
    expect(isServicePrincipal("lambda.amazonaws.com")).toBe(true);
    expect(isServicePrincipal("example.com")).toBe(false);
  });
});

describe("ID helpers", () => {
  test("createId generates random suffix", () => {
    const id = createId("pref");
    expect(id).toMatch(/^pref_[0-9a-z]{16}$/);
    expect(createId()).toHaveLength(16);
  });
});
