import { PageLoader } from "@/components/ui/page-loader";

/** Route fallback — the shared centred board loader. See `components/ui/page-loader.tsx`. */
export default function SprintPlanningLoading() {
  return <PageLoader label="Loading sprint planning" />;
}
