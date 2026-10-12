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
      { property: "og:title", content: "BLUE ORIGIN — Entrar" },
      { property: "og:description", content: "Entre ou crie a sua conta BLUE ORIGIN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        name: "description",
        content: "Entre ou crie a sua conta BLUE ORIGIN.",
      },
    ],
  }),
});
