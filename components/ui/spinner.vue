<template>
  <div :class="['spinner', sizeClass]" role="status" aria-label="Loading">
    <div class="spinner-circle"></div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  size: {
    type: String,
    default: 'md',
    validator: (value: string) => ['xs', 'sm', 'md', 'lg', 'xl'].includes(value)
  }
});

const sizeClass = computed(() => `spinner-${props.size}`);
</script>

<style scoped>
.spinner {
  display: inline-flex;
  position: relative;
}

.spinner-circle {
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Size variants */
.spinner-xs {
  width: 1rem;
  height: 1rem;
}
.spinner-xs .spinner-circle {
  width: 1rem;
  height: 1rem;
  border-width: 2px;
}

.spinner-sm {
  width: 1.5rem;
  height: 1.5rem;
}
.spinner-sm .spinner-circle {
  width: 1.5rem;
  height: 1.5rem;
  border-width: 2px;
}

.spinner-md {
  width: 2rem;
  height: 2rem;
}
.spinner-md .spinner-circle {
  width: 2rem;
  height: 2rem;
  border-width: 3px;
}

.spinner-lg {
  width: 2.5rem;
  height: 2.5rem;
}
.spinner-lg .spinner-circle {
  width: 2.5rem;
  height: 2.5rem;
  border-width: 3px;
}

.spinner-xl {
  width: 3rem;
  height: 3rem;
}
.spinner-xl .spinner-circle {
  width: 3rem;
  height: 3rem;
  border-width: 4px;
}
</style>
