import { WorkspaceModuleHeader } from "@/components/workspace/WorkspaceModule";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return <WorkspaceModuleHeader eyebrow={eyebrow} title={title} description={description} icon="store" actions={action} />;
}
