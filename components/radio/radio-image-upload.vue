<template>
  <div>
    <div class="image-columns">
      <section>
        <h3>Station logo</h3>
        <div class="image-preview logo-preview">
          <img
            v-if="logoPreview"
            :src="logoPreview"
            alt="Station logo preview"
          /><UtilityArt v-else />
        </div>
        <label class="label" for="station-logo-file">Choose logo image</label
        ><input
          id="station-logo-file"
          ref="logoInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="file-input w-full"
          :disabled="saving"
          @change="choose($event, 'logo')"
        /><button
          v-if="logoPreview"
          class="btn btn-ghost text-error mt-3"
          :disabled="saving"
          @click="remove('logo')"
        >
          Remove logo
        </button>
      </section>
      <section>
        <h3>Background image</h3>
        <div class="image-preview background-preview">
          <img
            v-if="backgroundPreview"
            :src="backgroundPreview"
            alt="Station background preview"
          /><UtilityArt v-else />
        </div>
        <label class="label" for="station-background-file"
          >Choose background image</label
        ><input
          id="station-background-file"
          ref="backgroundInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="file-input w-full"
          :disabled="saving"
          @change="choose($event, 'background')"
        /><button
          v-if="backgroundPreview"
          class="btn btn-ghost text-error mt-3"
          :disabled="saving"
          @click="remove('background')"
        >
          Remove background
        </button>
      </section>
    </div>
    <p v-if="error" role="alert" class="text-error mt-4">{{ error }}</p>
    <p v-if="saved" role="status" class="mt-4">Station images saved.</p>
    <div class="image-actions">
      <button
        class="btn btn-primary"
        :disabled="!changed || saving"
        @click="save"
      >
        {{ saving ? "Saving…" : "Save Images" }}</button
      ><button
        v-if="changed"
        class="btn btn-outline"
        :disabled="saving"
        @click="reset"
      >
        Cancel image changes
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
const props = defineProps<{
  channelId: string;
  currentLogoPath?: string | null;
  currentBackgroundPath?: string | null;
}>();
const emit = defineEmits<{
  updated: [
    data: {
      logoImagePath?: string | null;
      backgroundImagePath?: string | null;
    },
  ];
}>();
const logoInput = ref<HTMLInputElement | null>(null),
  backgroundInput = ref<HTMLInputElement | null>(null);
const logoFile = ref<File | null>(null),
  backgroundFile = ref<File | null>(null);
const logoPreview = ref<string | null>(props.currentLogoPath || null),
  backgroundPreview = ref<string | null>(props.currentBackgroundPath || null);
const removeLogo = ref(false),
  removeBackground = ref(false),
  saving = ref(false),
  saved = ref(false),
  error = ref("");
const changed = computed(
  () =>
    !!logoFile.value ||
    !!backgroundFile.value ||
    removeLogo.value ||
    removeBackground.value,
);
function release(value: string | null) {
  if (value?.startsWith("blob:")) URL.revokeObjectURL(value);
}
function reset() {
  release(logoPreview.value);
  release(backgroundPreview.value);
  logoPreview.value = props.currentLogoPath || null;
  backgroundPreview.value = props.currentBackgroundPath || null;
  logoFile.value = null;
  backgroundFile.value = null;
  removeLogo.value = false;
  removeBackground.value = false;
  if (logoInput.value) logoInput.value.value = "";
  if (backgroundInput.value) backgroundInput.value.value = "";
  error.value = "";
}
watch(
  () => [props.currentLogoPath, props.currentBackgroundPath],
  () => {
    if (!changed.value) reset();
  },
);
function choose(event: Event, kind: "logo" | "background") {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  error.value = "";
  saved.value = false;
  if (
    file.size > 5 * 1024 * 1024 ||
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)
  ) {
    error.value = "Choose a PNG, JPEG, WebP or GIF image under 5 MB.";
    input.value = "";
    return;
  }
  if (kind === "logo") {
    release(logoPreview.value);
    logoFile.value = file;
    logoPreview.value = URL.createObjectURL(file);
    removeLogo.value = false;
  } else {
    release(backgroundPreview.value);
    backgroundFile.value = file;
    backgroundPreview.value = URL.createObjectURL(file);
    removeBackground.value = false;
  }
}
function remove(kind: "logo" | "background") {
  saved.value = false;
  if (kind === "logo") {
    release(logoPreview.value);
    logoPreview.value = null;
    logoFile.value = null;
    removeLogo.value = !!props.currentLogoPath;
    if (logoInput.value) logoInput.value.value = "";
  } else {
    release(backgroundPreview.value);
    backgroundPreview.value = null;
    backgroundFile.value = null;
    removeBackground.value = !!props.currentBackgroundPath;
    if (backgroundInput.value) backgroundInput.value.value = "";
  }
}
function base64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}
const extensions: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpeg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
async function save() {
  if (!changed.value || saving.value) return;
  saving.value = true;
  error.value = "";
  saved.value = false;
  try {
    const body: Record<string, string | boolean> = {};
    if (logoFile.value) {
      body.logoImageBase64 = await base64(logoFile.value);
      body.logoImageExtension = extensions[logoFile.value.type]!;
    } else if (removeLogo.value) body.removeLogo = true;
    if (backgroundFile.value) {
      body.backgroundImageBase64 = await base64(backgroundFile.value);
      body.backgroundImageExtension = extensions[backgroundFile.value.type]!;
    } else if (removeBackground.value) body.removeBackground = true;
    const result = await $fetch<{
      logoImagePath: string | null;
      backgroundImagePath: string | null;
    }>(`/api/radio-stations/${props.channelId}/images`, {
      method: "PUT",
      body,
    });
    release(logoPreview.value);
    release(backgroundPreview.value);
    logoFile.value = null;
    backgroundFile.value = null;
    removeLogo.value = false;
    removeBackground.value = false;
    logoPreview.value = result.logoImagePath;
    backgroundPreview.value = result.backgroundImagePath;
    if (logoInput.value) logoInput.value.value = "";
    if (backgroundInput.value) backgroundInput.value.value = "";
    emit("updated", result);
    saved.value = true;
  } catch (err: any) {
    error.value =
      err?.data?.statusMessage ||
      "Could not save the images. Please try again.";
  } finally {
    saving.value = false;
  }
}
onBeforeUnmount(() => {
  release(logoPreview.value);
  release(backgroundPreview.value);
});
</script>
<style scoped>
.image-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rem;
}
.image-columns section {
  min-width: 0;
}
.image-columns h3 {
  margin-bottom: 1rem;
}
.image-preview {
  height: 14rem;
  border: 1px solid var(--rule);
  background: var(--color-base-200);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
  overflow: hidden;
}
.image-preview > img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.image-preview :deep(.utility-art) {
  max-height: 100%;
  width: 100%;
  border: 0;
}
.image-preview :deep(.utility-art img) {
  max-width: 4rem;
}
.image-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.5rem;
}
.file-input {
  font-size: 0.875rem;
  min-height: 44px;
  max-width: 100%;
}
@media (max-width: 700px) {
  .image-columns {
    grid-template-columns: 1fr;
  }
}
</style>
