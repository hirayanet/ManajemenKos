import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import MobileNav from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex flex-col bg-background">
          {/* Mobile Header */}
          <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center h-full px-4">
              <h1 className="font-bold text-base">Sistem Manajemen Kos</h1>
            </div>
          </header>

          {/* Mobile Content */}
          <main className="flex-1 p-4 pb-20 overflow-y-auto">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <MobileNav />
        </div>
      </SidebarProvider>
    );
  }

  // Desktop layout — original sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center h-full px-4">
              <SidebarTrigger className="mr-4" />
              <div className="flex items-center space-x-2">
                <h1 className="font-semibold">Sistem Manajemen Kos</h1>
              </div>
            </div>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Layout;