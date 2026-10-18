<template>
  <AuthShell headline="Welcome back to your music."
    ><h1>Login</h1>
    <form @submit.prevent="login" :aria-busy="loading">
      <div>
        <label class="label" for="login-email">Email</label>
        <div>
          <input
            id="login-email"
            v-model="state.email"
            type="email"
            class="input"
            autocomplete="email"
            required
            :aria-invalid="!!validationErrors.email"
            :aria-describedby="
              validationErrors.email ? 'login-email-error' : undefined
            "
          />
        </div>
        <p
          v-if="validationErrors.email"
          id="login-email-error"
          class="field-error"
        >
          {{ validationErrors.email }}
        </p>
      </div>
      <div>
        <label class="label" for="login-password">Password</label>
        <div class="password-field">
          <input
            id="login-password"
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            class="input"
            autocomplete="current-password"
            required
            :aria-invalid="!!validationErrors.password"
            :aria-describedby="
              validationErrors.password ? 'login-password-error' : undefined
            "
          /><button
            type="button"
            class="btn btn-ghost control-icon"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            :title="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <Icon
              :name="
                showPassword
                  ? 'material-symbols:visibility-off-rounded'
                  : 'material-symbols:visibility-rounded'
              "
              size="20"
              class="w-5 h-5"
            />
          </button>
        </div>
        <p
          v-if="validationErrors.password"
          id="login-password-error"
          class="field-error"
        >
          {{ validationErrors.password }}
        </p>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? "Please wait…" : "Login" }}
      </button>
      <p v-if="errorMessage" role="alert" class="field-error">
        {{ errorMessage }}
      </p>
    </form>
    <p class="form-footer">
      Don't have an account?
      <NuxtLink to="/register" class="link link-primary">Register</NuxtLink>
    </p></AuthShell
  >
</template>
<script setup lang="ts">
import { z } from "zod";
import { useUser } from "~/composables/use-user";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginSchema = z.output<typeof loginSchema>;

interface ValidationError {
  email?: string;
  password?: string;
}

const state = reactive<LoginSchema>({
  email: "",
  password: "",
});

const showPassword = ref(false);
useSeoMeta({ title: "Login — Lyra" });
const loading = ref(false);
const { fetchUser } = useUser();
const errorMessage = ref<string | null>(null);
const validationErrors = ref<ValidationError>({});

async function login() {
  if (loading.value) return;
  loading.value = true;
  errorMessage.value = null;
  validationErrors.value = {};

  // Validate form data
  const result = loginSchema.safeParse(state);
  if (!result.success) {
    const fieldErrors: ValidationError = {};
    result.error.errors.forEach((err) => {
      if (err.path[0] === "email") fieldErrors.email = err.message;
      if (err.path[0] === "password") fieldErrors.password = err.message;
    });
    validationErrors.value = fieldErrors;
    loading.value = false;
    return;
  }

  try {
    const response = await $fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(result.data), // Use validated data
    });

    // Handle successful login - cookie is already set by server
    // Fetch user data to populate the user composable state
    await fetchUser();

    // Redirect to the libraries page upon successful login
    await navigateTo("/library");
  } catch (error: any) {
    if (error.data && error.data.message) {
      errorMessage.value = error.data.message;
    } else {
      errorMessage.value = "An unexpected error occurred. Please try again.";
    }
  } finally {
    loading.value = false;
  }
}
</script>
