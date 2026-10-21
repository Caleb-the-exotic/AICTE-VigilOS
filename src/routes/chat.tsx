import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/chat")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/comms", search: { ...search, tab: "chat" } });
  },
});
