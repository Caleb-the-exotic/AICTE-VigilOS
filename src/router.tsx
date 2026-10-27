import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { WorkspaceLoadingScreen } from "@/components/common/WorkspaceLoadingScreen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: () => (
      <WorkspaceLoadingScreen
        heading="Preparing your secure workspace"
        message="Loading application modules..."
      />
    ),
  });

  return router;
};

