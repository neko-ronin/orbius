// Saves live in the repo's own saves/ folder, written through a dev-server endpoint,
// so they survive a cleared browser profile and can be read, diffed and grepped like
// anything else in the tree. IndexedDB stays as the fallback for a built copy, where
// no dev server exists to write files.
const API = "/__boast";
let disk;
async function onDisk() {
  if (disk === undefined)
    disk = await fetch(`${API}/ping`, { headers: { "x-boast": "1" } })
      .then((r) => r.ok)
      .catch(() => false);
  return disk;
}
async function writeState(key, value) {
  return (await call("PUT", "state", key, JSON.stringify(value, null, 2)))
    .saved;
}
async function call(method, area, name, body) {
  const r = await fetch(`${API}/${area}${name ? `/${name}` : ""}`, {
    method,
    headers: { "x-boast": "1", "Content-Type": "application/json" },
    body,
  });
  if (!r.ok)
    throw Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
}
// A saved project is a file in saves/projects. These are what the Open dialog lists.
export async function listProjects() {
  if (!(await onDisk())) return null;
  return (await call("GET", "projects")).names;
}
export async function readProject(name) {
  return (await call("GET", "projects", name)).data;
}
export async function writeProject(name, value) {
  if (!(await onDisk())) return null;
  return (await call("PUT", "projects", name, JSON.stringify(value, null, 2)))
    .saved;
}
export async function deleteProject(name) {
  if (await onDisk()) await call("DELETE", "projects", name);
}
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
  if (await onDisk()) {
    const value = await call("GET", "state", key)
      .then((r) => r.data)
      .catch(() => undefined);
    if (value !== undefined) return value;
  }
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
  if (await onDisk()) return writeState(key, value);
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
