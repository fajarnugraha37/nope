import { spec } from "../src/dsl/spec-builder";
import { all } from "../src/core/combinators";

interface User {
  age: number;
  role: string;
  subject: {
    role: string;
  }
}

const adultAdmin = all<User, {}>(
  spec.field<User>("age").gte(18),
  spec.field<User>("subject.role").eq("admin"),
);

const candidate: User = { age: 21, role: "admin", subject: { role: "admin" } };

console.log("is adult admin?", await adultAdmin.isSatisfiedByAsync!(candidate));
console.log("explain:", adultAdmin.explain(candidate));
