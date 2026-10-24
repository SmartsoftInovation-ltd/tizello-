import { PageLoader } from "@/components/ui/page-loader";

/** Route fallback — the shared centred board loader. See `components/ui/page-loader.tsx`. */
export default function SprintBreakdownLoading() {
  return <PageLoader label="Loading the sprint breakdown" />;
}
