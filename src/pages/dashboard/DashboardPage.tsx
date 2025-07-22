import { useAuthStore } from '../../store/authStore'
import { 
  CurrencyDollarIcon, 
  PhoneIcon, 
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

const stats = [
  { name: 'Total Revenue', stat: '$24,563', icon: CurrencyDollarIcon, change: '+12%', changeType: 'increase' },
  { name: 'Total Calls', stat: '1,234', icon: PhoneIcon, change: '+8%', changeType: 'increase' },
  { name: 'Active Campaigns', stat: '12', icon: ChartBarIcon, change: '+2', changeType: 'increase' },
  { name: 'Conversion Rate', stat: '24.5%', icon: ArrowTrendingUpIcon, change: '-2%', changeType: 'decrease' },
]

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function DashboardPage() {
  const { user, userType } = useAuthStore()

  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Welcome back, {user?.email}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="mt-8">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            {userType === 'supplier' ? 'Campaign Performance' : 'Lead Overview'}
          </h2>
          <dl className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div
                key={item.name}
                className="relative bg-white pt-5 px-4 pb-12 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden"
              >
                <dt>
                  <div className="absolute bg-primary-500 rounded-md p-3">
                    <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <p className="ml-16 text-sm font-medium text-gray-500 truncate">{item.name}</p>
                </dt>
                <dd className="ml-16 pb-6 flex items-baseline sm:pb-7">
                  <p className="text-2xl font-semibold text-gray-900">{item.stat}</p>
                  <p
                    className={classNames(
                      item.changeType === 'increase' ? 'text-green-600' : 'text-red-600',
                      'ml-2 flex items-baseline text-sm font-semibold'
                    )}
                  >
                    {item.change}
                  </p>
                  <div className="absolute bottom-0 inset-x-0 bg-gray-50 px-4 py-4 sm:px-6">
                    <div className="text-sm">
                      <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
                        View all<span className="sr-only"> {item.name} stats</span>
                      </a>
                    </div>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h2 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h2>
          <div className="mt-5 bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              <li className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <PhoneIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">New call received</p>
                      <p className="text-sm text-gray-500">Campaign: Home Services</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">2 minutes ago</div>
                </div>
              </li>
              <li className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CurrencyDollarIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Payment processed</p>
                      <p className="text-sm text-gray-500">Amount: $125.00</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">1 hour ago</div>
                </div>
              </li>
              <li className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <ChartBarIcon className="h-8 w-8 text-gray-400" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Campaign activated</p>
                      <p className="text-sm text-gray-500">Campaign: Insurance Leads</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">3 hours ago</div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}