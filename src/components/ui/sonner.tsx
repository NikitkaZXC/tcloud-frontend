import { Toaster as Sonner, type ToasterProps } from "sonner"
import { useTheme } from "@/lib/theme"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "2px",
          "--success-bg": "color-mix(in oklab, var(--success) 12%, var(--popover))",
          "--success-border": "var(--success)",
          "--success-text": "var(--success)",
          "--error-bg": "color-mix(in oklab, var(--destructive) 12%, var(--popover))",
          "--error-border": "var(--destructive)",
          "--error-text": "var(--destructive)",
          "--warning-bg": "color-mix(in oklab, var(--warning) 12%, var(--popover))",
          "--warning-border": "var(--warning)",
          "--warning-text": "var(--warning)",
          "--info-bg": "color-mix(in oklab, var(--read) 12%, var(--popover))",
          "--info-border": "var(--read)",
          "--info-text": "var(--read)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
