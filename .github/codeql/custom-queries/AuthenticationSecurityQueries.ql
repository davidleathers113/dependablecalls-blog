/**
 * @name Authentication security vulnerabilities
 * @description Detects authentication and authorization security issues in DCE platform
 * @kind problem
 * @problem.severity error
 * @security-severity 8.5
 * @precision high
 * @id dce/auth-security
 * @tags security
 *       external/cwe/cwe-287
 *       external/cwe/cwe-285
 *       authentication
 *       authorization
 */

import javascript

// Detect weak password validation
class WeakPasswordValidation extends CallExpr {
  WeakPasswordValidation() {
    this.getCalleeName().regexpMatch(".*password.*") and
    exists(StringLiteral regex |
      regex = this.getAnArgument() and
      not regex.getValue().regexpMatch(".*[A-Z].*[a-z].*[0-9].*[!@#$%^&*].*")
    )
  }
}

// Detect missing JWT verification
class MissingJWTVerification extends CallExpr {
  MissingJWTVerification() {
    this.getCalleeName().regexpMatch(".*decode.*|.*verify.*") and
    exists(Literal verify |
      verify = this.getAnArgument() and
      verify.getValue() = "false"
    )
  }
}

// Detect insecure session management
class InsecureSessionManagement extends DataFlow::PropWrite {
  InsecureSessionManagement() {
    this.getPropertyName().regexpMatch(".*session.*|.*cookie.*") and
    exists(ObjectExpr obj |
      obj = this.getRhs().asExpr() and
      not exists(Property secure |
        secure = obj.getAProperty() and
        secure.getName() = "secure" and
        secure.getValue().(Literal).getValue() = "true"
      )
    )
  }
}

// Detect hardcoded authentication secrets
class HardcodedAuthSecret extends StringLiteral {
  HardcodedAuthSecret() {
    exists(DataFlow::PropWrite write |
      write.getPropertyName().regexpMatch(".*secret|.*key|.*token") and
      write.getRhs().asExpr() = this and
      this.getValue().length() > 10 and
      not this.getValue().regexpMatch("process\\.env\\..*")
    )
  }
}

// Detect missing rate limiting on auth endpoints
class MissingAuthRateLimit extends Function {
  MissingAuthRateLimit() {
    exists(RouteHandler handler |
      handler.getARouteSetup().getPath().regexpMatch(".*/auth/.*|.*/login.*|.*/register.*") and
      handler = this and
      not exists(CallExpr rateLimit |
        rateLimit.getCalleeName().regexpMatch(".*rateLimit.*|.*throttle.*") and
        rateLimit.getEnclosingFunction() = this
      )
    )
  }
}

// Detect unsafe password comparison
class UnsafePasswordComparison extends BinaryExpr {
  UnsafePasswordComparison() {
    this.getOperator() instanceof EqualityTest and
    exists(DataFlow::Node password |
      password.asExpr() = this.getAnOperand() and
      password.toString().regexpMatch(".*password.*|.*pwd.*|.*pass.*")
    ) and
    not exists(CallExpr compare |
      compare.getCalleeName().regexpMatch("bcrypt.*|crypto.*|compare.*") and
      compare.getAnArgument() = this.getAnOperand()
    )
  }
}

// Detect privilege escalation vulnerabilities
class PrivilegeEscalation extends DataFlow::PropWrite {
  PrivilegeEscalation() {
    this.getPropertyName().regexpMatch(".*role.*|.*admin.*|.*permission.*") and
    exists(DataFlow::Node userInput |
      userInput.asExpr().(PropAccess).getBase().(VarAccess).getName().regexpMatch("req|request|body|params|query") and
      this.getRhs() = userInput
    )
  }
}

from DataFlow::Node node, string message
where
  (
    node instanceof WeakPasswordValidation and
    message = "Weak password validation pattern detected"
  ) or (  
    node instanceof MissingJWTVerification and
    message = "JWT verification disabled or missing"
  ) or (
    node instanceof InsecureSessionManagement and
    message = "Insecure session/cookie configuration"
  ) or (
    node instanceof HardcodedAuthSecret and
    message = "Hardcoded authentication secret detected"
  ) or (
    node instanceof MissingAuthRateLimit and
    message = "Missing rate limiting on authentication endpoint"
  ) or (
    node instanceof UnsafePasswordComparison and
    message = "Unsafe password comparison using == or ==="
  ) or (
    node instanceof PrivilegeEscalation and
    message = "Potential privilege escalation via user input"
  )
select node, message