<template>
  <div class="space-y-4">
    <div class="form-control">
      <label class="label">
        <span class="label-text font-medium">Station Logo</span>
      </label>
      <div class="flex items-center space-x-4">
        <div class="w-24 h-24 bg-base-300 rounded-lg overflow-hidden">
          <img v-if="logoPreview" :src="logoPreview" class="w-full h-full object-cover" alt="Logo Preview" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Icon name="ph:radio-solid" class="w-12 h-12 text-base-content/50" />
          </div>
        </div>
        <div>
          <input type="file" ref="logoFileInput" class="hidden" accept="image/*" @change="handleLogoFileChange" />
          <button @click="logoFileInput?.click()" class="btn btn-sm btn-outline">
            {{ logoPreview ? 'Change Logo' : 'Upload Logo' }}
          </button>
          <button v-if="logoPreview" @click="removeLogo" class="btn btn-sm btn-ghost text-error ml-2">
            Remove
          </button>
        </div>
      </div>
    </div>
    
    <div class="form-control">
      <label class="label">
        <span class="label-text font-medium">Background Image</span>
      </label>
      <div class="flex items-center space-x-4">
        <div class="w-32 h-16 bg-base-300 rounded-lg overflow-hidden">
          <img v-if="backgroundPreview" :src="backgroundPreview" class="w-full h-full object-cover" alt="Background Preview" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Icon name="ph:image" class="w-8 h-8 text-base-content/50" />
          </div>
        </div>
        <div>
          <input type="file" ref="backgroundFileInput" class="hidden" accept="image/*" @change="handleBackgroundFileChange" />
          <button @click="backgroundFileInput?.click()" class="btn btn-sm btn-outline">
            {{ backgroundPreview ? 'Change Background' : 'Upload Background' }}
          </button>
          <button v-if="backgroundPreview" @click="removeBackground" class="btn btn-sm btn-ghost text-error ml-2">
            Remove
          </button>
        </div>
      </div>
    </div>
    
    <div class="flex justify-end">
      <button @click="saveImages" class="btn btn-primary" :disabled="!hasChanges || isSaving">
        {{ isSaving ? 'Saving...' : 'Save Images' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from '#imports';

interface Props {
  channelId: string;
  currentLogoPath?: string | null;
  currentBackgroundPath?: string | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'updated', data: { logoImagePath?: string | null, backgroundImagePath?: string | null }): void;
}>();

const logoFileInput = ref<HTMLInputElement | null>(null);
const backgroundFileInput = ref<HTMLInputElement | null>(null);

const logoFile = ref<File | null>(null);
const backgroundFile = ref<File | null>(null);
const logoPreview = ref<string | null>(props.currentLogoPath || null);
const backgroundPreview = ref<string | null>(props.currentBackgroundPath || null);
const isSaving = ref(false);

const hasChanges = computed((): boolean => {
  return logoFile.value !== null || backgroundFile.value !== null;
});

function handleLogoFileChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    logoFile.value = target.files[0];
    logoPreview.value = URL.createObjectURL(logoFile.value);
  }
}

function handleBackgroundFileChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    backgroundFile.value = target.files[0];
    backgroundPreview.value = URL.createObjectURL(backgroundFile.value);
  }
}

function removeLogo(): void {
  logoFile.value = null;
  logoPreview.value = null;
  if (logoFileInput.value) logoFileInput.value.value = '';
}

function removeBackground(): void {
  backgroundFile.value = null;
  backgroundPreview.value = null;
  if (backgroundFileInput.value) backgroundFileInput.value.value = '';
}

// Helper function to get file extension safely
const getExtension = (filename: string): string => {
  const parts = filename.split('.');
  if (parts.length > 1) {
    return `.${parts.pop()}`;
  }
  return '';
};

// Helper function to convert File to Base64
const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      const base64String = reader.result.split(',')[1];
      if (base64String) {
        resolve(base64String);
      } else {
        reject(new Error('Could not extract Base64 string from Data URL.'));
      }
    } else {
      reject(new Error('Failed to read file as Base64 string.'));
    }
  };
  reader.onerror = error => reject(error);
});

async function saveImages(): Promise<void> {
  if (!hasChanges.value) return;
  
  isSaving.value = true;
  
  try {
    const payload: { 
      logoImageBase64?: string; 
      logoImageExtension?: string; 
      backgroundImageBase64?: string; 
      backgroundImageExtension?: string; 
    } = {};

    if (logoFile.value) {
      payload.logoImageBase64 = await toBase64(logoFile.value);
      payload.logoImageExtension = getExtension(logoFile.value.name);
    }
    
    if (backgroundFile.value) {
      payload.backgroundImageBase64 = await toBase64(backgroundFile.value);
      payload.backgroundImageExtension = getExtension(backgroundFile.value.name);
    }
    
    // Send to API
    const response = await $fetch(`/api/radio-stations/${props.channelId}/images`, {
      method: 'PUT',
      body: payload
    });
    
    // Emit updated event with new paths
    emit('updated', {
      logoImagePath: response.logoImagePath,
      backgroundImagePath: response.backgroundImagePath
    });
    
    // Reset file inputs
    logoFile.value = null;
    backgroundFile.value = null;
    
    // Update previews with new paths
    logoPreview.value = response.logoImagePath ?? null;
    backgroundPreview.value = response.backgroundImagePath ?? null;
    
  } catch (error) {
    console.error('Error saving images:', error);
    // Handle error (show toast notification, etc.)
  } finally {
    isSaving.value = false;
  }
}
</script>
