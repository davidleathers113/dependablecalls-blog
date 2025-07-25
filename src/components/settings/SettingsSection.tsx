import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

/**
 * Props for the SettingsSection component
 */
export interface SettingsSectionProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The title of the settings section
   */
  title: string
  /**
   * Optional description text for the section
   */
  description?: string
  /**
   * Optional icon to display with the section title
   */
  icon?: React.ReactNode
  /**
   * Whether to show a divider at the bottom of the section
   * @default true
   */
  showDivider?: boolean
  /**
   * Additional actions to display in the section header
   */
  actions?: React.ReactNode
}

/**
 * A container component for grouping related settings.
 * Provides consistent styling and layout for settings sections.
 *
 * @example
 * ```tsx
 * <SettingsSection
 *   title="Notifications"
 *   description="Configure how you receive notifications"
 *   icon={<BellIcon className="h-5 w-5" />}
 * >
 *   <SettingsToggle label="Email notifications" />
 *   <SettingsToggle label="Push notifications" />
 * </SettingsSection>
 * ```
 */
const SettingsSection = forwardRef<HTMLDivElement, SettingsSectionProps>(
  (
    { className = '', title, description, icon, showDivider = true, actions, children, ...props },
    ref
  ) => {
    const sectionClasses = ['pb-6', showDivider && 'border-b border-gray-200', className]
      .filter(Boolean)
      .join(' ')

    return (
      <div ref={ref} className={sectionClasses} {...props}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start">
            {icon && (
              <div className="flex-shrink-0 mr-3">
                <span className="text-gray-400">{icon}</span>
              </div>
            )}
            <div>
              <h3 className="text-lg font-medium text-gray-900">{title}</h3>
              {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
            </div>
          </div>
          {actions && <div className="ml-4 flex-shrink-0">{actions}</div>}
        </div>
        <div className={icon ? 'ml-8' : ''}>{children}</div>
      </div>
    )
  }
)

SettingsSection.displayName = 'SettingsSection'

export { SettingsSection }
export default SettingsSection
