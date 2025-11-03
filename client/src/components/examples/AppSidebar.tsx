import { AppSidebar } from '../AppSidebar'
import { SidebarProvider } from '@/components/ui/sidebar'

export default function AppSidebarExample() {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 p-8">
          <p className="text-sm text-muted-foreground">Main content area</p>
        </div>
      </div>
    </SidebarProvider>
  )
}
