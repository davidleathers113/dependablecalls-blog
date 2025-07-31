import { Link, useLocation } from 'react-router-dom'
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const location = useLocation()

  const allItems = [
    { label: 'Home', href: '/' },
    ...items
  ]

  return (
    <nav className={`flex ${className}`} aria-label="Breadcrumb">


      <ol className="flex items-center space-x-1">
        {allItems.map((item, index) => (
          <li key={index} className="flex items-center">
            {index === 0 ? (
              <div className="flex items-center">
                {item.href ? (
                  <Link
                    to={item.href}
                    className="text-gray-400 hover:text-gray-500 transition-colors duration-200 p-1 -m-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label="Go to home page"
                  >
                    <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  </Link>
                ) : (
                  <HomeIcon className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                )}
              </div>
            ) : (
              <>
                <ChevronRightIcon
                  className="h-5 w-5 flex-shrink-0 text-gray-300 mx-2"
                  aria-hidden="true"
                />
                <div className="flex items-center">
                  {item.href && location.pathname !== item.href ? (
                    <Link
                      to={item.href}
                      className="text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors duration-200 p-1 -m-1 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className="text-sm font-medium text-gray-900"
                      aria-current="page"
                    >
                      {item.label}
                    </span>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}