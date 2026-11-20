import {
  WorkflowStudio,
  type WorkflowStudioDependencies,
} from '../workflow-studio/WorkflowStudio';

export function OptionsApp({
  dependencies,
  onNavigateToFocus,
}: Readonly<{
  dependencies: WorkflowStudioDependencies;
  onNavigateToFocus(): void | Promise<void>;
}>) {
  return (
    <WorkflowStudio
      dependencies={dependencies}
      onNavigateToFocus={onNavigateToFocus}
    />
  );
}
