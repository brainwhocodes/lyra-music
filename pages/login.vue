<template>
  <div class="flex items-center justify-center min-h-screen bg-base-200">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title justify-center text-2xl font-bold">Login</h2>

        <form @submit.prevent="login" class="space-y-4">
          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">Email</span>
            </div>
            <input 
              v-model="state.email" 
              type="email" 
              placeholder="you@example.com" 
              class="input input-bordered w-full" 
              required 
            />
             <div class="label" v-if="validationErrors.email">
              <span class="label-text-alt text-error">{{ validationErrors.email }}</span>
            </div>
          </label>

          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">Password</span>
            </div>
            <input 
              v-model="state.password" 
              type="password" 
              placeholder="********" 
              class="input input-bordered w-full" 
              required 
            />
             <div class="label" v-if="validationErrors.password">
              <span class="label-text-alt text-error">{{ validationErrors.password }}</span>
            </div>
          </label>

          <div class="card-actions justify-end">
            <button type="submit" class="btn btn-primary w-full" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner"></span>
              Login
            </button>
          </div>

          <div v-if="errorMessage" class="text-error text-sm text-center mt-2">
            {{ errorMessage }}
          </div>
        </form>

        <div class="divider"></div>

        <div class="text-sm text-center">
          Don't have an account? 
          <NuxtLink to="/register" class="link link-primary">Register</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'
import { useUser } from '~/composables/use-user'

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters')
})

type LoginSchema = z.output<typeof loginSchema>

interface ValidationError {
  email?: string;
  password?: string;
}

const state = reactive<LoginSchema>({
  email: '',
  password: ''
})

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const validationErrors = ref<ValidationError>({})

async function login() {
  loading.value = true
  errorMessage.value = null
  validationErrors.value = {}

  // Validate form data
  const result = loginSchema.safeParse(state)
  if (!result.success) {
    const fieldErrors: ValidationError = {}
    result.error.errors.forEach(err => {
      if (err.path[0] === 'email') fieldErrors.email = err.message
      if (err.path[0] === 'password') fieldErrors.password = err.message
    })
    validationErrors.value = fieldErrors
    loading.value = false
    return
  }

  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(result.data) // Use validated data
    })

    // Handle successful login - cookie is already set by server
    // Fetch user data to populate the user composable state
    const { fetchUser } = useUser();
    await fetchUser();
    
    // Redirect to the libraries page upon successful login
    await navigateTo('/library');
  } catch (error: any) {
    if (error.data && error.data.message) {
      errorMessage.value = error.data.message
    } else {
      errorMessage.value = 'An unexpected error occurred. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>
