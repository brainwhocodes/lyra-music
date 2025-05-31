<template>
    <dialog>
        <div class="modal">
            <div class="modal-box">
                <h3 class="font-bold text-lg mb-4">Confirmation</h3>
                <p class="mb-4">Are you sure you want to perform this action?</p>
                <div class="modal-action">
                    <button class="btn btn-outline" @click="closeModal">Cancel</button>
                    <button class="btn btn-primary" @click="confirmAction">Confirm</button>
                </div>
            </div>
        </div>
    </dialog>
</template>

<script setup lang="ts">

</script>
