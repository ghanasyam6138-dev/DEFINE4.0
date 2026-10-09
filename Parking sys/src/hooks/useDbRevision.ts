import { useSyncExternalStore } from 'react';
import { dbService } from '../services/dbService';

/**
 * Re-renders the calling component whenever the database changes, whether the
 * change was made on this device or arrived live from another device.
 * Returns a revision number that can be used as an effect dependency.
 */
export function useDbRevision(): number {
    return useSyncExternalStore(
        (onChange) => dbService.subscribe(onChange),
        () => dbService.getVersion(),
        () => 0
    );
}
