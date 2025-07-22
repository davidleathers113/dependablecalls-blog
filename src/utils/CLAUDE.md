# Utility Functions

# File Organization

```
utils/
├── format.ts       # Data formatting utilities
├── validate.ts     # Validation helpers
├── date.ts        # Date/time utilities
├── string.ts      # String manipulation
├── number.ts      # Number utilities
├── crypto.ts      # Encryption/hashing
├── storage.ts     # Local/session storage
└── index.ts       # Export all utilities
```

# Formatting Utilities

```tsx
// format.ts
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length !== 10) return phone

  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
}

export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatPercentage(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}
```

# Validation Helpers

```tsx
// validate.ts - NO REGEX ALLOWED
import { z } from 'zod'

export const phoneValidator = z
  .string()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val.length === 10, {
    message: 'Phone number must be 10 digits',
  })

export const emailValidator = z.string().email()

export const urlValidator = z.string().url()

export function isValidPhone(phone: string): boolean {
  return phoneValidator.safeParse(phone).success
}

export function isValidEmail(email: string): boolean {
  return emailValidator.safeParse(email).success
}
```

# Date Utilities

```tsx
// date.ts
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'iso' = 'short'
): string {
  const d = new Date(date)

  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US')
    case 'long':
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    case 'iso':
      return d.toISOString()
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function getDateRange(period: 'today' | 'week' | 'month' | 'year'): {
  start: Date
  end: Date
} {
  const end = new Date()
  const start = new Date()

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      break
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setMonth(start.getMonth() - 1)
      break
    case 'year':
      start.setFullYear(start.getFullYear() - 1)
      break
  }

  return { start, end }
}
```

# String Utilities

```tsx
// string.ts - NO REGEX ALLOWED
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

export function extractInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
```

# Number Utilities

```tsx
// number.ts
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return (value / total) * 100
}
```

# Crypto Utilities

```tsx
// crypto.ts
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value)
  const hash = await crypto.subtle.digest('SHA-256', data)

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function generateSecureToken(length = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)

  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

# Storage Utilities

```tsx
// storage.ts
export const storage = {
  get<T>(key: string, defaultValue?: T): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : (defaultValue ?? null)
    } catch {
      return defaultValue ?? null
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Storage error:', error)
    }
  },

  remove(key: string): void {
    localStorage.removeItem(key)
  },

  clear(): void {
    localStorage.clear()
  },
}

export const sessionStorage = {
  get<T>(key: string): T | null {
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch {
      return null
    }
  },

  set<T>(key: string, value: T): void {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  },
}
```

# Array Utilities

```tsx
export function groupBy<T, K extends keyof any>(array: T[], key: (item: T) => K): Record<K, T[]> {
  return array.reduce(
    (groups, item) => {
      const group = key(item)
      if (!groups[group]) groups[group] = []
      groups[group].push(item)
      return groups
    },
    {} as Record<K, T[]>
  )
}

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)]
}

export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
```

# DCE-Specific Utilities

## Call Duration Formatting

```tsx
export function formatCallDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
```

## Commission Calculation

```tsx
export function calculateCommission(amount: number, rate: number, minCommission = 0): number {
  const commission = amount * (rate / 100)
  return Math.max(commission, minCommission)
}
```

## Quality Score Calculation

```tsx
export function calculateQualityScore(
  duration: number,
  converted: boolean,
  fraudScore: number
): number {
  let score = 50 // Base score

  // Duration bonus
  if (duration > 120) score += 20
  else if (duration > 60) score += 10

  // Conversion bonus
  if (converted) score += 30

  // Fraud penalty
  score -= fraudScore * 10

  return clamp(score, 0, 100)
}
```

# Error Utilities

```tsx
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unknown error occurred'
}

export function isNetworkError(error: unknown): boolean {
  return (
    error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))
  )
}
```

# Type Guards

```tsx
export function isNotNull<T>(value: T | null): value is T {
  return value !== null
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined
}

export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value)
}
```

# CRITICAL RULES

- NO regex patterns anywhere
- NO any types in utility functions
- ALWAYS use Zod for validation
- ALWAYS handle edge cases
- ALWAYS provide TypeScript types
- ALWAYS document complex utilities
- TEST all utility functions
- USE native APIs when available
- OPTIMIZE for performance
- KEEP utilities pure and side-effect free
