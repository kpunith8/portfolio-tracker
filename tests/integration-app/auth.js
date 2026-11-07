import { cookies } from "next/headers";

export function getKindeServerSession() {
  return {
    isAuthenticated: async () =>
      (await cookies()).get("fixture-unauth")?.value !== "1",
    getUser: async () => ({ id: "test-owner", given_name: "Test" }),
  };
}
