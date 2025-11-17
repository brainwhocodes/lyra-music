import { ref, readonly } from '#imports';

// Define the structure of a toast message
interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

// Create a reactive array to store toast messages
const toasts = ref<ToastMessage[]>([]);

// This will be our composable
export function useToast() {
  const add = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now() + Math.random();
    const duration = toast.duration || 5000; // Default duration 5 seconds

    toasts.value.push({ id, ...toast });

    // Automatically remove the toast after its duration
    setTimeout(() => {
      remove(id);
    }, duration);
  };

  const remove = (id: number) => {
    toasts.value = toasts.value.filter((t: ToastMessage) => t.id !== id);
  };

  return {
    toasts: readonly(toasts), // Expose a readonly version of the toasts array
    add,
    remove,
  };
}
