import { useToast } from '~/composables/useToast'
import type { MessageType } from '~/types/message-type'

export function useNotification() {
  const toast = useToast()

  const showNotification = (message: string, type: MessageType = 'info'): void => {
    toast.add({ message, type })
  }

  return { showNotification }
}
