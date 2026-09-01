import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileFullScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Content to render at the bottom (e.g., submit button) — fixed on mobile */
  footer?: ReactNode;
  /** Max width for desktop mode */
  maxWidth?: string;
}

export default function MobileFullScreenDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-[700px]",
}: MobileFullScreenDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="inset-0 w-full h-full max-w-none max-h-none p-0 m-0 rounded-none border-0 gap-0 data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full">
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-4 py-3">
            <div>
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {description}
                </DialogDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-24">
            {children}
          </div>

          {/* Fixed Footer */}
          {footer && (
            <div className="sticky bottom-0 border-t bg-background px-4 py-3">
              {footer}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Desktop: normal dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${maxWidth} max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-4">{children}</div>
        {footer && <div className="pt-4">{footer}</div>}
      </DialogContent>
    </Dialog>
  );
}
