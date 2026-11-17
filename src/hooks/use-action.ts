import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/api'

export function useAction<TArgs = void, TResult = unknown>(
  fn: (args: TArgs) => Promise<TResult>,
  options: { invalidate?: QueryKey[]; success?: string; onSuccess?: (result: TResult) => void } = {},
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      options.invalidate?.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      if (options.success) toast.success(options.success)
      options.onSuccess?.(result)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })
}
