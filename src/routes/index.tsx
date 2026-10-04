import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/auth",
      search: { mode: "login" },
    });
  },
  head: () => ({
    meta: [
      { title: "BLUE ORIGIN — Entrar" },
      {
        name: "description",
        content: "Entre ou crie a sua conta BLUE ORIGIN.",
      },
    ],
  }),
});
