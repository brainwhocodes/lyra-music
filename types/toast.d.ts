// Define the toast interface with the methods you're using
interface ToastInterface {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
  // Add other methods your toast plugin provides as needed
}

// Augment the NuxtApp interface to include $toast
declare module '#app' {
  interface NuxtApp {
    $toast: ToastInterface;
  }
}

// For Vue component instances
declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $toast: ToastInterface;
  }
}
