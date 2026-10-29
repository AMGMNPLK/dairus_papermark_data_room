import NextAuth from "next-auth";

import { authOptions } from "@/lib/core-auth";

export { authOptions } from "@/lib/core-auth";
export default NextAuth(authOptions);
