import { ProjectCard } from '../ProjectCard'

export default function ProjectCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      <ProjectCard
        id="1"
        name="Residential Exterior Paint"
        clientName="John Smith"
        status="in-progress"
        location="123 Main St, Oakland, CA"
        startDate="Jan 15, 2025"
        estimatedCompletion="Jan 30, 2025"
        onClick={() => console.log('View project 1')}
      />
      <ProjectCard
        id="2"
        name="Office Interior Refresh"
        clientName="Tech Startup Inc"
        status="pending"
        location="456 Market St, San Francisco, CA"
        startDate="Feb 1, 2025"
        onClick={() => console.log('View project 2')}
      />
    </div>
  )
}
