import { connection } from "next/server";

import Kitchen from "@/components/kitchen";
import { readState } from "@/lib/db";

export default async function Page() {
  await connection();
  return <Kitchen initialState={readState()} />;
}
