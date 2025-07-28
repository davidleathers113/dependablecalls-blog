/**
 * @name Payment security vulnerabilities
 * @description Detects potential payment processing security issues in DCE platform
 * @kind problem
 * @problem.severity error
 * @security-severity 9.0
 * @precision high
 * @id dce/payment-security
 * @tags security
 *       external/cwe/cwe-639
 *       payment
 *       financial
 */

import javascript

// Detect potential payment amount manipulation
class PaymentAmountManipulation extends DataFlow::Node {
  PaymentAmountManipulation() {
    exists(DataFlow::PropWrite write |
      write.getPropertyName() = "amount" and
      write.getRhs() = this and
      exists(BinaryExpr binExpr |
        binExpr = this.asExpr() and
        binExpr.getOperator() instanceof ArithmeticBinaryExpr
      )
    )
  }
}

// Detect hardcoded Stripe keys
class HardcodedStripeKey extends StringLiteral {
  HardcodedStripeKey() {
    this.getValue().regexpMatch("sk_test_.*|pk_test_.*|sk_live_.*|pk_live_.*")
  }
}

// Detect insecure payment data storage
class InsecurePaymentStorage extends DataFlow::Node {
  InsecurePaymentStorage() {
    exists(DataFlow::PropWrite write |
      write.getPropertyName().regexpMatch("card.*|payment.*|billing.*") and
      write.getRhs() = this and
      not exists(CallExpr encrypt |
        encrypt.getCalleeName() = "encrypt" and
        encrypt.getAnArgument() = this.asExpr()
      )
    )
  }
}

// Detect missing payment validation
class MissingPaymentValidation extends CallExpr {
  MissingPaymentValidation() {
    this.getCalleeName().regexpMatch("create.*Payment|process.*Payment") and
    not exists(CallExpr validate |
      validate.getCalleeName().regexpMatch("validate.*|sanitize.*|verify.*") and
      validate.getEnclosingFunction() = this.getEnclosingFunction()
    )
  }
}

from DataFlow::Node node, string message
where
  (
    node instanceof PaymentAmountManipulation and
    message = "Potential payment amount manipulation detected"
  ) or (
    node instanceof HardcodedStripeKey and
    message = "Hardcoded Stripe API key detected"
  ) or (
    node instanceof InsecurePaymentStorage and
    message = "Insecure payment data storage detected"
  ) or (
    node instanceof MissingPaymentValidation and
    message = "Missing payment validation detected"
  )
select node, message