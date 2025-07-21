import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Layout from "./pages/Layout";
import NotFound from "./pages/NotFound";
import Residents from "./pages/Residents";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import AuthGuard from "./components/AuthGuard";
// Import halaman ResidentHistory
import ResidentHistory from "./pages/ResidentHistory";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={
            <AuthGuard>
              <Layout>
                <Dashboard />
              </Layout>
            </AuthGuard>
          } />
          <Route path="/residents" element={
            <AuthGuard>
              <Layout>
                <Residents />
              </Layout>
            </AuthGuard>
          } />
          <Route path="/payments" element={
            <AuthGuard>
              <Layout>
                <Payments />
              </Layout>
            </AuthGuard>
          } />
          <Route path="/reports" element={
            <AuthGuard>
              <Layout>
                <Reports />
              </Layout>
            </AuthGuard>
          } />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="/resident-history" element={<ResidentHistory />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
