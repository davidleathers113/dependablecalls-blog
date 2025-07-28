export interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'white' | 'dark'
}

export function Logo({ className = '', size = 'md', variant = 'default' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-6 w-auto',
    md: 'h-8 w-auto',
    lg: 'h-10 w-auto'
  }

  const textSizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl'
  }

  const textColorClass = variant === 'white' ? 'text-white' : 'text-gray-900'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src="/images/dce-logo.png"
        alt="DependableCalls"
        className={`${sizeClasses[size]}`}
      />
      <span className={`font-semibold ${textSizeClasses[size]} ${textColorClass}`}>
        Dependable Calls
      </span>
    </div>
  )
}

export default Logo