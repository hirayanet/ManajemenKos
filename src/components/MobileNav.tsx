import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  Users,
  CreditCard,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const mainTabs = [
  { title: "Home", url: "/dashboard", icon: Home },
  { title: "Penghuni", url: "/residents", icon: Users },
  { title: "Bayar", url: "/payments", icon: CreditCard },
  { title: "Laporan", url: "/reports", icon: FileText },
];

const moreMenuItems = [
  { title: "Reservasi DP", url: "/dp-reservasi" },
  { title: "Pengeluaran", url: "/expenses" },
  { title: "Riwayat Penghuni", url: "/resident-history" },
  { title: "Manajemen Admin", url: "/admin-management" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleLogout = () => {
    localStorage.removeItem("admin_session");
    toast({
      title: "Logout berhasil",
      description: "Anda telah keluar dari sistem",
    });
    navigate("/login");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {mainTabs.map((tab) => {
          const isActive =
            location.pathname === tab.url ||
            (tab.url === "/dashboard" && location.pathname === "/");
          return (
            <NavLink
              key={tab.title}
              to={tab.url}
              className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-0"
            >
              <tab.icon
                className={`h-5 w-5 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {tab.title}
              </span>
            </NavLink>
          );
        })}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-0.5 px-3 py-2 min-w-0">
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">
                Lainnya
              </span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
            <SheetHeader className="pb-4">
              <SheetTitle className="text-lg">Menu Lainnya</SheetTitle>
            </SheetHeader>
            <div className="space-y-1 pb-4">
              {moreMenuItems.map((item) => (
                <button
                  key={item.url}
                  onClick={() => {
                    navigate(item.url);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    location.pathname === item.url
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {item.title}
                </button>
              ))}
              <div className="border-t border-border my-2" />
              <button
                onClick={() => {
                  handleLogout();
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                Keluar
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
