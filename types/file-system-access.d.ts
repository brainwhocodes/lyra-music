// types/file-system-access.d.ts

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemPermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  // If you use more methods from FileSystemDirectoryHandle like getFileHandle, getDirectoryHandle, values, etc.,
  // their signatures would be added here.
}

interface FileSystemPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

type WellKnownDirectory =
  | 'desktop'
  | 'documents'
  | 'downloads'
  | 'music'
  | 'pictures'
  | 'videos';

interface DirectoryPickerOptions {
  id?: string;
  mode?: 'read' | 'readwrite';
  startIn?: FileSystemHandle | WellKnownDirectory;
}

declare global {
  interface Window {
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  // Define FileSystemDirectoryHandle in the global scope if not already picked up
  // This might be redundant if the interface above is correctly processed,
  // but ensures it's available.
  // eslint-disable-next-line no-var
  var FileSystemDirectoryHandle: {
    prototype: FileSystemDirectoryHandle;
    new(): FileSystemDirectoryHandle;
  };
}

// This export makes the file a module, which can be important for how TypeScript processes declaration files.
// If it causes issues or isn't strictly needed for global augmentations in your setup, it can be removed.
export {};
