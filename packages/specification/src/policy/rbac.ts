import { spec } from "../dsl/spec-builder.js";
import { all, any } from "../core/combinators.js";

export interface User {
  id: string;
  role: "admin" | "editor" | "viewer";
  department?: string;
  attributes?: Record<string, unknown>;
}

export interface Resource {
  ownerId: string;
  department?: string;
}

export interface AccessRequest {
  subject: User;
  resource: Resource;
  action: string;
}

export const adminOrOwnerPolicy = all<AccessRequest, {}>(
  any(
    spec.field<AccessRequest>("subject.role").eq("admin"),
    spec.field<AccessRequest>("action").in(["read", "list"]),
  ),
  spec.field<AccessRequest>("action").notIn(["delete"]),
);
