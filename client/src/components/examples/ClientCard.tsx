import { ClientCard } from '../ClientCard'

export default function ClientCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <ClientCard
        id="1"
        name="John Smith"
        email="john.smith@email.com"
        phone="(555) 123-4567"
        address="123 Main St, Oakland, CA 94612"
        projectCount={3}
        onClick={() => console.log('View client 1')}
      />
    </div>
  )
}
