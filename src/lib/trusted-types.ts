/**
 * Trusted Types Integration for CSP v3
 * 
 * Implements Trusted Types API for DOM manipulation security
 * and prevents CSP bypass attacks through DOM manipulation.
 */

declare global {
  interface Window {
    trustedTypes?: {
      createPolicy: (name: string, policy: TrustedTypePolicyOptions) => TrustedTypePolicy;
      getPolicyNames: () => string[];
      isHTML: (value: any) => value is TrustedHTML;
      isScript: (value: any) => value is TrustedScript;
      isScriptURL: (value: any) => value is TrustedScriptURL;
    };
  }
}

interface TrustedTypePolicy {
  createHTML: (input: string) => TrustedHTML;
  createScript: (input: string) => TrustedScript;
  createScriptURL: (input: string) => TrustedScriptURL;
}

interface TrustedTypePolicyOptions {
  createHTML?: (input: string) => string;
  createScript?: (input: string) => string;
  createScriptURL?: (input: string) => string;
}

type TrustedHTML = string & { readonly __brand: unique symbol };
type TrustedScript = string & { readonly __brand: unique symbol };
type TrustedScriptURL = string & { readonly __brand: unique symbol };

/**
 * DOMPurify-based trusted types policy
 */
let dompurifyPolicy: TrustedTypePolicy | null = null;

/**
 * Initialize trusted types policies
 */
export function initializeTrustedTypes(): void {
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return; // Not supported or not in browser
  }

  try {
    // Create DOMPurify policy for HTML sanitization
    if (!dompurifyPolicy) {
      dompurifyPolicy = window.trustedTypes.createPolicy('dompurify', {
        createHTML: (input: string) => {
          // Import DOMPurify dynamically to ensure it's available
          // @ts-expect-error - DOMPurify is loaded via CDN in production
          if (typeof DOMPurify !== 'undefined' && DOMPurify) {
            // @ts-expect-error - DOMPurify is loaded via CDN in production
            return DOMPurify.sanitize(input, { 
              RETURN_DOM_FRAGMENT: false,
              RETURN_DOM: false
            }) as string;
          }
          
          // Fallback - basic sanitization (not recommended for production)
          return input
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
        },
        
        createScript: (input: string) => {
          // Only allow specific safe scripts
          const allowedScripts = [
            /^console\.(log|warn|error|info)\(/,
            /^window\.__CSP_NONCES__/,
            /^document\.getElementById\(/
          ];
          
          const isAllowed = allowedScripts.some(pattern => pattern.test(input));
          if (!isAllowed) {
            throw new Error('Script content not allowed by trusted types policy');
          }
          
          return input;
        },
        
        createScriptURL: (input: string) => {
          // Allow only specific domains and self
          const allowedOrigins = [
            location.origin,
            'https://js.stripe.com',
            'https://cdn.jsdelivr.net'
          ];
          
          try {
            const url = new URL(input);
            const isAllowed = allowedOrigins.some(origin => 
              url.origin === origin || input.startsWith('/')
            );
            
            if (!isAllowed) {
              throw new Error('Script URL not allowed by trusted types policy');
            }
            
            return input;
          } catch {
            throw new Error('Invalid script URL');
          }
        }
      });
    }
    
    // Create default policy as fallback
    if (!window.trustedTypes.getPolicyNames().includes('default')) {
      window.trustedTypes.createPolicy('default', {
        createHTML: (input: string) => {
          console.warn('Using default trusted types policy - should be avoided');
          return dompurifyPolicy?.createHTML(input) || '';
        },
        createScript: (_input: string) => {
          console.warn('Using default trusted types policy for script - should be avoided');
          return '';
        },
        createScriptURL: (_input: string) => {
          console.warn('Using default trusted types policy for script URL - should be avoided');
          return '';
        }
      });
    }
    
  } catch (error) {
    console.error('Failed to initialize trusted types policies:', error);
  }
}

/**
 * Safe HTML creation with trusted types
 */
export function createTrustedHTML(html: string): TrustedHTML | string {
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return html; // Fallback for non-supporting browsers
  }
  
  if (!dompurifyPolicy) {
    initializeTrustedTypes();
  }
  
  try {
    return dompurifyPolicy?.createHTML(html) || html;
  } catch (error) {
    console.error('Failed to create trusted HTML:', error);
    return ''; // Return empty string on error
  }
}

/**
 * Safe script creation with trusted types
 */
export function createTrustedScript(script: string): TrustedScript | string {
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return script;
  }
  
  if (!dompurifyPolicy) {
    initializeTrustedTypes();
  }
  
  try {
    return dompurifyPolicy?.createScript(script) || '';
  } catch (error) {
    console.error('Failed to create trusted script:', error);
    return '';
  }
}

/**
 * Safe script URL creation with trusted types
 */
export function createTrustedScriptURL(url: string): TrustedScriptURL | string {
  if (typeof window === 'undefined' || !window.trustedTypes) {
    return url;
  }
  
  if (!dompurifyPolicy) {
    initializeTrustedTypes();
  }
  
  try {
    return dompurifyPolicy?.createScriptURL(url) || url;
  } catch (error) {
    console.error('Failed to create trusted script URL:', error);
    return '';
  }
}

/**
 * Safe innerHTML assignment
 */
export function safeSetInnerHTML(element: Element, html: string): void {
  const trustedHTML = createTrustedHTML(html);
  element.innerHTML = trustedHTML as string;
}

/**
 * Check if trusted types is supported and enabled
 */
export function isTrustedTypesSupported(): boolean {
  return typeof window !== 'undefined' && !!window.trustedTypes;
}

/**
 * Get current trusted types policies
 */
export function getTrustedTypesPolicies(): string[] {
  if (!isTrustedTypesSupported()) {
    return [];
  }
  
  return window.trustedTypes!.getPolicyNames();
}

// Initialize on module load in browser environment
if (typeof window !== 'undefined') {
  // Wait for DOMContentLoaded to ensure DOMPurify is available
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTrustedTypes);
  } else {
    initializeTrustedTypes();
  }
}