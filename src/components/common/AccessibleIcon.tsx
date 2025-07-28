import React from 'react'

interface AccessibleIconProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  'aria-label'?: string
  decorative?: boolean
  className?: string
}

export function AccessibleIcon({ 
  icon: Icon, 
  'aria-label': ariaLabel,
  decorative = false,
  className = '' 
}: AccessibleIconProps) {
  if (decorative) {
    return <Icon className={className} aria-hidden={true} />
  }
  return <Icon className={className} aria-label={ariaLabel} />
}

export default AccessibleIcon