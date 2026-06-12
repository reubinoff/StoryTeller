import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
}

let storage: Storage;
try {
  storage = window.localStorage;
} catch {
  storage = createMemoryStorage();
}

if (!storage) storage = createMemoryStorage();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: storage,
});

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});
