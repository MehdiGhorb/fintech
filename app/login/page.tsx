import { Suspense } from "react";
import LoginPage from "./page-client";

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
