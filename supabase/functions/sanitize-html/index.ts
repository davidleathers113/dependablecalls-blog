import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import DOMPurify from 'https://esm.sh/isomorphic-dompurify@2.14.0'

interface SanitizeRequest {
  content: string
  contentType: 'markdown' | 'html'
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
}

interface SanitizeResponse {
  sanitized: string | null
  isClean: boolean
  removedContent?: string[]
}

// Default allowed tags for blog content
const DEFAULT_ALLOWED_TAGS = [
  'p', 'br', 'span', 'div', 'section', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'q', 'cite',
  'em', 'strong', 'i', 'b', 'u', 'mark', 'small',
  'a', 'abbr', 'sub', 'sup',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'pre', 'code', 'kbd', 'samp', 'var',
  'hr', 'details', 'summary'
]

// Default allowed attributes
const DEFAULT_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'target', 'rel'],
  'img': ['src', 'alt', 'title', 'width', 'height', 'loading'],
  'blockquote': ['cite'],
  'q': ['cite'],
  'code': ['class'], // For syntax highlighting
  'pre': ['class'],
  '*': ['class', 'id'] // Allow class and id on all elements
}

// Known XSS attack patterns to test against
const XSS_TEST_PATTERNS = [
  '<script>alert("xss")</script>',
  '<img src=x onerror=alert("xss")>',
  '<svg onload=alert("xss")>',
  '<iframe src="javascript:alert(\'xss\')">',
  '<input onfocus=alert("xss") autofocus>',
  '<select onfocus=alert("xss") autofocus>',
  '<textarea onfocus=alert("xss") autofocus>',
  '<button onclick=alert("xss")>',
  '<form action="javascript:alert(\'xss\')">',
  '<object data="javascript:alert(\'xss\')">',
  '<embed src="javascript:alert(\'xss\')">',
  '<a href="javascript:alert(\'xss\')">click</a>',
  '<a href="vbscript:msgbox(\'xss\')">click</a>',
  '<body onload=alert("xss")>',
  '<style>body{background:url("javascript:alert(\'xss\')")}</style>',
  '<link rel="stylesheet" href="javascript:alert(\'xss\')">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(\'xss\')">',
  '<base href="javascript:alert(\'xss\')//">',
  '<details open ontoggle=alert("xss")>',
  '<<script>alert("xss");//<</script>',
  '<scr<script>ipt>alert("xss")</scr</script>ipt>',
  '"><script>alert("xss")</script>',
  '\'><script>alert("xss")</script>',
  'javascript:/*--></title></style></textarea></script></xmp><svg/onload=\'+/"/+/onmouseover=1/+/[*/[]/+alert("xss")//\'>',
  '<img src="x" onerror="alert(String.fromCharCode(88,83,83))">',
  '<svg><script>alert&#40;1&#41;</script></svg>',
  '<img src=1 href=1 onerror="javascript:alert(1)"></img>',
  '<audio src=1 href=1 onerror="javascript:alert(1)"></audio>',
  '<video src=1 href=1 onerror="javascript:alert(1)"></video>',
  '<body onresize="javascript:alert(1)">',
  '<div style="width: expression(alert(\'XSS\'));">',
  '<img src=x:alert(alt) onerror=eval(src) alt=xss>',
  '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
  '<svg><set onbegin=alert(1) attributename=x dur=1s>',
  '<marquee onstart=alert(1)>XSS</marquee>'
]

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify internal service role authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Parse request body
    const requestData: SanitizeRequest = await req.json()
    
    if (!requestData.content) {
      return new Response(
        JSON.stringify({ sanitized: null, isClean: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Convert markdown to HTML if needed (using marked)
    let htmlContent = requestData.content
    if (requestData.contentType === 'markdown') {
      // Import marked for markdown conversion
      const { marked } = await import('https://esm.sh/marked@14.1.3')
      
      // Configure marked for security
      marked.setOptions({
        headerIds: false,
        mangle: false
      })
      
      htmlContent = await marked.parse(requestData.content)
    }

    // Configure DOMPurify
    const config = {
      ALLOWED_TAGS: requestData.allowedTags || DEFAULT_ALLOWED_TAGS,
      ALLOWED_ATTR: [] as string[],
      ALLOW_DATA_ATTR: false,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      ALLOW_SELF_CLOSE_IN_ATTR: false,
      SAFE_FOR_TEMPLATES: true,
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      FORCE_BODY: true,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true,
      IN_PLACE: false
    }

    // Build allowed attributes list
    const allowedAttrs = requestData.allowedAttributes || DEFAULT_ALLOWED_ATTRIBUTES
    for (const [tag, attrs] of Object.entries(allowedAttrs)) {
      if (tag === '*') {
        config.ALLOWED_ATTR.push(...attrs)
      } else {
        for (const attr of attrs) {
          config.ALLOWED_ATTR.push(`${attr}`)
        }
      }
    }

    // Add custom hook to track removed content
    const removedContent: string[] = []
    DOMPurify.addHook('uponSanitizeElement', (node: Element) => {
      if (node.nodeType === 1) { // Element node
        const tagName = node.tagName.toLowerCase()
        if (!config.ALLOWED_TAGS.includes(tagName)) {
          removedContent.push(`<${tagName}>`)
        }
      }
    })

    DOMPurify.addHook('uponSanitizeAttribute', (node: Element, data: { attrName: string; attrValue: string; keepAttr: boolean }) => {
      if (data.attrName && data.attrValue) {
        // Check for javascript: and other dangerous protocols
        if (data.attrValue.match(/^(javascript|vbscript|data|blob):/i)) {
          removedContent.push(`${data.attrName}="${data.attrValue}"`)
          data.keepAttr = false
        }
      }
    })

    // Perform sanitization
    const sanitized = DOMPurify.sanitize(htmlContent, config)

    // Test against known XSS patterns
    let containsXSS = false
    for (const pattern of XSS_TEST_PATTERNS) {
      const testResult = DOMPurify.sanitize(pattern, config)
      if (testResult !== '' && testResult.includes('alert') || testResult.includes('javascript:')) {
        containsXSS = true
        break
      }
    }

    // Remove hooks to prevent memory leaks
    DOMPurify.removeAllHooks()

    // Check if content was modified during sanitization
    const isClean = sanitized === htmlContent && !containsXSS

    const response: SanitizeResponse = {
      sanitized: sanitized || null,
      isClean,
      removedContent: removedContent.length > 0 ? removedContent : undefined
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in sanitize-html function:', error)
    
    return new Response(
      JSON.stringify({ 
        sanitized: null, 
        isClean: false, 
        error: error instanceof Error ? error.message : 'Sanitization failed' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})