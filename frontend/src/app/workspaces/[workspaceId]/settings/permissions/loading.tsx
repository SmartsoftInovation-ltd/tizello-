import { PageLoader } from "@/components/ui/page-loader";

/** Route fallback — the shared centred board loader. See `components/ui/page-loader.tsx`. */
export default function PermissionsLoading() {
  return <PageLoader label="Loading roles and permissions" />;
}
