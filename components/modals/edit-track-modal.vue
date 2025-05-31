<template>
    <dialog :class="['modal', isOpen ? 'modal-open' : '']">
        <div class="modal-box">
            <form @submit.prevent="onSubmit">
                
            </form>
        </div>
    </dialog>
</template>
<script setup lang="ts">
const props = defineProps<{ open: boolean }>();
const emit = defineEmits(['close']);

const isOpen = ref(props.open);

watch(() => props.open, (newValue: boolean) => {
    isOpen.value = newValue;
});

const closeModal = () => {
    isOpen.value = false;
    emit('close');
};
</script>