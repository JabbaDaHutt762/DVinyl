# DVinyl fork — Unraid deployment

Fork: https://github.com/JabbaDaHutt762/DVinyl
Image: `ghcr.io/jabbadahutt762/dvinyl:latest`
Starting point: upstream DVinyl 3.3.0.

## First customization

- Default Discogs music search returns *master albums* (one per master ID).
- Clicking a master lists that album's physical pressings; select one to
  confirm and save, with year/country/label filters.
- "Search exact pressings" retains the original release-level search.
- This is used by the shared Add Record flow, including Add from Wishlist.
- The fork builds into our GHCR package and does not publish to upstream Docker Hub.

## Deployment (preserve existing collection)

1. Enable GitHub Actions for this fork, if GitHub prompts you to enable workflows.
2. Merge the feature PR **after tests pass**. The main-branch workflow tests and
   publishes `ghcr.io/jabbadahutt762/dvinyl:latest`.
3. Verify the GHCR package exists. To pull without Docker credentials, set the
   package visibility to **public** under its GitHub package settings.
4. Before replacing the image, back up the MongoDB `dvinyl` database and DVinyl
   uploads directory to Tower, and verify backups are not empty.
   Example (replace the database container name and any auth options):

   ```sh
   mkdir -p /mnt/remotes/TOWER_Jarvis_Backups/DVinyl
   docker exec YOUR_MONGODB_CONTAINER mongodump --db=dvinyl --archive \
     > /mnt/remotes/TOWER_Jarvis_Backups/DVinyl/dvinyl.archive
   ```

5. Unraid > Docker > DVinyl > Edit. Change the **Repository** field only to
   `ghcr.io/jabbadahutt762/dvinyl:latest`. Leave the existing MongoDB URL,
   network, ports, application volume, JWT/session secrets, and Discogs token
   **unchanged**. Apply, then check your collection and search.
6. If rollback is needed, restore Repository to `kyonew/dvinyl:latest`.
   Do not remove appdata or MongoDB.

The separate template `unraid-template/dvinyl-fork.xml` is for *new installs*.
Do not create a second DVinyl container sharing the live database as a shortcut.

## Known limitation

Discogs currently returns at most 100 masters or pressings per search, so not
every result of a very broad artist query is reachable yet. The immediate
goal is eliminating repeated pressings from the first album search page.
