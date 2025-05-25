/**
 * @file Main scanner module that handles music library scanning and metadata extraction.
 * This file re-exports all functionality from the modular scanner implementation.
 */

// Import and re-export the scanner module
export * from './scanner/index';

// Export default for backward compatibility
import { scanner } from './scanner/index';
export default scanner;
