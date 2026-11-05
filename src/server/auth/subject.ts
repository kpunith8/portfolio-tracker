import "server-only";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function subject() {
  const session = getKindeServerSession();
  if (!(await session.isAuthenticated()))
    throw new Error("Authentication required");
  const user = await session.getUser();
  if (!user?.id) throw new Error("Authentication required");
  return user.id;
}
