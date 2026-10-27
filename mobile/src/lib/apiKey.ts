import * as SecureStore from 'expo-secure-store';

// The API's X-Api-Key, kept in the iOS Keychain. It is pasted into Settings once and never
// goes in .env or the source: EXPO_PUBLIC_ values are compiled into the JavaScript bundle,
// which anyone with the app could read. Never log the key or put it in an error message.
const KEY = 'lifetracker.apiKey';

// Only readable while the phone is unlocked, and not copied to backups or a new phone.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const getApiKey = () => SecureStore.getItemAsync(KEY, options);

export const saveApiKey = (value: string) => SecureStore.setItemAsync(KEY, value.trim(), options);

export const clearApiKey = () => SecureStore.deleteItemAsync(KEY, options);
