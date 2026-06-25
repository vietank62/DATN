import { createContext } from 'react';
import type { LocationState } from '../types/location';

export const LocationContext = createContext<LocationState | undefined>(undefined);

