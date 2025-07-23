import { HTMLAttributes } from 'react'

export interface LoadingProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'spinner' | 'dots' | 'pulse'
  text?: string
  centered?: boolean
  overlay?: boolean
}

const Loading = ({
  className = '',
  size = 'md',
  variant = 'spinner',
  text,
  centered = false,
  overlay = false,
  ...props
}: LoadingProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
  }

  const containerClasses = [
    'flex items-center',
    centered && 'justify-center',
    text ? 'flex-col space-y-2' : 'space-x-2',
    overlay && 'fixed inset-0 bg-white bg-opacity-75 z-50',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const renderSpinner = () => (
    <div
      className={`animate-spin rounded-full border-2 border-current border-t-transparent text-blue-600 ${sizeClasses[size]}`}
      role="status"
      aria-label="Loading"
    />
  )

  const renderDots = () => (
    <div className="flex space-x-1" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`bg-blue-600 rounded-full animate-pulse ${
            size === 'sm'
              ? 'h-1.5 w-1.5'
              : size === 'md'
                ? 'h-2 w-2'
                : size === 'lg'
                  ? 'h-2.5 w-2.5'
                  : 'h-3 w-3'
          }`}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '0.6s',
          }}
        />
      ))}
    </div>
  )

  const renderPulse = () => (
    <div
      className={`bg-blue-600 rounded-full animate-pulse ${sizeClasses[size]}`}
      role="status"
      aria-label="Loading"
    />
  )

  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return renderDots()
      case 'pulse':
        return renderPulse()
      case 'spinner':
      default:
        return renderSpinner()
    }
  }

  return (
    <div className={containerClasses} {...props}>
      {renderLoader()}
      {text && <span className={`text-gray-600 ${textSizeClasses[size]}`}>{text}</span>}
    </div>
  )
}

// Skeleton loading component for content placeholders
export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  rounded?: boolean
  lines?: number
}

const Skeleton = ({
  className = '',
  width,
  height,
  rounded = false,
  lines = 1,
  ...props
}: SkeletonProps) => {
  const baseClasses = ['animate-pulse bg-gray-200', rounded ? 'rounded-full' : 'rounded'].join(' ')

  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  }

  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} h-4`}
            style={{
              width: i === lines - 1 ? '60%' : '100%',
            }}
          />
        ))}
      </div>
    )
  }

  return <div className={`${baseClasses} ${className}`} style={style} {...props} />
}

// Full page loading component
export interface PageLoadingProps {
  text?: string
  size?: LoadingProps['size']
}

const PageLoading = ({ text = 'Loading...', size = 'lg' }: PageLoadingProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loading size={size} text={text} centered />
    </div>
  )
}

// Card/Component loading placeholder
export interface CardLoadingProps {
  lines?: number
  showAvatar?: boolean
}

const CardLoading = ({ lines = 3, showAvatar = false }: CardLoadingProps) => {
  return (
    <div className="p-6 space-y-4">
      {showAvatar && (
        <div className="flex items-center space-x-4">
          <Skeleton width={40} height={40} rounded />
          <div className="flex-1">
            <Skeleton width="60%" height={16} />
            <Skeleton width="40%" height={12} className="mt-2" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} height={16} />
        ))}
      </div>
    </div>
  )
}

export { Loading, Skeleton, PageLoading, CardLoading }
export default Loading
