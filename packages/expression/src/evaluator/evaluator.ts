import { ExpressionEvaluator } from "./expression.evaluator.js";

/** @deprecated Use ExpressionEvaluator instead */
export class Evaluator extends ExpressionEvaluator {
  constructor(cache?: any, engine?: any) {
    console.warn(
      "Evaluator class is deprecated. Use ExpressionEvaluator instead."
    );
    super();
  }
}
