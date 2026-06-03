# Deployment

Bug Defence is a static site, hosted on **Cloudflare Pages** and auto-deployed
on every push to `main` via **GitHub Actions**. Total cost: **€0** (Pages free
tier + unlimited Actions minutes on a public repo).

- **Production:** <https://ritscher.ch>
- **Pages default:** <https://bug-defence.pages.dev>
- **Pages project:** `bug-defence` (production branch `main`)
- **Workflow:** [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

---

## How it works

On every push to `main` (or a manual run via the Actions tab), the workflow:

1. Checks out the repo.
2. **Assembles a clean web root** in `dist/`: copies `Bug Defence.html` →
   `dist/index.html` (so the game loads at the domain root, no space-in-filename
   URL) and copies `css/` + `js/`.
3. Installs `wrangler` and runs
   `wrangler pages deploy dist --project-name=bug-defence --branch=main`.
   Because the project's production branch is `main`, this is a **production**
   deployment.

```yaml
# .github/workflows/deploy.yml (essentials)
on:
  push: { branches: [main] }
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Assemble site
        run: |
          mkdir -p dist
          cp "Bug Defence.html" dist/index.html
          cp -r css js dist/
      - name: Deploy to Cloudflare Pages
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: |
          npm i -g wrangler@3
          wrangler pages deploy dist --project-name=bug-defence --branch=main --commit-dirty=true
```

---

## Reproducing the setup from scratch

### 1. Cloudflare API token
Dashboard → **My Profile → API Tokens → Create Token → Custom token**:
- Permission: **Account → Cloudflare Pages → Edit**
- Account Resources: your account
- Copy the token (shown once).

### 2. Account ID
Dashboard → any account/zone overview → **Account Details → Account ID** (copy button).

### 3. GitHub repository secrets
From the repo (with the `gh` CLI authenticated):

```bash
gh secret set CLOUDFLARE_API_TOKEN     # paste the token (input is hidden)
gh secret set CLOUDFLARE_ACCOUNT_ID    # paste the account id
```

(Or repo **Settings → Secrets and variables → Actions → New repository secret**.)

### 4. Create the Pages project once
The CI token can deploy into an existing project but **cannot reliably create
one** (the API returns a generic `8000000` error — see Gotchas). So create it
once locally with full OAuth permissions:

```bash
npx wrangler login                                              # browser OAuth → Allow
npx wrangler pages project create bug-defence --production-branch=main
```

Setting `--production-branch=main` makes it match the workflow's `--branch=main`,
so CI deploys land in production.

> Dashboard alternative: **Workers & Pages → Create application → Pages → Upload
> assets**, name it `bug-defence`, upload any file to create it, then set the
> production branch to `main` in the project settings.

### 5. First deploy
Push to `main` (or re-run the workflow). The Actions log ends with
`✨ Deployment complete!` and a `*.bug-defence.pages.dev` URL.

```bash
gh run rerun --failed     # if an earlier run failed before secrets/project existed
```

### 6. Custom domain
Dashboard → **Workers & Pages → bug-defence → Custom domains → Set up a domain**
→ `ritscher.ch` (the apex; or a subdomain like `bugdefence.ritscher.ch`). Since
`ritscher.ch` is already on Cloudflare, the DNS record is created automatically
and SSL provisions in ~1 minute.

---

## Operating it

- **Deploy:** just `git push` to `main`. Done.
- **Manual deploy:** Actions tab → *Deploy to Cloudflare Pages* → *Run workflow*.
- **Check status:** `gh run list --limit 1` / `gh run watch <id>`.
- **Verify live:** `curl -sI https://ritscher.ch` (expect `200`).
- **Rollback:** Cloudflare dashboard → project → *Deployments* → pick a previous
  deployment → *Rollback*. (Or revert the commit and push.)

---

## Cost

| Item | Tier | Notes |
|------|------|-------|
| Cloudflare Pages | Free | Unlimited requests + bandwidth, free SSL, free custom domains |
| Pages builds | n/a | We use **Direct Upload** from CI — does **not** count against the 500-builds/month limit |
| GitHub Actions | Free | Unlimited minutes on public repos |

---

## Gotchas hit while setting this up

- **`8000000` on project create.** `wrangler pages project create` via the CI
  API token failed with a generic "unknown error". Project creation needs full
  permissions the scoped token doesn't reliably grant — so we create the project
  **once via `wrangler login` (OAuth)** and let CI only *deploy*. The deploy step
  authenticates fine with the scoped token.
- **`8000007` project not found.** The CI deploy fails until the project exists.
  Expected on the very first runs — create the project (step 4), then re-run.
- **First runs are red until secrets + project exist.** That's normal; nothing to
  fix beyond completing steps 3–4 and re-running.
- **Production vs. preview.** A deploy is *production* only when `--branch`
  matches the project's production branch. We use `main` for both. If you create
  the project with a different production branch, change `--branch` to match (or
  the custom domain won't update).
- **Entry filename.** The repo's entry is `Bug Defence.html` (with a space). The
  build step renames it to `index.html` in `dist/` so the site root serves the
  game cleanly.
- **Caching after deploy.** If you see stale assets right after a deploy, hard-
  reload (Cmd/Ctrl+Shift+R). A `_headers` file could pin long cache on `css/`+`js/`
  and always-fresh HTML if this becomes annoying.
