import { useState } from 'react';

// Kept separate so route-derived launcher state is initialized before any app lookup.
export const useLauncherRouteState = (initialAppId?: string) =>
  useState<string>(() => initialAppId || '');
