import { StatCard } from '../StatCard'
import { DollarSign } from 'lucide-react'

export default function StatCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
      <StatCard
        title="Total Revenue"
        value="$48,250"
        icon={DollarSign}
        trend={{ value: "+12.5% from last month", isPositive: true }}
        testId="card-revenue"
      />
    </div>
  )
}
