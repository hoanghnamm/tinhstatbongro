import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Every panel announces its own step. The web build read the title off the
 * panel's own markup so no caller passed it twice; here the panel says it out
 * loud, which is the same idea with a type behind it.
 */
export function useAnnounce(text: string): void {
  useEffect(() => {
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
}
