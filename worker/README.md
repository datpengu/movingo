# Journey API Worker

This Worker is the private API boundary for the GitHub Pages journey search. It forwards requests to ResRobot without exposing the API key to site visitors.

## Deploy

1. Install Wrangler or use `npx wrangler`, then authenticate with Cloudflare.
2. From this directory, add the key as a Worker Secret:

   ```sh
   npx wrangler secret put RESROBOT_API_KEY
   ```

3. Deploy:

   ```sh
   npx wrangler deploy
   ```

4. Copy the deployed Worker HTTPS URL into `../search-journey/config.js` as `window.JOURNEY_API_BASE`.

The Worker accepts browser requests only from `https://datpengu.github.io`. Keep the ResRobot key out of Git, GitHub Pages, and `config.js`.
