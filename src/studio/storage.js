// Structured storage keeps embedded meshes out of localStorage's small string quota.
let database;
function open() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open("boast-studio", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("projects");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = undefined;
        reject(request.error);
      };
    });
  return database;
}
export async function readStored(key) {
  const db = await open();
  const value = await new Promise((resolve, reject) => {
    const request = db.transaction("projects").objectStore("projects").get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (value !== undefined) return value;
  const legacy = localStorage.getItem(
    key === "autosave" ? "boast-autosave" : "boast-collection",
  );
  return legacy ? JSON.parse(legacy) : undefined;
}
export async function writeStored(key, value) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("projects", "readwrite");
    transaction.objectStore("projects").put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error || Error("Storage transaction cancelled."));
  });
}
