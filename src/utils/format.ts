/**
 * Utility functions for formatting data display
 * NO REGEX - Uses proper string methods and libraries
 */

/**
 * Format currency amounts
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    // Fallback for invalid currency codes
    return `$${amount.toFixed(2)}`
  }
}

/**
 * Format numbers with proper locale formatting
 */
export const formatNumber = (
  value: number,
  options: {
    minimumFractionDigits?: number
    maximumFractionDigits?: number
    useGrouping?: boolean
  } = {},
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 3,
    useGrouping: options.useGrouping ?? true,
  }).format(value)
}

/**
 * Format percentage values
 */
export const formatPercentage = (
  value: number,
  decimals: number = 1,
  locale: string = 'en-US'
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100)
}

/**
 * Format dates with various options
 */
export const formatDate = (
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
  locale: string = 'en-US'
): string => {
  return new Intl.DateTimeFormat(locale, options).format(date)
}

/**
 * Format time
 */
export const formatTime = (
  date: Date,
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  },
  locale: string = 'en-US'
): string => {
  return new Intl.DateTimeFormat(locale, options).format(date)
}

/**
 * Format datetime
 */
export const formatDateTime = (date: Date, locale: string = 'en-US'): string => {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: Date, locale: string = 'en-US'): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  // Use Intl.RelativeTimeFormat for proper localization
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, 'second')
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), 'minute')
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour')
  } else if (diffInSeconds < 2592000) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), 'day')
  } else if (diffInSeconds < 31536000) {
    return rtf.format(-Math.floor(diffInSeconds / 2592000), 'month')
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 31536000), 'year')
  }
}

/**
 * Format file sizes
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

/**
 * Format duration in seconds to human readable format
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }
  if (remainingSeconds > 0 || parts.length === 0) {
    parts.push(`${remainingSeconds}s`)
  }

  return parts.join(' ')
}

/**
 * Format phone numbers using basic string manipulation (no regex)
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters
  const digits = phoneNumber
    .split('')
    .filter((char) => {
      return char >= '0' && char <= '9'
    })
    .join('')

  // Format US phone numbers
  if (digits.length === 10) {
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7)}`
  }

  // Return original if can't format
  return phoneNumber
}

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Capitalize first letter of each word
 */
export const titleCase = (str: string): string => {
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format call duration in MM:SS format
 */
export const formatCallDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

/**
 * Format conversion rate as percentage
 */
export const formatConversionRate = (
  conversions: number,
  total: number,
  decimals: number = 2
): string => {
  if (total === 0) return '0%'
  const rate = (conversions / total) * 100
  return `${rate.toFixed(decimals)}%`
}

/**
 * Format campaign status for display
 */
export const formatCampaignStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    active: 'Active',
    paused: 'Paused',
    draft: 'Draft',
    completed: 'Completed',
    archived: 'Archived',
  }
  return statusMap[status] || titleCase(status)
}

/**
 * Format API response status
 */
export const formatApiStatus = (status: number): string => {
  if (status >= 200 && status < 300) return 'Success'
  if (status >= 300 && status < 400) return 'Redirect'
  if (status >= 400 && status < 500) return 'Client Error'
  if (status >= 500) return 'Server Error'
  return 'Unknown'
}

/**
 * Format bandwidth usage
 */
export const formatBandwidth = (bytes: number): string => {
  return formatFileSize(bytes)
}

/**
 * Format call quality score
 */
export const formatQualityScore = (score: number): string => {
  if (score >= 0.9) return 'Excellent'
  if (score >= 0.8) return 'Good'
  if (score >= 0.7) return 'Fair'
  if (score >= 0.6) return 'Poor'
  return 'Very Poor'
}

/**
 * Format geographic location
 */
export const formatLocation = (city?: string, state?: string, country?: string): string => {
  const parts = [city, state, country].filter(Boolean)
  return parts.join(', ')
}

/**
 * Format tracking number for display
 */
export const formatTrackingNumber = (trackingNumber: string): string => {
  // Add spaces for readability without using regex
  if (trackingNumber.length === 10) {
    return `(${trackingNumber.substring(0, 3)}) ${trackingNumber.substring(3, 6)}-${trackingNumber.substring(6)}`
  }
  return trackingNumber
}
