<template>
  <AuthShell headline="A place for your collection."
    ><h1>Register</h1>
    <form @submit.prevent="register" :aria-busy="loading">
      <div>
        <label class="label" for="register-email">Email</label>
        <div>
          <input
            id="register-email"
            v-model="state.email"
            type="email"
            class="input"
            autocomplete="email"
            required
            :aria-invalid="!!validationErrors.email"
            :aria-describedby="
              validationErrors.email ? 'register-email-error' : undefined
            "
          />
        </div>
        <p
          v-if="validationErrors.email"
          id="register-email-error"
          class="field-error"
        >
          {{ validationErrors.email }}
        </p>
      </div>
      <div>
        <label class="label" for="register-name">Name</label>
        <div>
          <input
            id="register-name"
            v-model="state.name"
            type="text"
            class="input"
            autocomplete="name"
            required
            :aria-invalid="!!validationErrors.name"
            :aria-describedby="
              validationErrors.name ? 'register-name-error' : undefined
            "
          />
        </div>
        <p
          v-if="validationErrors.name"
          id="register-name-error"
          class="field-error"
        >
          {{ validationErrors.name }}
        </p>
      </div>
      <div>
        <label class="label" for="register-password">Password</label>
        <div class="password-field">
          <input
            id="register-password"
            v-model="state.password"
            :type="showPassword ? 'text' : 'password'"
            class="input"
            autocomplete="new-password"
            required
            :aria-invalid="!!validationErrors.password"
            :aria-describedby="
              validationErrors.password ? 'register-password-error' : undefined
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
          id="register-password-error"
          class="field-error"
        >
          {{ validationErrors.password }}
        </p>
      </div>
      <div>
        <label class="label" for="register-confirmPassword"
          >Confirm Password</label
        >
        <div class="password-field">
          <input
            id="register-confirmPassword"
            v-model="state.confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            class="input"
            autocomplete="new-password"
            required
            :aria-invalid="!!validationErrors.confirmPassword"
            :aria-describedby="
              validationErrors.confirmPassword
                ? 'register-confirmPassword-error'
                : undefined
            "
          />
        </div>
        <p
          v-if="validationErrors.confirmPassword"
          id="register-confirmPassword-error"
          class="field-error"
        >
          {{ validationErrors.confirmPassword }}
        </p>
      </div>
      <div>
        <label class="label" for="register-accessCode">Access Code</label>
        <div>
          <input
            id="register-accessCode"
            v-model="state.accessCode"
            type="text"
            class="input"
            autocomplete="off"
            required
            :aria-invalid="!!validationErrors.accessCode"
            :aria-describedby="
              validationErrors.accessCode
                ? 'register-accessCode-error'
                : 'access-hint'
            "
          />
        </div>
        <p
          v-if="validationErrors.accessCode"
          id="register-accessCode-error"
          class="field-error"
        >
          {{ validationErrors.accessCode }}
        </p>
        <p id="access-hint" class="field-hint">
          Get an access code from your server administrator.
        </p>
      </div>
      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? "Please wait…" : "Register" }}
      </button>
      <p v-if="errorMessage" role="alert" class="field-error">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" role="status">{{ successMessage }}</p>
    </form>
    <p class="form-footer">
      Already have an account?
      <NuxtLink to="/login" class="link link-primary">Login</NuxtLink>
    </p></AuthShell
  >
</template>
<script setup lang="ts">
import { z } from "zod";
import { useUser } from "~/composables/use-user";

const registerSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "Password confirmation must be at least 8 characters"),
    name: z.string().min(3, "Name must be at least 3 characters"),
    accessCode: z.string().optional().default(""),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], // path of error
  });

type RegisterSchema = z.output<typeof registerSchema>;

interface ValidationError {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  accessCode?: string;
}

const state = reactive<RegisterSchema>({
  email: "",
  password: "",
  confirmPassword: "",
  name: "",
  accessCode: "",
});

const showPassword = ref(false);
useSeoMeta({ title: "Register — Lyra" });
const loading = ref(false);
const { fetchUser } = useUser();
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const validationErrors = ref<ValidationError>({});

async function register() {
  if (loading.value) return;
  loading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  validationErrors.value = {};

  // Validate form data
  const result = registerSchema.safeParse(state);
  if (!result.success) {
    const fieldErrors: ValidationError = {};
    result.error.errors.forEach((err) => {
      const field = err.path[0];
      if (field === "email") fieldErrors.email = err.message;
      if (field === "name") fieldErrors.name = err.message;
      if (field === "accessCode") fieldErrors.accessCode = err.message;
      if (field === "password") fieldErrors.password = err.message;
      if (field === "confirmPassword")
        fieldErrors.confirmPassword = err.message;
    });
    validationErrors.value = fieldErrors;
    loading.value = false;
    return;
  }

  try {
    const response = await $fetch("/api/auth/register", {
      method: "POST",
      body: {
        email: result.data.email,
        password: result.data.password,
        name: result.data.name,
        accessCode: result.data.accessCode,
      },
    });

    successMessage.value = "Registration successful! Redirecting to library...";

    // Handle successful registration - cookie is already set by server
    // Fetch user data to populate the user composable state
    await fetchUser();

    // Redirect to library page after a short delay
    await navigateTo("/library");
  } catch (error: any) {
    console.error("Registration failed:", error);
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
