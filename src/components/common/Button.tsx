import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      loading = false,
      asChild = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button'

    const baseClasses = [
      'inline-flex items-center justify-center font-medium transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
      fullWidth && 'w-full',
    ]
      .filter(Boolean)
      .join(' ')

    const variantClasses = {
      primary: [
        'bg-blue-600 text-white border border-transparent',
        'hover:bg-blue-700 focus:ring-blue-500',
        'active:bg-blue-800',
      ].join(' '),
      secondary: [
        'bg-gray-600 text-white border border-transparent',
        'hover:bg-gray-700 focus:ring-gray-500',
        'active:bg-gray-800',
      ].join(' '),
      outline: [
        'bg-white text-gray-700 border border-gray-300',
        'hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-500',
        'active:bg-gray-100',
      ].join(' '),
      ghost: [
        'bg-transparent text-gray-700 border border-transparent',
        'hover:bg-gray-100 focus:ring-gray-500',
        'active:bg-gray-200',
      ].join(' '),
      danger: [
        'bg-red-600 text-white border border-transparent',
        'hover:bg-red-700 focus:ring-red-500',
        'active:bg-red-800',
      ].join(' '),
    }

    const sizeClasses = {
      sm: 'h-8 px-3 text-sm rounded-md',
      md: 'h-10 px-4 text-sm rounded-md',
      lg: 'h-11 px-6 text-base rounded-md',
    }

    const classes = [baseClasses, variantClasses[variant], sizeClasses[size], className]
      .filter(Boolean)
      .join(' ')

    const isDisabled = disabled || loading

    const content = (
      <>
        {loading && (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {!loading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!loading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </>
    )

    return (
      <Comp ref={ref} className={classes} disabled={isDisabled} {...props}>
        {content}
      </Comp>
    )
  }
)

Button.displayName = 'Button'

export { Button }
export default Button
