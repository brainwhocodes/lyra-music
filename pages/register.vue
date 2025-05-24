<template>
  <div class="flex items-center justify-center min-h-screen bg-base-200">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title justify-center text-2xl font-bold">Register</h2>

        <form @submit.prevent="register" class="space-y-4">
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
              <span class="label-text">Name</span>
            </div>
            <input 
              v-model="state.name" 
              type="text" 
              placeholder="Your name" 
              class="input input-bordered w-full" 
              required 
            />
            <div class="label" v-if="validationErrors.name">
              <span class="label-text-alt text-error">{{ validationErrors.name }}</span>
            </div>
          </label>

          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">Password</span>
            </div>
            <input 
              v-model="state.password" 
              type="password" 
              placeholder="Create a password" 
              class="input input-bordered w-full" 
              required 
            />
            <div class="label" v-if="validationErrors.password">
              <span class="label-text-alt text-error">{{ validationErrors.password }}</span>
            </div>
          </label>

          <label class="form-control w-full">
            <div class="label">
              <span class="label-text">Confirm Password</span>
            </div>
            <input 
              v-model="state.confirmPassword" 
              type="password" 
              placeholder="Confirm your password" 
              class="input input-bordered w-full" 
              required 
            />
            <div class="label" v-if="validationErrors.confirmPassword">
              <span class="label-text-alt text-error">{{ validationErrors.confirmPassword }}</span>
            </div>
          </label>

          <div class="card-actions justify-end">
            <button type="submit" class="btn btn-primary w-full" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner"></span>
              Register
            </button>
          </div>

          <div v-if="errorMessage" class="text-error text-sm text-center mt-2">
            {{ errorMessage }}
          </div>
          <div v-if="successMessage" class="text-success text-sm text-center mt-2">
            {{ successMessage }}
          </div>
        </form>

        <div class="divider"></div>

        <div class="text-sm text-center">
          Already have an account? 
          <NuxtLink to="/login" class="link link-primary">Login</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Password confirmation must be at least 8 characters'),
  name: z.string().min(3, 'Name must be at least 3 characters'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'] // path of error
})

type RegisterSchema = z.output<typeof registerSchema>

interface ValidationError {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
}

const state = reactive<RegisterSchema>({
  email: '',
  password: '',
  confirmPassword: '',
  name: ''
})

const loading = ref(false)
const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const validationErrors = ref<ValidationError>({})

async function register() {
  loading.value = true
  errorMessage.value = null
  successMessage.value = null
  validationErrors.value = {}

  // Validate form data
  const result = registerSchema.safeParse(state)
  if (!result.success) {
    const fieldErrors: ValidationError = {}
    result.error.errors.forEach(err => {
      const field = err.path[0]
      if (field === 'email') fieldErrors.email = err.message
      if (field === 'password') fieldErrors.password = err.message
      if (field === 'confirmPassword') fieldErrors.confirmPassword = err.message
    })
    validationErrors.value = fieldErrors
    loading.value = false
    return
  }

  try {
    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: result.data.email,
        password: result.data.password,
        name: result.data.name
      }
    })

    console.log('Registration successful:', response)
    successMessage.value = 'Registration successful! Redirecting to library...' 
    
    // Redirect to login page after a short delay
    setTimeout(() => {
      navigateTo('/library')
    })

  } catch (error: any) {
    console.error('Registration failed:', error)
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
