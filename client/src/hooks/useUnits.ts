import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type UnitSystem = 'metric' | 'imperial';

interface UseUnitsReturn {
    units: UnitSystem;
    isMetric: boolean;
    setUnits: (newUnits: UnitSystem) => void;
    toggleUnits: () => void;
}

export function useUnits(): UseUnitsReturn {
    const { user, org } = useAuth();
    const [units, setUnitsState] = useState<UnitSystem>('imperial'); // Default fallback

    // Load initial state
    useEffect(() => {
        if (!user) {
            setUnitsState('imperial'); // Guest fallback
            return;
        }

        // 1. Check local storage for user-specific override
        const storageKey = `unitsOverride_${user.uid}`;
        const localOverride = localStorage.getItem(storageKey) as UnitSystem | null;

        if (localOverride === 'metric' || localOverride === 'imperial') {
            setUnitsState(localOverride);
            return;
        }

        // 2. Fallback to org default if no local override
        if (org?.defaultUnits === 'metric' || org?.defaultUnits === 'imperial') {
            setUnitsState(org.defaultUnits);
        } else {
            // 3. Ultimate system default
            setUnitsState('imperial');
        }
    }, [user, org?.defaultUnits]);

    // Handle unit updates
    const setUnits = useCallback(
        (newUnits: UnitSystem) => {
            setUnitsState(newUnits);

            // Persist to local storage if logged in
            if (user) {
                const storageKey = `unitsOverride_${user.uid}`;
                localStorage.setItem(storageKey, newUnits);
            }
        },
        [user]
    );

    const toggleUnits = useCallback(() => {
        setUnits(units === 'metric' ? 'imperial' : 'metric');
    }, [units, setUnits]);

    return {
        units,
        isMetric: units === 'metric',
        setUnits,
        toggleUnits,
    };
}
