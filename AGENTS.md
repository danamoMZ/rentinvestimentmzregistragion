<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Personal information uses its own `/app/personal-info` content route, linked from Conta, to keep account settings separate from the account overview.
- Avatar uploads are decoded and cropped to a small JPEG before persisting in the existing profile avatar field, avoiding arbitrary file formats and new storage permissions.
- Cache clearing only removes browser Cache Storage and non-identity query results; it must preserve authentication storage and service worker registration.
