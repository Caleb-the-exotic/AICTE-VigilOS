import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mail")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/comms", search: { ...search, tab: "mail" } });
  },
});
