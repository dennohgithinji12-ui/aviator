/**
 * Re-export AuthManager as PuterAuthManager for backward compatibility
 * Puter.js dependency has been decommissioned in favor of native Aviator Auth
 */
import { AuthManager } from './auth-manager.js';

export class PuterAuthManager extends AuthManager {
  constructor(stakingManager, soundEngine, onAuthChange) {
    super(stakingManager, soundEngine, onAuthChange);
  }
}

export { AuthManager };
