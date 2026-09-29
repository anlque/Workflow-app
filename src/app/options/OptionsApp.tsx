import {
  WorkflowStudio,
  type WorkflowStudioDependencies,
} from '../workflow-studio/WorkflowStudio';

export function OptionsApp({
  dependencies,
}: Readonly<{ dependencies: WorkflowStudioDependencies }>) {
  return <WorkflowStudio dependencies={dependencies} />;
}
