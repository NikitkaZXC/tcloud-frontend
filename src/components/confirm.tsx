import type { ReactNode } from 'react'
import { Slot } from 'radix-ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export function Confirm({
  title,
  description,
  action = 'Удалить',
  onConfirm,
  children,
  open,
  onOpenChange,
  skip,
}: {
  title: string
  description?: ReactNode
  action?: string
  onConfirm: () => void
  children: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  skip?: boolean
}) {
  if (skip) return <Slot.Root onClick={onConfirm}>{children}</Slot.Root>
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
