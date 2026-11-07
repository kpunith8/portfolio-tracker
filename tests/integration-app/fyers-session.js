export async function owner() {
  return "test-owner";
}

export async function getToken() {
  return null;
}

export function seal() {
  throw new Error("Not available in test fixture");
}

export function unseal() {
  return null;
}

export async function setCookie() {
  throw new Error("Not available in test fixture");
}
