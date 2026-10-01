export interface WorkspaceModule {
  folder: string;
  packageName: string;
}

export function buildModuleLoadersSource(modules: WorkspaceModule[]): string;
export function readWorkspaceModules(): WorkspaceModule[];
