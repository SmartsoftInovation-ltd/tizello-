import { PageLoader } from "@/components/ui/page-loader";

/** Route fallback for the role editor — the shared centred loader. */
export default function RoleEditorLoading() {
  return <PageLoader label="Loading role" />;
}
