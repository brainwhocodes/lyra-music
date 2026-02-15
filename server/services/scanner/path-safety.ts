import { isAbsolute, relative, resolve, sep } from 'node:path';

function normalizeForPlatform(input: string): string {
  return process.platform === 'win32' ? input.toLowerCase() : input;
}

/**
 * Returns true when candidate is inside root (or equal to root).
 * Uses relative path semantics to avoid prefix-based path traversal bugs.
 */
export function isPathInsideRoot(candidate: string, root: string): boolean {
  const resolvedCandidate = normalizeForPlatform(resolve(candidate));
  const resolvedRoot = normalizeForPlatform(resolve(root));

  if (resolvedCandidate === resolvedRoot) {
    return true;
  }

  const rel = relative(resolvedRoot, resolvedCandidate);
  if (!rel || rel === '.') {
    return true;
  }

  return !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel);
}

export function isPathInsideAllowedRoots(candidate: string, allowedRoots: string[]): boolean {
  return allowedRoots.some((root) => isPathInsideRoot(candidate, root));
}
